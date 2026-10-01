// Builds the 3D scene for a level (or the menu showroom / KL finale) from level data + Blender kits.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { make, instance, lib } from './assets.js';
import { T } from './physics.js';

export const THEMES = {
  village: {
    skyTop: '#070d22', skyBottom: '#2b3f6a', fog: '#16223e', fogNear: 22, fogFar: 80,
    hemiSky: '#7d8fd6', hemiGround: '#1d1a24', hemi: 0.75, env: 0.35, fill: 0.9, sun: '#a9bcff', sunI: 1.25, sunDir: [-6, 10, 8],
    tile: 'vil', plank: 'vil_Plank', hills: ['#1a2a44', '#132036', '#0e182a'], moon: true, stars: true, motes: '#ffd27a',
  },
  forest: {
    skyTop: '#f7c977', skyBottom: '#a8d8c8', fog: '#bfd9a8', fogNear: 26, fogFar: 95,
    hemiSky: '#fff1cf', hemiGround: '#3d5a2a', hemi: 1.0, env: 0.7, fill: 0.6, sun: '#ffe2a8', sunI: 2.2, sunDir: [8, 12, 6],
    tile: 'for', plank: 'for_Log', hills: ['#6aa05a', '#4f8a4a', '#3a7040'], sunDisc: '#fff1c2', motes: '#fff4c8',
  },
  volcano: {
    skyTop: '#160505', skyBottom: '#9a3416', fog: '#3a1410', fogNear: 20, fogFar: 75,
    hemiSky: '#ff9a6a', hemiGround: '#2a1010', hemi: 0.7, env: 0.4, fill: 0.7, sun: '#ffb27a', sunI: 1.6, sunDir: [5, 9, 7],
    tile: 'vol', plank: 'vol_Platform', hills: ['#3a1c18', '#2a1412', '#1c0e0d'], embers: true, motes: '#ff7a2a',
  },
  city: {
    skyTop: '#05061a', skyBottom: '#3b2a6a', fog: '#1b1840', fogNear: 30, fogFar: 120,
    hemiSky: '#8a8adf', hemiGround: '#1a1830', hemi: 0.8, env: 0.45, fill: 0.8, sun: '#c9b8ff', sunI: 1.2, sunDir: [-4, 10, 8],
    tile: 'vil', plank: 'vil_Plank', hills: ['#191a3c', '#121332', '#0c0d26'], stars: true, motes: '#c9b8ff',
  },
};

function skyDome(t) {
  const g = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(t.skyTop) }, bottom: { value: new THREE.Color(t.skyBottom) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.6 + 0.25, 0., 1.); gl_FragColor = vec4(mix(bottom, top, pow(h, .8)), 1.); }',
  });
  const s = new THREE.Mesh(g, m); s.renderOrder = -10;
  return s;
}

// rolling silhouette hills as flat layered shapes
function hills(color, z, height, seed, length, yBase = -2) {
  const shape = new THREE.Shape();
  const x0 = -60, x1 = length + 60, step = 4;
  shape.moveTo(x0, yBase - 30);
  for (let x = x0; x <= x1; x += step) {
    const n = Math.sin(x * 0.07 + seed) * 0.5 + Math.sin(x * 0.023 + seed * 2.3) * 0.8 + Math.sin(x * 0.15 + seed * 5) * 0.2;
    shape.lineTo(x, yBase + height * (0.6 + n * 0.35));
  }
  shape.lineTo(x1, yBase - 30);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: true }));
  m.position.z = z;
  return m;
}

function starfield(n = 700) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1;
    pos.set([Math.cos(a) * 300 * Math.cos(e), 40 + Math.sin(e) * 260, -Math.abs(Math.sin(a)) * 300 - 50], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
}

// drifting particles: fireflies / pollen / embers
export class Motes {
  constructor(color, count, area, rising) {
    this.n = count; this.area = area; this.rising = rising;
    this.pos = new Float32Array(count * 3); this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) this.reset(i, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      color, size: rising ? 0.14 : 0.11, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
  }
  reset(i, any) {
    const a = this.area;
    this.pos[i * 3] = a.x0 + Math.random() * (a.x1 - a.x0);
    this.pos[i * 3 + 1] = any ? a.y0 + Math.random() * (a.y1 - a.y0) : a.y0;
    this.pos[i * 3 + 2] = -Math.random() * 6 + 1.5;
    this.seed[i] = Math.random() * 100;
  }
  update(dt, t, cx) {
    // keep the cloud around the camera so a long level only needs a few hundred motes
    this.area.x0 = cx - 25; this.area.x1 = cx + 25;
    for (let i = 0; i < this.n; i++) {
      const s = this.seed[i];
      let x = this.pos[i * 3], y = this.pos[i * 3 + 1];
      if (this.rising) { y += dt * (0.8 + (s % 1) * 1.2); x += Math.sin(t * 1.3 + s) * dt * 0.4; }
      else { x += Math.sin(t * 0.6 + s) * dt * 0.35; y += Math.cos(t * 0.8 + s * 1.7) * dt * 0.25; }
      if (x < this.area.x0) x += 50; if (x > this.area.x1) x -= 50;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y;
      if (y > this.area.y1) this.reset(i, false);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = this.rising ? 0.9 : 0.55 + Math.sin(t * 3) * 0.3;
  }
}

function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 wp; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time; varying vec3 wp;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = wp.xz * 0.9 + vec2(time * 0.15, time * 0.05);
        float v = n(p) * .55 + n(p * 2.3 - time * .2) * .3 + n(p * 5.) * .15;
        vec3 c = mix(vec3(.55,.06,.02), vec3(1.,.55,.08), smoothstep(.35,.75,v));
        c = mix(c, vec3(1.,.9,.5), smoothstep(.78,.95,v));
        gl_FragColor = vec4(c * 1.4, 1.);
      }`,
  });
}

// one soft studio environment for reflections, shared by every world
let envTex = null;
function environment(renderer) {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envTex;
}

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.animated = [];   // things with update(dt, t)
  }

  setupTheme(themeId, length) {
    const t = THEMES[themeId]; this.theme = t; this.themeId = themeId;
    const s = this.scene;
    s.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    s.background = new THREE.Color(t.skyBottom);
    this.sky = skyDome(t); s.add(this.sky);
    s.add(new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemi));
    s.environment = environment(this.renderer); s.environmentIntensity = t.env;
    // soft light from the camera side so the faces of tiles and characters never go black
    this.fill = new THREE.DirectionalLight(t.hemiSky, t.fill); this.fill.position.set(0, 4, 20);
    s.add(this.fill); s.add(this.fill.target);
    const sun = new THREE.DirectionalLight(t.sun, t.sunI);
    sun.position.set(...t.sunDir); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -10; sc.near = 0.5; sc.far = 60;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target); this.sun = sun;
    // parallax hill layers
    this.hillLayers = t.hills.map((c, i) => {
      const m = hills(c, -10 - i * 12, 6 + i * 5, i * 3.1 + themeId.length, length, -1 - i * 1.5);
      m.userData.parallax = 0.15 + i * 0.22; s.add(m); return m;
    });
    if (t.stars) s.add(starfield());
    if (t.moon) {
      const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }));
      moon.position.set(0, 34, -150); moon.userData.parallax = 0.97; s.add(moon); this.hillLayers.push(moon);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: '#6c7fc8', transparent: true, opacity: 0.18, fog: false }));
      halo.position.set(0, 34, -151); halo.userData.parallax = 0.97; s.add(halo); this.hillLayers.push(halo);
    }
    if (t.sunDisc) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.MeshBasicMaterial({ color: t.sunDisc, fog: false }));
      disc.position.set(0, 26, -160); disc.userData.parallax = 0.97; s.add(disc); this.hillLayers.push(disc);
    }
    this.motes = new Motes(t.motes, themeId === 'volcano' ? 220 : 160, { x0: -25, x1: 25, y0: -1, y1: 16 }, !!t.embers);
    s.add(this.motes.points);
  }

  build(level) {
    const L = level.build();
    this.grid = { w: L.w, h: L.h, cells: L.cells };
    this.level = L;
    this.setupTheme(level.theme, L.w);
    const t = this.theme, g = new THREE.Group(); this.scene.add(g);

    const tops = [], fills = [], planks = [];
    for (let x = 0; x < L.w; x++) for (let y = 0; y < L.h; y++) {
      const c = L.cells[y * L.w + x];
      const p = { x: x + 0.5, y: y + 0.5, z: 0 };
      if (c === T.GROUND) {
        const above = y + 1 < L.h ? L.cells[(y + 1) * L.w + x] : 0;
        (above === T.GROUND ? fills : tops).push(p);
      } else if (c === T.PLATFORM) planks.push(p);
    }
    instance(`${t.tile}_TileTop`, tops, g);
    instance(`${t.tile}_TileFill`, fills, g, { shadows: false });
    instance(t.plank, planks, g);
    // carry each ground column down out of view so terrain reads as solid earth and pits stay pits
    const deep = [];
    for (let x = 0; x < L.w; x++) if (L.cells[x] === T.GROUND) for (let y = -1; y >= -7; y--) deep.push({ x: x + 0.5, y: y + 0.5, z: 0 });
    instance(`${t.tile}_TileFill`, deep, g, { shadows: false });

    // lava: one animated strip per run of hazard cells
    this.lava = null;
    const runs = [];
    for (let x = 0; x < L.w; x++) {
      if (L.cells[x] === T.HAZARD) { if (runs.length && runs.at(-1).x1 === x) runs.at(-1).x1++; else runs.push({ x0: x, x1: x + 1 }); }
    }
    if (runs.length) {
      this.lava = lavaMaterial();
      for (const r of runs) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, 2.4, 1, 1), this.lava);
        m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.55, 0); g.add(m);
        const glow = new THREE.PointLight('#ff6a1f', 6, 9, 1.6); glow.position.set((r.x0 + r.x1) / 2, 1.8, 1); g.add(glow);
      }
    }

    // decor (non-colliding scenery)
    for (const d of L.decor) {
      const o = make(d.kind);
      o.position.set(d.x + 0.5, d.y, d.z); o.scale.setScalar(d.s); o.rotation.y = d.ry;
      if (d.kind.includes('Mountain')) o.traverse(m => { if (m.isMesh) m.castShadow = false; });
      g.add(o);
    }
    // scattered filler scenery behind the play lane, deterministic per level
    const fillers = { village: ['vil_Bush', 'vil_Palm', 'vil_Fence'], forest: ['for_Fern', 'for_Tree', 'for_Rock', 'for_Mushroom'], volcano: ['vol_Spike', 'vol_Crystal', 'vol_DeadTree'] }[level.theme] || [];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let x = 4; x < L.w - 4; x += 3 + Math.floor(rnd() * 4)) {
      let top = -1;
      for (let y = L.h - 1; y >= 0; y--) if (L.cells[y * L.w + x] === T.GROUND) { top = y + 1; break; }
      if (top < 0) continue;
      const kind = fillers[Math.floor(rnd() * fillers.length)];
      const o = make(kind);
      const far = kind.includes('Tree') || kind.includes('Palm');
      o.position.set(x + 0.5, top, far ? -4 - rnd() * 3 : -1.35 - rnd() * 0.4);
      o.scale.setScalar(far ? 0.9 + rnd() * 0.5 : 0.7 + rnd() * 0.5); o.rotation.y = rnd() * 0.8 - 0.4;
      g.add(o);
    }
    if (level.theme === 'volcano') {
      for (let i = 0; i < 6; i++) {
        const v = make('vol_Mountain'); v.position.set(i * 40 + 10, -6, -45 - (i % 2) * 15); v.scale.setScalar(2.4 + (i % 3) * 0.5);
        v.traverse(m => { if (m.isMesh) m.castShadow = false; }); g.add(v);
      }
    }
    return L;
  }

  // the menu showroom: a round stage the character turns on, with themed backdrop
  buildShowroom(themeId = 'village') {
    this.setupTheme(themeId, 60);
    const t = this.theme;
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.5, 48), new THREE.MeshStandardMaterial({ color: '#f6ecd7', roughness: 0.6 }));
    stage.position.set(0, -0.25, 0); stage.receiveShadow = true; this.scene.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 64), new THREE.MeshStandardMaterial({ color: '#f2b632', emissive: '#f2b632', emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    const ground = [];
    for (let x = -14; x < 14; x++) ground.push({ x: x + 0.5, y: -1.5, z: -3.5 });
    instance(`${t.tile}_TileTop`, ground, this.scene);
    const decor = { village: [['vil_House', -6, -6.5, 0.9], ['vil_Palm', 5, -5, 1.1], ['vil_Lantern', 3, -2.4, 1]],
                    forest: [['for_Tree', -6, -6, 1.1], ['for_Mushroom', 3.5, -2.6, 1.2], ['for_Fern', 5, -3, 1]],
                    volcano: [['vol_Mountain', -10, -20, 1.6], ['vol_Crystal', 3.5, -2.6, 1.2], ['vol_DeadTree', -4, -3.4, 1]] }[themeId] || [];
    for (const [k, x, z, s] of decor) { const o = make(k); o.position.set(x, -1, z); o.scale.setScalar(s); this.scene.add(o); }
    return stage;
  }

  // the finale: KL skyline at night
  buildCity() {
    this.setupTheme('city', 80);
    const s = this.scene;
    const road = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 8), new THREE.MeshStandardMaterial({ color: '#2a2a3a', roughness: 0.9 }));
    road.position.set(0, -0.5, -1); road.receiveShadow = true; s.add(road);
    for (let x = -60; x < 60; x += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(2, 0.02, 0.15), new THREE.MeshBasicMaterial({ color: '#f2b632' }));
      line.position.set(x, 0.01, 0.6); s.add(line);
    }
    const pt = make('city_Petronas'); pt.position.set(4, 0, -16); pt.scale.setScalar(1.8); s.add(pt);
    const kl = make('city_KLTower'); kl.position.set(-12, 0, -22); kl.scale.setScalar(1.7); s.add(kl);
    for (let i = 0; i < 14; i++) {
      const tw = make(`city_Tower${i % 4}`);
      const side = i % 2 ? 1 : -1;
      tw.position.set(side * (14 + (i >> 1) * 5) + (i % 3), 0, -14 - (i % 4) * 6); tw.scale.setScalar(1.3 + (i % 3) * 0.3);
      s.add(tw);
    }
    for (const x of [-18, -8, 8, 18]) { const p = make('vil_Palm'); p.position.set(x, 0, -4); s.add(p); }
  }

  update(dt, t, camX) {
    if (this.lava) this.lava.uniforms.time.value = t;
    if (this.hillLayers) for (const h of this.hillLayers) h.position.x = camX * h.userData.parallax;
    if (this.sky) this.sky.position.x = camX;
    if (this.motes) this.motes.update(dt, t, camX);
    if (this.sun) {   // keep the shadow frustum on the action
      this.sun.position.set(camX + this.theme.sunDir[0], this.theme.sunDir[1], this.theme.sunDir[2]);
      this.sun.target.position.set(camX, 0, 0);
      this.fill.position.set(camX, 6, 20); this.fill.target.position.set(camX, 2, 0);
    }
    for (const a of this.animated) a.update(dt, t);
  }

  // free only geometry this world created; prototype geometry (shared by clones) stays
  dispose() {
    this.scene.traverse(o => { if ((o.isMesh || o.isPoints) && !o.geometry?.userData.lib) o.geometry?.dispose(); });
  }
}
