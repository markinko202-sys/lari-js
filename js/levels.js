// Level data. Each level is built with a tiny builder so gaps and ledges can be checked against
// the measured reach (tools/reach.mjs): single jump ≤ 5 wide / 2 high, double jump ≤ 8 / 4,
// + dash ≤ 11, + glide ≤ 21. Every skill gate is followed by obstacles that need that skill.
import { T } from './physics.js';

const H = 18;

class Builder {
  constructor(w) {
    this.w = w; this.h = H;
    this.cells = new Uint8Array(w * H);
    this.ents = []; this.decor = [];
    this.start = { x: 2.5, y: 3 };
  }
  set(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < H) this.cells[y * this.w + x] = c; }
  get(x, y) { return this.cells[y * this.w + x]; }
  // solid ground from x0 (inclusive) to x1 (exclusive), surface at `top`
  ground(x0, x1, top) { for (let x = x0; x < x1; x++) for (let y = 0; y < top; y++) this.set(x, y, T.GROUND); return this; }
  plat(x, y, len = 3) { for (let i = 0; i < len; i++) this.set(x + i, y, T.PLATFORM); return this; }
  block(x, y, gives = 'coin') { this.set(x, y, T.BLOCK); this.ents.push({ type: 'block', x, y, gives }); return this; }
  lava(x0, x1, y = 0) { for (let x = x0; x < x1; x++) this.set(x, y, T.HAZARD); return this; }
  coins(x, y, n = 3, dx = 1) { for (let i = 0; i < n; i++) this.ents.push({ type: 'coin', x: x + i * dx + 0.5, y: y + 0.5 }); return this; }
  arc(x, y, n, rise = 2) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.ents.push({ type: 'coin', x: x + i + 0.5, y: y + 0.5 + Math.sin(t * Math.PI) * rise });
    }
    return this;
  }
  bug(x, y, range = 3) { this.ents.push({ type: 'bug', x: x + 0.5, y, range }); return this; }
  fly(x, y, range = 2.5, axis = 'y') { this.ents.push({ type: 'fly', x: x + 0.5, y: y + 0.5, range, axis }); return this; }
  spring(x, y) { this.ents.push({ type: 'spring', x: x + 0.5, y }); return this; }
  heart(x, y) { this.ents.push({ type: 'heart', x: x + 0.5, y: y + 0.6 }); return this; }
  check(x, y) { this.ents.push({ type: 'check', x: x + 0.5, y }); return this; }
  // the barrier must be taller than the reach you already have, so the gate can't be skipped
  gate(x, y, skill, height = 3) {
    for (let k = 0; k < height; k++) this.set(x, y + k, T.BARRIER);
    this.ents.push({ type: 'gate', x: x + 0.5, y, skill, height });
    return this;
  }
  goal(x, y) { this.ents.push({ type: 'goal', x: x + 0.5, y }); this.goalX = x; return this; }
  deco(kind, x, y, z = -1.6, s = 1, ry = 0) { this.decor.push({ kind, x, y, z, s, ry }); return this; }
}

// ------------------------------------------------------------------ 1 · NIGHT KAMPUNG — learn `for` → double jump
function village() {
  const L = new Builder(176);
  L.start = { x: 3.5, y: 2 };
  L.ground(0, 24, 2).coins(6, 3, 4).bug(17, 2, 3)
    .deco('vil_House', 9, 2, -3.2).deco('vil_Lantern', 4, 2, -1.4).deco('vil_Palm', 15, 2, -2.6, 1.1).deco('vil_Fence', 20, 2, -1.3)
    // first gap: 4 wide, a normal jump
    .arc(24, 3, 4, 1.6)
    .ground(28, 50, 2).plat(32, 5, 3).block(35, 5).block(36, 5, 'heart').coins(32, 6, 3)
    .bug(40, 2, 4).bug(46, 2, 2)
    .deco('vil_Palm', 30, 2, -2.4).deco('vil_Bush', 38, 2, -1.2).deco('vil_House', 44, 2, -3.6, 0.9, 0.3).deco('vil_Lantern', 49, 2, -1.4)
    .ground(53, 72, 3).check(55, 3).coins(58, 4, 3)
    .spring(66, 3).arc(65, 7, 4, 1.5)
    .deco('vil_Fence', 59, 3, -1.3).deco('vil_Palm', 62, 3, -2.8, 1.2).deco('vil_Bush', 69, 3, -1.2)
    .ground(72, 92, 2).bug(76, 2, 3).coins(74, 3, 3)
    // the code gate: learn the loop, earn the double jump
    .gate(86, 2, 'loop').deco('vil_Lantern', 84, 2, -1.2).deco('vil_Lantern', 89, 2, -1.2)
    // after the gate: a 3-high wall and 7-wide gaps — only a double jump gets you through
    .ground(92, 101, 5).coins(94, 6, 4).deco('vil_Bush', 97, 5, -1.2)
    .arc(101, 6, 6, 2.2)
    .ground(108, 122, 5).check(110, 5).bug(114, 5, 3).fly(118, 7, 1.5)
    .deco('vil_House', 116, 5, -3.4, 0.9).deco('vil_Lantern', 121, 5, -1.3)
    .arc(122, 6, 7, 2.6)
    .ground(129, 142, 4).bug(132, 4, 3).block(136, 7).block(137, 7).heart(139, 4)
    .deco('vil_Palm', 134, 4, -2.6).deco('vil_Fence', 140, 4, -1.3)
    .ground(142, 176, 2).coins(146, 3, 5).bug(152, 2, 3).bug(158, 2, 3)
    .deco('vil_House', 150, 2, -3.4).deco('vil_Palm', 157, 2, -2.4, 1.2).deco('vil_Lantern', 165, 2, -1.3)
    .goal(170, 2);
  return L;
}

// ------------------------------------------------------------------ 2 · RAINFOREST — learn `function` → dash
function forest() {
  const L = new Builder(186);
  L.start = { x: 3.5, y: 2 };
  L.ground(0, 22, 2).coins(5, 3, 4).bug(14, 2, 3)
    .deco('for_Tree', 8, 2, -3.0).deco('for_Fern', 4, 2, -1.2).deco('for_Mushroom', 12, 2, -1.3).deco('for_Rock', 19, 2, -1.6)
    // double-jump warm-ups (skill from the kampung)
    .arc(22, 3, 6, 2.4)
    .ground(28, 40, 2).ground(40, 52, 5).coins(41, 6, 4).bug(46, 5, 3).fly(36, 5, 1.6)
    .deco('for_Tree', 32, 2, -3.2, 1.1).deco('for_Fern', 43, 5, -1.2).deco('for_Hornbill', 48, 9, -2.2)
    .ground(52, 58, 3).plat(56, 6, 3).block(57, 9).block(58, 9, 'heart')
    .arc(58, 4, 6, 2.4)
    .ground(65, 92, 3).check(66, 3).bug(72, 3, 4).bug(80, 3, 3).coins(70, 4, 6)
    .deco('for_Tree', 70, 3, -3.4).deco('for_Mushroom', 76, 3, -1.3).deco('for_Rock', 84, 3, -1.6).deco('for_Fern', 88, 3, -1.2)
    // the code gate: functions → dash
    .gate(90, 3, 'function', 5)
    // after the gate: 10-wide gaps, need jump + double jump + dash
    .ground(91, 100, 3).coins(93, 4, 4)
    .coins(101, 6, 9).fly(105, 8, 1.2)
    .ground(110, 124, 3).check(112, 3).bug(117, 3, 4).spring(122, 3).coins(121, 9, 3)
    .deco('for_Tree', 116, 3, -3.2).deco('for_Log', 113, 3, -1.0).deco('for_Hornbill', 119, 11, -2.4)
    .coins(125, 5, 9)
    .ground(133, 150, 4).bug(139, 4, 3).bug(145, 4, 3).block(141, 7).block(142, 7, 'heart')
    .deco('for_Tree', 137, 4, -3.4, 1.2).deco('for_Mushroom', 148, 4, -1.3)
    .coins(151, 6, 8)
    .ground(160, 186, 2).coins(163, 3, 5).bug(170, 2, 3)
    .deco('for_Tree', 166, 2, -3.0).deco('for_Fern', 174, 2, -1.2).deco('for_Rock', 177, 2, -1.6)
    .goal(180, 2);
  return L;
}

// ------------------------------------------------------------------ 3 · VOLCANO — learn `async/await` → glide
function volcano() {
  const L = new Builder(206);
  L.start = { x: 3.5, y: 3 };
  L.ground(0, 20, 3).coins(6, 4, 4).bug(14, 3, 3)
    .deco('vol_Mountain', 30, 0, -14, 1.6).deco('vol_DeadTree', 8, 3, -1.8).deco('vol_Spike', 17, 3, -1.4)
    .lava(20, 27).arc(20, 4, 7, 2.6)
    .ground(27, 40, 3).bug(31, 3, 3).fly(36, 6, 1.5).deco('vol_Crystal', 38, 3, -1.4)
    .lava(40, 49).coins(41, 6, 8)
    .ground(49, 66, 4).check(52, 4).spring(62, 4).coins(61, 10, 3).bug(57, 4, 3)
    .deco('vol_DeadTree', 55, 4, -1.8).deco('vol_Spike', 64, 4, -1.4)
    .ground(66, 80, 6).coins(68, 7, 4).bug(73, 6, 3).block(75, 9).block(76, 9, 'heart')
    .lava(80, 86).arc(80, 7, 6, 2.2)
    .ground(86, 100, 6).deco('vol_Crystal', 88, 6, -1.4).deco('vol_Mountain', 110, 0, -16, 2.0)
    // the code gate: async/await → glide
    .gate(97, 6, 'async', 5)
    // after the gate: 15-wide lava fields — hold jump to glide across
    .ground(98, 104, 6).coins(99, 7, 4)
    .lava(104, 119).coins(105, 7, 13)
    .ground(119, 132, 6).check(121, 6).bug(126, 6, 3).deco('vol_DeadTree', 129, 6, -1.8)
    .lava(132, 148).fly(140, 8, 2).coins(133, 8, 14)
    .ground(148, 160, 5).heart(150, 5).bug(155, 5, 3).deco('vol_Spike', 158, 5, -1.4)
    .lava(160, 174).coins(161, 6, 12)
    .ground(174, 206, 4).coins(177, 5, 5).bug(184, 4, 3).bug(190, 4, 3)
    .deco('vol_Crystal', 180, 4, -1.4).deco('vol_DeadTree', 192, 4, -1.8)
    .goal(200, 4);
  return L;
}

export const SKILLS = {
  loop:     { id: 'loop',     name: 'for loop',     power: 'Double jump', key: 'Jump again in the air' },
  function: { id: 'function', name: 'function',     power: 'Dash',        key: 'Shift / ⇥ to dash' },
  async:    { id: 'async',    name: 'async / await', power: 'Glide',      key: 'Hold jump while falling' },
};

export const LEVELS = [
  { id: 'village', name: 'Night Kampung', sub: 'Level 1', build: village, theme: 'village', music: 'village', skill: 'loop', bonus: 60 },
  { id: 'forest',  name: 'Rainforest',    sub: 'Level 2', build: forest,  theme: 'forest',  music: 'forest',  skill: 'function', bonus: 80 },
  { id: 'volcano', name: 'Volcano',       sub: 'Level 3', build: volcano, theme: 'volcano', music: 'volcano', skill: 'async', bonus: 100 },
];
