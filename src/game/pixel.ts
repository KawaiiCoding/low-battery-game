/** Pure helpers for text-defined pixel art. No Phaser imports so they are unit-testable. */
export type Grid = readonly string[];

export function gridSize(g: Grid): { w: number; h: number } {
  return { w: g.length ? g[0].length : 0, h: g.length };
}

/** Returns a list of human-readable problems (empty list = valid). */
export function validateGrid(g: Grid, palette: Record<string, number>): string[] {
  const errors: string[] = [];
  if (g.length === 0) return ['grid is empty'];
  const w = g[0].length;
  if (w === 0) errors.push('grid has zero width');
  g.forEach((row, y) => {
    if (row.length !== w) errors.push(`row ${y} has width ${row.length}, expected ${w}`);
    for (const ch of row) {
      if (ch !== '.' && !(ch in palette)) errors.push(`row ${y} uses unknown color '${ch}'`);
    }
  });
  return errors;
}

export function recolor(g: Grid, map: Record<string, string>): string[] {
  return g.map((row) => row.replace(/./g, (ch) => map[ch] ?? ch));
}

export function flipX(g: Grid): string[] {
  return g.map((row) => row.split('').reverse().join(''));
}

/** Draws a grid onto a 2D context at (ox, oy). */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  g: Grid,
  ox: number,
  oy: number,
  palette: Record<string, number>,
): void {
  for (let y = 0; y < g.length; y++) {
    const row = g[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = '#' + palette[ch].toString(16).padStart(6, '0');
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}
