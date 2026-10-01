// ASCII view of a level slice:  node tools/dump_level.mjs <level 0-2> <difficulty 0-3> <x from> [width]
import { LEVELS, buildLevel } from '../js/levels.js';
const [li, d, from, wid = 80] = process.argv.slice(2).map(Number);
const L = buildLevel(LEVELS[li], d);
const ch = { 0: '.', 1: '#', 2: '=', 3: '?', 4: 'u', 5: '~', 6: '|', 7: 'B', 8: '^' };
const ents = {}; for (const e of L.ents) if (e.x !== undefined && e.type !== 'coin') ents[`${Math.floor(e.x)},${Math.floor(e.y)}`] = { spring: 'S', check: 'K', gate: 'G', goal: 'E', heart: 'H' }[e.type] || 'e';
for (let y = L.h - 1; y >= 0; y--) {
  let s = String(y).padStart(2) + ' ';
  for (let x = from; x < from + wid && x < L.w; x++) s += ents[`${x},${y}`] || ch[L.cells[y * L.w + x]];
  console.log(s);
}
let ruler = '   '; for (let x = from; x < from + wid; x += 10) ruler += String(x).padEnd(10); console.log(ruler);
