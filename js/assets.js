// Loads the Blender-made GLB files and keeps every top-level node as a prototype to clone.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FILES = ['characters', 'hats', 'common', 'kit_village', 'kit_forest', 'kit_volcano', 'kit_city'];
const VERSION = '1';
export const lib = {};

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(FILES.map(async f => {
    const gltf = await loader.loadAsync(`assets/${f}.glb?v=${VERSION}`);
    for (const node of [...gltf.scene.children]) {
      node.position.set(0, 0, 0);
      node.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          o.geometry.userData.lib = true;
          const m = o.material;
          // glTF emissive strength comes through as emissiveIntensity; keep glows readable but not blown out
          if (m.emissiveIntensity > 1) m.emissiveIntensity = Math.min(m.emissiveIntensity, 3);
          if (m.transmission > 0) { m.transparent = true; m.opacity = 0.55; m.transmission = 0; m.roughness = 0.1; }
        }
      });
      lib[node.name] = node;
    }
    onProgress?.(++done / FILES.length, f);
  }));
  return lib;
}

export function make(name) {
  const p = lib[name];
  if (!p) { console.warn('missing asset', name); return new THREE.Group(); }
  return p.clone(true);
}

// Bake a prototype into InstancedMeshes, one per sub-mesh, for many copies at `positions`.
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _local = new THREE.Matrix4(), _s = new THREE.Matrix4();
export function instance(name, positions, parent, { scale = 1, shadows = true } = {}) {
  const proto = lib[name];
  if (!proto || !positions.length) return;
  proto.updateMatrixWorld(true);
  _inv.copy(proto.matrixWorld).invert();
  _s.makeScale(scale, scale, scale);
  proto.traverse(mesh => {
    if (!mesh.isMesh) return;
    _local.multiplyMatrices(_inv, mesh.matrixWorld);
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, positions.length);
    positions.forEach((p, i) => {
      _m.makeTranslation(p.x, p.y, p.z).multiply(_s).multiply(_local);
      im.setMatrixAt(i, _m);
    });
    im.castShadow = shadows; im.receiveShadow = true;
    im.frustumCulled = false;
    parent.add(im);
  });
}

// GLTFLoader makes node names unique ("LegL", "LegL_1", …) — look parts up by their base name
export function byName(root, name) {
  let hit = null;
  root.traverse(o => { if (!hit && (o.name === name || o.name.replace(/_\d+$/, '') === name)) hit = o; });
  return hit;
}
