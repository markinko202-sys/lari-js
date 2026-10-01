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
// Each entity: { obj, box:{x,y,w,h}, update(dt,t,game) } — `game` exposes player body, grid, events.
export function spawnEntities(level, scene, game) {
  const list = [];
  for (const e of level.ents) {
    const f = FACTORY[e.type];
    if (f) { const ent = f(e, game); if (ent) { scene.add(ent.obj); list.push(ent); } }
  }
  return list;
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
          if (d < 5) { this.obj.position.x += dx / d * dt * 12; e.y += dy / d * dt * 12; this.box.x = this.obj.position.x; this.box.y = e.y - 0.35; }
        }
        if (aabb(pb, this.box)) { this.alive = false; g.collectCoin(this.obj.position.x, this.obj.position.y); }
      },
    };
  },

  bug(e, g) {
    const obj = make('Bug'); obj.scale.setScalar(0.95);
    const legs = []; obj.traverse(o => { if (o.name.startsWith('BugLeg') && !o.name.includes('Mesh')) legs.push(o); });
    return {
      type: 'bug', obj, x: e.x, y: e.y, x0: e.x - e.range, x1: e.x + e.range, dir: -1, alive: true, squish: 0,
      box: { x: e.x, y: e.y, w: 0.85, h: 0.6 },
      update(dt, t, g) {
        if (!this.alive) {
          this.squish += dt;
          this.obj.scale.set(0.95 * (1 + this.squish), 0.95 * Math.max(0.05, 1 - this.squish * 4), 0.95);
          if (this.squish > 0.5) this.obj.visible = false;
          return;
        }
        const sp = 1.6 * g.diff.bugSpeed;
        this.x += this.dir * sp * dt;
        // turn at the patrol ends, walls and ledges
        const ahead = Math.floor(this.x + this.dir * 0.5), below = Math.floor(this.y - 0.5), at = Math.floor(this.y + 0.3);
        const cell = (x, y) => g.grid.cells[y * g.grid.w + x];
        if (this.x < this.x0 || this.x > this.x1 || cell(ahead, at) === T.GROUND || cell(ahead, at) === T.BARRIER || (below >= 0 && !cell(ahead, below))) {
          this.dir *= -1; this.x += this.dir * sp * dt * 2;
        }
        this.obj.position.set(this.x, this.y, 0);
        this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
        legs.forEach((l, i) => { l.rotation.y = Math.sin(t * 18 + i * 1.7) * 0.4; });
        this.box.x = this.x; this.box.y = this.y;
        g.touchEnemy(this);
      },
    };
  },

  fly(e) {
    const obj = make('FlyBug'); obj.scale.setScalar(1.1);
    const wings = [byName(obj, 'WingL'), byName(obj, 'WingR')];
    return {
      type: 'fly', obj, alive: true, squish: 0, box: { x: e.x, y: e.y - 0.3, w: 0.7, h: 0.6 },
      update(dt, t, g) {
        if (!this.alive) { this.squish += dt; this.obj.position.y -= dt * 6; this.obj.rotation.z += dt * 8; if (this.squish > 0.8) this.obj.visible = false; return; }
        const k = Math.sin(t * 1.4 + e.x);
        const x = e.axis === 'x' ? e.x + k * e.range : e.x, y = e.axis === 'y' ? e.y + k * e.range : e.y;
        this.obj.position.set(x, y, 0);
        this.obj.rotation.y = g.body.x > x ? -0.4 : Math.PI + 0.4;
        wings.forEach((w, i) => w && (w.rotation.x = Math.sin(t * 40) * 0.6 * (i ? -1 : 1)));
        this.box.x = x; this.box.y = y - 0.3;
        g.touchEnemy(this);
      },
    };
  },

  block(e, g) {
    const obj = make('CodeBlock'); obj.position.set(e.x + 0.5, e.y + 0.5, 0);
    return {
      type: 'block', obj, used: false, bounce: 0, x: e.x, y: e.y,
      hit(g) {
        if (this.used) { g.sfx('bump'); this.bounce = 0.5; return; }
        this.used = true; this.bounce = 1;
        g.grid.cells[e.y * g.grid.w + e.x] = T.USED;
        const used = make('CodeBlockUsed'); used.position.copy(this.obj.position);
        this.obj.parent.add(used); this.obj.visible = false; this.usedObj = used;
        if (e.gives === 'heart') g.spawnHeart(e.x + 0.5, e.y + 1.2);
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
    obj.scale.set(1, e.height / 3, 1);
    const barrier = byName(obj, 'GateBarrier');
    barrier?.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false; } });
    return {
      type: 'gate', obj, skill: e.skill, open: false, fade: 1,
      trigger: { x: e.x - 1.2, y: e.y, w: 1.6, h: e.height },
      openGate(g) {
        this.open = true;
        for (let k = 0; k < e.height; k++) g.grid.cells[(e.y + k) * g.grid.w + Math.floor(e.x)] = T.EMPTY;
      },
      update(dt, t, g) {
        if (this.open) {
          this.fade = Math.max(0, this.fade - dt * 1.5);
          if (barrier) { barrier.scale.set(this.fade, 1, 1); barrier.visible = this.fade > 0.01; }
          return;
        }
        barrier?.traverse(o => { if (o.isMesh) o.material.opacity = 0.45 + Math.sin(t * 4) * 0.15; });
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
        if (b.vy <= 0 && aabb(b, this.box) && b.y > e.y + 0.2) {
          b.vy = P.springV; b.y = e.y + 0.62; b.onGround = false; b.springing = true; b.jumpsUsed = 1;
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
    // the exit: a tall archway with the next place's name glowing on it
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
