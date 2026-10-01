// The player's 3D rig and every interactive thing in a level.
import * as THREE from 'three';
import { make, byName } from './assets.js';
import { aabb, T, P } from './physics.js';

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// ------------------------------------------------------------------ player visual
export class Rig {
  constructor(charId, hatId, trailColor, scene) {
    this.root = new THREE.Group();
    this.model = make(`Char_${charId}`);
    this.root.add(this.model);
    const get = n => byName(this.model, n);
    this.parts = { legL: get('LegL'), legR: get('LegR'), armL: get('ArmL'), armR: get('ArmR'), head: get('Head'), tail: get('Tail') };
    if (hatId && hatId !== 'none') {
      const anchor = get('HatAnchor');
      const hat = make(`Hat_${hatId}`);
      (anchor || this.parts.head || this.model).add(hat);
    }
    this.phase = 0; this.squash = 1; this.yaw = -0.55; this.blink = 0;
    this.trail = trailColor ? new Trail(trailColor, scene) : null;
  }
  // body: physics body; mode: 'idle' | 'menu'
  update(dt, t, b, mode = 'play') {
    const p = this.parts;
    const speed = b ? Math.abs(b.vx) : 0;
    if (mode === 'menu') {
      this.model.rotation.y = 0; this.root.rotation.y += dt * 0.6;
      const k = Math.sin(t * 2);
      p.armL && (p.armL.rotation.z = 0.15 + k * 0.08); p.armR && (p.armR.rotation.z = -0.1 - k * 0.08);
      p.head && (p.head.rotation.z = Math.sin(t * 1.3) * 0.06);
      this.model.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
      if (p.tail) p.tail.rotation.x = Math.sin(t * 3) * 0.3;
      return;
    }
    // face direction, turned toward the camera so the face reads
    const targetYaw = b.facing > 0 ? -0.55 : Math.PI + 0.55;
    this.yaw = damp(this.yaw, targetYaw, 14, dt);
    this.model.rotation.y = this.yaw;

    let legA = 0, armA = 0, lean = 0, armOut = 0;
    if (b.dash > 0) { lean = -0.5; legA = 0.6; armA = -1.0; }
    else if (!b.onGround) {
      if (b.gliding) { armOut = 1.4; legA = 0.25; lean = -0.15; }
      else { legA = b.vy > 0 ? 0.7 : 0.35; armA = b.vy > 0 ? -1.2 : -0.6; }
    } else if (speed > 0.2) {
      this.phase += dt * (6 + speed * 1.6);
      legA = Math.sin(this.phase) * Math.min(1, speed / 5) * 0.9;
      armA = -legA * 0.8; lean = -Math.min(0.18, speed * 0.025);
    } else {
      this.phase = 0;
    }
    const s = 18;
    p.legL && (p.legL.rotation.z = damp(p.legL.rotation.z, b.onGround ? legA : legA, s, dt));
    p.legR && (p.legR.rotation.z = damp(p.legR.rotation.z, b.onGround && speed > 0.2 ? -legA : -legA * 0.4, s, dt));
    p.armL && (p.armL.rotation.z = damp(p.armL.rotation.z, armA, s, dt));
    p.armR && (p.armR.rotation.z = damp(p.armR.rotation.z, -armA, s, dt));
    p.armL && (p.armL.rotation.x = damp(p.armL.rotation.x, -armOut, s, dt));
    p.armR && (p.armR.rotation.x = damp(p.armR.rotation.x, armOut, s, dt));
    this.model.rotation.z = damp(this.model.rotation.z, lean * (b.facing > 0 ? 1 : -1), 12, dt);
    if (p.head) p.head.rotation.z = damp(p.head.rotation.z, b.onGround ? Math.sin(this.phase * 2) * 0.04 : 0.08, 10, dt);
    if (p.tail) p.tail.rotation.x = Math.sin(t * 6 + this.phase) * 0.35;

    // squash & stretch
    if (b.landed) this.squash = 0.78;
    if (b.jumped) { this.squash = 1.18; b.jumped = null; }
    this.squash = damp(this.squash, 1, 10, dt);
    this.model.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));
    this.model.position.y = b.onGround && speed > 0.2 ? Math.abs(Math.sin(this.phase)) * 0.06 : 0;

    this.root.position.set(b.x, b.y, 0);
    if (this.trail) this.trail.update(dt, b, speed > 3 || b.dash > 0 || b.gliding);
  }
  setInvulnerable(on, t) { this.model.visible = !on || Math.sin(t * 40) > -0.2; }
  dispose() { this.trail?.dispose(); }
}

class Trail {
  constructor(color, scene) {
    this.n = 40; this.i = 0; this.acc = 0;
    this.pos = new Float32Array(this.n * 3).fill(-999); this.life = new Float32Array(this.n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points); this.scene = scene;
  }
  update(dt, b, emit) {
    this.acc += dt;
    if (emit && this.acc > 0.025) {
      this.acc = 0; const k = this.i++ % this.n;
      this.pos.set([b.x - b.facing * 0.25 + (Math.random() - 0.5) * 0.2, b.y + 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4], k * 3);
      this.life[k] = 1;
    }
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] > 0) { this.life[k] -= dt * 2.2; this.pos[k * 3 + 1] += dt * 0.6; if (this.life[k] <= 0) this.pos[k * 3 + 1] = -999; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.points); this.points.geometry.dispose(); }
}

// ------------------------------------------------------------------ one-shot particle bursts
export class Bursts {
  constructor(scene) {
    this.n = 160; this.pos = new Float32Array(this.n * 3).fill(-999); this.vel = new Float32Array(this.n * 3);
    this.col = new Float32Array(this.n * 3); this.life = new Float32Array(this.n); this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(x, y, color, count = 10, speed = 4, up = 2) {
    const c = new THREE.Color(color);
    for (let j = 0; j < count; j++) {
      const k = this.i++ % this.n, a = Math.random() * Math.PI * 2;
      this.pos.set([x, y, (Math.random() - 0.5) * 0.6], k * 3);
      this.vel.set([Math.cos(a) * speed * Math.random(), up + Math.sin(a) * speed * Math.random(), (Math.random() - 0.5) * 2], k * 3);
      this.col.set([c.r, c.g, c.b], k * 3); this.life[k] = 0.5 + Math.random() * 0.4;
    }
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      this.vel[k * 3 + 1] -= 14 * dt;
      for (let a = 0; a < 3; a++) this.pos[k * 3 + a] += this.vel[k * 3 + a] * dt;
      if (this.life[k] <= 0) this.pos[k * 3 + 1] = -999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ level entities
// Each entity: { type, obj, x, update(dt, t, game) }. Enemies also carry box / stompable / dashable.
export function spawnEntities(level, scene, game, difficulty) {
  const list = [];
  for (const e of level.ents) {
    if (e.min !== undefined && e.min > difficulty) continue;
    const f = FACTORY[e.type];
    if (!f) continue;
    const ent = f(e, game);
    if (!ent) continue;
    ent.x0 = e.x ?? 0;
    scene.add(ent.obj); list.push(ent);
  }
  return list;
}

const tinted = (obj, hex, emissive = 0) => {
  obj.traverse(o => {
    if (!o.isMesh || !/shell|Shell|BatBody|bat_fur|bat_wing|Wing/.test(o.material.name + o.name)) return;
    o.material = o.material.clone(); o.material.color.set(hex);
    if (emissive) { o.material.emissive = new THREE.Color(hex); o.material.emissiveIntensity = emissive; }
  });
  return obj;
};
const cellAt = (g, x, y) => (x < 0 || x >= g.grid.w || y < 0 || y >= g.grid.h ? 0 : g.grid.cells[y * g.grid.w + x]);
const isSolid = c => c === T.GROUND || c === T.BRICK || c === T.BLOCK || c === T.USED || c === T.BARRIER || c === T.PLATFORM;

// a walker that patrols its range, turning at walls, spikes and ledges
function walkerMove(en, dt, g, speed) {
  en.x += en.dir * speed * dt;
  const ahead = Math.floor(en.x + en.dir * 0.5), at = Math.floor(en.y + 0.3), below = Math.floor(en.y - 0.5);
  const wall = isSolid(cellAt(g, ahead, at)) || cellAt(g, ahead, at) === T.SPIKE;
  const ledge = below >= 0 && !isSolid(cellAt(g, ahead, below));
  if (en.x < en.xmin || en.x > en.xmax || wall || ledge) { en.dir *= -1; en.x += en.dir * speed * dt * 2; }
}
function dying(en, dt) {
  en.squish += dt;
  en.obj.scale.set(en.s * (1 + en.squish), en.s * Math.max(0.05, 1 - en.squish * 4), en.s);
  if (en.squish > 0.45) en.obj.visible = false;
}

function walker(model, e, opts = {}) {
  const obj = make(model); const s = opts.scale || 0.95; obj.scale.setScalar(s);
  if (opts.tint) tinted(obj, opts.tint);
  const legs = []; obj.traverse(o => { if (/Leg[LR]?\d*$|BugLeg/.test(o.name) && !o.isMesh) legs.push(o); });
  return {
    type: opts.type || 'bug', obj, s, x: e.x, y: e.y, xmin: e.x - (e.range ?? 3), xmax: e.x + (e.range ?? 3), dir: -1, alive: true, squish: 0,
    stompable: opts.stompable ?? true, dashable: true, box: { x: e.x, y: e.y, w: opts.w || 0.85, h: opts.h || 0.6 },
    update(dt, t, g) {
      if (!this.alive) return dying(this, dt);
      walkerMove(this, dt, g, (opts.speed || 1.6) * g.diff.bugSpeed);
      this.obj.position.set(this.x, this.y, 0);
      this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
      legs.forEach((l, i) => { l.rotation.y = Math.sin(t * 18 + i * 1.7) * 0.4; });
      this.box.x = this.x; this.box.y = this.y;
      g.touchEnemy(this);
    },
  };
}

const FACTORY = {
  coin(e) {
    const obj = make('Coin'); obj.position.set(e.x, e.y, 0); obj.scale.setScalar(0.85);
    return {
      type: 'coin', obj, box: { x: e.x, y: e.y - 0.35, w: 0.7, h: 0.7 }, alive: true, seed: Math.random() * 6,
      update(dt, t, g) {
        if (!this.alive) {
          this.obj.position.y += dt * 6; this.obj.scale.multiplyScalar(1 - dt * 5);
          if (this.obj.scale.x < 0.05) this.obj.visible = false;
          return;
        }
        this.obj.rotation.y = t * 3 + this.seed;
        this.obj.position.y = e.y + Math.sin(t * 2.5 + this.seed) * 0.08;
        const pb = g.body;
        if (g.magnet) {
          const dx = pb.x - this.obj.position.x, dy = pb.y + 0.7 - this.obj.position.y, d = Math.hypot(dx, dy);
          if (d < 5 && d > 0.01) { this.obj.position.x += dx / d * dt * 12; e.y += dy / d * dt * 12; this.box.x = this.obj.position.x; this.box.y = e.y - 0.35; }
        }
        if (aabb(pb, this.box)) { this.alive = false; g.collectCoin(this.obj.position.x, this.obj.position.y); }
      },
    };
  },

  bug: e => walker('Bug', e, { type: 'bug' }),
  beetle: e => walker('Bug', e, { type: 'beetle', tint: '#3f8f4a', speed: 1.9 }),
  crab: e => walker('MagmaCrab', e, { type: 'crab', stompable: false, speed: 1.3, scale: 1.0, w: 1.0, h: 0.8 }),

  // kampung chicken: patrols, then charges when it spots you
  ayam(e) {
    const en = walker('Ayam', e, { type: 'ayam', speed: 1.2, scale: 1.0, w: 0.8, h: 0.9 });
    const head = byName(en.obj, 'AyamHead'), base = en.update;
    en.charge = 0; en.cool = 0;
    en.update = function (dt, t, g) {
      if (!this.alive) return dying(this, dt);
      const b = g.body, dx = b.x - this.x;
      this.cool = Math.max(0, this.cool - dt);
      if (this.charge <= 0 && this.cool === 0 && Math.abs(dx) < 7 && Math.abs(b.y - this.y) < 1.5 && Math.sign(dx) === this.dir) { this.charge = 1.3; g.sfx('bump'); }
      if (this.charge > 0) {
        this.charge -= dt; if (this.charge <= 0) this.cool = 1.5;
        walkerMove(this, dt, g, 4.6 * g.diff.bugSpeed);
        this.obj.position.set(this.x, this.y + Math.abs(Math.sin(t * 22)) * 0.08, 0);
        this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
        if (head) head.rotation.z = -0.5;
        this.box.x = this.x; this.box.y = this.y; g.touchEnemy(this);
        return;
      }
      if (head) head.rotation.z = Math.sin(t * 6) * 0.25;
      base.call(this, dt, t, g);
    };
    return en;
  },

  // bats hover, then swoop at you
  bat: e => flyer('Kelawar', e, null),
  firebat: e => flyer('Kelawar', e, '#ff5a1f'),
  fly(e) {
    const obj = make('FlyBug'); obj.scale.setScalar(1.1);
    const wings = [byName(obj, 'WingL'), byName(obj, 'WingR')];
    return {
      type: 'fly', obj, s: 1.1, alive: true, squish: 0, stompable: true, dashable: true, box: { x: e.x, y: e.y - 0.3, w: 0.7, h: 0.6 },
      update(dt, t, g) {
        if (!this.alive) { this.squish += dt; this.obj.position.y -= dt * 6; this.obj.rotation.z += dt * 8; if (this.squish > 0.8) this.obj.visible = false; return; }
        const k = Math.sin(t * 1.4 * g.diff.bugSpeed + e.x);
        const x = e.axis === 'x' ? e.x + k * e.range : e.x, y = e.axis === 'y' ? e.y + k * e.range : e.y;
        this.obj.position.set(x, y, 0);
        this.obj.rotation.y = g.body.x > x ? -0.4 : Math.PI + 0.4;
        wings.forEach((w, i) => w && (w.rotation.x = Math.sin(t * 40) * 0.6 * (i ? -1 : 1)));
        this.box.x = x; this.box.y = y - 0.3;
        g.touchEnemy(this);
      },
    };
  },

  // forest spider: waits up high, drops on its thread when you pass underneath
  spider(e) {
    const obj = make('Spider'); obj.scale.setScalar(0.9);
    const thread = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e9e2d2', transparent: true, opacity: 0.6 }));
    const group = new THREE.Group(); group.add(obj, thread);
    const top = e.y, bottom = e.y - e.drop;
    return {
      type: 'spider', obj: group, s: 0.9, alive: true, squish: 0, stompable: true, dashable: true, y: top, state: 'wait', timer: 0,
      box: { x: e.x, y: top - 0.4, w: 0.8, h: 0.7 },
      update(dt, t, g) {
        if (!this.alive) { this.squish += dt; obj.position.y -= dt * 8; obj.rotation.z += dt * 10; thread.visible = false; if (this.squish > 0.8) group.visible = false; return; }
        const b = g.body;
        if (this.state === 'wait' && Math.abs(b.x - e.x) < 2.6 && b.y < top) { this.state = 'drop'; g.sfx('bump'); }
        if (this.state === 'drop') { this.y = Math.max(bottom + 0.5, this.y - dt * 9); if (this.y <= bottom + 0.5) { this.state = 'hold'; this.timer = 1.4; } }
        else if (this.state === 'hold') { this.timer -= dt; if (this.timer <= 0) this.state = 'up'; }
        else if (this.state === 'up') { this.y = Math.min(top, this.y + dt * 2.5); if (this.y >= top) this.state = 'wait'; }
        const sway = this.state === 'wait' ? Math.sin(t * 2) * 0.1 : 0;
        obj.position.set(e.x + sway, this.y, 0);
        obj.rotation.y = -Math.PI / 2;
        const p = thread.geometry.attributes.position; p.setXYZ(0, e.x, top + 6, 0); p.setXYZ(1, e.x + sway, this.y + 0.2, 0); p.needsUpdate = true;
        this.box.x = e.x; this.box.y = this.y - 0.4;
        g.touchEnemy(this);
      },
    };
  },

  // snail: stomp it and it hides; touch the shell to kick it — a sliding shell clears other enemies
  siput(e) {
    const obj = make('Siput'); obj.scale.setScalar(0.95);
    const body = byName(obj, 'SiputBody');
    return {
      type: 'siput', obj, s: 0.95, x: e.x, y: e.y, xmin: e.x - e.range, xmax: e.x + e.range, dir: -1, alive: true, squish: 0,
      stompable: true, dashable: true, shell: false, sliding: 0, vy: 0, kickCool: 0,
      box: { x: e.x, y: e.y, w: 0.9, h: 0.8 },
      onStomp(g) {
        if (!this.shell) { this.shell = true; this.sliding = 0; if (body) body.visible = false; g.sfx('stomp'); return true; }
        if (this.sliding) { this.sliding = 0; g.sfx('stomp'); return true; }
        return false;
      },
      update(dt, t, g) {
        if (!this.alive) return dying(this, dt);
        this.kickCool = Math.max(0, this.kickCool - dt);
        const b = g.body;
        if (!this.shell) {
          walkerMove(this, dt, g, 0.7 * g.diff.bugSpeed);
        } else if (this.sliding) {
          this.x += this.sliding * 10 * dt;
          const ahead = Math.floor(this.x + Math.sign(this.sliding) * 0.5), at = Math.floor(this.y + 0.3);
          if (isSolid(cellAt(g, ahead, at))) this.sliding *= -1;
          // fall into pits
          if (!isSolid(cellAt(g, Math.floor(this.x), Math.floor(this.y - 0.1)))) { this.vy -= 30 * dt; this.y += this.vy * dt; if (this.y < -3) { this.alive = false; this.obj.visible = false; } }
          g.shellHits(this);
          this.obj.rotation.z += this.sliding * dt * 12;
        } else if (this.kickCool === 0 && aabb(b, this.box) && b.vy >= -0.5) {
          this.sliding = b.x < this.x ? 1 : -1; this.kickCool = 0.3; g.sfx('dash');
        }
        this.obj.position.set(this.x, this.y, 0);
        if (!this.sliding) this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
        this.box.x = this.x; this.box.y = this.y;
        if (!this.shell || this.sliding) g.touchEnemy(this);
        else if (aabb(b, this.box) && b.vy < -1 && b.y > this.y + 0.4) { this.sliding = b.x < this.x ? 1 : -1; b.vy = 9; g.sfx('stomp'); }
      },
    };
  },

  // lava blob: leaps out of the lava on a timer — can't be stomped
  blob(e) {
    const obj = make('LavaBlob'); obj.scale.setScalar(0.9);
    const seed = Math.random() * 2;
    return {
      type: 'blob', obj, s: 0.9, alive: true, squish: 0, stompable: false, dashable: false, phase: seed,
      box: { x: e.x, y: 0, w: 0.7, h: 0.7 },
      update(dt, t, g) {
        const period = 2.6 / g.diff.bugSpeed, tt = ((t + this.phase) % period) / period;
        const up = tt < 0.55 ? Math.sin((tt / 0.55) * Math.PI) : 0;
        const y = 0.3 + up * (e.height + 0.3);
        this.obj.position.set(e.x, y, 0);
        this.obj.rotation.z = tt < 0.275 ? 0 : Math.PI;
        this.obj.visible = up > 0.02;
        this.box.x = e.x; this.box.y = y - 0.35;
        if (up > 0.05) g.touchEnemy(this);
      },
    };
  },

  block(e, g) {
    const obj = make('CodeBlock'); obj.position.set(e.x + 0.5, e.y + 0.5, 0);
    return {
      type: 'block', obj, used: false, bounce: 0, x: e.x, y: e.y,
      hit(g) {
        if (this.used) { g.sfx('bump'); this.bounce = 0.5; return; }
        this.used = true; this.alive = false; this.bounce = 1;   // alive=false keeps the spent block from being re-shown
        g.grid.cells[e.y * g.grid.w + e.x] = T.USED;
        const used = make('CodeBlockUsed'); used.position.copy(this.obj.position);
        this.obj.parent.add(used); this.obj.visible = false; this.usedObj = used;
        if (e.gives === 'heart') g.spawnHeart(e.x + 0.5, e.y + 1.4);
        else { g.collectCoin(e.x + 0.5, e.y + 1.4, 3); }
        g.sfx('reward');
      },
      update(dt) {
        if (this.bounce > 0) {
          this.bounce = Math.max(0, this.bounce - dt * 5);
          const o = this.usedObj || this.obj;
          o.position.y = e.y + 0.5 + Math.sin(this.bounce * Math.PI) * 0.25;
        }
      },
    };
  },

  gate(e, g) {
    const obj = make('Gate'); obj.position.set(e.x, e.y, 0);
    const barrier = byName(obj, 'GateBarrier');
    const tall = g.grid.h - e.y;               // the light curtain reaches the sky
    barrier?.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; } });
    if (barrier) { barrier.scale.y = tall / 2.85; barrier.position.y = tall / 2; }
    if (e.power) obj.traverse(o => { if (o.isMesh && o.material.name === 'gate_stone') { o.material = o.material.clone(); o.material.color.set('#c9a24a'); o.material.metalness = 0.6; o.material.roughness = 0.35; } });
    return {
      type: 'gate', obj, topic: e.topic, power: e.power, open: false, fade: 1,
      trigger: { x: e.x - 1.1, y: e.y, w: 1.4, h: tall },
      openGate(g) {
        this.open = true;
        for (let y = e.y; y < g.grid.h; y++) if (g.grid.cells[y * g.grid.w + Math.floor(e.x)] === T.BARRIER) g.grid.cells[y * g.grid.w + Math.floor(e.x)] = T.EMPTY;
      },
      update(dt, t, g) {
        if (this.open) {
          this.fade = Math.max(0, this.fade - dt * 1.5);
          if (barrier) { barrier.scale.x = this.fade; barrier.visible = this.fade > 0.01; }
          return;
        }
        barrier?.traverse(o => { if (o.isMesh) o.material.opacity = 0.35 + Math.sin(t * 4) * 0.12; });
        if (!g.inQuiz && aabb(g.body, this.trigger)) g.reachGate(this);
      },
    };
  },

  spring(e) {
    const obj = make('Spring'); obj.position.set(e.x, e.y, 0);
    return {
      type: 'spring', obj, squash: 0, box: { x: e.x, y: e.y, w: 0.8, h: 0.6 },
      update(dt, t, g) {
        this.squash = Math.max(0, this.squash - dt * 4);
        obj.scale.y = 1 - Math.sin(this.squash * Math.PI) * 0.4;
        const b = g.body;
        if (b.vy <= 0 && aabb(b, this.box) && b.y >= e.y - 0.05 && b.dash <= 0) {   // landing on it or walking onto it
          b.vy = P.springV; b.y = e.y + 0.62; b.onGround = false; b.coyote = 0; b.springing = true; b.jumpsUsed = 1;
          this.squash = 1; g.sfx('spring'); b.jumped = 'jump';
        }
      },
    };
  },

  heart(e) { return makeHeart(e.x, e.y); },

  check(e) {
    const obj = make('Checkpoint'); obj.position.set(e.x, e.y, -0.6);
    const flag = byName(obj, 'Flag');
    return {
      type: 'check', obj, reached: false, box: { x: e.x, y: e.y, w: 1.2, h: 3 },
      update(dt, t, g) {
        if (flag) flag.rotation.y = Math.sin(t * 3) * 0.15;
        if (!this.reached && aabb(g.body, this.box)) { this.reached = true; g.setCheckpoint(e.x, e.y + 0.05); obj.scale.setScalar(1.15); }
        if (this.reached) obj.scale.setScalar(Math.max(1, obj.scale.x - dt));
      },
    };
  },

  goal(e) {
    const obj = new THREE.Group(); obj.position.set(e.x, e.y, -0.4);
    const gate = make('Gate'); gate.scale.set(1.2, 1.2, 1); obj.add(gate);
    const b = byName(gate, 'GateBarrier');
    b?.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#f2b632'); o.material.emissive?.set('#f2b632'); o.material.transparent = true; o.material.opacity = 0.35; o.castShadow = false; } });
    const flag = make('Checkpoint'); flag.position.set(-1.8, 0, 0.2); obj.add(flag);
    return {
      type: 'goal', obj, done: false, box: { x: e.x, y: e.y, w: 1.4, h: 3 },
      update(dt, t, g) {
        b?.traverse(o => { if (o.isMesh) o.material.opacity = 0.3 + Math.sin(t * 3) * 0.12; });
        if (!this.done && aabb(g.body, this.box)) { this.done = true; g.finish(); }
      },
    };
  },
};

function flyer(model, e, tint) {
  const obj = make(model); obj.scale.setScalar(1.15);
  if (tint) obj.traverse(o => { if (o.isMesh && /bat_/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(tint); o.material.emissive = new THREE.Color(tint); o.material.emissiveIntensity = 0.6; } });
  const wings = [byName(obj, 'WingL'), byName(obj, 'WingR')];
  return {
    type: 'bat', obj, s: 1.15, alive: true, squish: 0, stompable: true, dashable: true, x: e.x, y: e.y, swoop: 0, cool: Math.random() * 2,
    box: { x: e.x, y: e.y - 0.3, w: 0.8, h: 0.6 },
    update(dt, t, g) {
      if (!this.alive) { this.squish += dt; this.obj.position.y -= dt * 6; this.obj.rotation.z += dt * 8; if (this.squish > 0.8) this.obj.visible = false; return; }
      const b = g.body, home = { x: e.x + (e.axis === 'x' ? Math.sin(t * 0.9 + e.x) * e.range : 0), y: e.y + (e.axis === 'y' ? Math.sin(t * 1.2 + e.x) * e.range : Math.sin(t * 2 + e.x) * 0.3) };
      this.cool = Math.max(0, this.cool - dt);
      if (this.swoop <= 0 && this.cool === 0 && Math.abs(b.x - this.x) < 6 && b.y < this.y - 1) { this.swoop = 1.6; this.tx = b.x; this.ty = b.y + 0.6; }
      let tx = home.x, ty = home.y, k = 2;
      if (this.swoop > 0) { this.swoop -= dt; if (this.swoop > 0.8) { tx = this.tx; ty = this.ty; k = 3.2 * g.diff.bugSpeed; } else if (this.swoop <= 0) this.cool = 2; }
      this.x += (tx - this.x) * (1 - Math.exp(-k * dt)); this.y += (ty - this.y) * (1 - Math.exp(-k * dt));
      this.obj.position.set(this.x, this.y, 0);
      this.obj.rotation.y = b.x > this.x ? -0.5 : Math.PI + 0.5;
      wings.forEach((w, i) => w && (w.rotation.x = Math.sin(t * 22) * 0.7 * (i ? -1 : 1)));
      this.box.x = this.x; this.box.y = this.y - 0.3;
      g.touchEnemy(this);
    },
  };
}

export function makeHeart(x, y) {
  const obj = make('Heart'); obj.position.set(x, y, 0); obj.scale.setScalar(1.3);
  return {
    type: 'heart', obj, alive: true, box: { x, y: y - 0.3, w: 0.7, h: 0.7 },
    update(dt, t, g) {
      if (!this.alive) { this.obj.scale.multiplyScalar(1 - dt * 6); if (this.obj.scale.x < 0.05) this.obj.visible = false; return; }
      this.obj.rotation.y = t * 2; this.obj.position.y = y + Math.sin(t * 3) * 0.1;
      if (aabb(g.body, this.box)) { this.alive = false; g.gainHeart(); }
    },
  };
}
