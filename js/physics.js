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
  poundHang: 0.12, poundSpeed: 26,                     // ground pound: a short hang in the air, then straight down
  wallKick: 8.5, wallSlide: 4, wallLock: 0.16, wallCoyote: 0.1,
  corner: 0.26,                                        // head clips a ledge corner by less than this → slide past it
};

// tile codes
export const T = {
  EMPTY: 0, GROUND: 1, PLATFORM: 2, BLOCK: 3, USED: 4, HAZARD: 5, BARRIER: 6, BRICK: 7, SPIKE: 8,
  CRACK: 9,    // cracked rock: a shot breaks it
  SOFT: 10,    // loose floor: a ground pound breaks it
  HIDDEN: 11,  // invisible block: only solid when you jump into it from below
  WATER: 12,   // sea: deadly like lava
};
export const solid = c => c === T.GROUND || c === T.PLATFORM || c === T.BLOCK || c === T.USED || c === T.BARRIER || c === T.BRICK || c === T.CRACK || c === T.SOFT;
export const deadly = c => c === T.HAZARD || c === T.WATER;

export function makeBody(x, y) {
  return {
    x, y, vx: 0, vy: 0, w: P.width, h: P.height,
    onGround: false, coyote: 0, buffer: 0, jumpsUsed: 0, facing: 1, jumpT: 0, springing: false,
    dash: 0, dashCd: 0, dashDir: 1, airDashUsed: false, gliding: false,
    pound: 0, poundHang: 0, pounded: false,
    wallT: 9, wallDir: 0, wallLock: 0, sliding: false,
    landed: false, jumped: null,
    bumped: null, // {x, y} of a block hit from below this step
  };
}

// skills: { double, dash, glide, pound, wall }
// input: { left, right, jump (held), jumpPressed (edge), dashPressed (edge), downPressed (edge) }
export function step(b, input, grid, skills, dt) {
  b.bumped = null; b.pounded = false;
  // timers
  b.coyote = b.onGround ? P.coyote : Math.max(0, b.coyote - dt);
  b.buffer = input.jumpPressed ? P.buffer : Math.max(0, b.buffer - dt);
  b.dashCd = Math.max(0, b.dashCd - dt);
  b.wallLock = Math.max(0, b.wallLock - dt);

  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) b.facing = dir;
  if (b.wallLock > 0 && dir === b.wallDir) dir = 0;     // right after a wall jump you can't steer straight back in

  // ground pound: start in the air, hang for a beat, then drop
  if (skills.pound && input.downPressed && !b.onGround && !b.pound && b.dash <= 0) {
    b.pound = 1; b.poundHang = P.poundHang; b.gliding = false;
  }
  // dash
  if (!b.pound && skills.dash && input.dashPressed && b.dashCd === 0 && !(b.airDashUsed && !b.onGround)) {
    b.dash = P.dashTime; b.dashCd = P.dashCooldown; b.dashDir = dir || b.facing;
    if (!b.onGround) b.airDashUsed = true;
  }
  if (b.pound) {
    b.vx = 0;
    if (b.poundHang > 0) { b.poundHang -= dt; b.vy = 0; } else b.vy = -P.poundSpeed;
  } else if (b.dash > 0) {
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

    // jumping: ground (incl. coyote time) → wall jump → double jump
    if (b.buffer > 0) {
      if ((b.onGround || b.coyote > 0) && b.vy < P.jumpV * 0.5) {   // never cut short a spring / stomp launch
        b.vy = P.jumpV; b.jumpsUsed = 1; b.buffer = 0; b.coyote = 0; b.onGround = false; b.jumped = 'jump'; b.jumpT = 0;
      } else if (skills.wall && !b.onGround && b.wallT < P.wallCoyote) {
        b.vy = P.jumpV; b.vx = -b.wallDir * P.wallKick; b.facing = -b.wallDir; b.wallLock = P.wallLock;
        b.jumpsUsed = 1; b.airDashUsed = false; b.buffer = 0; b.wallT = 9; b.jumped = 'wall'; b.jumpT = 0;
      } else if (skills.double && b.jumpsUsed < 2 && !b.onGround) {
        b.vy = Math.max(b.vy, P.doubleJumpV); b.jumpsUsed = 2; b.buffer = 0; b.jumped = 'double'; b.jumpT = 0;
      }
    }
    b.jumpT += dt;
    if (!input.jump && b.vy > 0 && !b.springing && b.jumpT > P.minJumpTime) b.vy *= Math.pow(P.jumpCut, dt * 10);  // variable height

    // gravity / glide / wall slide
    b.vy -= P.gravity * dt;
    b.gliding = !!(skills.glide && input.jump && b.vy < 0 && !b.onGround);
    b.sliding = !!(skills.wall && !b.onGround && b.vy < 0 && b.wallT === 0 && dir === b.wallDir);
    const maxFall = b.gliding ? P.glideFall : b.sliding ? P.wallSlide : P.maxFall;
    if (b.vy < -maxFall) b.vy = -maxFall;
  }

  // integrate with tile collisions, X then Y
  const hitWall = moveX(b, b.vx * dt, grid);
  const wasGround = b.onGround;
  b.onGround = false;
  // when nothing moves us vertically (dash, pound hang) probe a hair down so standing still still counts as grounded
  moveY(b, b.vy * dt || -1e-4, grid);
  if (b.onGround) {
    b.jumpsUsed = 0; b.airDashUsed = false; b.springing = false; b.wallT = 9;
    if (b.pound) { b.pound = 0; b.pounded = true; }
  } else {
    // wall contact (for wall jumps): pressed into a wall, or touching one while holding toward it
    const side = hitWall || (dir && touching(b, grid, dir) ? dir : 0);
    if (side) { b.wallDir = side; b.wallT = 0; } else b.wallT += dt;
  }
  b.landed = b.onGround && !wasGround;
  return b;
}

export function cell(grid, x, y) {
  if (x < 0 || x >= grid.w) return T.GROUND;        // world edges are walls
  if (y < 0) return T.EMPTY;                        // pits
  if (y >= grid.h) {                                // open sky — but a gate's light curtain has no top to hop over
    return grid.cells[(grid.h - 1) * grid.w + x] === T.BARRIER ? T.BARRIER : T.EMPTY;
  }
  return grid.cells[y * grid.w + x];
}

function rowsBlocked(b, grid, tx) {
  const y0 = Math.floor(b.y + 0.01), y1 = Math.floor(b.y + b.h - 0.01);
  for (let ty = y0; ty <= y1; ty++) if (solid(cell(grid, tx, ty))) return true;
  return false;
}
function touching(b, grid, s) {
  return rowsBlocked(b, grid, Math.floor(b.x + s * (b.w / 2 + 0.03)));
}

// returns the side of a wall it ran into (1 / -1) or 0
function moveX(b, dx, grid) {
  if (!dx) return 0;
  b.x += dx;
  if (dx > 0) {
    const tx = Math.floor(b.x + b.w / 2);
    if (rowsBlocked(b, grid, tx)) { b.x = tx - b.w / 2 - 1e-4; b.vx = 0; return 1; }
  } else {
    const tx = Math.floor(b.x - b.w / 2);
    if (rowsBlocked(b, grid, tx)) { b.x = tx + 1 + b.w / 2 + 1e-4; b.vx = 0; return -1; }
  }
  return 0;
}

function moveY(b, dy, grid) {
  b.y += dy;
  const x0 = Math.floor(b.x - b.w / 2 + 0.01), x1 = Math.floor(b.x + b.w / 2 - 0.01);
  if (dy < 0) {
    const ty = Math.floor(b.y);
    for (let tx = x0; tx <= x1; tx++) if (solid(cell(grid, tx, ty))) { b.y = ty + 1; b.vy = 0; b.onGround = true; return; }
  } else if (dy > 0) {
    const ty = Math.floor(b.y + b.h);
    const head = tx => { const c = cell(grid, tx, ty); return solid(c) || c === T.HIDDEN; };
    // bump the block nearest the player's centre
    let hit = null;
    for (let tx = x0; tx <= x1; tx++) {
      if (head(tx) && (!hit || Math.abs(tx + 0.5 - b.x) < Math.abs(hit.x + 0.5 - b.x))) hit = { x: tx, y: ty };
    }
    if (!hit) return;
    // corner correction: if only a sliver of the head clips a ledge, slide past it instead of bonking
    if (x0 !== x1) {
      const left = b.x - b.w / 2, right = b.x + b.w / 2;
      if (head(x0) && !head(x1) && x0 + 1 - left <= P.corner) {
        const nx = b.x + (x0 + 1 - left) + 1e-3;
        if (!rowsBlocked({ ...b, x: nx }, grid, Math.floor(nx + b.w / 2))) { b.x = nx; return; }
      }
      if (head(x1) && !head(x0) && right - x1 <= P.corner) {
        const nx = b.x - (right - x1) - 1e-3;
        if (!rowsBlocked({ ...b, x: nx }, grid, Math.floor(nx - b.w / 2))) { b.x = nx; return; }
      }
    }
    b.y = ty - b.h; b.vy = 0; b.bumped = hit;
  }
}

// what deadly / painful tiles the body is touching: 'lava' (lava or sea) kills, 'spike' hurts
export function overlapsHazard(b, grid) {
  const x0 = Math.floor(b.x - b.w / 2 + 0.1), x1 = Math.floor(b.x + b.w / 2 - 0.1);
  const y0 = Math.floor(b.y + 0.05), y1 = Math.floor(b.y + b.h * 0.5);
  let hit = null;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (deadly(cell(grid, x, y))) return 'lava';
  // spikes: a forgiving hitbox — only the feet, and only well inside the tile (grazing an edge is fine)
  const sx0 = Math.floor(b.x - b.w / 2 + 0.25), sx1 = Math.floor(b.x + b.w / 2 - 0.25), sy = Math.floor(b.y + 0.05);
  for (let x = sx0; x <= sx1; x++) if (cell(grid, x, sy) === T.SPIKE && b.y < sy + 0.4) hit = 'spike';
  return hit;
}

export function aabb(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
