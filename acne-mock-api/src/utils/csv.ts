// Generic CSV serializer for Store collections
// Flattens nested objects/arrays to JSON strings and escapes values properly.

function escapeField(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str: string;
  if (typeof val === 'object') {
    // Nested object/array — serialize to JSON
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  // Escape per RFC 4180: wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return '';

  // Collect all unique keys across rows (handles sparse data)
  const keys = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach(k => keys.add(k));
  }
  const headers = Array.from(keys);

  const lines: string[] = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeField(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}
