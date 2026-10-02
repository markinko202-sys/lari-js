// The player's 3D rig and every interactive thing in a level.
import * as THREE from 'three';
import { make, byName, ownMaterials } from './assets.js?v=9';
import { aabb, T, P, solid, cell } from './physics.js?v=9';

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = p => p * p * (3 - 2 * p);
const bell = p => Math.sin(clamp(p, 0, 1) * Math.PI);

// per-character flavour: signature emote, voice pitch for the babble, long skirt (shorter stride)
export const CHAR_META = {
  coder:     { emote: 'wave',    voice: 1.0 },
  kucing:    { emote: 'stretch', voice: 1.5 },
  robot:     { emote: 'robot',   voice: 0.7, beep: true },
  ninja:     { emote: 'flip',    voice: 0.9 },
  astro:     { emote: 'float',   voice: 0.85 },
  siti:      { emote: 'bow',     voice: 1.35, skirt: true },
  mei:       { emote: 'dance',   voice: 1.45 },
  priya:     { emote: 'cheer',   voice: 1.3 },
  puteri:    { emote: 'twirl',   voice: 1.25, skirt: true },
  kancil:    { emote: 'hop',     voice: 1.7 },
  harimau:   { emote: 'roar',    voice: 0.6 },
  kenyalang: { emote: 'flap',    voice: 1.15 },
};

// Emotes write pose targets for progress p (0…1). Conventions (same for both sides, so a pose can't fold into the body):
//   armL / armR   swing forward (+) or back (−)      armLx / armRx   raise out to the side (+), in toward the chest (−)
//   legL / legR   swing forward (+)                  head            tilt back (+) / forward (−)
//   lean          forward (−) / back (+)             y lift · spin turn · flip somersault about the waist · tail swish
export const EMOTES = {
  wave(k, p, t) { k.armRx = 2.45 + Math.sin(t * 16) * 0.3; k.armR = 0.25; k.head = 0.12; k.y = bell(p * 1.2) * 0.04; },
  stretch(k, p, t) { const s = bell(p); k.lean = -0.45 * s; k.armL = 1.5 * s; k.armR = 1.5 * s; k.legR = -0.5 * s; k.tail = 1.0 * s + Math.sin(t * 10) * 0.3; k.head = 0.2 * s; },
  robot(k, p) { const st = Math.floor(p * 6); k.armL = st % 2 ? 1.57 : 0; k.armR = st % 2 ? 0 : 1.57; k.head = st % 3 === 1 ? 0.3 : st % 3 === 2 ? -0.2 : 0; k.y = (st % 2) * 0.04; k.snap = true; },
  flip(k, p) { const q = clamp((p - 0.15) / 0.6, 0, 1); k.y = bell(q) * 1.1; k.flip = ease(q) * Math.PI * 2; k.legL = k.legR = 0.9 * bell(q); k.armL = k.armR = 1.1 * bell(q); if (p > 0.8) { k.armRx = 1.4; k.armL = 0.6; } },
  float(k, p, t) { const s = bell(p); k.y = s * 0.9; k.armLx = 1.1 * s; k.armRx = 1.1 * s; k.legL = 0.25 * s; k.legR = -0.2 * s; k.spin = Math.sin(t * 1.4) * 0.4 * s; k.lean = Math.sin(t * 2) * 0.1 * s; },
  bow(k, p) { const s = bell(p); k.armR = 1.25 * s; k.armRx = -0.25 * s; k.armL = 0.2 * s; k.lean = -0.38 * s; k.head = -0.15 * s; },
  dance(k, p, t) { const s = bell(p), b = Math.sin(t * 12); k.y = Math.abs(b) * 0.18 * s; k.spin = b * 0.5 * s; k.armLx = (1.6 + b * 0.8) * s; k.armRx = (1.6 - b * 0.8) * s; k.legL = b * 0.4 * s; k.legR = -b * 0.4 * s; },
  cheer(k, p, t) { const s = bell(p), b = Math.sin(t * 14); k.armLx = (2.4 + b * 0.2) * s; k.armRx = (2.4 - b * 0.2) * s; k.y = Math.abs(Math.sin(t * 7)) * 0.2 * s; k.head = 0.15 * s; },
  twirl(k, p) { const q = clamp(p / 0.7, 0, 1); k.spin = ease(q) * Math.PI * 2; k.armLx = 1.3 * bell(q); k.armRx = 1.3 * bell(q); const c = clamp((p - 0.7) / 0.3, 0, 1); k.legR = -0.35 * bell(c); k.lean = -0.12 * bell(c); k.armLx += 0.5 * bell(c); k.armRx += 0.5 * bell(c); },   // spin, then a curtsy: one foot back, never sinking
  hop(k, p, t) { const s = bell(p); k.y = Math.abs(Math.sin(p * Math.PI * 3)) * 0.45 * s; k.legL = k.legR = 0.4 * s; k.head = Math.sin(t * 20) * 0.15 * s; k.tail = Math.sin(t * 25) * 0.8; },
  roar(k, p, t) { const s = bell(p); k.lean = (p < 0.35 ? 0.25 : -0.3) * s; k.armL = k.armR = 1.9 * s; k.armLx = k.armRx = 0.4 * s; k.head = (p < 0.35 ? 0.3 : -0.2 + Math.sin(t * 40) * 0.05) * s; k.tail = 1.2 * s; },
  flap(k, p, t) { const s = bell(p), f = Math.sin(t * 22); k.armLx = k.armRx = (1.2 + f * 0.9) * s; k.y = (0.25 + Math.sin(t * 11) * 0.08) * s; k.tail = 0.6 * s; },
  victory(k, p, t) { k.armLx = k.armRx = 2.45; k.y = Math.abs(Math.sin(t * 6)) * 0.35; },
};
export const EMOTE_TIME = { flip: 1.4, twirl: 1.7, robot: 1.8, victory: 99 };
const POSE_KEYS = ['legL', 'legR', 'armL', 'armR', 'armLx', 'armRx', 'head', 'lean', 'y', 'spin', 'flip', 'tail'];
const PIVOT = 0.85;   // waist height of every character
const _rigInv = new THREE.Matrix4(), _rigM = new THREE.Matrix4(), _rigC = new THREE.Vector3();

// ------------------------------------------------------------------ player visual
export class Rig {
  constructor(charId, hatId, trailColor, scene) {
    this.id = charId; this.meta = CHAR_META[charId] || CHAR_META.coder;
    this.root = new THREE.Group();
    this.model = make(`Char_${charId}`);
    // flips spin about the waist (a pivot group), never about the feet — the head stays above the ground
    this.flipper = new THREE.Group(); this.flipper.position.y = PIVOT;
    this.root.add(this.flipper); this.flipper.add(this.model); this.model.position.y = -PIVOT;
    const get = n => byName(this.model, n);
    this.parts = { legL: get('LegL'), legR: get('LegR'), armL: get('ArmL'), armR: get('ArmR'), head: get('Head'), tail: get('Tail') || get('Braid') };
    if (hatId && hatId !== 'none') {
      const anchor = get('HatAnchor');
      const hat = make(`Hat_${hatId}`);
      (anchor || this.parts.head || this.model).add(hat);
      this.tuckUnderHat(hat);
    }
    // own copies of the materials, so the star glow tints only this rig
    this.mats = ownMaterials(this.root).map(m => ({ m, e: m.emissive?.clone(), i: m.emissiveIntensity }));
    this.meshes = []; this.root.traverse(o => { if (o.isMesh) { o.geometry.boundingBox || o.geometry.computeBoundingBox(); this.meshes.push(o); } });
    this.lift = 0;
    this.phase = 0; this.squash = 1; this.yaw = -0.55; this.turn = 0; this.facingOffset = -0.25;
    this.emoteName = null; this.emoteT = 0;
    this.k = {};
    this.trail = trailColor ? new Trail(trailColor, scene) : null;
  }
  // ears, buns, a tiara or an antenna the hat would swallow are tucked under it (both ears at once),
  // the way hats work on animal characters; a hat that doesn't touch them leaves them alone
  tuckUnderHat(hat) {
    this.root.updateMatrixWorld(true);
    const inHat = new Set(); hat.traverse(o => inHat.add(o));
    const hatMeshes = [], hatVols = [];
    hat.traverse(o => { if (o.isMesh) { hatMeshes.push(o); const v = ellipsoid(o, 0.02); if (v) hatVols.push(v); } });
    for (const re of [/^Ear/, /^Bun/, /^Tiara/, /^Antenna/]) {
      const group = []; (this.parts.head || this.model).traverse(o => { if (o.isMesh && !inHat.has(o) && re.test(o.name)) group.push(o); });
      const clash = m => hatVols.some(v => sinksInto(m, v)) || hatMeshes.some(h => { const v = ellipsoid(m, 0.02); return v && sinksInto(h, v); });
      if (group.some(clash)) for (const m of group) m.visible = false;
    }
  }
  emote(name = this.meta.emote) { this.emoteName = name; this.emoteT = 0; }
  get emoting() { return !!this.emoteName; }

  // b: physics body (null in menus); mode: 'play' | 'menu'
  update(dt, t, b, mode = 'play') {
    const p = this.parts, k = this.k;
    for (const key of POSE_KEYS) k[key] = 0;
    k.snap = false;
    let yaw;
    if (mode === 'menu') {
      // face the camera, breathe, sway a little; the player can drag to turn
      const breathe = Math.sin(t * 2);
      k.armL = 0.05; k.armR = 0.05; k.armLx = k.armRx = 0.12 + breathe * 0.05;
      k.head = Math.sin(t * 1.3) * 0.06; k.y = Math.abs(Math.sin(t * 2)) * 0.02; k.tail = Math.sin(t * 3) * 0.3;
      yaw = -Math.PI / 2 + this.facingOffset + Math.sin(t * 0.7) * 0.18 + this.turn;
    } else {
      const speed = Math.abs(b.vx);
      // face direction, turned toward the camera so the face reads
      const targetYaw = b.facing > 0 ? -0.55 : Math.PI + 0.55;
      this.yaw = damp(this.yaw, targetYaw, 14, dt);
      yaw = this.yaw;
      let legA = 0, armA = 0, lean = 0, armOut = 0;
      if (b.pound) { legA = 0.9; armOut = 2.3; }                          // arms up for the slam
      else if (b.dash > 0) { lean = -0.5; legA = 0.6; armA = -1.0; }
      else if (!b.onGround) {
        if (b.gliding) { armOut = 1.4; legA = 0.25; lean = -0.15; }
        else if (b.sliding) { armOut = 1.9; legA = 0.3; lean = 0.15; }      // hands up on the wall
        else { legA = b.vy > 0 ? 0.7 : 0.35; armA = b.vy > 0 ? -1.2 : -0.6; }
      } else if (speed > 0.2) {
        this.phase += dt * (6 + speed * 1.6);
        legA = Math.sin(this.phase) * Math.min(1, speed / 5) * (this.meta.skirt ? 0.5 : 0.9);
        armA = -legA * 0.8; lean = -Math.min(0.18, speed * 0.025);
      } else this.phase = 0;
      k.legL = legA; k.legR = b.onGround && speed > 0.2 ? -legA : -legA * 0.4;
      k.armL = armA; k.armR = -armA; k.armLx = k.armRx = armOut;
      k.lean = lean;                                                        // the model is already turned to face its way
      k.head = b.onGround ? Math.sin(this.phase * 2) * 0.04 : 0.08;
      k.tail = Math.sin(t * 6 + this.phase) * 0.35;
      k.y = b.onGround && speed > 0.2 ? Math.abs(Math.sin(this.phase)) * 0.06 : 0;
      if (b.pound && b.poundHang > 0) k.flip = -(1 - b.poundHang / P.poundHang) * Math.PI * 2;   // a quick front flip before the drop
    }
    // a signature emote overrides the pose while it plays
    if (this.emoteName) {
      this.emoteT += dt;
      const dur = EMOTE_TIME[this.emoteName] || 1.6, pr = this.emoteT / dur;
      if (pr >= 1) this.emoteName = null;
      else EMOTES[this.emoteName](k, pr, t);
    }
    const s = k.snap ? 40 : 16;
    p.legL && (p.legL.rotation.z = damp(p.legL.rotation.z, k.legL, s, dt));
    p.legR && (p.legR.rotation.z = damp(p.legR.rotation.z, k.legR, s, dt));
    p.armL && (p.armL.rotation.z = damp(p.armL.rotation.z, k.armL, s, dt));
    p.armR && (p.armR.rotation.z = damp(p.armR.rotation.z, k.armR, s, dt));
    p.armL && (p.armL.rotation.x = damp(p.armL.rotation.x, k.armLx, s, dt));     // left: + turns outward
    p.armR && (p.armR.rotation.x = damp(p.armR.rotation.x, -k.armRx, s, dt));    // right: mirrored
    p.head && (p.head.rotation.z = damp(p.head.rotation.z, k.head, 10, dt));
    p.tail && (p.tail.rotation.x = damp(p.tail.rotation.x, k.tail, 12, dt));
    this.model.rotation.y = yaw + k.spin;
    this.lean = damp(this.lean || 0, k.lean, 12, dt);
    this.model.rotation.z = this.lean;
    // somersaults happen in the screen plane: backflip = away from where you face
    this.flipper.rotation.z = k.flip * (b && b.facing < 0 ? -1 : 1);

    // squash & stretch
    if (b?.landed) this.squash = 0.78;
    if (b?.jumped) { this.squash = 1.18; b.jumped = null; }
    this.squash = damp(this.squash, 1, 10, dt);
    this.model.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));
    // a lift (hop, flip, float) raises the whole spinning body — applied outside the rotation, so upside down it still goes up
    this.bob = damp(this.bob || 0, k.y, 20, dt);
    this.model.position.y = -PIVOT;
    this.flipper.position.y = PIVOT + this.bob;
    if (b) this.root.position.set(b.x, b.y, 0);
    // nothing may sink below the floor the character stands on (the bottom of its physics box):
    // if a pose dips a toe, a hand or the head under it, the body rises and rests on that point instead
    const low = this.lowestPoint();
    this.lift = low < 0 ? -low : 0;
    if (this.lift) this.flipper.position.y += this.lift;
    if (b && this.trail) this.trail.update(dt, b, Math.abs(b.vx) > 3 || b.dash > 0 || b.gliding);
  }
  // the lowest corner of any part, in the rig's own space (0 = the floor under its feet)
  lowestPoint() {
    this.root.updateMatrixWorld(true);
    _rigInv.copy(this.root.matrixWorld).invert();
    let min = Infinity;
    for (const m of this.meshes) {
      if (!m.visible) continue;
      _rigM.multiplyMatrices(_rigInv, m.matrixWorld);
      const a = m.geometry.boundingBox.min, z = m.geometry.boundingBox.max;
      for (let i = 0; i < 8; i++) {
        _rigC.set(i & 1 ? z.x : a.x, i & 2 ? z.y : a.y, i & 4 ? z.z : a.z).applyMatrix4(_rigM);
        if (_rigC.y < min) min = _rigC.y;
      }
    }
    return min;
  }
  setInvulnerable(on, t) { this.model.visible = !on || Math.sin(t * 40) > -0.2; }
  // star power: a cycling rainbow glow
  setGlow(on, t) {
    if (!on && !this.glowing) return;
    for (const { m, e, i } of this.mats) {
      if (!m.emissive) continue;
      if (on) { m.emissive.setHSL((t * 1.5) % 1, 1, 0.5); m.emissiveIntensity = 0.55; }
      else { m.emissive.copy(e); m.emissiveIntensity = i; }
    }
    this.glowing = on;
  }
  // where a speech bubble should point
  headWorld(v) { (this.parts.head || this.model).getWorldPosition(v); v.y += 0.85; return v; }
  dispose() { this.trail?.dispose(); }
}

// a mesh's volume as the ellipsoid inside its local bounding box (good enough for rounded toy parts)
function ellipsoid(mesh, minSize) {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox, s = bb.getSize(new THREE.Vector3());
  if (Math.min(s.x, s.y, s.z) < minSize) return null;
  return { mesh, c: bb.getCenter(new THREE.Vector3()), h: s.multiplyScalar(0.46) };
}
const _p = new THREE.Vector3(), _toLocal = new THREE.Matrix4();
// do several of this mesh's vertices sit well inside that volume?
function sinksInto(mesh, vol) {
  const pos = mesh.geometry.attributes.position;
  _toLocal.copy(vol.mesh.matrixWorld).invert().multiply(mesh.matrixWorld);
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(_toLocal);
    const dx = (_p.x - vol.c.x) / vol.h.x, dy = (_p.y - vol.c.y) / vol.h.y, dz = (_p.z - vol.c.z) / vol.h.z;
    if (dx * dx + dy * dy + dz * dz < 0.884 && ++n > 1) return true;     // deeper than ~6% of the volume
  }
  return false;
}

class Trail {
  constructor(color, scene) {
    this.n = 40; this.i = 0; this.acc = 0; this.t = 0;
    this.rainbow = color === 'rainbow';
    this.pos = new Float32Array(this.n * 3).fill(-999); this.life = new Float32Array(this.n);
    this.col = new Float32Array(this.n * 3).fill(1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: this.rainbow ? '#ffffff' : color, vertexColors: this.rainbow, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points); this.scene = scene;
    this.c = new THREE.Color();
  }
  update(dt, b, emit) {
    this.acc += dt; this.t += dt;
    if (emit && this.acc > 0.025) {
      this.acc = 0; const k = this.i++ % this.n;
      this.pos.set([b.x - b.facing * 0.25 + (Math.random() - 0.5) * 0.2, b.y + 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4], k * 3);
      if (this.rainbow) { this.c.setHSL((this.t * 0.8) % 1, 1, 0.6); this.col.set([this.c.r, this.c.g, this.c.b], k * 3); }
      this.life[k] = 1;
    }
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] > 0) { this.life[k] -= dt * 2.2; this.pos[k * 3 + 1] += dt * 0.6; if (this.life[k] <= 0) this.pos[k * 3 + 1] = -999; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    if (this.rainbow) this.points.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
}

// ------------------------------------------------------------------ one-shot particle bursts
export class Bursts {
  constructor(scene) {
    this.n = 260; this.pos = new Float32Array(this.n * 3).fill(-999); this.vel = new Float32Array(this.n * 3);
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
    const ent = f(e, game, difficulty);
    if (!ent) continue;
    ent.x0 = e.x ?? 0;
    scene.add(ent.obj); list.push(ent);
  }
  return list;
}

const tinted = (obj, hex, emissive = 0, re = /shell|Shell|BatBody|bat_fur|bat_wing|Wing/) => {
  obj.traverse(o => {
    if (!o.isMesh || !re.test(o.material.name + o.name)) return;
    o.material = o.material.clone(); o.material.color.set(hex);
    if (emissive) { o.material.emissive = new THREE.Color(hex); o.material.emissiveIntensity = emissive; }
  });
  return obj;
};
const cellAt = (g, x, y) => cell(g.grid, x, y);

// a walker that patrols its range, turning at walls, spikes and ledges
function walkerMove(en, dt, g, speed) {
  en.x += en.dir * speed * dt;
  const ahead = Math.floor(en.x + en.dir * 0.5), at = Math.floor(en.y + 0.3), below = Math.floor(en.y - 0.5);
  const wall = solid(cellAt(g, ahead, at)) || cellAt(g, ahead, at) === T.SPIKE;
  const ledge = below >= 0 && !solid(cellAt(g, ahead, below));
  if (en.x < en.xmin || en.x > en.xmax || wall || ledge) { en.dir *= -1; en.x += en.dir * speed * dt * 2; }
}
function dying(en, dt) {
  en.squish += dt;
  en.obj.scale.set(en.s * (1 + en.squish), en.s * Math.max(0.05, 1 - en.squish * 4), en.s);
  if (en.squish > 0.45) en.obj.visible = false;
}
function falling(en, dt) {   // knocked out of the air
  en.squish += dt; en.obj.position.y -= dt * 6; en.obj.rotation.z += dt * 8;
  if (en.squish > 0.8) en.obj.visible = false;
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

// patrols, then — after a wind-up you can see — charges when it spots you; `leap` hops at you when close
function charger(model, e, opts) {
  const en = walker(model, e, opts);
  const head = opts.head ? byName(en.obj, opts.head) : null, base = en.update;
  en.charge = 0; en.cool = 0; en.wind = 0; en.vy = 0; en.hopY = 0;
  en.update = function (dt, t, g) {
    if (!this.alive) return dying(this, dt);
    const b = g.body, dx = b.x - this.x;
    this.cool = Math.max(0, this.cool - dt);
    if (this.charge <= 0 && this.wind <= 0 && this.cool === 0 && Math.abs(dx) < 7 && Math.abs(b.y - this.y) < 1.5 && Math.sign(dx) === this.dir) { this.wind = 0.4; g.sfx('alert'); }
    if (this.wind > 0) {                         // the tell: crouch and shake
      this.wind -= dt;
      this.obj.position.set(this.x + Math.sin(t * 60) * 0.05, this.y, 0);
      this.obj.scale.set(this.s * 1.1, this.s * 0.85, this.s);
      if (head) head.rotation.z = -0.6;
      if (this.wind <= 0) { this.charge = 1.3; this.obj.scale.setScalar(this.s); }
      this.box.x = this.x; g.touchEnemy(this);
      return;
    }
    if (this.charge > 0) {
      this.charge -= dt; if (this.charge <= 0) this.cool = 1.5;
      walkerMove(this, dt, g, (opts.chargeSpeed || 4.6) * g.diff.bugSpeed);
      if (opts.leap && this.hopY === 0 && this.vy === 0 && Math.abs(dx) < 3 && Math.sign(dx) === this.dir) this.vy = 9;
      if (this.vy || this.hopY > 0) { this.vy -= 30 * dt; this.hopY = Math.max(0, this.hopY + this.vy * dt); if (this.hopY === 0) this.vy = 0; }
      this.obj.position.set(this.x, this.y + this.hopY + Math.abs(Math.sin(t * 22)) * 0.08, 0);
      this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
      if (head) head.rotation.z = -0.5;
      this.box.x = this.x; this.box.y = this.y + this.hopY; g.touchEnemy(this);
      return;
    }
    this.hopY = 0; this.vy = 0; this.box.y = this.y;
    if (head) head.rotation.z = Math.sin(t * 6) * 0.25;
    base.call(this, dt, t, g);
  };
  return en;
}

// hovers, rises a touch (the tell), then swoops at you
function flyer(model, e, tint, opts = {}) {
  const obj = make(model); obj.scale.setScalar(opts.scale || 1.15);
  if (tint) obj.traverse(o => { if (o.isMesh && /bat_/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(tint); o.material.emissive = new THREE.Color(tint); o.material.emissiveIntensity = 0.6; } });
  const wings = [byName(obj, 'WingL'), byName(obj, 'WingR')];
  const rotors = []; obj.traverse(o => { if (/^Wing[LR]\d/.test(o.name) && !o.isMesh) rotors.push(o); });
  return {
    type: 'bat', obj, s: 1.15, alive: true, squish: 0, stompable: true, dashable: true, x: e.x, y: e.y, swoop: 0, cool: Math.random() * 2,
    box: { x: e.x, y: e.y - 0.3, w: 0.8, h: 0.6 },
    update(dt, t, g) {
      if (!this.alive) return falling(this, dt);
      const b = g.body, home = { x: e.x + (e.axis === 'x' ? Math.sin(t * 0.9 + e.x) * e.range : 0), y: e.y + (e.axis === 'y' ? Math.sin(t * 1.2 + e.x) * e.range : Math.sin(t * 2 + e.x) * 0.3) };
      this.cool = Math.max(0, this.cool - dt);
      if (this.swoop <= 0 && this.cool === 0 && Math.abs(b.x - this.x) < 6 && b.y < this.y - 1) { this.swoop = 1.9; this.tx = b.x; this.ty = b.y + 0.6; g.sfx('alert'); }
      let tx = home.x, ty = home.y, k = 2;
      if (this.swoop > 0) {
        this.swoop -= dt;
        if (this.swoop > 1.6) { ty = this.y + 0.6; k = 6; }
        else if (this.swoop > 0.8) { tx = this.tx; ty = this.ty; k = 3.2 * g.diff.bugSpeed; }
        else if (this.swoop <= 0) this.cool = 2;
      }
      this.x += (tx - this.x) * (1 - Math.exp(-k * dt)); this.y += (ty - this.y) * (1 - Math.exp(-k * dt));
      this.obj.position.set(this.x, this.y, 0);
      this.obj.rotation.y = b.x > this.x ? -0.5 : Math.PI + 0.5;
      wings.forEach((w, i) => w && (w.rotation.x = Math.sin(t * 22) * 0.7 * (i ? -1 : 1)));
      rotors.forEach((r, i) => { r.rotation.y = t * 40 + i; });
      this.box.x = this.x; this.box.y = this.y - 0.3;
      g.touchEnemy(this);
    },
  };
}

// leaps out of lava / the sea on a timer (a splash first); can't be stomped
function jumper(model, e, opts) {
  const obj = make(model); obj.scale.setScalar(0.9);
  const seed = Math.random() * 2;
  return {
    type: opts.type, obj, s: 0.9, alive: true, squish: 0, stompable: false, dashable: !!opts.dashable, fireproof: !!opts.fireproof, phase: seed,
    box: { x: e.x, y: 0, w: 0.7, h: 0.7 }, warned: false,
    update(dt, t, g) {
      if (!this.alive) return falling(this, dt);
      const period = 2.6 / g.diff.bugSpeed, tt = ((t + this.phase) % period) / period;
      const up = tt < 0.55 ? Math.sin((tt / 0.55) * Math.PI) : 0;
      if (tt > 0.85 && !this.warned) { this.warned = true; g.splash(e.x, 0.7, opts.splash); }   // the tell
      if (tt < 0.5) this.warned = false;
      const y = 0.3 + up * (e.height + 0.3);
      this.obj.position.set(e.x, y, 0);
      this.obj.rotation.z = opts.flip && tt >= 0.275 ? Math.PI : 0;
      this.obj.visible = up > 0.02;
      this.box.x = e.x; this.box.y = y - 0.35;
      if (up > 0.05) g.touchEnemy(this);
    },
  };
}

const BOSS = {
  ayam:   { model: 'Ayam', scale: 2.4, box: [1.6, 2.1], tint: [/ayam_brown|ayam_tail/, '#c8312b'], speed: 2.4 },
  beetle: { model: 'Bug', scale: 2.7, box: [2.1, 1.5], tint: [/bug_shell/, '#3f8f4a'], speed: 2.6 },
  crab:   { model: 'MagmaCrab', scale: 2.3, box: [2.2, 1.6], spiky: true, speed: 2.2 },
  ketam:  { model: 'Ketam', scale: 2.7, box: [2.2, 1.5], speed: 2.8 },
  kera:   { model: 'Kera', scale: 2.3, box: [1.5, 2.3], speed: 3.0 },
  robot:  { model: 'Char_robot', scale: 1.9, box: [1.3, 3.0], tint: [/robot_/, '#4a3a4a'], glow: '#ff2a2a', speed: 2.6 },
};

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
        if (g.magnet && !g.dead) {
          const dx = pb.x - this.obj.position.x, dy = pb.y + 0.7 - this.obj.position.y, d = Math.hypot(dx, dy);
          if (d < 5 && d > 0.01) { this.obj.position.x += dx / d * dt * 12; e.y += dy / d * dt * 12; this.box.x = this.obj.position.x; this.box.y = e.y - 0.35; }
        }
        if (!g.dead && aabb(pb, this.box)) { this.alive = false; g.collectCoin(this.obj.position.x, this.obj.position.y); }
      },
    };
  },

  bug: e => walker('Bug', e, { type: 'bug' }),
  beetle: e => walker('Bug', e, { type: 'beetle', tint: '#3f8f4a', speed: 1.9 }),
  crab: e => walker('MagmaCrab', e, { type: 'crab', stompable: false, speed: 1.3, scale: 1.0, w: 1.0, h: 0.8 }),
  ketam: e => walker('Ketam', e, { type: 'ketam', speed: 2.1, scale: 0.95, w: 0.95, h: 0.7 }),
  lipan: e => walker('Lipan', e, { type: 'lipan', speed: 1.7, scale: 1.0, w: 1.0, h: 0.5 }),
  robovac: e => walker('RoboVac', e, { type: 'robovac', speed: 2.2, scale: 1.0, w: 0.9, h: 0.45 }),

  ayam: e => charger('Ayam', e, { type: 'ayam', speed: 1.2, scale: 1.0, w: 0.8, h: 0.9, head: 'AyamHead' }),
  kera: e => charger('Kera', e, { type: 'kera', speed: 1.4, scale: 0.95, w: 0.8, h: 1.0, chargeSpeed: 4.2, leap: true }),
  merpati: e => charger('Merpati', e, { type: 'merpati', speed: 1.0, scale: 1.0, w: 0.7, h: 0.8, chargeSpeed: 3.8 }),

  bat: e => flyer('Kelawar', e, null),
  firebat: e => flyer('Kelawar', e, '#ff5a1f'),
  cavebat: e => flyer('Kelawar', e, '#3fd0c0'),
  camar: e => flyer('Camar', e, null, { scale: 1.2 }),
  drone: e => flyer('Drone', e, null, { scale: 1.1 }),
  fly(e) {
    const obj = make('FlyBug'); obj.scale.setScalar(1.1);
    const wings = [byName(obj, 'WingL'), byName(obj, 'WingR')];
    return {
      type: 'fly', obj, s: 1.1, alive: true, squish: 0, stompable: true, dashable: true, box: { x: e.x, y: e.y - 0.3, w: 0.7, h: 0.6 },
      update(dt, t, g) {
        if (!this.alive) return falling(this, dt);
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

  // forest spider: waits up high, wiggles, then drops on its thread when you pass underneath
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
        if (this.state === 'wait' && Math.abs(b.x - e.x) < 3.2 && b.y < top) { this.state = 'tell'; this.timer = 0.3; g.sfx('alert'); }
        if (this.state === 'tell') { this.timer -= dt; if (this.timer <= 0) this.state = 'drop'; }
        else if (this.state === 'drop') { this.y = Math.max(bottom + 0.5, this.y - dt * 9); if (this.y <= bottom + 0.5) { this.state = 'hold'; this.timer = 1.4; } }
        else if (this.state === 'hold') { this.timer -= dt; if (this.timer <= 0) this.state = 'up'; }
        else if (this.state === 'up') { this.y = Math.min(top, this.y + dt * 2.5); if (this.y >= top) this.state = 'wait'; }
        const sway = this.state === 'wait' ? Math.sin(t * 2) * 0.1 : this.state === 'tell' ? Math.sin(t * 50) * 0.08 : 0;
        obj.position.set(e.x + sway, this.y, 0);
        obj.rotation.y = -Math.PI / 2;
        const p = thread.geometry.attributes.position; p.setXYZ(0, e.x, top + 6, 0); p.setXYZ(1, e.x + sway, this.y + 0.2, 0); p.needsUpdate = true;
        this.box.x = e.x; this.box.y = this.y - 0.4;
        g.touchEnemy(this);
      },
    };
  },

  // cave stalactite: shivers when you walk below, then drops and shatters; grows back
  stalactite(e) {
    const obj = make('Stalactite'); obj.scale.setScalar(0.9);
    return {
      type: 'stalactite', obj, s: 0.9, alive: true, squish: 0, stompable: false, dashable: true, y: e.y, vy: 0, state: 'wait', timer: 0,
      box: { x: e.x, y: e.y - 1.0, w: 0.6, h: 1.0 },
      update(dt, t, g) {
        if (!this.alive) {
          obj.visible = false; this.timer -= dt;
          if (this.timer <= 0) { this.alive = true; this.state = 'grow'; this.y = e.y; this.timer = 0.8; obj.visible = true; }
          return;
        }
        const b = g.body;
        if (this.state === 'wait' && Math.abs(b.x - e.x) < 1.8 && b.y < e.y) { this.state = 'tell'; this.timer = 0.45; g.sfx('rumble'); }
        if (this.state === 'grow') { this.timer -= dt; obj.scale.setScalar(0.9 * (1 - Math.max(0, this.timer) / 0.8)); if (this.timer <= 0) this.state = 'wait'; }
        else if (this.state === 'tell') { this.timer -= dt; if (this.timer <= 0) { this.state = 'fall'; this.vy = 0; } }
        else if (this.state === 'fall') {
          this.vy -= 40 * dt; this.y += this.vy * dt;
          if (this.y - 1.0 <= e.floor) { this.alive = false; this.timer = 4; g.splash(e.x, e.floor + 0.3, '#b3aa98', 16); g.sfx('crumble'); g.shake(0.25); return; }
        }
        obj.position.set(e.x + (this.state === 'tell' ? Math.sin(t * 70) * 0.06 : 0), this.y, 0);
        this.box.x = e.x; this.box.y = this.y - 1.0;
        if (this.state === 'fall') g.touchEnemy(this);
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
          if (solid(cellAt(g, ahead, at))) this.sliding *= -1;
          // fall into pits, land on lower ground
          if (!solid(cellAt(g, Math.floor(this.x), Math.floor(this.y - 0.05)))) {
            this.vy -= 30 * dt; this.y += this.vy * dt;
            if (solid(cellAt(g, Math.floor(this.x), Math.floor(this.y)))) { this.y = Math.floor(this.y) + 1; this.vy = 0; }
          }
          // a shell that leaves the screen is gone for good (it used to clear enemies across the whole level)
          if (this.y < -3 || Math.abs(this.x - b.x) > 24) { this.alive = false; this.squish = 1; this.obj.visible = false; this.sliding = 0; return; }
          g.shellHits(this);
          this.obj.rotation.z += this.sliding * dt * 12;
        } else if (this.kickCool === 0 && aabb(b, this.box) && b.vy >= -0.5) {
          this.sliding = b.x < this.x ? 1 : -1; this.kickCool = 0.3; g.sfx('dash');
        }
        this.obj.position.set(this.x, this.y, 0);
        if (!this.sliding) this.obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
        this.box.x = this.x; this.box.y = this.y;
        // the player who just kicked it gets a moment to get clear
        if (!this.shell || (this.sliding && this.kickCool === 0)) g.touchEnemy(this);
        else if (aabb(b, this.box) && b.vy < -1 && b.y > this.y + 0.4) { this.sliding = b.x < this.x ? 1 : -1; this.kickCool = 0.3; b.vy = 9; g.sfx('stomp'); }
      },
    };
  },

  blob: e => jumper('LavaBlob', e, { type: 'blob', flip: true, fireproof: true, splash: '#ff7a1f' }),
  oborobor: e => jumper('OborObor', e, { type: 'oborobor', dashable: true, splash: '#bfeaff' }),

  block(e) {
    const obj = make('CodeBlock'); obj.position.set(e.x + 0.5, e.y + 0.5, 0);
    if (e.hidden) obj.visible = false;
    return {
      type: 'block', obj, used: false, bounce: 0, x: e.x, y: e.y, alive: !e.hidden,   // hidden: stays invisible (never culled back in) until found
      hit(g) {
        if (this.used) { g.sfx('bump'); this.bounce = 0.5; return; }
        this.used = true; this.alive = false; this.bounce = 1;   // alive=false keeps the spent block from being re-shown
        g.grid.cells[e.y * g.grid.w + e.x] = T.USED;
        const used = make('CodeBlockUsed'); used.position.copy(this.obj.position);
        this.obj.parent.add(used); this.obj.visible = false; this.usedObj = used;
        if (e.hidden) g.floater(e.x + 0.5, e.y + 1.4, '!', 'gold');
        if (e.gives === 'coin') g.collectCoin(e.x + 0.5, e.y + 1.4, 3);
        else g.spawn(e.gives, e.x + 0.5, e.y + 1.4);
        g.sfx(e.gives === 'coin' ? 'reward' : 'powerup');
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
    barrier?.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false;
      if (e.boss) { o.material.color.set('#ff4a3a'); o.material.emissive?.set('#ff4a3a'); }
    });
    if (barrier) { barrier.scale.y = tall / 2.85; barrier.position.y = tall / 2; }
    if (e.power || e.boss) obj.traverse(o => { if (o.isMesh && o.material.name === 'gate_stone') { o.material = o.material.clone(); o.material.color.set(e.boss ? '#5a2a2a' : '#c9a24a'); o.material.metalness = 0.6; o.material.roughness = 0.35; } });
    return {
      type: 'gate', obj, topic: e.topic, power: e.power, boss: e.boss, open: false, fade: 1, nag: 0,
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
        this.nag = Math.max(0, this.nag - dt);
        if (!g.inQuiz && aabb(g.body, this.trigger)) {
          if (!this.boss) g.reachGate(this);
          else if (this.nag === 0) { this.nag = 3; g.bossNag(); }
        }
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
          b.vy = P.springV; b.y = e.y + 0.62; b.onGround = false; b.coyote = 0; b.springing = true; b.jumpsUsed = 1; b.pound = 0;
          this.squash = 1; g.sfx('spring'); b.jumped = 'jump';
        }
      },
    };
  },

  heart(e) { return makePickup('heart', e.x, e.y); },

  check(e) {
    const obj = make('Checkpoint'); obj.position.set(e.x, e.y, -0.6);
    const flag = byName(obj, 'Flag');
    return {
      type: 'check', obj, reached: false, box: { x: e.x, y: e.y, w: 1.2, h: 3 },
      update(dt, t, g) {
        if (flag) flag.rotation.y = Math.sin(t * 3) * 0.15;
        if (!this.reached && !g.dead && aabb(g.body, this.box)) { this.reached = true; g.setCheckpoint(e.x, e.y + 0.05); obj.scale.setScalar(1.15); }
        if (this.reached) obj.scale.setScalar(Math.max(1, obj.scale.x - dt));
      },
    };
  },

  // the flagpole: grab it as high as you can — the higher, the bigger the bonus
  goal(e) {
    const obj = make('Flagpole'); obj.position.set(e.x, e.y, -0.2);
    const flag = byName(obj, 'Flag');
    return {
      type: 'goal', obj, done: false, flagY: flag ? flag.position.y : 8.4, x: e.x, y: e.y, box: { x: e.x, y: e.y, w: 0.4, h: 9.6 },
      update(dt, t, g) {
        if (flag) { flag.rotation.y = Math.sin(t * 4) * 0.12; flag.position.y = this.flagY; }
        if (!this.done && !g.dead && aabb(g.body, this.box)) { this.done = true; g.grabPole(this, g.body.y - e.y); }
      },
    };
  },

  boss(e, g, difficulty) {
    const spec = BOSS[e.kind] || BOSS.ayam;
    const obj = make(spec.model); obj.scale.setScalar(spec.scale);
    const mats = ownMaterials(obj);
    if (spec.tint) for (const m of mats) if (spec.tint[0].test(m.name)) m.color.set(spec.tint[1]);
    if (spec.glow) for (const m of mats) if (m.emissive && m.emissiveIntensity > 0.5) m.emissive.set(spec.glow);
    const legs = []; obj.traverse(o => { if (/Leg[LR]?\d*$|BugLeg/.test(o.name) && !o.isMesh) legs.push(o); });
    const hp = 3 + (difficulty >= 2 ? 1 : 0) + (difficulty >= 3 ? 1 : 0);
    return {
      type: 'boss', kind: e.kind, obj, s: spec.scale, alive: true, x: e.x, y: e.y, vx: 0, vy: 0, dir: -1, hp, maxHp: hp,
      state: 'idle', timer: 2.2, invuln: 0, speed: spec.speed, spiky: !!spec.spiky, squish: 0, stompable: true, dashable: true, x0: e.x0,
      box: { x: e.x, y: e.y, w: spec.box[0], h: spec.box[1] },
      update(dt, t, g) {
        if (!this.alive) {
          this.squish += dt;
          obj.rotation.z += dt * 6; obj.position.y += dt * (4 - this.squish * 8);
          obj.scale.setScalar(spec.scale * Math.max(0.01, 1 - this.squish * 0.6));
          if (this.squish > 1.6) obj.visible = false;
          return;
        }
        const b = g.body;
        this.invuln = Math.max(0, this.invuln - dt);
        if (this.state === 'idle') {
          if (b.x > e.x0 + 1.5) { this.state = 'walk'; this.timer = 2.4; g.bossStart(this); }
        } else if (this.state === 'walk') {
          const want = b.x > this.x ? 1 : -1;
          if (want !== this.dir && Math.abs(b.x - this.x) > 1.2) this.dir = want;
          this.x = clamp(this.x + this.dir * this.speed * g.diff.bugSpeed * dt, e.xmin, e.xmax);
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'crouch'; this.timer = 0.55; g.sfx('alert'); }
        } else if (this.state === 'crouch') {                      // the tell before the big jump
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'air'; this.vy = 15; this.vx = clamp((b.x - this.x) * 0.9, -6, 6); }
        } else if (this.state === 'air') {
          this.x = clamp(this.x + this.vx * dt, e.xmin, e.xmax); this.vy -= 32 * dt; this.y += this.vy * dt;
          if (this.y <= e.y) { this.y = e.y; this.state = 'stun'; this.timer = 1.1; g.bossLand(this); }
        } else if (this.state === 'stun') {
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 'walk'; this.timer = 1.6 + Math.random() * 1.4; }
        }
        const crouch = this.state === 'crouch' ? 1 - this.timer / 0.55 : 0;
        obj.position.set(this.x, this.y, 0);
        obj.scale.set(spec.scale * (1 + crouch * 0.15), spec.scale * (1 - crouch * 0.25), spec.scale);
        obj.rotation.y = this.dir > 0 ? -0.4 : Math.PI + 0.4;
        obj.rotation.z = this.state === 'stun' ? Math.sin(t * 9) * 0.12 : 0;
        legs.forEach((l, i) => { const w = this.state === 'walk'; l.rotation.z = w ? Math.sin(t * 10 + i * 2) * 0.5 : 0; l.rotation.y = w ? Math.sin(t * 14 + i) * 0.3 : 0; });
        obj.visible = this.invuln <= 0 || Math.sin(t * 40) > 0;
        if (this.spiky) for (const m of mats) if (m.emissive && m.name === 'crab_glow') m.emissiveIntensity = this.state === 'stun' ? 0.15 : 3;   // cooled off = safe to stomp
        this.box.x = this.x; this.box.y = this.y;
        g.touchBoss(this);
      },
      damage(g, amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.hp -= amount; this.invuln = amount >= 1 ? 1.2 : 0.35;
        this.speed += 0.35 * amount;
        if (this.state === 'stun') { this.state = 'walk'; this.timer = 1.2; }
        if (this.hp <= 0.01) { this.alive = false; g.bossDead(this); }
        else g.bossHurt(this);
        return true;
      },
    };
  },
};

// heart (+1 heart) · life (gold heart: +1 max heart, the 1-UP) · star (bounces away — catch it!)
export function makePickup(kind, x, y) {
  if (kind === 'star') {
    const obj = make('Star'); obj.position.set(x, y, 0); obj.scale.setScalar(1.2);
    return {
      type: 'star', obj, alive: true, x, y, vx: 2.6, vy: 7, life: 9, box: { x, y: y - 0.4, w: 0.8, h: 0.8 },
      update(dt, t, g) {
        if (!this.alive) { this.obj.scale.multiplyScalar(1 - dt * 6); if (this.obj.scale.x < 0.05) this.obj.visible = false; return; }
        this.life -= dt;
        if (this.life <= 0) { this.alive = false; return; }
        this.vy -= 22 * dt;
        const nx = this.x + this.vx * dt;
        if (solid(cellAt(g, Math.floor(nx + Math.sign(this.vx) * 0.35), Math.floor(this.y)))) this.vx *= -1; else this.x = nx;
        this.y += this.vy * dt;
        if (this.vy < 0 && solid(cellAt(g, Math.floor(this.x), Math.floor(this.y - 0.4)))) { this.y = Math.floor(this.y - 0.4) + 1.4; this.vy = 9; }
        if (this.y < -3) { this.alive = false; return; }
        this.obj.position.set(this.x, this.y, 0); this.obj.rotation.y = t * 5;
        this.obj.visible = this.life > 2 || Math.sin(t * 30) > 0;
        this.box.x = this.x; this.box.y = this.y - 0.4;
        if (!g.dead && aabb(g.body, this.box)) { this.alive = false; g.gainStar(); }
      },
    };
  }
  const obj = make('Heart'); obj.position.set(x, y, 0); obj.scale.setScalar(kind === 'life' ? 1.5 : 1.3);
  if (kind === 'life') ownMaterials(obj).forEach(m => { m.color.set('#ffcf3a'); m.emissive = new THREE.Color('#f2b632'); m.emissiveIntensity = 0.4; });
  return {
    type: kind, obj, alive: true, box: { x, y: y - 0.3, w: 0.7, h: 0.7 },
    update(dt, t, g) {
      if (!this.alive) { this.obj.scale.multiplyScalar(1 - dt * 6); if (this.obj.scale.x < 0.05) this.obj.visible = false; return; }
      this.obj.rotation.y = t * 2; this.obj.position.y = y + Math.sin(t * 3) * 0.1;
      if (!g.dead && aabb(g.body, this.box)) { this.alive = false; if (kind === 'life') g.gainLife(); else g.gainHeart(); }
    },
  };
}

// a sambal fireball: bounces along the floor, burns enemies, breaks cracked rock
export function makeShot(x, y, dir) {
  const obj = make('Fireball'); obj.scale.setScalar(0.8); obj.position.set(x, y, 0);
  return {
    type: 'shot', obj, alive: true, x, y, vx: dir * 12, vy: -1, life: 1.4, box: { x, y: y - 0.25, w: 0.45, h: 0.45 },
    update(dt, t, g) {
      if (!this.alive) return;
      this.life -= dt;
      const nx = this.x + this.vx * dt, cx = Math.floor(nx + Math.sign(this.vx) * 0.2), cy = Math.floor(this.y);
      const c = cellAt(g, cx, cy);
      if (c === T.CRACK) { g.breakCrack(cx, cy); return this.pop(g); }
      if (solid(c)) return this.pop(g);
      this.x = nx;
      this.vy -= 40 * dt; this.y += this.vy * dt;
      if (this.vy < 0 && solid(cellAt(g, Math.floor(this.x), Math.floor(this.y - 0.22)))) { this.y = Math.floor(this.y - 0.22) + 1.22; this.vy = 8; }
      if (this.life <= 0 || this.y < -2 || deadlyAt(g, this.x, this.y)) return this.pop(g);
      this.obj.position.set(this.x, this.y, 0); this.obj.rotation.z = -t * 20 * Math.sign(this.vx);
      this.obj.scale.x = 0.8 * Math.sign(this.vx);
      this.box.x = this.x; this.box.y = this.y - 0.22;
      if (g.shotHits(this)) this.pop(g);
    },
    pop(g) { this.alive = false; this.obj.visible = false; g.splash(this.x, this.y, '#ff7a1f', 8); },
  };
}
const deadlyAt = (g, x, y) => { const c = cellAt(g, Math.floor(x), Math.floor(y)); return c === T.HAZARD || c === T.WATER; };
