export function inferFileTypeFromMoodleIconSrc(iconSrc: string): string | undefined {
  // Moodle commonly uses icons like: /theme/image.php/boost/core/123/f/pdf-24
  // or /pix/f/document-24.png etc.
  const match = iconSrc.match(/\/f\/([a-z0-9]+)(?:[-/?]|$)/i);
  const token = match?.[1]?.toLowerCase();
  if (!token) return undefined;

  // Normalize common Moodle icon tokens to real file extensions.
  switch (token) {
    case "pdf":
      return "pdf";
    case "document":
      return "doc";
    case "powerpoint":
      return "ppt";
    case "spreadsheet":
      return "xls";
    case "archive":
      return "zip";
    case "image":
      return "png";
    case "audio":
      return "mp3";
    case "video":
      return "mp4";
    case "text":
      return "txt";
    default:
      return undefined;
  }
}

/**
 * Clean up Moodle course names by removing redundant info.
 *
 * Examples:
 * - "Mathematik II (cds-402) FS25" → "Mathematik II"
 * - "2025 HS FHGR CDS Numerische Methoden" → "Numerische Methoden"
 * - "Datenbanken und Datenverarbeitung (cds-104) FS25" → "Datenbanken und Datenverarbeitung"
 */
export function cleanCourseName(name: string): string {
  let cleaned = name;

  // Remove prefix patterns like "2025 HS FHGR CDS " or "2024 FS FHGR ..."
  // Pattern: year (4 digits) + term (FS/HS) + optional school/program codes + space
  cleaned = cleaned.replace(/^\d{4}\s+(FS|HS)\s+FHGR\s+(\w+\s+)?/i, '');

  // Remove course codes in parentheses like "(cds-402)", "(cds-104)", or just "(cds)"
  cleaned = cleaned.replace(/\s*\([a-z]+(-\d+)?\)/gi, '');

  // Remove trailing term suffix like " FS25" or " HS24"
  cleaned = cleaned.replace(/\s+(FS|HS)\d{2}$/i, '');

  // Trim any extra whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Decode HTML entities in a string.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")  // Handle &#39; &#039; &#0039; etc.
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Handle any remaining numeric entities like &#123;
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Handle hex entities like &#x27;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
