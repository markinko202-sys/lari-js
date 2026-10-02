// Levels are assembled from hand-designed chunks (stairs, cube towers, floating bridges, spike runs,
// enemy set-pieces…) with a seeded RNG, so they are long but deterministic, and scale with difficulty.
// Every number below stays inside the reach measured with QUICK TAPS (tools/reach.mjs), so the
// route always works on a phone:  tap jump ≈ 1.9 up / 4.5 across · double ≈ 3.6 / 7.8 · dash ≈ 12 · glide ≈ 22.
// tools/check_levels.mjs then proves each level is beatable and every power gate is unskippable.
import { T } from './physics.js?v=9';

export const H = 20;

// Each level teaches one life lesson that becomes a power. `move` is the physics skill it switches on.
export const SKILLS = {
  persist:    { id: 'persist',    move: 'double', icon: '⤒' },
  focus:      { id: 'focus',      move: 'dash',   icon: '➤' },
  patience:   { id: 'patience',   move: 'glide',  icon: '☂' },
  courage:    { id: 'courage',    move: 'shoot',  icon: '✹' },
  grounded:   { id: 'grounded',   move: 'pound',  icon: '⤓' },
  resilience: { id: 'resilience', move: 'wall',   icon: '⇄' },
};
export const SKILL_ORDER = ['persist', 'focus', 'patience', 'courage', 'grounded', 'resilience'];
// the moves you have once these lessons are learned
export function movesFrom(learned) {
  const m = {};
  for (const id of SKILL_ORDER) if (learned[id]) m[SKILLS[id].move] = true;
  return m;
}

export const LEVELS = [
  { id: 'village', theme: 'village', music: 'village', skill: 'persist',    gates: ['friends', 'persist', 'health'],       length: 820,  seed: 11, bonus: 120, boss: 'ayam' },
  { id: 'forest',  theme: 'forest',  music: 'forest',  skill: 'focus',      gates: ['nature', 'focus', 'money'],           length: 900,  seed: 23, bonus: 160, boss: 'beetle' },
  { id: 'volcano', theme: 'volcano', music: 'volcano', skill: 'patience',   gates: ['feelings', 'patience', 'safety'],     length: 960,  seed: 37, bonus: 200, boss: 'crab' },
  { id: 'beach',   theme: 'beach',   music: 'beach',   skill: 'courage',    gates: ['teamwork', 'courage', 'food'],        length: 980,  seed: 41, bonus: 240, boss: 'ketam' },
  { id: 'cave',    theme: 'cave',    music: 'cave',    skill: 'grounded',   gates: ['time', 'grounded', 'learning'],       length: 1040, seed: 53, bonus: 280, boss: 'kera' },
  { id: 'kota',    theme: 'kota',    music: 'kota',    skill: 'resilience', gates: ['kindness', 'resilience', 'gratitude'], length: 1100, seed: 67, bonus: 320, boss: 'robot' },
];

const THEME = {
  village: { cube: 'vil_Crate', walker: 'bug', charger: 'ayam', flyer: 'bat', pit: 'pit' },
  forest:  { cube: 'for_Stone', walker: 'beetle', shell: 'siput', hanger: 'spider', flyer: 'fly', pit: 'pit' },
  volcano: { cube: 'vol_Block', walker: 'crab', jumper: 'blob', flyer: 'firebat', pit: 'lava' },
  beach:   { cube: 'bch_Block', walker: 'ketam', jumper: 'oborobor', flyer: 'camar', pit: 'water' },
  cave:    { cube: 'gua_Block', walker: 'lipan', charger: 'kera', dropper: 'stalactite', flyer: 'cavebat', pit: 'pit' },
  kota:    { cube: 'kota_Box', walker: 'robovac', charger: 'merpati', flyer: 'drone', pit: 'pit' },
};

// difficulty knobs used while building
const DIFF = [
  { gap: 0.7,  enemies: 0.55, spikes: 0.4, hearts: 2.0, checkEvery: 70 },   // easy
  { gap: 0.85, enemies: 1.0,  spikes: 0.8, hearts: 1.0, checkEvery: 85 },   // normal
  { gap: 1.0,  enemies: 1.5,  spikes: 1.1, hearts: 0.7, checkEvery: 110 },  // hard
  { gap: 1.0,  enemies: 2.1,  spikes: 1.5, hearts: 0.4, checkEvery: 160 },  // very hard
];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class Builder {
  constructor(w) {
    this.w = w; this.h = H;
    this.cells = new Uint8Array(w * H);
    this.ents = []; this.decor = [];
  }
  set(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < H) this.cells[y * this.w + x] = c; }
  get(x, y) { return x < 0 || x >= this.w || y < 0 || y >= H ? 0 : this.cells[y * this.w + x]; }
  ground(x0, x1, top) { for (let x = x0; x < x1; x++) for (let y = 0; y < top; y++) this.set(x, y, T.GROUND); }
  bricks(x, y, len = 1, hgt = 1) { for (let i = 0; i < len; i++) for (let k = 0; k < hgt; k++) this.set(x + i, y + k, T.BRICK); }
  spikes(x, y, len = 1) { for (let i = 0; i < len; i++) this.set(x + i, y, T.SPIKE); }
  fill(x0, x1, tile) { for (let x = x0; x < x1; x++) this.set(x, 0, tile); }
  ent(o) { this.ents.push(o); }
  coin(x, y) { this.ent({ type: 'coin', x: x + 0.5, y: y + 0.5 }); }
  coins(x, y, n) { for (let i = 0; i < n; i++) this.coin(x + i, y); }
  arc(x, y, n, rise) { for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.ent({ type: 'coin', x: x + i + 0.5, y: y + 0.5 + Math.sin(t * Math.PI) * rise }); } }
  block(x, y, gives = 'coin') { this.set(x, y, T.BLOCK); this.ent({ type: 'block', x, y, gives }); }
  hidden(x, y, gives) { this.set(x, y, T.HIDDEN); this.ent({ type: 'block', x, y, gives, hidden: true }); }
}

export function buildLevel(def, difficulty = 1) {
  const D = DIFF[difficulty], th = THEME[def.theme];
  const r = rng(def.seed * 7919 + difficulty * 101);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const B = new Builder(def.length + 160);
  // the moves you hold at each point of the route (earlier levels' powers are already learned)
  const lvl = SKILL_ORDER.indexOf(def.skill);
  const sk = { double: lvl > 0, dash: lvl > 1, glide: lvl > 2 };
  const pitTile = th.pit === 'lava' ? T.HAZARD : th.pit === 'water' ? T.WATER : 0;
  const pitFill = (x0, x1) => { if (pitTile) B.fill(x0, x1, pitTile); };

  let x = 0, h = 3, lastCheck = 0, enemyBudget = 0;
  const maxGap = () => Math.floor((sk.glide ? 11 : sk.dash ? 9 : sk.double ? 6 : 4) * D.gap) || 2;
  const gapW = () => Math.max(2, Math.round(ri(2, maxGap()) * (0.75 + D.gap * 0.25)));
  const maxRise = () => (sk.double ? 3 : 1);
  const lift = () => Math.min(Math.max(2, h), H - 9);
  const groundRun = n => { B.ground(x, x + n, h); x += n; };
  // the highest standable top in the last `span` columns (a proof wall must tower over all of it)
  const prevMax = span => {
    let m = 0;
    for (let xx = Math.max(0, x - span); xx < x; xx++) for (let y = H - 1; y >= 0; y--) if (B.get(xx, y) && B.get(xx, y) !== T.BARRIER) { m = Math.max(m, y + 1); break; }
    return m;
  };

  // enemies: base ones spawn on every difficulty, extras only on harder ones
  const enemy = (o, base = true) => {
    enemyBudget += D.enemies;
    o.min = base ? (enemyBudget >= 1 ? 0 : 1) : (D.enemies > 1.2 ? 2 : 3);
    if (enemyBudget >= 1) enemyBudget -= 1;
    B.ent(o);
  };
  const walker = (ex, ey, range = 3) => enemy({ type: th.walker, x: ex + 0.5, y: ey, range });
  const checkpoint = () => { B.ent({ type: 'check', x: x + 1.5, y: h }); lastCheck = x; };
  const surprise = () => { const k = r(); return k < 0.35 ? 'star' : k < 0.7 ? 'life' : 'coin'; };

  // ---------------------------------------------------------------- chunks
  const chunks = {
    run() {
      const n = ri(10, 15), x0 = x; groundRun(n);
      if (r() < 0.6) {
        // a Mario row of cubes with a { } block: bump it from below — or climb the steps and run along the top
        const len = ri(3, 5), bx = x0 + ri(4, n - len - 1), by = h + 3;
        for (let k = 1; k <= 3; k++) B.bricks(bx - 4 + k, h, 1, k);            // steps 1-2-3 up to the row
        for (let i = 0; i < len; i++) {
          if (i === Math.floor(len / 2)) B.block(bx + i, by, r() < 0.06 ? 'star' : r() < 0.18 * D.hearts ? 'heart' : 'coin');
          else B.bricks(bx + i, by);
        }
        B.coins(bx, by + 1, len);                                                  // up top: the reward for climbing
        B.coins(bx, h + 1, len);                                                   // underneath: the easy ones
        walker(bx + Math.floor(len / 2), h, Math.max(1, len / 2 - 0.5));           // patrols under the row
        if (r() < D.enemies - 0.6) walker(x0 + n - 2, h, 1);
      } else {
        B.coins(x0 + 2, h + 1, ri(3, 5));
        walker(x0 + Math.floor(n / 2), h, 3);
        if (r() < D.enemies - 0.6) walker(x0 + n - 3, h, 2);
        if (r() < 0.35) B.hidden(x0 + ri(3, n - 4), h + 3, surprise());          // nothing there… until you jump into it
      }
    },
    gap() {
      groundRun(ri(3, 5));
      const w = gapW(), x0 = x;
      pitFill(x, x + w);
      x += w;
      B.arc(x0, h + 1, w, Math.min(3, w * 0.4));
      if (th.jumper && w >= 3) enemy({ type: th.jumper, x: x0 + w / 2, y: 0.6, height: h + 2.5 }, r() < 0.6);
      groundRun(ri(3, 5));
    },
    step() {
      groundRun(ri(3, 5));
      const up = h + maxRise() < H - 10 && (h < 4 || r() < 0.5);
      h = up ? h + ri(1, maxRise()) : Math.max(2, h - ri(1, 3));
      groundRun(ri(5, 9));
      B.coins(x - 4, h + 1, 3);
    },
    pyramid() {
      // cube staircase up, a flat top, a gap, and stairs back down
      const k = ri(3, 4), x0 = x;
      const g = ri(0, 1) ? 0 : Math.min(3, maxGap());
      groundRun(1 + k + 2 + g + k + 2 + ri(0, 1));          // room for both stairs and the gap, so nothing spills into the next chunk
      for (let i = 0; i < k; i++) B.bricks(x0 + 1 + i, h, 1, i + 1);
      for (let i = 0; i < 2; i++) B.bricks(x0 + 1 + k + i, h, 1, k);
      for (let i = 0; i < k; i++) B.bricks(x0 + 1 + k + 2 + g + i, h, 1, k - i);
      // the gap between the two halves is a real pit through the ground
      if (g) for (let i = 0; i < g; i++) for (let y = 0; y < h; y++) B.set(x0 + 1 + k + 2 + i, y, y === 0 && pitTile ? pitTile : T.EMPTY);
      B.coins(x0 + 1 + k, h + k + 1, 2);
      if (D.enemies > 1) walker(x - 2, h, 1);               // on the flat after the stairs, never inside a cube
    },
    bridge() {
      // a wide pit crossed on floating cubes
      groundRun(ri(3, 4));
      const x0 = x, hops = ri(2, 4);
      let px = x0, py = h;
      for (let i = 0; i < hops; i++) {
        const gap = Math.max(2, Math.min(maxGap() - 1, ri(2, 4)));
        px += gap;
        py = Math.max(2, Math.min(H - 8, py + ri(-1, Math.min(1, maxRise()))));
        const len = ri(2, 3);
        B.bricks(px, py - 1, len);
        B.coins(px, py, len);
        px += len;
      }
      const w = px + Math.max(2, Math.min(maxGap() - 1, ri(2, 4))) - x0;
      pitFill(x0, x0 + w);
      x = x0 + w;
      h = Math.max(2, Math.min(lift(), py + ri(-1, 0)));
      if (th.flyer) enemy({ type: th.flyer, x: x0 + w / 2, y: h + 3, range: 2, axis: 'y' }, r() < 0.5);
      groundRun(ri(4, 6));
    },
    climb() {
      // a cliff you scale on cube ledges, with a treasure ledge at the top
      const room = H - 10 - h;                 // keep the route well under the sky
      if (room < 3) return chunks.descend();
      groundRun(ri(3, 5));
      const total = Math.min(ri(4, 6), room), x0 = x;
      const stepH = sk.double ? 3 : 1;
      let y = h, cx = x0;
      while (y < h + total) {
        const s = Math.min(stepH, h + total - y);
        B.ground(cx, cx + 2, y + s); // each ledge is solid down to the ground
        cx += 2; y += s;
        if (cx - x0 >= 2) B.coin(cx - 1, y);
      }
      for (let k = 0; k < 2; k++) B.bricks(cx + k, y, 1, 1);
      x = cx; h = y;
      groundRun(ri(4, 7));
      B.coins(x - 4, h + 1, 3);
      if (r() < 0.35 * D.hearts) B.ent({ type: 'heart', x: x - 2 + 0.5, y: h + 0.6 });
      walker(x - 5, h, 2);
    },
    spikes() {
      const n = ri(12, 18), x0 = x; groundRun(n);
      const patches = Math.max(1, Math.round(ri(1, 3) * D.spikes));
      let sx = x0 + 3;
      for (let i = 0; i < patches && sx < x0 + n - 3; i++) {
        const w = ri(1, Math.min(3, maxGap() - 1));
        B.spikes(sx, h, w); B.arc(sx - 1, h + 1, w + 2, 2);
        sx += w + ri(3, 5);
      }
    },
    spring() {
      // a spring up to a high ledge that carries on as the new ground
      groundRun(ri(4, 6));
      B.ent({ type: 'spring', x: x - 1.5, y: h });
      const up = Math.min(4, H - 10 - h);
      if (up < 2) { groundRun(4); return; }
      h += up;
      groundRun(ri(6, 9));
      B.coins(x - 7, h + 1, 5);
    },
    descend() {
      if (h <= 3) return chunks.run();
      groundRun(2);
      while (h > 3) { h -= Math.min(2, h - 3); groundRun(2); }
      groundRun(ri(4, 7));
    },
    special() {
      const n = ri(14, 20), x0 = x; groundRun(n);
      if (th.charger) { enemy({ type: th.charger, x: x0 + n - 3, y: h, range: n - 6 }); enemy({ type: th.charger, x: x0 + n - 7, y: h, range: n - 8 }, false); }
      if (th.hanger) { enemy({ type: th.hanger, x: x0 + 6.5, y: h + 5, drop: 4 }); enemy({ type: th.hanger, x: x0 + 12.5, y: h + 5, drop: 4 }, false); }
      if (th.shell) { enemy({ type: th.shell, x: x0 + 5.5, y: h, range: 3 }); walker(x0 + n - 7, h, 2); }
      if (th.dropper) { enemy({ type: th.dropper, x: x0 + 7.5, y: h + 6, floor: h }); enemy({ type: th.dropper, x: x0 + 11.5, y: h + 6, floor: h }, false); }
      if (th.walker === 'crab' || th.walker === 'ketam') { enemy({ type: th.walker, x: x0 + 5.5, y: h, range: 4 }); enemy({ type: th.walker, x: x0 + n - 6.5, y: h, range: 3 }, false); }
      if (th.walker === 'robovac') enemy({ type: 'robovac', x: x0 + Math.floor(n / 2) + 0.5, y: h, range: 4 });
      if (th.flyer) enemy({ type: th.flyer, x: x0 + n / 2, y: h + 3.5, range: 3, axis: 'x' }, false);
      B.coins(x0 + 3, h + 3, n - 6);
      // a little cube hill at each end to hop up on (coins overhead are in jumping reach from there)
      B.bricks(x0 + 3, h, 1, 1); B.bricks(x0 + 4, h, 1, 2);
      B.bricks(x0 + n - 5, h, 1, 1); B.bricks(x0 + n - 4, h, 1, 2);             // both climb 1 → 2 from the left, then drop off
    },
  };
  const weights = { run: 3, gap: 3, step: 2, pyramid: 2, bridge: 2, climb: 2, spikes: 2, spring: 1, descend: 1, special: 2 };
  const bag = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));

  // ---------------------------------------------------------------- power proofs
  // right after the power gate: an obstacle you cannot pass without the new power
  const proofs = {
    double() { h += 3; groundRun(8); },                                                          // a 3-high wall
    dash() { const w = 10; pitFill(x, x + w); B.arc(x, h + 1, w, 3); x += w; groundRun(8); },   // wider than a double jump
    glide() { const w = 15; pitFill(x, x + w); B.arc(x, h + 1, w, 3); x += w; groundRun(8); },  // wider than a dash
    shoot() {
      // a cracked rock wall holding up a stone pillar: only a shot can open it
      groundRun(2);
      for (let k = 0; k < 2; k++) {
        for (let y = h; y < h + 3; y++) B.set(x + k, y, T.CRACK);
        for (let y = h + 3; y < h + 10; y++) B.set(x + k, y, T.GROUND);
      }
      B.ground(x, x + 2, h); x += 2;
      groundRun(6); B.coins(x - 5, h + 1, 3);
    },
    pound() {
      // loose floor over a tunnel that runs under a tall wall
      while (h < 6) { h += 1; groundRun(2); }
      while (h > 7) { h -= 1; groundRun(2); }
      groundRun(2);
      const sx = x, wx = sx + 3, ex = wx + 4;
      const top = Math.min(H - 2, Math.max(h + 6, prevMax(32) + 5));                                      // out of reach from anything nearby
      B.ground(sx, ex + 4, h);
      for (let xx = sx; xx < ex + 2; xx++) for (let y = h - 4; y < h - 1; y++) B.set(xx, y, T.EMPTY);   // the tunnel
      for (let xx = sx; xx < sx + 3; xx++) B.set(xx, h - 1, T.SOFT);                                      // its lid
      for (let xx = wx; xx < ex; xx++) for (let y = h; y < top; y++) B.set(xx, y, T.GROUND);              // the wall
      for (let xx = ex; xx < ex + 2; xx++) B.set(xx, h - 1, T.EMPTY);                                     // the way out…
      for (let y = h - 4; y < h - 2; y++) B.set(ex + 2, y, T.GROUND);                                     // …via a step
      B.set(ex + 2, h - 2, T.EMPTY); B.set(ex + 2, h - 1, T.EMPTY);
      B.coins(wx, h - 3, 4);
      x = ex + 3;
      groundRun(6);
    },
    wall() {
      // a chimney: duck under the left wall, then kick between the walls up to the roof
      if (h > 3) chunks.descend();
      groundRun(3);
      while (prevMax(30) + 5 > h + 11) groundRun(4);        // far enough from any high ground that nothing can glide onto the roof
      const lx = x, roof = Math.max(h + 8, prevMax(30) + 5);
      B.ground(lx, lx + 5, h);
      for (let xx = lx; xx < lx + 2; xx++) for (let y = h + 3; y < roof + 5; y++) B.set(xx, y, T.GROUND);
      x = lx + 5; h = roof;
      groundRun(8);
      B.coins(lx + 2, h - 3, 3);
      B.coins(x - 6, h + 1, 4);
    },
  };

  // the life-lesson gate and, after the power gate, the obstacle that proves you need the new power
  const gate = (topic) => {
    groundRun(3); checkpoint();
    groundRun(5);
    const gx = x;
    for (let y = h; y < H; y++) B.set(gx, y, T.BARRIER);   // a light curtain up to the sky: no hopping over
    B.ent({ type: 'gate', x: gx + 0.5, y: h, topic, power: topic === def.skill });
    groundRun(6);
    if (topic === def.skill) {
      const move = SKILLS[def.skill].move;
      if (move in sk) sk[move] = true;
      const px0 = x;
      proofs[move]();
      B.ent({ type: 'proof', x0: px0, x1: x, move });
    }
  };

  // the boss arena: the exit stays shut until the boss is beaten
  const bossArena = () => {
    if (h > 4) chunks.descend();
    groundRun(4); checkpoint(); groundRun(4);
    const ax = x, W = 24;
    groundRun(W);
    // two ledges to stomp from, each with a spring beside it to get up there
    B.bricks(ax + 5, h + 3, 2); B.bricks(ax + W - 7, h + 3, 2);
    B.ent({ type: 'spring', x: ax + 3.5, y: h }); B.ent({ type: 'spring', x: ax + W - 3.5, y: h });
    B.ent({ type: 'boss', kind: def.boss, x: ax + W * 0.7, y: h, xmin: ax + 1.5, xmax: ax + W - 1.5, x0: ax });
    const gx = x;
    for (let y = h; y < H; y++) B.set(gx, y, T.BARRIER);
    B.ent({ type: 'gate', x: gx + 0.5, y: h, boss: true });
    groundRun(5);
  };

  // ---------------------------------------------------------------- assemble
  B.ground(0, 10, h); x = 10;
  B.start = { x: 3.5, y: h };
  B.coins(4, h + 1, 3);
  const gateAt = [0.2, 0.45, 0.72].map(f => Math.floor(def.length * f));
  let gi = 0, last = '';
  while (x < def.length - 20) {
    if (gi < 3 && x >= gateAt[gi]) { gate(def.gates[gi]); gi++; continue; }
    if (x - lastCheck > D.checkEvery) checkpoint();
    let c = pick(bag);
    if (c === last && r() < 0.7) c = pick(bag);
    last = c;
    chunks[c]();
  }
  while (gi < 3) { gate(def.gates[gi]); gi++; }
  bossArena();
  groundRun(6);
  B.ent({ type: 'goal', x: x + 0.5, y: h });     // the flagpole
  groundRun(14);
  // trim the builder to the real length
  const w = x;
  const cells = new Uint8Array(w * H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < w; xx++) cells[y * w + xx] = B.cells[y * B.w + xx];
  B.w = w; B.cells = cells;

  // background scenery markers
  const decoKinds = {
    village: ['vil_House', 'vil_Palm', 'vil_Lantern', 'vil_Fence', 'vil_Bush'],
    forest: ['for_Tree', 'for_Fern', 'for_Mushroom', 'for_Rock', 'for_Log'],
    volcano: ['vol_DeadTree', 'vol_Crystal', 'vol_Spike'],
    beach: ['vil_Palm', 'bch_Umbrella', 'bch_Castle', 'bch_Rock', 'bch_Shell', 'bch_Hut', 'vil_Palm'],
    cave: ['gua_Stalagmite', 'gua_Crystal', 'gua_Shroom', 'gua_Lantern', 'gua_Column', 'gua_Crystal'],
    kota: ['kota_AC', 'kota_Tank', 'kota_Antenna', 'kota_Neon', 'kota_Dish', 'kota_AC'],
  }[def.theme];
  for (let dx = 6; dx < w - 6; dx += ri(5, 9)) {
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (B.get(dx, y) === T.GROUND) { top = y + 1; break; }
    if (top < 0) continue;
    const kind = pick(decoKinds);
    const far = /House|Palm|Tree|Hut|Column|Tank|Neon/.test(kind);
    B.decor.push({ kind, x: dx, y: top, z: far ? -3.2 - r() * 2.5 : -1.4 - r() * 0.3, s: far ? 0.9 + r() * 0.4 : 0.8 + r() * 0.4, ry: r() * 0.6 - 0.3 });
  }
  if (def.theme === 'village' && th.flyer) {
    for (let k = 1; k < 8; k++) {
      const ex = Math.floor((w / 8) * k);
      let top = 0; for (let y = H - 1; y >= 0; y--) if (B.get(ex, y)) { top = y + 1; break; }
      enemy({ type: th.flyer, x: ex + 0.5, y: Math.min(H - 3, Math.max(top, 3) + 4.5), range: 3, axis: 'x' }, false);   // above the local ground, not inside it
    }
  }
  B.difficulty = difficulty;
  B.theme = th;
  return B;
}
