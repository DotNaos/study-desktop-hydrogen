import { createLogger } from '@aryazos/ts-base/logging';
import { MoodleResource } from './types';
import { decodeHtmlEntities, inferFileTypeFromMoodleIconSrc } from './utils';

const logger = createLogger('com.aryazos.providers.moodle.parsing');

/**
 * Parse resources from course HTML.
 * Extracts section IDs from data-id attributes on section elements.
 */
export function parseResources(
    html: string,
    courseId: string,
    baseUrl: string,
): MoodleResource[] {
    const resources: MoodleResource[] = [];
    const seenIds = new Set<string>(); // Track across all sections to prevent duplicates

    // Find all section <li> elements with data-id attribute
    // Pattern: <li id="section-X" ... data-id="SECTIONID" ... data-sectionname="NAME">
    const sectionRegex =
        /<li[^>]*id="section-\d+"[^>]*data-id="(\d+)"[^>]*data-sectionname="([^"]*)"[^>]*>/gi;

    interface SectionInfo {
        index: number;
        id: string;
        name: string;
    }

    const sections: SectionInfo[] = [];
    let match;

    while ((match = sectionRegex.exec(html)) !== null) {
        sections.push({
            index: match.index,
            id: match[1],
            name: decodeHtmlEntities(match[2]),
        });
    }

    logger.debug('Found sections with IDs', {
        count: sections.length,
        sections: sections.map((s) => ({ id: s.id, name: s.name })),
    });

    // If no sections found with data-id, fall back to old behavior
    if (sections.length === 0) {
        logger.debug('No sections with data-id found, using fallback');
        // Create a single "General" section with no ID
        extractResourcesFromHtml(
            html,
            courseId,
            undefined,
            'General',
            resources,
            seenIds,
            baseUrl,
        );
        return resources;
    }

    // Sort sections by their position in HTML
    sections.sort((a, b) => a.index - b.index);

    // Process each section
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextSectionIndex =
            i < sections.length - 1 ? sections[i + 1].index : html.length;
        const sectionHtml = html.substring(section.index, nextSectionIndex);

        logger.debug(`Processing section`, {
            id: section.id,
            name: section.name,
        });

        // Find resources in this section
        extractResourcesFromHtml(
            sectionHtml,
            courseId,
            section.id,
            section.name,
            resources,
            seenIds,
            baseUrl,
        );
    }

    return resources;
}

function extractResourcesFromHtml(
    html: string,
    courseId: string,
    sectionId: string | undefined,
    sectionName: string,
    resources: MoodleResource[],
    seenIds: Set<string>,
    baseUrl: string,
) {
    // Match each activity list item as a contained unit
    // The HTML structure is: <li class="activity resource modtype_resource...">...<div class="activity-item" data-activityname="NAME">...</li>
    // We need to extract the ID from the link inside and the name from data-activityname

    // Pattern to match each <li class="activity resource...">...</li> block
    const activityItemRegex =
        /<li[^>]*class="[^"]*activity[^"]*resource[^"]*modtype_resource[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

    let liMatch;
    while ((liMatch = activityItemRegex.exec(html)) !== null) {
        const liContent = liMatch[1];

        // Extract the resource ID from the link
        const idMatch = liContent.match(/\/mod\/resource\/view\.php\?id=(\d+)/);
        if (!idMatch) continue;

        const id = idMatch[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        // Extract name from data-activityname attribute (most reliable)
        let name: string | undefined;
        const activityNameMatch = liContent.match(
            /data-activityname="([^"]+)"/,
        );
        if (activityNameMatch) {
            name = decodeHtmlEntities(activityNameMatch[1].trim());
        }

        // Fallback: try instancename span
        if (!name) {
            const instanceNameMatch = liContent.match(
                /<span[^>]*class="[^"]*instancename[^"]*"[^>]*>([^<]+)/,
            );
            if (instanceNameMatch) {
                name = decodeHtmlEntities(instanceNameMatch[1].trim());
            }
        }

        // Skip if we couldn't extract a name
        if (!name) {
            logger.debug(`Skipping resource without name`, { id, sectionName });
            continue;
        }

        // Extract file type from icon or badge
        let fileType: string | undefined = 'pdf'; // Default to PDF
        const iconMatch = liContent.match(/src="[^"]*\/f\/([a-z0-9]+)/i);
        if (iconMatch) {
            fileType = inferFileTypeFromMoodleIconSrc(iconMatch[0]) || 'pdf';
        }
        // Also check badge text (e.g., "PDF", "Word document", etc.)
        const badgeMatch = liContent.match(
            /class="activitybadge[^"]*"[^>]*>\s*([^<]+)/,
        );
        if (badgeMatch) {
            const badgeText = badgeMatch[1].trim().toLowerCase();
            if (badgeText === 'pdf') fileType = 'pdf';
            else if (badgeText.includes('word')) fileType = 'docx';
            else if (
                badgeText.includes('excel') ||
                badgeText.includes('spreadsheet')
            )
                fileType = 'xlsx';
            else if (
                badgeText.includes('powerpoint') ||
                badgeText.includes('presentation')
            )
                fileType = 'pptx';
        }

        logger.debug(`Matched resource`, { id, name, sectionName, fileType });

        resources.push({
            id,
            name,
            url: `${baseUrl}/mod/resource/view.php?id=${id}&redirect=1`,
            type: 'resource',
            courseId,
            sectionId,
            sectionName,
            fileType,
        });
    }

    logger.debug(`Extracted resources from section`, {
        sectionName,
        resourceCount: resources.length,
        resourceIds: [...seenIds],
    });

    // Match folder links - these will be shown as expandable folders
    const folderRegex =
        /<li[^>]*class="[^"]*activity[^"]*folder[^"]*modtype_folder[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let folderMatch;

    while ((folderMatch = folderRegex.exec(html)) !== null) {
        const liContent = folderMatch[1];

        // Extract folder ID from link
        const idMatch = liContent.match(/\/mod\/folder\/view\.php\?id=(\d+)/);
        if (!idMatch) continue;

        const id = `folder-${idMatch[1]}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        // Extract name from data-activityname or instancename
        let name: string | undefined;
        const activityNameMatch = liContent.match(
            /data-activityname="([^"]+)"/,
        );
        if (activityNameMatch) {
            name = decodeHtmlEntities(activityNameMatch[1].trim());
        }
        if (!name) {
            const instanceNameMatch = liContent.match(
                /<span[^>]*class="[^"]*instancename[^"]*"[^>]*>([^<]+)/,
            );
            if (instanceNameMatch) {
                name = decodeHtmlEntities(instanceNameMatch[1].trim());
            }
        }

        if (!name) continue;

        resources.push({
            id,
            name,
            url: `${baseUrl}/mod/folder/view.php?id=${idMatch[1]}`,
            type: 'folder',
            courseId,
            sectionId,
            sectionName,
        });
    }
}
