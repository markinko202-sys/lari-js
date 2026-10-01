// Pure platformer physics (no Three.js) so it can be tuned and verified headless in Node.
// World units: 1 tile = 1 unit. X right, Y up. The player is an axis-aligned box.

export const P = {
  width: 0.62, height: 1.42,
  accel: 60, airAccel: 38, friction: 48, maxSpeed: 7.2,
  gravity: 34, maxFall: 18,
  jumpV: 12.4, doubleJumpV: 12.0, jumpCut: 0.55,       // releasing jump early cuts the rise…
  minJumpTime: 0.16,                                   // …but never before this, so a quick tap is still a real jump
  coyote: 0.1, buffer: 0.12,
  dashSpeed: 17, dashTime: 0.19, dashCooldown: 0.45,
  glideFall: 2.2,
  springV: 19,
  stompBounce: 10,
};

// tile codes
export const T = { EMPTY: 0, GROUND: 1, PLATFORM: 2, BLOCK: 3, USED: 4, HAZARD: 5, BARRIER: 6, BRICK: 7, SPIKE: 8 };
export const solid = c => c === T.GROUND || c === T.PLATFORM || c === T.BLOCK || c === T.USED || c === T.BARRIER || c === T.BRICK;

export function makeBody(x, y) {
  return {
    x, y, vx: 0, vy: 0, w: P.width, h: P.height,
    onGround: false, coyote: 0, buffer: 0, jumpsUsed: 0, facing: 1,
    dash: 0, dashCd: 0, dashDir: 1, airDashUsed: false, gliding: false,
    bumped: null, // {x, y} of a block hit from below this step
  };
}

// skills: { double: bool, dash: bool, glide: bool }
// input: { left, right, jump (held), jumpPressed (edge), dashPressed (edge) }
export function step(b, input, grid, skills, dt) {
  b.bumped = null;
  // timers
  b.coyote = b.onGround ? P.coyote : Math.max(0, b.coyote - dt);
  b.buffer = input.jumpPressed ? P.buffer : Math.max(0, b.buffer - dt);
  b.dashCd = Math.max(0, b.dashCd - dt);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) b.facing = dir;

  // dash
  if (skills.dash && input.dashPressed && b.dashCd === 0 && !(b.airDashUsed && !b.onGround)) {
    b.dash = P.dashTime; b.dashCd = P.dashCooldown; b.dashDir = dir || b.facing;
    if (!b.onGround) b.airDashUsed = true;
  }
  if (b.dash > 0) {
    b.dash -= dt;
    b.vx = b.dashDir * P.dashSpeed; b.vy = 0;
  } else {
    // horizontal
    const a = b.onGround ? P.accel : P.airAccel;
    if (dir && (Math.sign(b.vx) !== dir || Math.abs(b.vx) < P.maxSpeed)) b.vx = dir * Math.min(P.maxSpeed, Math.abs(b.vx) * (Math.sign(b.vx) === dir ? 1 : -1) + a * dt);
    else if (b.onGround) {
      const f = P.friction * dt;
      b.vx = Math.abs(b.vx) <= f ? 0 : b.vx - Math.sign(b.vx) * f;
    }
    // hard cap; right after a dash the extra speed bleeds off quickly instead of snapping
    const cap = P.maxSpeed;
    if (Math.abs(b.vx) > cap) b.vx = Math.sign(b.vx) * Math.max(cap, Math.abs(b.vx) - 120 * dt);

    // jumping
    if (b.buffer > 0) {
      if ((b.onGround || b.coyote > 0) && b.vy < P.jumpV * 0.5) {   // never cut short a spring / stomp launch
        b.vy = P.jumpV; b.jumpsUsed = 1; b.buffer = 0; b.coyote = 0; b.onGround = false; b.jumped = 'jump'; b.jumpT = 0;
      } else if (skills.double && b.jumpsUsed < 2 && !b.onGround) {
        b.vy = Math.max(b.vy, P.doubleJumpV); b.jumpsUsed = 2; b.buffer = 0; b.jumped = 'double'; b.jumpT = 0;
      }
    }
    b.jumpT = (b.jumpT || 0) + dt;
    if (!input.jump && b.vy > 0 && !b.springing && b.jumpT > P.minJumpTime) b.vy *= Math.pow(P.jumpCut, dt * 10);  // variable height

    // gravity / glide
    b.vy -= P.gravity * dt;
    b.gliding = !!(skills.glide && input.jump && b.vy < 0 && !b.onGround);
    const maxFall = b.gliding ? P.glideFall : P.maxFall;
    if (b.vy < -maxFall) b.vy = -maxFall;
  }

  // integrate with tile collisions, X then Y
  moveX(b, b.vx * dt, grid);
  const wasGround = b.onGround;
  b.onGround = false;
  moveY(b, b.vy * dt, grid);
  if (b.onGround) { b.jumpsUsed = 0; b.airDashUsed = false; b.springing = false; }
  b.landed = b.onGround && !wasGround;
  return b;
}

function cell(grid, x, y) {
  if (x < 0 || x >= grid.w) return T.GROUND;        // world edges are walls
  if (y < 0 || y >= grid.h) return T.EMPTY;         // open sky / pit
  return grid.cells[y * grid.w + x];
}

function moveX(b, dx, grid) {
  if (!dx) return;
  b.x += dx;
  const left = b.x - b.w / 2, right = b.x + b.w / 2;
  const y0 = Math.floor(b.y + 0.01), y1 = Math.floor(b.y + b.h - 0.01);
  if (dx > 0) {
    const tx = Math.floor(right);
    for (let ty = y0; ty <= y1; ty++) if (solid(cell(grid, tx, ty))) { b.x = tx - b.w / 2 - 1e-4; b.vx = 0; return; }
  } else {
    const tx = Math.floor(left);
    for (let ty = y0; ty <= y1; ty++) if (solid(cell(grid, tx, ty))) { b.x = tx + 1 + b.w / 2 + 1e-4; b.vx = 0; return; }
  }
}

function moveY(b, dy, grid) {
  b.y += dy;
  const x0 = Math.floor(b.x - b.w / 2 + 0.01), x1 = Math.floor(b.x + b.w / 2 - 0.01);
  if (dy < 0) {
    const ty = Math.floor(b.y);
    for (let tx = x0; tx <= x1; tx++) if (solid(cell(grid, tx, ty))) { b.y = ty + 1; b.vy = 0; b.onGround = true; return; }
  } else if (dy > 0) {
    const ty = Math.floor(b.y + b.h);
    // bump the block nearest the player's centre
    let hit = null;
    for (let tx = x0; tx <= x1; tx++) {
      if (solid(cell(grid, tx, ty))) {
        if (!hit || Math.abs(tx + 0.5 - b.x) < Math.abs(hit.x + 0.5 - b.x)) hit = { x: tx, y: ty };
      }
    }
    if (hit) { b.y = ty - b.h; b.vy = 0; b.bumped = hit; }
  }
}

// what deadly / painful tiles the body is touching: 'lava' kills, 'spike' hurts
export function overlapsHazard(b, grid) {
  const x0 = Math.floor(b.x - b.w / 2 + 0.1), x1 = Math.floor(b.x + b.w / 2 - 0.1);
  const y0 = Math.floor(b.y + 0.05), y1 = Math.floor(b.y + b.h * 0.5);
  let hit = null;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (cell(grid, x, y) === T.HAZARD) return 'lava';
  // spikes: a forgiving hitbox — only the feet, and only well inside the tile (grazing an edge is fine)
  const sx0 = Math.floor(b.x - b.w / 2 + 0.25), sx1 = Math.floor(b.x + b.w / 2 - 0.25), sy = Math.floor(b.y + 0.05);
  for (let x = sx0; x <= sx1; x++) if (cell(grid, x, sy) === T.SPIKE && b.y < sy + 0.4) hit = 'spike';
  return hit;
}

export function aabb(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
