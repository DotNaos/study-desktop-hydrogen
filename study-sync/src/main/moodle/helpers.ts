
export function normalizeFileExtension(ext: string | undefined): string | undefined {
  if (!ext) return undefined;
  const cleaned = ext.trim().toLowerCase().replace(/^\./, "");
  if (!cleaned) return undefined;
  // Defensive: keep it simple (alnum only) to avoid weird cache/file issues.
  if (!/^[a-z0-9]+$/.test(cleaned)) return undefined;
  return cleaned;
}

export function extractExtensionFromFilename(value: string): string | undefined {
  // Handles: "file.pdf", "file.pdf?forcedownload=1", "FILE.PDF"
  const v = value.trim();
  const base = v.split("?")[0].split("#")[0];
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === base.length - 1) return undefined;
  return normalizeFileExtension(base.slice(lastDot + 1));
}

export function extensionFromContentType(contentType: string): string | undefined {
  const ct = contentType.toLowerCase();
  if (ct.includes("application/pdf")) return "pdf";
  if (ct.includes("application/msword")) return "doc";
  if (ct.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "docx";
  if (ct.includes("application/vnd.ms-powerpoint")) return "ppt";
  if (ct.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation")) return "pptx";
  if (ct.includes("application/vnd.ms-excel")) return "xls";
  if (ct.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) return "xlsx";
  if (ct.includes("text/markdown") || ct.includes("text/x-markdown")) return "md";
  if (ct.includes("text/plain")) return "txt";
  return undefined;
}
