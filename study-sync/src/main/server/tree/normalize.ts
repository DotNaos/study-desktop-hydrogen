export function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_.]+/g, " ")
    .toLowerCase()
    .trim();
}

export function normalizeQuery(input: string): string {
  return normalizeName(input).replace(/\s+/g, " ");
}
