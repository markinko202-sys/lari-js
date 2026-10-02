// Shop thumbnails: each character, hat and power-up is rendered once from its real 3D model into a
// small picture (a second, tiny WebGL renderer), cached as a data URL. Trails are drawn in 2D.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { make } from './assets.js';

const SIZE = 192;
const cache = new Map();
let r = null, scene = null, cam = null, holder = null;

function setup() {
  r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(SIZE, SIZE, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
  r.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
  pm.dispose();
  scene.add(new THREE.HemisphereLight('#fff6e6', '#5a4a6a', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 1.7); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#9ad8ff', 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  holder = new THREE.Group(); scene.add(holder);
}

// frame an object: centre it and back the camera off until it fills ~80% of the picture
function shoot(obj, { yaw = 0, pitch = 0.18, fill = 0.8, lookY = 0 } = {}) {
  if (!r) setup();
  holder.clear(); holder.add(obj);
  obj.rotation.y = yaw;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const radius = Math.max(s.x, s.y, s.z) * 0.5;
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / fill;
  c.y += lookY * s.y;
  cam.position.set(c.x, c.y + Math.sin(pitch) * dist, c.z + Math.cos(pitch) * dist);
  cam.lookAt(c);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}

function drawTrail(color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const g = cv.getContext('2d'), cx = SIZE / 2, cy = SIZE / 2;
  if (!color) {                                       // "none": an empty ring
    g.strokeStyle = 'rgba(23,20,31,.35)'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, SIZE * 0.28, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - SIZE * 0.2, cy + SIZE * 0.2); g.lineTo(cx + SIZE * 0.2, cy - SIZE * 0.2); g.stroke();
    return cv.toDataURL();
  }
  for (let i = 0; i < 46; i++) {                      // a comet swirl of sparks
    const k = i / 46, a = k * Math.PI * 2.4, rad = SIZE * (0.08 + k * 0.3);
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.7;
    g.fillStyle = color === 'rainbow' ? `hsl(${k * 340}, 95%, 60%)` : color;
    g.globalAlpha = 0.25 + k * 0.75;
    g.beginPath(); g.arc(x, y, 3 + k * 9, 0, Math.PI * 2); g.fill();
  }
  return cv.toDataURL();
}

// kind: 'character' | 'hat' | 'trail' | 'item'; ref: model id / colour
export function thumbnail(kind, id, ref) {
  const key = `${kind}:${id}`;
  if (cache.has(key)) return cache.get(key);
  let url;
  try {
    if (kind === 'trail') url = drawTrail(ref);
    else if (kind === 'character') url = shoot(make(`Char_${id}`), { yaw: -Math.PI / 2 - 0.45, pitch: 0.12, fill: 0.86 });
    else if (kind === 'hat') url = id === 'none' ? drawTrail(null) : shoot(make(`Hat_${id}`), { yaw: -Math.PI / 2 - 0.5, pitch: 0.45, fill: 0.78 });
    else url = shoot(make(ref), { yaw: ref === 'Magnet' || ref === 'Shield' ? 0 : -0.35, pitch: 0.15, fill: 0.78 });
  } catch (err) { console.warn('thumbnail', key, err); url = ''; }
  cache.set(key, url);
  return url;
}
