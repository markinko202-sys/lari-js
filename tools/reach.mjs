// Measures how high / far the player can get with each skill set, to design levels that are always beatable.
//   node tools/reach.mjs
import { makeBody, step } from '../js/physics.js';
const W = 400, H = 40, dt = 1 / 120;
const flat = { w: W, h: H, cells: new Uint8Array(W * H) };
for (let x = 0; x < W; x++) for (let y = 0; y < 10; y++) flat.cells[y * W + x] = 1;

// plan(frame) -> extra input; jump is held the whole time
function run(skills, plan) {
  const b = makeBody(20, 10);
  for (let i = 0; i < 120; i++) step(b, { right: true }, flat, skills, dt);
  const x0 = b.x; let peak = 0, f = 0;
  for (; f < 1200; f++) {
    step(b, { right: true, jump: true, ...plan(f) }, flat, skills, dt);
    peak = Math.max(peak, b.y - 10);
    if (f > 5 && b.onGround) break;
  }
  return { height: +peak.toFixed(2), dist: +(b.x - x0).toFixed(2), air: +(f * dt).toFixed(2) };
}
const at = (...frames) => f => frames.includes(f);
console.log('single        ', run({}, f => ({ jumpPressed: f === 0 })));
console.log('double        ', run({ double: true }, f => ({ jumpPressed: at(0, 40)(f) })));
console.log('double+dash   ', run({ double: true, dash: true }, f => ({ jumpPressed: at(0, 40)(f), dashPressed: f === 80 })));
console.log('dbl+dash+glide', run({ double: true, dash: true, glide: true }, f => ({ jumpPressed: at(0, 40)(f), dashPressed: f === 80 })));
