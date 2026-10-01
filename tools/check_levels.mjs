// Proves every level is beatable with the skills the player has at that point, and that the
// obstacle right after each code gate is impossible WITHOUT the new skill (so gates can't be skipped).
// Uses the real game physics. Run:  node tools/check_levels.mjs
import { makeBody, step, T } from '../js/physics.js';
import { LEVELS } from '../js/levels.js';

const dt = 1 / 120;

// can the player get from standing on segment A to standing on segment B?
function crossable(grid, a, b, skills) {
  const doubles = skills.double ? [null, ...range(10, 70, 4)] : [null];
  const dashes = skills.dash ? [null, ...range(10, 130, 6)] : [null];
  for (const jumpAt of [0.35, 0.6, 1.0]) for (const dbl of doubles) for (const dsh of dashes) {
    const body = makeBody(a.x1 - 3.2, a.top);
    let f = 0, jumped = false, jf = 0;
    while (f++ < 1200) {
      const ready = !jumped && body.x >= a.x1 - jumpAt;
      const inp = { right: true, jump: true, jumpPressed: false, dashPressed: false };
      if (ready) { inp.jumpPressed = true; jumped = true; jf = f; }
      else if (!jumped) inp.jump = false;
      if (jumped && dbl !== null && f - jf === dbl) inp.jumpPressed = true;
      if (jumped && dsh !== null && f - jf === dsh) inp.dashPressed = true;
      step(body, inp, grid, skills, dt);
      if (body.y < -2) break;
      if (jumped && body.onGround && f - jf > 3) {
        if (body.x >= b.x0 && Math.abs(body.y - b.top) < 0.01) return true;
        if (body.x > a.x1 + 0.2) break;          // landed somewhere else
        if (f - jf > 10) break;
      }
    }
  }
  return false;
}
const range = (a, b, s) => { const r = []; for (let i = a; i <= b; i += s) r.push(i); return r; };

// ground segments along the route (ignoring optional platforms / blocks)
function segments(L) {
  const top = x => { for (let y = L.h - 1; y >= 0; y--) if (L.cells[y * L.w + x] === T.GROUND) return y + 1; return -1; };
  const segs = [];
  for (let x = 0; x < L.w; x++) {
    const t = top(x);
    if (t < 0) continue;
    const last = segs.at(-1);
    if (last && last.x1 === x && last.top === t) last.x1++;
    else segs.push({ x0: x, x1: x + 1, top: t });
  }
  return segs;
}

let ok = true;
const have = {};
const SKILL = { loop: 'double', function: 'dash', async: 'glide' };
for (const def of LEVELS) {
  const L = def.build();
  const grid = { w: L.w, h: L.h, cells: L.cells };
  // the gate barrier is opened once you answer; treat it as open for the route check
  const gate = L.ents.find(e => e.type === 'gate');
  const open = new Uint8Array(L.cells); for (let i = 0; i < open.length; i++) if (open[i] === T.BARRIER) open[i] = T.EMPTY;
  const routeGrid = { ...grid, cells: open };
  const segs = segments(L);
  const before = { ...have }, after = { ...have, [SKILL[def.skill]]: true };
  console.log(`\n${def.name}  (${segs.length} ground segments, gate at x=${gate.x - 0.5}, barrier ${gate.height} high)`);
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i], b = segs[i + 1];
    const afterGate = a.x1 > gate.x;
    const sk = afterGate ? after : before;
    const pass = crossable(routeGrid, a, b, sk);
    const gap = b.x0 - a.x1, rise = b.top - a.top;
    const label = `  x${a.x1}→${b.x0}  gap ${gap} rise ${rise >= 0 ? '+' : ''}${rise}`;
    if (!pass) { ok = false; console.log(`${label}  ✗ NOT crossable with ${JSON.stringify(sk)}`); continue; }
    // the first obstacle after the gate must need the new skill
    const firstAfter = afterGate && !(segs[i - 1] && segs[i - 1].x1 > gate.x) ;
    if (firstAfter && crossable(routeGrid, a, b, before)) {
      ok = false; console.log(`${label}  ✗ passable WITHOUT ${def.skill} — the gate can be skipped`);
    } else console.log(`${label}  ✓${firstAfter ? `  (needs ${SKILL[def.skill]})` : ''}`);
  }
  // the barrier itself must be too tall to hop over with the skills you had before
  const gx = Math.floor(gate.x), seg = segs.find(s => s.x0 <= gx - 1 && s.x1 > gx - 1);
  const wall = { x0: gx + 1, x1: gx + 2, top: gate.y + gate.height };
  const fake = new Uint8Array(L.cells);                   // stand-in: is there a ledge at the barrier top we could land on?
  for (let y = 0; y < gate.y + gate.height; y++) fake[y * L.w + gx] = T.GROUND;
  const hop = crossable({ ...grid, cells: fake }, { ...seg, x1: gx }, { x0: gx, x1: gx + 1, top: gate.y + gate.height }, before);
  console.log(`  barrier hop-over without ${def.skill}: ${hop ? '✗ possible' : '✓ impossible'}`);
  if (hop) ok = false;
  Object.assign(have, after);
}
console.log(ok ? '\nALL LEVELS OK' : '\nPROBLEMS FOUND');
process.exit(ok ? 0 : 1);
