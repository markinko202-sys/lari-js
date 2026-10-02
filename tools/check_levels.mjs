// Proves, with the real game physics, for every level × difficulty:
//   1. the goal is reachable with the skills you have at each point (code gates opened as you answer them);
//   2. right after the power gate, the "proof" obstacle can NOT be crossed without the new power;
//   3. jumps are planned as quick taps, so the route also works with touch controls.
// It builds a graph of every standable span (ground, cube tops, blocks) and simulates jumps between them.
//   node tools/check_levels.mjs [--verbose]
import { makeBody, step, T, solid, P, overlapsHazard } from '../js/physics.js';
import { LEVELS, buildLevel, SKILLS, SKILL_ORDER } from '../js/levels.js';

const dt = 1 / 120;
const VERBOSE = process.argv.includes('--verbose');
const NAMES = ['Easy', 'Normal', 'Hard', 'Very hard'];

export function spans(grid) {
  const out = [];
  const c = (x, y) => (x < 0 || x >= grid.w || y < 0 || y >= grid.h ? (y < 0 ? T.GROUND : T.EMPTY) : grid.cells[y * grid.w + x]);
  for (let y = 1; y < grid.h; y++) {
    let cur = null;
    for (let x = 0; x < grid.w; x++) {
      const ok = solid(c(x, y - 1)) && !solid(c(x, y)) && !solid(c(x, y + 1)) && c(x, y) !== T.SPIKE && c(x, y) !== T.HAZARD;
      if (ok) { if (cur && cur.x1 === x) cur.x1++; else { cur = { x0: x, x1: x + 1, top: y, id: out.length }; out.push(cur); } }
      else cur = null;
    }
  }
  return out;
}

// try to get from span a to span b; springs give a boost; spikes/lava/pits fail the attempt
export function crossable(grid, springs, a, b, skills) {
  const dir = b.x0 >= a.x1 ? 1 : b.x1 <= a.x0 ? -1 : 0;
  const starts = [];
  if (dir === 1) starts.push(a.x1 - 0.35, a.x1 - 1.5, a.x1 - 3);
  else if (dir === -1) starts.push(a.x0 + 0.35, a.x0 + 1.5, a.x0 + 3);
  else { // overlapping in x: jump straight up/down from under the target's edges
    for (const x of [b.x0 + 0.5, b.x1 - 0.5, (b.x0 + b.x1) / 2, b.x0 - 0.6, b.x1 + 0.6]) if (x > a.x0 + 0.3 && x < a.x1 - 0.3) starts.push(x);
  }
  const moves = dir === 0 ? [1, -1, 0] : [dir];
  if (skills.wall && wallClimb(grid, a, b, starts, moves)) return true;
  const dbl = skills.double ? [null, 18, 30, 42, 54] : [null];
  const dsh = skills.dash ? [null, 25, 45, 65] : [null];
  for (const sx of starts) for (const mv of moves) for (const mode of ['edge', 'early', 'now', 'walk']) for (const d2 of (mode === 'walk' ? [null] : dbl)) for (const ds of dsh) {
    const jumpFirst = mode === 'now';
    const body = makeBody(sx, a.top);
    for (let k = 0; k < 3; k++) step(body, {}, grid, skills, dt);   // settle onto the ground first
    let jumped = false, jf = 0;
    for (let f = 0; f < 700; f++) {
      const lead = mode === 'early' ? 1.1 : 0.3;   // real players take off a little before the edge too
      const pastEdge = mv > 0 ? body.x > a.x1 - lead : mv < 0 ? body.x < a.x0 + lead : true;
      const inp = { right: mv > 0, left: mv < 0, jump: false, jumpPressed: false, dashPressed: false };
      if (!jumped && mode === 'walk') { if (!body.onGround) { jumped = true; jf = f; } }      // just step off the edge
      else if (!jumped && (jumpFirst || pastEdge || !body.onGround)) { inp.jumpPressed = true; jumped = true; jf = f; }
      if (jumped) {
        const t = f - jf;
        inp.jump = mode !== 'walk' && (t < 3 || (d2 !== null && t >= d2 && t < d2 + 3) || skills.glide);   // quick taps (+ hold for glide)
        if (d2 !== null && t === d2) inp.jumpPressed = true;
        if (ds !== null && t === ds) inp.dashPressed = true;
        if (mv === 0) { inp.right = b.x0 + 0.5 > body.x; inp.left = b.x1 - 0.5 < body.x; }
      }
      step(body, inp, grid, skills, dt);
      for (const s of springs) if (body.vy <= 0 && Math.abs(body.x - s.x) < 0.7 && body.y >= s.y - 0.05 && body.y < s.y + 0.6) { body.vy = P.springV; body.y = s.y + 0.62; body.springing = true; body.onGround = false; body.coyote = 0; body.jumpsUsed = 1; }
      if (body.y < -2) break;
      if (overlapsHazard(body, grid)) break;                       // same rule as the game
      if (body.onGround && f - jf > 2) {
        if (Math.abs(body.y - b.top) < 0.01 && body.x + body.w / 2 > b.x0 && body.x - body.w / 2 < b.x1) return true;
        if (!(Math.abs(body.y - a.top) < 0.01 && body.x + body.w / 2 > a.x0 && body.x - body.w / 2 < a.x1)) break;
        if (f - jf > 20) break;
      }
    }
  }
  return false;
}

// wall jumps: run at a wall, tap jump at every wall contact and steer for the opposite wall,
// then once above the target, steer onto it
function wallClimb(grid, a, b, starts, moves) {
  const skills = { double: true, dash: true, glide: true, wall: true };
  for (const sx of starts) for (const mv of moves) {
    const body = makeBody(sx, a.top);
    for (let k = 0; k < 3; k++) step(body, {}, grid, skills, dt);
    let hold = mv || 1, last = -99, jf = 0;
    for (let f = 0; f < 900; f++) {
      const inp = { right: hold > 0, left: hold < 0, jump: f - last < 4 || f < 4, jumpPressed: f === 0 };
      if (f > 0 && !body.onGround && body.wallT === 0 && f - last > 6) { inp.jumpPressed = true; inp.jump = true; last = f; }
      if (body.y > b.top + 0.05) { const t = (b.x0 + b.x1) / 2; hold = t > body.x ? 1 : -1; }
      step(body, inp, grid, skills, dt);
      if (body.jumped === 'wall') { hold = -body.wallDir; body.jumped = null; }
      if (body.y < -2 || overlapsHazard(body, grid)) break;
      if (body.onGround && f > 8) {
        if (Math.abs(body.y - b.top) < 0.01 && body.x + body.w / 2 > b.x0 && body.x - body.w / 2 < b.x1) return true;
        if (f - jf > 30) { jf = f; inp.jumpPressed = true; last = f; }   // landed back on the floor: try again from here
        if (f > 400) break;
      }
    }
  }
  return false;
}

function reach(grid, springs, sp, startSpan, skillsAt) {
  const seen = new Set([startSpan.id]), queue = [startSpan];
  while (queue.length) {
    const a = queue.shift();
    const sk = skillsAt(a);
    for (const b of sp) {
      if (seen.has(b.id)) continue;
      const gapX = b.x0 >= a.x1 ? b.x0 - a.x1 : a.x0 >= b.x1 ? a.x0 - b.x1 : 0;
      if (gapX > (sk.glide ? 24 : sk.dash ? 14 : 10) || b.top - a.top > (sk.wall ? 11 : 6) || a.top - b.top > 14) continue;
      if (crossable(grid, springs, a, b, sk)) { seen.add(b.id); queue.push(b); }
    }
  }
  return seen;
}

if (import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
function main() {
let ok = true;
const t0 = Date.now();
const ONLY = process.argv.find(a => /^--level=/.test(a))?.slice(8);
for (const def of LEVELS) {
  if (ONLY && def.id !== ONLY) continue;
  const lvl = SKILL_ORDER.indexOf(def.skill);
  const move = SKILLS[def.skill].move;
  for (let d = 0; d < 4; d++) {
    const L = buildLevel(def, d);
    const before = {};
    for (let k = 0; k < lvl; k++) before[SKILLS[SKILL_ORDER[k]].move] = true;
    const after = { ...before, [move]: true };
    // gates are opened as you answer them; cracked rock / loose floor open once you can shoot / pound
    const gridFor = sk => {
      const open = new Uint8Array(L.cells);
      for (let i = 0; i < open.length; i++) {
        const c = open[i];
        if (c === T.BARRIER || (c === T.CRACK && sk.shoot) || (c === T.SOFT && sk.pound)) open[i] = T.EMPTY;
      }
      return { w: L.w, h: L.h, cells: open };
    };
    const grid = gridFor(after), gridNo = gridFor(before);
    const springs = L.ents.filter(e => e.type === 'spring');
    const sp = spans(grid), spNo = spans(gridNo);
    const at = (list, x, y) => list.find(s => s.top === y && x >= s.x0 && x < s.x1);
    const start = at(sp, Math.floor(L.start.x), L.start.y);
    const goal = L.ents.find(e => e.type === 'goal');
    const goalSpan = at(sp, Math.floor(goal.x), goal.y);
    const powerGate = L.ents.find(e => e.type === 'gate' && e.power);
    const proof = L.ents.find(e => e.type === 'proof');
    const skillsAt = s => (s.x1 > powerGate.x + 0.5 ? after : before);   // you can walk through the opened gate within a span
    const seen = reach(grid, springs, sp, start, skillsAt);
    const won = goalSpan && seen.has(goalSpan.id);
    // without the power, nothing past the proof obstacle may be reachable
    const noPower = reach(gridNo, springs, spNo, at(spNo, Math.floor(L.start.x), L.start.y), () => before);
    const leak = spNo.filter(s => s.x0 >= proof.x1 && noPower.has(s.id));
    const coins = L.ents.filter(e => e.type === 'coin').length;
    const enemies = L.ents.filter(e => e.min !== undefined && e.min <= d).length;
    const line = `${def.id.padEnd(8)} ${NAMES[d].padEnd(9)} length ${String(L.w).padStart(4)} · spans ${String(sp.length).padStart(3)} · coins ${coins} · enemies ${enemies}`;
    if (!won) {
      ok = false;
      const far = [...seen].map(i => sp[i]).sort((p, q) => q.x1 - p.x1)[0];
      console.log(`${line}  ✗ goal NOT reachable — stuck around x=${far.x1}, top ${far.top}`);
    } else if (leak.length) {
      ok = false; console.log(`${line}  ✗ proof obstacle skippable without ${move} (reached x=${leak[0].x0}, top ${leak[0].top})`);
    } else console.log(`${line}  ✓`);
  }
}
console.log(`\n${ok ? 'ALL LEVELS OK' : 'PROBLEMS FOUND'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(ok ? 0 : 1);
}
