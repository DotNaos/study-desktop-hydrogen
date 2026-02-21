import { createLogger } from '@aryazos/ts-base/logging';
import pdf from 'pdf-parse';

const logger = createLogger('com.aryazos.study-sync.textExtractor');

export interface TextExtractionResult {
    text: string;
    pages: number;
    method: 'native' | 'ocr' | 'empty';
}

/**
 * Extract text from a PDF buffer.
 * Uses pdf-parse for native text extraction.
 * Falls back to 'empty' if no text can be extracted (OCR would require tesseract).
 */
export async function extractTextFromPdf(
    buffer: Buffer,
): Promise<TextExtractionResult> {
    try {
        // pdf-parse expects Buffer, but accepts Uint8Array also
        const data = await pdf(buffer);
        const text = data.text?.trim() || '';

        if (text.length > 50) {
            logger.info('PDF text extracted via native method', {
                pages: data.numpages,
                textLength: text.length,
            });
            return {
                text,
                pages: data.numpages,
                method: 'native',
            };
        }

        // Text too short - likely scanned PDF
        logger.warn('PDF has minimal text, may be scanned/image-based', {
            pages: data.numpages,
            textLength: text.length,
        });

        return {
            text: text || '',
            pages: data.numpages,
            method: 'empty',
        };
    } catch (error) {
        logger.error('Failed to extract PDF text', { error });
        return {
            text: '',
            pages: 0,
            method: 'empty',
        };
    }
}

/**
 * Simple in-memory cache for extracted text.
 * Key is node ID, value is extraction result.
 */
class TextCache {
    private cache = new Map<string, TextExtractionResult>();

    get(nodeId: string): TextExtractionResult | undefined {
        return this.cache.get(nodeId);
    }

    set(nodeId: string, result: TextExtractionResult): void {
        this.cache.set(nodeId, result);
    }

    has(nodeId: string): boolean {
        return this.cache.has(nodeId);
    }

    clear(): void {
        this.cache.clear();
    }
}

export const textCache = new TextCache();
