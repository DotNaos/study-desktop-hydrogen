import { createLogger } from '@aryazos/ts-base/logging';
import { minimatch } from 'minimatch';
import { remoteCache, type CachedRemoteNode } from '../remoteCache';
import { getExportRoot } from './state';
import type { PredictionConfidence, PredictionResult } from './types';

const logger = createLogger('com.aryazos.study-sync.downloader.predictions');

/**
 * Generate predictions for a local path.
 * Uses topmost-first strategy: if a parent folder is mapped to a remote folder,
 * predictions for children prioritize resources within that remote folder.
 *
 * @param localName - The local file/folder name to find matches for
 * @param parentRemoteId - If the parent is already mapped, scope search to this remote folder
 * @returns Ranked list of predictions
 */
export async function fetchPredictions(
    localName: string,
    _localStack: any[],
    parentRemoteId?: string,
): Promise<PredictionResult[]> {
    const rootPath = getExportRoot();
    if (!rootPath) {
        return [];
    }

    const results: PredictionResult[] = [];
    const seenIds = new Set<string>();

    // Strategy 1: If parent is mapped, search within that scope first
    if (parentRemoteId) {
        const scopedResults = await searchWithinScope(
            localName,
            parentRemoteId,
        );
        for (const result of scopedResults) {
            if (!seenIds.has(result.remoteId)) {
                seenIds.add(result.remoteId);
                results.push(result);
            }
        }
    }

    // Strategy 2: Global search (lower priority)
    const globalResults = await searchGlobal(localName);
    for (const result of globalResults) {
        if (!seenIds.has(result.remoteId)) {
            seenIds.add(result.remoteId);
            // Downgrade confidence for global results if we already have scoped results
            const adjusted =
                results.length > 0
                    ? {
                          ...result,
                          confidence: downgradeConfidence(result.confidence),
                      }
                    : result;
            results.push(adjusted);
        }
    }

    return results;
}

/**
 * Search for matches within a specific remote folder scope.
 */
async function searchWithinScope(
    localName: string,
    parentRemoteId: string,
): Promise<PredictionResult[]> {
    const results: PredictionResult[] = [];

    // Get all children of the parent folder
    const children = await remoteCache.getChildren(parentRemoteId);

    // Exact name match (high confidence)
    const exactMatch = children.find(
        (child) =>
            normalizeForMatch(child.name) === normalizeForMatch(localName),
    );
    if (exactMatch) {
        results.push({
            remoteId: exactMatch.id,
            remoteName: exactMatch.name,
            remotePath: buildRemotePath(exactMatch),
            confidence: 'high',
            reason: 'Exact name match within parent scope',
            fileExtension: exactMatch.fileExtension,
            type: exactMatch.type,
        });
    }

    // Fuzzy matches (medium confidence)
    // Fuzzy matches (ranked by score)
    const scoredMatches = children
        .filter((c) => c.id !== exactMatch?.id)
        .map((child) => ({
            child,
            score: calculateMatchScore(localName, child.name),
        }))
        .sort((a, b) => b.score - a.score);

    for (const { child, score } of scoredMatches.slice(0, 3)) {
        const confidence: PredictionConfidence =
            score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
        results.push({
            remoteId: child.id,
            remoteName: child.name,
            remotePath: buildRemotePath(child),
            confidence,
            reason: `Best match in scope (Score: ${Math.round(score * 100)}%)`,
            fileExtension: child.fileExtension,
            type: child.type,
        });
    }

    return results;
}

/**
 * Global search across all indexed remote nodes.
 */
async function searchGlobal(localName: string): Promise<PredictionResult[]> {
    const results: PredictionResult[] = [];

    // Get all remote nodes and score them
    const allNodes = await remoteCache.getAllNodes();

    // Exact matches first (high confidence)
    const exactMatches = allNodes.filter(
        (m) => normalizeForMatch(m.name) === normalizeForMatch(localName),
    );

    for (const match of exactMatches.slice(0, 3)) {
        results.push({
            remoteId: match.id,
            remoteName: match.name,
            remotePath: buildRemotePath(match),
            confidence: 'high',
            reason: 'Exact name match',
            fileExtension: match.fileExtension,
            type: match.type,
        });
    }

    // Fuzzy matches with scoring - filter out very low scores
    const scoredMatches = getFuzzyMatchesWithScores(
        localName,
        allNodes.filter((n) => !exactMatches.some((e) => e.id === n.id)),
    ).filter((m) => m.score >= 0.15); // Minimum threshold - ignore irrelevant matches

    logger.debug(
        `[Predictions] Top 3 global scored matches:`,
        scoredMatches.slice(0, 3).map((m) => `${m.node.name} (${m.score})`),
    );

    for (const { node, score } of scoredMatches.slice(0, 10)) {
        const confidence: PredictionConfidence =
            score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low';
        results.push({
            remoteId: node.id,
            remoteName: node.name,
            remotePath: buildRemotePath(node),
            confidence,
            reason: `Match score: ${Math.round(score * 100)}%`,
            fileExtension: node.fileExtension,
            type: node.type,
        });
    }

    return results;
}

/**
 * Normalize a name for matching (lowercase, remove common punctuation).
 */
function normalizeForMatch(name: string): string {
    return name
        .toLowerCase()
        .replace(/[_\-\.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate fuzzy match score between local and remote names.
 * Returns a score from 0 to 1, where higher is better.
 */
function calculateMatchScore(localName: string, remoteName: string): number {
    const localWords = extractSignificantWords(localName);
    const remoteWords = extractSignificantWords(remoteName);

    if (localWords.length === 0 || remoteWords.length === 0) {
        return 0;
    }

    let matchedLocalWords = 0;
    let matchedRemoteWords = 0;

    // Check how many local words are found in remote
    for (const lw of localWords) {
        for (const rw of remoteWords) {
            if (wordsMatch(lw, rw)) {
                matchedLocalWords++;
                break;
            }
        }
    }

    // Check how many remote words are found in local
    for (const rw of remoteWords) {
        for (const lw of localWords) {
            if (wordsMatch(lw, rw)) {
                matchedRemoteWords++;
                break;
            }
        }
    }

    // Jaccard-like scoring: prioritize local word coverage
    // (we care more that local words match than all remote words are covered)
    const localCoverage = matchedLocalWords / localWords.length;
    const remoteCoverage = matchedRemoteWords / remoteWords.length;

    // Weight local coverage more heavily (0.7 vs 0.3)
    return localCoverage * 0.7 + remoteCoverage * 0.3;
}

/**
 * Extract significant words (filters out stopwords and short words).
 */
function extractSignificantWords(name: string): string[] {
    const stopwords = new Set([
        'the',
        'a',
        'an',
        'and',
        'or',
        'for',
        'of',
        'to',
        'in',
        'on',
        'at',
        'with',
        'by',
        'from',
        'as',
        'is',
        'was',
        'are',
        'were',
        'be',
        'been',
        'und',
        'für',
        'mit',
        'von',
        'zu',
        'im',
        'am',
        'als',
        'ein',
        'eine',
    ]);

    return normalizeForMatch(name)
        .split(' ')
        .filter((word) => word.length >= 2 && !stopwords.has(word));
}

/**
 * Check if two words match (exact, prefix, or substring).
 */
function wordsMatch(word1: string, word2: string): boolean {
    // Exact match
    if (word1 === word2) return true;

    // One contains the other (for compound words)
    if (word1.length >= 3 && word2.length >= 3) {
        if (word1.includes(word2) || word2.includes(word1)) return true;
    }

    // Prefix match (for partial typing like "algo" → "algorithmen")
    if (word1.length >= 3 && word2.startsWith(word1)) return true;
    if (word2.length >= 3 && word1.startsWith(word2)) return true;

    return false;
}

/**
 * Get all fuzzy matches sorted by score.
 */
function getFuzzyMatchesWithScores(
    localName: string,
    candidates: CachedRemoteNode[],
): { node: CachedRemoteNode; score: number }[] {
    return candidates
        .map((node) => ({
            node,
            score: calculateMatchScore(localName, node.name),
        }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Build a human-readable path from a remote node record.
 */
function buildRemotePath(node: CachedRemoteNode): string {
    // For now, just return the name. In future, we could build the full path.
    return node.name;
}

/**
 * Downgrade confidence level.
 */
function downgradeConfidence(
    confidence: PredictionConfidence,
): PredictionConfidence {
    switch (confidence) {
        case 'high':
            return 'medium';
        case 'medium':
            return 'low';
        default:
            return 'low';
    }
}

/**
 * Check if a local path should be ignored based on ignore rules.
 * This is used to skip predictions for already-ignored items.
 */
export async function shouldIgnore(
    localPath: string,
    _localName: string,
    _isFolder: boolean,
    _fileExtension?: string,
): Promise<{ ignored: boolean; reason?: string }> {
    const rootPath = getExportRoot();
    if (!rootPath) {
        return { ignored: false };
    }

    const { listIgnoreRules } = await import('./store');
    const rules = await listIgnoreRules(rootPath);

    // Check path and all parent paths against rules
    const segments = localPath.split('/');
    for (let i = segments.length; i >= 1; i--) {
        const subPath = segments.slice(0, i).join('/');
        for (const rule of rules) {
            if (minimatch(subPath, rule.pattern, { dot: true })) {
                return {
                    ignored: true,
                    reason: `Matches pattern: ${rule.pattern}`,
                };
            }
        }
    }

    return { ignored: false };
}
