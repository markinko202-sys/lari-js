// Loads the Blender-made GLB files (Draco-compressed) and keeps every top-level node as a prototype to clone.
// The first three worlds load at boot; the later kits stream in the background and are awaited on demand.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const CORE = ['characters', 'hats', 'common', 'enemies', 'items', 'kit_village', 'kit_forest', 'kit_volcano', 'kit_city'];
const LATER = ['kit_beach', 'kit_cave', 'kit_kota'];
const VERSION = '5';
export const lib = {};

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const pending = {};

function loadFile(f) {
  return (pending[f] ||= loader.loadAsync(`assets/${f}.glb?v=${VERSION}`).then(gltf => {
    for (const node of [...gltf.scene.children]) {
      node.position.set(0, 0, 0);
      node.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          o.geometry.userData.lib = true;
          const m = o.material; m.userData.lib = true;
          // glTF emissive strength comes through as emissiveIntensity; keep glows readable but not blown out
          if (m.emissiveIntensity > 1) m.emissiveIntensity = Math.min(m.emissiveIntensity, 3);
          if (m.transmission > 0) { m.transparent = true; m.opacity = 0.55; m.transmission = 0; m.roughness = 0.1; }
        }
      });
      lib[node.name] = node;
    }
  }));
}

export async function loadAll(onProgress) {
  let done = 0;
  await Promise.all(CORE.map(f => loadFile(f).then(() => onProgress?.(++done / CORE.length, f))));
  for (const f of LATER) loadFile(f).catch(err => console.warn('kit failed', f, err));   // warm up, don't block the menu
  return lib;
}

// the kit a theme needs (resolves at once when it is already in)
const KIT = { beach: 'kit_beach', cave: 'kit_cave', kota: 'kit_kota' };
export function ensureTheme(theme) { return KIT[theme] ? loadFile(KIT[theme]) : Promise.resolve(); }

export function make(name) {
  const p = lib[name];
  if (!p) { console.warn('missing asset', name); return new THREE.Group(); }
  return p.clone(true);
}

// Bake a prototype into InstancedMeshes (one per sub-mesh) for many copies. Items are {x, y, z, s?, ry?}.
// Copies are split into chunks along X so the camera frustum culls everything off screen.
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _t = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function instance(name, items, parent, { shadows = true, chunk = 48 } = {}) {
  const proto = lib[name];
  if (!proto || !items.length) return;
  proto.updateMatrixWorld(true);
  _inv.copy(proto.matrixWorld).invert();
  const parts = [];
  proto.traverse(mesh => { if (mesh.isMesh) parts.push({ mesh, local: new THREE.Matrix4().multiplyMatrices(_inv, mesh.matrixWorld) }); });
  const buckets = new Map();
  for (const it of items) { const k = Math.floor(it.x / chunk); (buckets.get(k) || buckets.set(k, []).get(k)).push(it); }
  for (const list of buckets.values()) {
    for (const { mesh, local } of parts) {
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
      list.forEach((p, i) => {
        _q.setFromAxisAngle(_up, p.ry || 0); _sc.setScalar(p.s || 1); _v.set(p.x, p.y, p.z);
        _t.compose(_v, _q, _sc);
        _m.multiplyMatrices(_t, local);
        im.setMatrixAt(i, _m);
      });
      im.castShadow = shadows; im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
  }
}

// Duplicate names get suffixed twice over: Blender makes "Head.001" (exported as "Head001") and
// GLTFLoader adds "_1". Look parts up by their base name.
export function byName(root, name) {
  let hit = null;
  root.traverse(o => { if (!hit && (o.name === name || o.name.replace(/(_\d+|\d{3})+$/, '') === name)) hit = o; });
  return hit;
}

// every distinct material under a node gets its own copy, so tinting one object never tints its siblings
export function ownMaterials(root) {
  const seen = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!seen.has(o.material)) seen.set(o.material, o.material.clone());
    o.material = seen.get(o.material);
  });
  return [...seen.values()];
}
