/** Splits already-wrapped lines into pages of at most `maxLines` lines each. */
export function paginate(lines: string[], maxLines: number): string[] {
  const n = Math.max(1, Math.floor(maxLines));
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += n) pages.push(lines.slice(i, i + n).join('\n'));
  return pages.length ? pages : [''];
}
