// LARI.js — game controller: screens, input, the play loop, life-lesson gates, bosses, shop and save.
import * as THREE from 'three';
import { loadAll, ensureTheme } from './assets.js?v=9';
import { World } from './world.js?v=9';
import { Rig, Bursts, spawnEntities, makePickup, makeShot } from './actors.js?v=9';
import { makeBody, step, overlapsHazard, aabb, cell, T, P } from './physics.js?v=9';
import { LEVELS, SKILLS, SKILL_ORDER, movesFrom } from './levels.js?v=9';
import { lessonText, pickQuestion } from './quiz.js?v=9';
import { load, save, reset as resetSave, SHOP, DIFFICULTY } from './save.js?v=9';
import { t, setLang, getLang, detectLang, LANGS } from './i18n.js?v=9';
import { thumbnail } from './thumbs.js?v=9';
import * as audio from './audio.js?v=9';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const profile = load();
setLang(profile.lang || detectLang());
// ?mute keeps the game silent (automated tests) without touching the saved sound setting
const forceMute = /[?&]mute\b/.test(location.search);
audio.setMuted(!profile.sound || forceMute);

// ------------------------------------------------------------------ renderer
const canvas = $('#view');
const coarse = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep roughly the same amount of level visible on narrow/portrait screens
  camera.fov = w / h < 1 ? 58 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------------ input
const keys = { left: false, right: false, jump: false, dash: false, shoot: false, down: false };
const edges = { jump: false, dash: false, shoot: false, down: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyJ: 'dash', KeyE: 'shoot', KeyK: 'shoot', KeyC: 'shoot', ArrowDown: 'down', KeyS: 'down' };
const EDGE = new Set(['jump', 'dash', 'shoot', 'down']);
// double-tap a direction (keyboard or touch) to dash — the phone has no dash button
const lastTap = { left: 0, right: 0 };
function directionDown(k) {
  if (k !== 'left' && k !== 'right') return;
  const now = performance.now();
  if (now - lastTap[k] < 260) edges.dash = true;
  lastTap[k] = now;
}
addEventListener('keydown', e => {
  audio.unlock();
  if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'play') { pause(true); return; }
  if (state === 'quiz') {
    if (/^Digit[1-4]$/.test(e.code)) { const o = $$('#quiz-options button')[+e.code.slice(5) - 1]; if (o && !o.disabled && !o.classList.contains('gone')) o.click(); return; }
    if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); return; }   // a held jump key must not answer
  }
  const k = KEYMAP[e.code]; if (!k) return;
  if (state === 'play') e.preventDefault();
  if (!keys[k] && EDGE.has(k)) edges[k] = true;
  if (!keys[k]) directionDown(k);
  keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pause(true); });
for (const b of $$('#touch button')) {
  const k = b.dataset.k;
  // pointer capture keeps the press alive even if the thumb slides off the button
  const down = e => {
    e.preventDefault(); audio.unlock();
    try { b.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    if (EDGE.has(k)) edges[k] = true;     // every tap is a fresh press (double jump needs a 2nd tap)
    directionDown(k);
    keys[k] = true; b.classList.add('press');
  };
  const up = e => { e.preventDefault(); keys[k] = false; b.classList.remove('press'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
addEventListener('pointerdown', () => audio.unlock(), { once: true });
// iOS Safari ignores user-scalable=no: stop double-tap zoom and pinch zoom ourselves
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = performance.now();
  if (now - lastTouchEnd < 350 || e.target.closest('#touch, #view')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
$('#touch').addEventListener('touchstart', e => e.preventDefault(), { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ screens
const MENUS = ['title', 'levels', 'shop', 'settings', 'about'];
let state = 'loading', prevScreen = 'title';
function show(name) {
  for (const s of $$('.screen')) s.classList.toggle('on', s.dataset.screen === name);
  hideBubble();
  if ([...MENUS, 'ending'].includes(name)) {
    if (name !== 'settings' && name !== 'about') prevScreen = name;
    if (name !== 'shop') tryOn = {};
    state = name;
    if (name === 'ending') enterCity();
    else { enterShowroom(); audio.music('menu'); }
    if (name === 'levels') renderRoute();
    if (name === 'shop') renderShop();
    if (name === 'settings') renderSettings();
  }
  updateWallet();
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  audio.sfx('click');
  const go = b.dataset.go;
  show(go === 'back' ? prevScreen : go);
}));
function updateWallet() { $$('.coins-val').forEach(e => (e.textContent = profile.coins)); }

// ------------------------------------------------------------------ worlds
let world = null, rig = null, bursts = null;
function swapWorld(w) { world?.dispose(); rig?.dispose(); rig = null; world = w; }

// the menu backdrop follows your progress: the next place you are heading to
function showroomTheme() {
  return (LEVELS.find(L => !profile.levels[L.id]?.done) || LEVELS.at(-1)).theme;
}
function enterShowroom() {
  const theme = showroomTheme();
  if (world?.kind === 'showroom' && world.themeId === theme) {
    if (world.charKey !== charKey()) showroomRig();
    return;
  }
  ensureTheme(theme).then(() => {
    if (!MENUS.includes(state) || (world?.kind === 'showroom' && world.themeId === theme)) return;
    const w = new World(renderer); w.kind = 'showroom';
    w.buildShowroom(theme);
    swapWorld(w);
    bursts = null;
    showroomRig();
  });
}
function showroomRig() {
  if (!world) return;
  if (rig) { world.scene.remove(rig.root); rig.dispose(); }
  const l = look();
  world.charKey = charKey();
  rig = new Rig(l.character, l.hat, trailColor(l), world.scene);
  rig.root.position.set(0, 0, 0); world.scene.add(rig.root);
}
let tryOn = {};                                   // shop preview, not bought yet
const look = () => ({ ...profile.equipped, ...(state === 'shop' ? tryOn : {}) });
const charKey = () => { const l = look(); return `${l.character}|${l.hat}|${l.trail}`; };
const trailColor = (l = profile.equipped) => SHOP.trails.find(x => x.id === l.trail)?.color || null;

function enterCity() {
  const w = new World(renderer); w.kind = 'city'; w.buildCity(); swapWorld(w);
  bursts = null;
  rig = new Rig(profile.equipped.character, profile.equipped.hat, null, w.scene);
  w.scene.add(rig.root); rig.root.position.set(3, 0, 1.5);
  audio.music('finale');
  setTimeout(() => { if (state === 'ending' && rig) rig.emote('cheer'); }, 800);
}

// drag the character on the stage to turn it; a tap makes it say hi
let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (!MENUS.includes(state) || !rig) return;
  drag = { x: e.clientX, turn: rig.turn, moved: false };
});
addEventListener('pointermove', e => {
  if (!drag || !rig) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 6) drag.moved = true;
  rig.turn = drag.turn + dx * 0.012;
});
addEventListener('pointerup', () => { if (drag && !drag.moved) greet(); drag = null; });
function greet() {
  if (!rig) return;
  rig.emote(); audio.voice(rig.meta.voice, rig.meta.beep);
  bubble(t(`say_${rig.id}`));
}

// speech bubble over the character's head
const bubbleEl = $('#bubble'); let bubbleT = 0;
const _v = new THREE.Vector3();
function bubble(text, secs = 2.8) { bubbleEl.textContent = text; bubbleEl.classList.add('on'); bubbleT = secs; placeBubble(); }
function hideBubble() { bubbleT = 0; bubbleEl.classList.remove('on'); }
function placeBubble() {
  if (!rig) return;
  rig.headWorld(_v).project(camera);
  bubbleEl.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`;
  bubbleEl.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
}

// ------------------------------------------------------------------ level select
const ART = { village: '☾', forest: '♣', volcano: '▲', beach: '☀', cave: '◆', kota: '▦', city: 'KL' };
function levelUnlocked(i) { return i === 0 || profile.levels[LEVELS[i - 1].id]?.done; }
const levelName = L => t(`lv_${L.theme}`);
const powerOf = skill => t(`pw_${SKILLS[skill].move}`);
function renderRoute() {
  const r = $('#route'); r.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const rec = profile.levels[L.id], open = levelUnlocked(i);
    const b = document.createElement('button');
    b.className = 'lvl'; b.dataset.theme = L.theme; b.disabled = !open;
    b.innerHTML = `<div class="art" data-emoji="${ART[L.theme]}"></div>
      <p class="sub">${t('levelN', { n: i + 1 })}</p><h3>${levelName(L)}</h3>
      <p class="learn">${t('learnLine', { virtue: t(`v_${L.skill}`), power: powerOf(L.skill) })}</p>
      <p class="stars">${[0, 1, 2].map(k => (rec?.stars > k ? '★' : '☆')).join('')}</p>
      ${open ? '' : `<div class="lock">${t('lockPrev')}</div>`}`;
    b.addEventListener('click', () => { audio.sfx('click'); startLevel(i); });
    r.appendChild(b);
  });
  const allDone = LEVELS.every(L => profile.levels[L.id]?.done);
  const c = document.createElement('button');
  c.className = 'lvl'; c.dataset.theme = 'city'; c.disabled = !allDone;
  c.innerHTML = `<div class="art" data-emoji="KL"></div><p class="sub">${t('finale')}</p><h3>${t('lv_city')}</h3>
    <p class="learn">${t('klLine')}</p>${allDone ? '' : `<div class="lock">${t('lockAll')}</div>`}`;
  c.addEventListener('click', () => { audio.sfx('click'); show('ending'); });
  r.appendChild(c);
  $('#diff-label').textContent = t(`diff${profile.difficulty}`);
}

// ------------------------------------------------------------------ shop
let shopTab = 'characters';
$$('.tabs button').forEach(b => b.addEventListener('click', () => {
  shopTab = b.dataset.tab; audio.sfx('click');
  $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderShop();
}));
const SLOT = { characters: 'character', hats: 'hat', trails: 'trail' };
function itemName(tab, it) {
  if (tab === 'characters') return it.name;
  return t({ hats: 'hat_', trails: 'tr_', items: 'it_' }[tab] + it.id);
}
function itemBlurb(tab, it) {
  if (tab === 'characters') return t(`chb_${it.id}`);
  if (tab === 'items') return t(`itb_${it.id}`);
  return '';
}
function thumbOf(tab, it) {
  if (tab === 'characters') return ['character', it.id];
  if (tab === 'hats') return ['hat', it.id];
  if (tab === 'trails') return ['trail', it.id, it.color];
  return ['item', it.id, it.model];
}
// thumbnails are rendered a few per frame so opening a tab never stalls
let thumbQueue = [];
function pumpThumbs() {
  for (let n = 0; n < 3 && thumbQueue.length; n++) {
    const { img, args } = thumbQueue.shift();
    if (img.isConnected) img.src = thumbnail(...args);
  }
  if (thumbQueue.length) requestAnimationFrame(pumpThumbs);
}
function renderShop() {
  const grid = $('#shop-grid'); grid.innerHTML = '';
  const slot = SLOT[shopTab];
  thumbQueue = [];
  for (const it of SHOP[shopTab]) {
    const d = document.createElement('div'); d.className = 'item';
    const blurb = itemBlurb(shopTab, it);
    const img = document.createElement('img'); img.className = 'thumb'; img.alt = ''; img.decoding = 'async';
    const head = document.createElement('div'); head.className = 'item-head';
    head.innerHTML = `<h4>${itemName(shopTab, it)}</h4>${blurb ? `<p>${blurb}</p>` : ''}`;
    d.append(img, head);
    thumbQueue.push({ img, args: thumbOf(shopTab, it) });
    let action;
    if (shopTab === 'items') {
      const n = profile.items[it.id] || 0;
      head.insertAdjacentHTML('beforeend', `<span class="count">${t('owned', { n })}</span>`);
      action = Object.assign(document.createElement('button'), { className: 'buy', innerHTML: `<i class="coin-ic"></i>${it.price}` });
      action.disabled = profile.coins < it.price;
      action.onclick = () => buy(it, () => { profile.items[it.id] = (profile.items[it.id] || 0) + 1; });
    } else {
      const owned = profile.owned[shopTab].includes(it.id), eq = profile.equipped[slot] === it.id;
      const trying = tryOn[slot] === it.id && !eq;
      d.classList.toggle('sel', eq); d.classList.toggle('trying', trying);
      d.tabIndex = 0; d.setAttribute('role', 'button');
      head.insertAdjacentHTML('beforeend', trying ? `<span class="try-tag">${t('trying')}</span>` : (!owned ? `<span class="try-hint">${t('tapTry')}</span>` : ''));
      // tapping the card puts it on the character on the stage
      const preview = () => {
        if (eq) delete tryOn[slot]; else tryOn[slot] = it.id;
        audio.sfx('click'); refreshShop();
        if (rig) { rig.turn = 0; if (shopTab === 'characters') greet(); else rig.emote('cheer'); }
      };
      d.addEventListener('click', e => { if (!e.target.closest('.buy')) preview(); });
      d.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === d) preview(); });
      action = document.createElement('button');
      if (eq) { action.className = 'buy equipped'; action.textContent = t('equipped'); }
      else if (owned) { action.className = 'buy owned'; action.textContent = t('equip'); action.onclick = () => { profile.equipped[slot] = it.id; delete tryOn[slot]; save(); audio.sfx('click'); refreshShop(); }; }
      else {
        const short = profile.coins < it.price;
        action.className = 'buy'; action.innerHTML = short ? `<i class="coin-ic"></i>${it.price} · ${t('need', { n: it.price - profile.coins })}` : `${t('buy')} <i class="coin-ic"></i>${it.price}`;
        action.disabled = short;
        action.onclick = () => buy(it, () => { profile.owned[shopTab].push(it.id); profile.equipped[slot] = it.id; delete tryOn[slot]; });
      }
    }
    d.appendChild(action); grid.appendChild(d);
  }
  requestAnimationFrame(pumpThumbs);
}
function buy(it, apply) {
  if (profile.coins < it.price) { audio.sfx('wrong'); return; }
  profile.coins -= it.price; apply(); save(); audio.sfx('buy'); refreshShop();
  rig?.emote('cheer');
}
function refreshShop() { renderShop(); updateWallet(); enterShowroom(); }

// ------------------------------------------------------------------ settings
function renderSettings() {
  $('#lang-seg').innerHTML = LANGS.map(l => `<button data-lang="${l.id}" aria-pressed="${l.id === getLang()}">${l.name}</button>`).join('');
  $$('#lang-seg button').forEach(b => b.addEventListener('click', () => {
    profile.lang = b.dataset.lang; save(); setLang(profile.lang); audio.sfx('click'); renderSettings();
  }));
  const seg = $('#diff-seg');
  seg.innerHTML = DIFFICULTY.map(d => `<button data-diff="${d.id}" aria-pressed="${d.id === profile.difficulty}">${t(`diff${d.id}`)}<small>${t(`diffb${d.id}`)}</small></button>`).join('');
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { profile.difficulty = +b.dataset.diff; save(); audio.sfx('click'); renderSettings(); }));
  $('#sound-btn').textContent = profile.sound ? t('soundOn') : t('soundOff');
}
$('#sound-btn').addEventListener('click', () => { profile.sound = !profile.sound; save(); audio.setMuted(!profile.sound || forceMute); renderSettings(); });
$('#reset-btn').addEventListener('click', () => {
  if (!confirm(t('resetConfirm'))) return;
  resetSave(); if (world) world.charKey = null; enterShowroom(); renderSettings(); updateWallet();
});

// ------------------------------------------------------------------ play
let run = null;   // the current level attempt
const enemyLike = e => e.stompable !== undefined;
const game = {    // the interface entities talk to
  get body() { return run.body; }, get grid() { return world.grid; }, get diff() { return DIFFICULTY[run.difficulty]; },
  get magnet() { return run.magnet; }, get inQuiz() { return state === 'quiz'; }, get dead() { return run.dead > 0 || !!run.goal; },
  sfx: audio.sfx,
  collectCoin(x, y, n = 1) { addCoins(n); audio.sfx('coin'); bursts.emit(x, y, '#f2b632', 8, 3, 2); },
  touchEnemy(en) {
    const b = run.body;
    if (!en.alive || run.dead > 0 || run.goal || !aabb(b, en.box)) return;
    if (run.star > 0) { kill(en, 'star'); return; }                                     // star power: everything you touch falls
    if (b.dash > 0 && en.dashable) { kill(en, 'dash'); return; }                        // a dash breaks most enemies
    if (b.pound && b.vy < 0 && en.type !== 'blob') { kill(en, 'pound'); return; }       // so does a ground pound
    const fromAbove = b.vy < -1 && b.y > en.box.y + en.box.h * 0.35;
    if (fromAbove && en.stompable) {
      b.vy = keys.jump ? 13 : P.stompBounce; b.jumpsUsed = 1; b.coyote = 0; b.jumpT = 0;  // hold jump for a higher bounce
      if (en.onStomp && en.onStomp(game)) { combo(en.box.x, en.box.y); return; }       // snail → shell
      kill(en, 'stomp');
    } else if (fromAbove && !en.stompable) { hurt(0); b.vy = 9; }                       // spikes on its back
    else hurt(b.x < en.box.x ? -1 : 1);
  },
  touchBoss(boss) {
    const b = run.body;
    if (!boss.alive || run.dead > 0 || run.goal || boss.invuln > 0 || !aabb(b, boss.box)) return;
    const dir = b.x < boss.x ? -1 : 1;
    const fromAbove = b.vy < -1 && b.y > boss.box.y + boss.box.h * 0.55;
    if (run.star > 0 || b.dash > 0 || (b.pound && b.vy < 0) || (fromAbove && (!boss.spiky || boss.state === 'stun'))) {
      boss.damage(game, 1);
      if (fromAbove || b.pound) { b.vy = 13; b.pound = 0; b.jumpsUsed = 1; b.jumpT = 0; }
      else { b.dash = 0; b.vx = dir * 9; b.vy = 7; b.onGround = false; }
      return;
    }
    if (fromAbove) { hurt(0); b.vy = 11; return; }
    hurt(dir);
  },
  shellHits(shell) {
    for (const en of run.ents) {
      if (en === shell || !en.alive || !en.box || !en.dashable || en.type === 'boss') continue;
      if (Math.abs(en.box.x - shell.box.x) < 0.8 && Math.abs(en.box.y - shell.box.y) < 0.8) kill(en, 'shell');
    }
  },
  shotHits(shot) {
    for (const en of run.ents) {
      if (!en.alive || !en.box || !enemyLike(en) || !aabb(shot.box, en.box)) continue;
      if (en.type === 'boss') { en.damage(game, 0.34); return true; }
      if (!en.fireproof) kill(en, 'shot');
      return true;
    }
    return false;
  },
  spawn(kind, x, y) { const p = makePickup(kind, x, y); world.scene.add(p.obj); run.ents.push(p); },
  gainHeart() {
    if (run.hearts >= run.maxHearts) { game.collectCoin(run.body.x, run.body.y + 1, 5); return; }   // full health: worth coins instead
    run.hearts++; audio.sfx('heart'); bursts.emit(run.body.x, run.body.y + 1, '#e2384f', 10, 3, 3); hud();
  },
  gainLife() {
    run.maxHearts = Math.min(6, run.maxHearts + 1); run.hearts = Math.min(run.maxHearts, run.hearts + 1);
    audio.sfx('oneup'); floater(run.body.x, run.body.y + 2, '1-UP', 'life');
    bursts.emit(run.body.x, run.body.y + 1, '#ffcf3a', 16, 4, 3); hud();
  },
  gainStar() {
    run.star = 10; audio.sfx('star'); audio.music('star');
    toast(t('starPower'), t('starSub'));
  },
  setCheckpoint(x, y) { run.check = { x, y }; audio.sfx('check'); toast(t('checkpoint'), t('progressSaved')); },
  reachGate(gate) { openGate(gate); },
  grabPole(pole, height) { grabPole(pole, height); },
  splash(x, y, color = '#ffffff', n = 10) { bursts?.emit(x, y, color, n, 3, 3); },
  shake(a) { shake(a); },
  floater(x, y, text, cls) { floater(x, y, text, cls); },
  breakCrack(x, y) { crumble(x, y, T.CRACK, '#8a8590'); },
  bossStart(boss) {
    run.boss = boss; audio.music('boss'); audio.sfx('alert');
    toast(t(`boss_${boss.kind}`), boss.spiky ? t('bossSpiky') : t('bossSub', { n: Math.ceil(boss.hp) }));
    bossHud();
  },
  bossLand(boss) {
    shake(0.6); audio.sfx('thud'); bursts.emit(boss.x, boss.y + 0.1, '#d9ccb0', 24, 6, 2);
    const b = run.body;                                             // the shockwave catches anyone standing nearby
    if (boss.alive && b.onGround && Math.abs(b.x - boss.x) < 3.4) hurt(b.x < boss.x ? -1 : 1);
  },
  bossHurt(boss) {
    audio.sfx('bosshit'); shake(0.3); freeze(0.06);
    bursts.emit(boss.x, boss.y + boss.box.h * 0.6, '#ffd24a', 20, 5, 3);
    floater(boss.x, boss.y + boss.box.h + 0.6, '★', 'gold'); bossHud();
  },
  bossDead(boss) {
    audio.sfx('bossdie'); shake(0.9); freeze(0.12);
    for (let k = 0; k < 4; k++) bursts.emit(boss.x + (Math.random() - 0.5) * 2, boss.y + 1 + Math.random() * 1.5, ['#ffd24a', '#ff5a7a', '#4ff0c8', '#ffffff'][k], 24, 6, 4);
    run.bossBonus = 50; addCoins(20); floater(boss.x, boss.y + boss.box.h + 0.6, '+20', 'gold');
    run.ents.find(e => e.type === 'gate' && e.boss)?.openGate(game);
    audio.music(run.def.music);
    toast(t('bossDown', { boss: t(`boss_${boss.kind}`) }));
    run.boss = null; bossHud();
  },
  bossNag() { toast(t('bossNag')); audio.sfx('bump'); },
};

function addCoins(n) {
  run.coins += n;
  while (run.coins >= run.nextLife) { run.nextLife += 100; game.gainLife(); }   // every 100 coins: a 1-UP
  hud();
}

let starting = false;
async function startLevel(i) {
  if (starting) return;
  starting = true;
  const def = LEVELS[i];
  try {
    await ensureTheme(def.theme);
  } catch (err) { console.error(err); starting = false; return; }
  starting = false;
  const w = new World(renderer); w.kind = 'level';
  const L = w.build(def, profile.difficulty);
  swapWorld(w);
  bursts = new Bursts(w.scene);
  rig = new Rig(profile.equipped.character, profile.equipped.hat, trailColor(), w.scene);
  w.scene.add(rig.root);
  const items = profile.items;
  run = {
    index: i, def, difficulty: profile.difficulty,
    body: makeBody(L.start.x, L.start.y), check: { ...L.start },
    hearts: 3, maxHearts: 3, shield: false, magnet: false, star: 0,
    coins: 0, nextLife: 100, totalCoins: L.ents.filter(e => e.type === 'coin').length + L.ents.filter(e => e.type === 'block' && e.gives === 'coin' && !e.hidden).length * 3,
    lost: 0, stomps: 0, invuln: 0, dead: 0, final: false, time: 0, combo: 0, freeze: 0,
    shots: [], shootCd: 0, boss: null, bossBonus: 0, flagBonus: 0, goal: null, deathAnim: null,
  };
  // consume one of each owned power-up
  const used = [];
  if (items.life > 0) { items.life--; run.hearts = run.maxHearts = 4; used.push(t('pu_life')); }
  if (items.shield > 0) { items.shield--; run.shield = true; used.push(t('pu_shield')); }
  if (items.magnet > 0) { items.magnet--; run.magnet = true; used.push(t('pu_magnet')); }
  if (items.star > 0) { items.star--; run.star = 10; used.push(t('pu_star')); }
  save();
  run.ents = spawnEntities(L, w.scene, game, profile.difficulty);
  run.blocks = run.ents.filter(e => e.type === 'block');
  const goal = run.ents.find(e => e.type === 'goal');
  run.goalX = goal ? goal.obj.position.x : L.w;
  camState.x = run.body.x; camState.y = run.body.y;
  clearEdges(); acc = 0;
  $('#hud-level').textContent = levelName(def);
  $('#fade').classList.remove('on');
  show('play'); state = 'play';
  audio.music(run.star > 0 ? 'star' : def.music);
  hud(); bossHud(); touchButtons();
  toast(t('levelStart', { level: t('levelN', { n: i + 1 }), name: levelName(def), diff: t(`diff${profile.difficulty}`) }),
    used.length ? t('powerups', { list: used.join(', ') }) : t('gatesAhead', { virtue: t(`v_${def.skill}`) }));
  rig.emote(); audio.voice(rig.meta.voice, rig.meta.beep);
  // the catchphrase waits for the level banner to clear
  setTimeout(() => { if (state === 'play' && run?.time < 6 && !run.goal) bubble(t(`say_${rig.id}`), 2.2); }, 2700);
}

function kill(en, how) {
  if (!en.alive) return;
  en.alive = false; run.stomps++;
  audio.sfx(how === 'shot' ? 'burn' : 'stomp');
  const color = { dash: '#4ff0c8', shot: '#ff7a1f', star: '#ffd24a', pound: '#d9ccb0' }[how] || '#c8312b';
  bursts.emit(en.box.x, en.box.y + 0.4, color, 12, 4, 3);
  if (how === 'stomp') combo(en.box.x, en.box.y);
  else { addCoins(1); floater(en.box.x, en.box.y + 1, '+1'); }
  if (how === 'stomp' || how === 'pound' || how === 'bump') { shake(0.12); freeze(0.045); }
}
// stomp chains: each stomp before you land is worth more; the fifth is a 1-UP
function combo(x, y) {
  run.combo++;
  if (run.combo >= 5) { game.gainLife(); return; }
  const n = [1, 2, 4, 8][run.combo - 1];
  addCoins(n); floater(x, y + 1.1, run.combo > 1 ? `+${n} ×${run.combo}` : `+${n}`, run.combo > 2 ? 'gold' : '');
}
function hurt(dir) {
  const b = run.body;
  if (run.invuln > 0 || run.dead > 0 || run.star > 0 || run.goal) return;
  if (run.shield) { run.shield = false; run.invuln = 1.2; audio.sfx('bump'); bursts.emit(b.x, b.y + 0.8, '#4ff0c8', 14, 4, 2); hud(); return; }
  run.hearts--; run.lost++; run.invuln = 1.6; run.combo = 0;
  b.vx = dir * 7; b.vy = 8; b.onGround = false; b.dash = 0; b.pound = 0;
  audio.sfx('hurt'); bursts.emit(b.x, b.y + 0.8, '#e2384f', 10, 3, 2); shake(0.25);
  hud();
  if (run.hearts <= 0) die('hurt');
}
function fallDeath(cause) {
  if (run.dead > 0 || run.goal) return;
  run.hearts--; run.lost++;
  die(cause);
}
// a little Mario hop on the way out (a pit just swallows you); then respawn — or game over
function die(cause) {
  if (run.dead > 0) return;
  run.final = run.hearts <= 0;
  run.dead = run.final ? 1.5 : 1.1; run.star = 0; run.combo = 0;
  rig.setGlow(false, 0);
  audio.sfx(cause === 'pit' ? 'fall' : 'die');
  if (run.final) audio.stopMusic();
  run.deathAnim = cause === 'pit' ? null : { y: run.body.y, vy: 11 };
  hud();
}
function respawn() {
  const b = run.body;
  Object.assign(b, makeBody(run.check.x, run.check.y), { facing: 1 });
  run.invuln = 1.5; run.deathAnim = null;
  camState.x = b.x; camState.y = b.y;
  audio.music(run.boss ? 'boss' : run.def.music);
}

function gameOver() {
  state = 'over';
  bankRun();
  audio.sfx('gameover'); audio.duck(true);
  $('#over').hidden = false;
}
// coins picked up on a run you leave early are kept — the same rule as a game over
function bankRun() {
  if (!run || run.banked) return;
  run.banked = true; profile.coins += run.coins; save();
}

// the flagpole: slide down, walk off, cheer, then the results
function grabPole(pole, height) {
  if (state !== 'play') return;
  const b = run.body;
  run.goal = { pole, phase: 'slide', t: 0 };
  run.flagBonus = Math.round(10 + 90 * clamp(height / 8.5, 0, 1));
  floater(pole.x, b.y + 1.8, `+${run.flagBonus}`, 'gold');
  Object.assign(b, { vx: 0, vy: 0, dash: 0, pound: 0, x: pole.x - 0.34, facing: 1 });
  run.star = 0; rig.setGlow(false, 0);
  audio.stopMusic(); audio.sfx('flag');
}
function goalTick(dt) {
  const g = run.goal, b = run.body, p = g.pole;
  g.t += dt;
  if (g.phase === 'slide') {
    b.y = Math.max(p.y, b.y - 7 * dt); p.flagY = Math.max(1.4, p.flagY - 7.5 * dt);
    b.onGround = false; b.vx = 0; b.vy = -1;
    if (b.y <= p.y && p.flagY <= 1.41) { g.phase = 'walk'; g.t = 0; b.onGround = true; audio.sfx('complete'); }
  } else if (g.phase === 'walk') {
    b.vx = 3.2; b.x += b.vx * dt; b.onGround = true; b.facing = 1; b.vy = 0;
    if (g.t > 1.0) { g.phase = 'cheer'; g.t = 0; b.vx = 0; rig.emote('victory'); audio.voice(rig.meta.voice, rig.meta.beep); bubble(t(`say_${rig.id}`), 2); }
  } else {
    b.vx = 0;
    g.fw = (g.fw || 0) - dt;
    if (g.fw <= 0) {
      g.fw = 0.35; audio.sfx('firework');
      bursts.emit(b.x + (Math.random() - 0.3) * 6, b.y + 4 + Math.random() * 2, ['#ffd24a', '#ff5a7a', '#4ff0c8', '#9ad8ff'][Math.floor(Math.random() * 4)], 26, 5, 1);
    }
    if (g.t > 1.8) finishLevel();
  }
  for (const e of run.ents) if (Math.abs((e.obj.position.x || e.x0 || 0) - b.x) < 26) e.update(dt, elapsed, game);
  rig.update(dt, elapsed, b);
}

function finishLevel() {
  if (state !== 'play') return;
  state = 'complete';
  hideBubble();
  const d = DIFFICULTY[run.difficulty];
  const pct = run.totalCoins ? run.coins / run.totalCoins : 1;
  const stars = 1 + (pct >= 0.6 ? 1 : 0) + (run.lost === 0 ? 1 : 0);
  const bonus = run.def.bonus, earned = Math.round((run.coins + bonus + run.flagBonus + run.bossBonus) * d.coinMult);
  const rec = profile.levels[run.def.id] || {};
  profile.levels[run.def.id] = { done: true, stars: Math.max(rec.stars || 0, stars), best: Math.max(rec.best || 0, run.coins) };
  run.banked = true; profile.coins += earned; save();
  audio.duck(true); audio.music('menu');
  $('#complete-title').textContent = levelName(run.def);
  $('#complete-stars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : 'off'}">★</span>`).join('');
  $('#complete-tally').innerHTML = `
    <dt>${t('coinsCollected')}</dt><dd>${run.coins} / ${run.totalCoins}</dd>
    <dt>${t('flagBonus')}</dt><dd>+${run.flagBonus}</dd>
    ${run.bossBonus ? `<dt>${t('bossBonus')}</dt><dd>+${run.bossBonus}</dd>` : ''}
    <dt>${t('levelBonus')}</dt><dd>+${bonus}</dd>
    <dt>${t('multiplier', { diff: t(`diff${run.difficulty}`) })}</dt><dd>×${d.coinMult}</dd>
    <dt class="total">${t('earned')}</dt><dd class="total">+${earned}</dd>`;
  const last = run.index === LEVELS.length - 1;
  $('#complete-unlock').textContent = last ? t('roadOpen') : t('unlockedNext', { name: levelName(LEVELS[run.index + 1]) });
  $('#complete [data-act="next"]').textContent = last ? t('toCity') : t('next');
  $('#complete').hidden = false;
}

$$('[data-act]').forEach(b => b.addEventListener('click', () => {
  audio.sfx('click');
  const a = b.dataset.act;
  $$('.modal').forEach(m => (m.hidden = true)); audio.duck(false);
  if (a === 'resume') { state = 'play'; clearEdges(); }
  else if (a === 'restart') { bankRun(); startLevel(run.index); }
  else if (a === 'quit' || a === 'route') { bankRun(); show('levels'); }
  else if (a === 'shop') { show('shop'); }
  else if (a === 'next') { if (run.index === LEVELS.length - 1) show('ending'); else startLevel(run.index + 1); }
}));
$('#pause-btn').addEventListener('click', () => pause(true));
function pause(on) {
  if (on && state === 'play') { state = 'paused'; $('#pause').hidden = false; audio.duck(true); }
}

// ------------------------------------------------------------------ life-lesson gates
let quizTimer = null, quizOpened = 0;
const topicName = topic => (SKILLS[topic] ? t(`v_${topic}`) : t(`tp_${topic}`));
function openGate(gate) {
  const topic = gate.topic;
  if (profile.skills[topic]) {
    gate.openGate(game); audio.sfx('gate');
    toast(t('alreadyLearned'), gate.power ? t('powerYours', { power: powerOf(topic) }) : t('youKnow', { topic: topicName(topic) }));
    return;
  }
  state = 'quiz'; audio.duck(true); hideBubble();
  for (const k in keys) keys[k] = false;
  const les = lessonText(topic), d = DIFFICULTY[run.difficulty];
  const q = pickQuestion(topic, run.difficulty);
  $('#quiz-kicker').textContent = gate.power ? t('kickerPower', { virtue: topicName(topic) }) : t('kickerLesson', { topic: topicName(topic) });
  $('#quiz-title').textContent = les.title;
  $('#quiz-body').textContent = les.body;
  $('#quiz-tip').textContent = les.tip;
  $('#quiz-q').textContent = q.q;
  $('#quiz-feedback').textContent = ''; $('#quiz-feedback').className = 'feedback';
  // build options: Easy shows 3; a wise-friend hint strikes all but one wrong answer
  let idx = q.o.map((_, i) => i);
  if (idx.length > d.quizChoices) {
    const wrong = idx.filter(i => i !== q.a).sort(() => Math.random() - 0.5).slice(0, d.quizChoices - 1);
    idx = [q.a, ...wrong].sort((a, b) => a - b);
  }
  const useHint = profile.items.hint > 0;
  let struck = [];
  if (useHint) { profile.items.hint--; save(); struck = idx.filter(i => i !== q.a).slice(1); }
  const box = $('#quiz-options'); box.innerHTML = '';
  idx.forEach((i, n) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="k">${n + 1}</span>`; b.append(q.o[i]);
    if (struck.includes(i)) b.classList.add('gone');
    b.addEventListener('click', () => { if (performance.now() - quizOpened > 350 && !b.disabled) answer(i === q.a, b, gate); });
    box.appendChild(b);
  });
  if (useHint) feedback(t('hintUsed'), '');
  // hard mode: answer before the timer runs out
  clearInterval(quizTimer); $('#quiz-timer').textContent = '';
  if (d.timer) {
    let left = d.timer;
    $('#quiz-timer').textContent = `${left}s`;
    quizTimer = setInterval(() => {
      left--; $('#quiz-timer').textContent = `${left}s`;
      if (left <= 0) { clearInterval(quizTimer); answer(false, null, gate, true); }
    }, 1000);
  }
  $('#quiz').hidden = false; quizOpened = performance.now();
  box.querySelector('button:not(.gone)')?.focus();
}
function feedback(text, cls) { const f = $('#quiz-feedback'); f.textContent = text; f.className = `feedback ${cls}`; }
function answer(ok, btn, gate, timeout = false) {
  const d = DIFFICULTY[run.difficulty];
  if (ok) {
    clearInterval(quizTimer);
    btn.classList.add('right'); $$('#quiz-options button').forEach(b => (b.disabled = true));
    const topic = gate.topic;
    profile.skills[topic] = true; save();
    audio.sfx('correct');
    feedback(t('correct'), 'good');
    const p = document.createElement('p'); p.className = 'power';
    const move = SKILLS[topic]?.move;
    p.textContent = gate.power ? t('newPower', { power: t(`pw_${move}`), how: t(`how_${move}`) }) : t('learned', { topic: topicName(topic) });
    if (!gate.power) addCoins(10);
    $('#quiz-feedback').after(p);
    setTimeout(() => {
      p.remove(); $('#quiz').hidden = true; audio.duck(false);
      gate.openGate(game); audio.sfx('gate'); state = 'play'; clearEdges(); hud(); touchButtons();
      if (gate.power) { toast(t('powerUnlocked', { power: t(`pw_${move}`) }), t(`how_${move}`)); rig.emote(); }
      else toast(t('gateOpened'), t('youLearned', { topic: topicName(topic) }));
      bursts.emit(gate.obj.position.x, gate.obj.position.y + 1.5, '#4ff0c8', 30, 6, 3);
    }, 1400);
    return;
  }
  audio.sfx('wrong');
  if (btn) { btn.disabled = true; btn.classList.add('wrong'); setTimeout(() => btn.classList.add('gone'), 350); }
  if (d.wrongCostsLife) {
    run.hearts--; run.lost++; hud();
    if (run.hearts <= 0) { clearInterval(quizTimer); $('#quiz').hidden = true; audio.duck(false); state = 'play'; die('hurt'); return; }
    feedback(timeout ? t('timeUpHeart', { n: run.hearts }) : t('wrongHeart', { n: run.hearts }), 'bad');
    if (timeout) { $('#quiz').hidden = true; state = 'play'; clearEdges(); audio.duck(false); run.body.vx = -8; run.body.x -= 1.5; }
  } else feedback(t('wrongTry'), 'bad');
}

// ------------------------------------------------------------------ HUD, toasts, floating numbers
function hud() {
  if (!run) return;
  const h = $('#hearts'); h.innerHTML = '';
  for (let i = 0; i < run.maxHearts; i++) h.insertAdjacentHTML('beforeend', `<span class="heart ${i < run.hearts ? '' : 'empty'}"></span>`);
  if (run.shield) h.insertAdjacentHTML('beforeend', '<span class="heart shield"></span>');
  $('#hud-coins').textContent = run.coins;
  $('#skills').innerHTML = SKILL_ORDER.filter(id => profile.skills[id])
    .map(id => `<span class="chip" title="${powerOf(id)}"><i>${SKILLS[id].icon}</i><b>${powerOf(id)}</b></span>`).join('');
}
function bossHud() {
  const bar = $('#boss-bar'), b = run?.boss;
  bar.hidden = !b;
  if (!b) return;
  $('#boss-name').textContent = t(`boss_${b.kind}`);
  $('#boss-hp').style.width = `${Math.max(0, b.hp / b.maxHp) * 100}%`;
}
// the shot / pound buttons only appear once you have learned them
function touchButtons() {
  const m = movesFrom(profile.skills);
  $('#touch [data-k="shoot"]').hidden = !m.shoot;
  $('#touch [data-k="down"]').hidden = !m.pound;
}
let toastT = null;
function toast(title, sub = '') {
  const el = $('#toast'); el.innerHTML = ''; el.append(title);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
  el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600);
}
const floaters = [];
function floater(x, y, text, cls = '') {
  const el = document.createElement('span'); el.className = `floater ${cls}`; el.textContent = text;
  $('#floaters').appendChild(el);
  floaters.push({ el, x, y, t: 0 });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt; f.y += dt * 1.4;
    _v.set(f.x, f.y, 0).project(camera);
    f.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.15 - f.t)})`;
    f.el.style.opacity = String(Math.min(1, 2.2 - f.t * 2.2));
    if (f.t > 1 || state !== 'play') { f.el.remove(); floaters.splice(i, 1); }
  }
}

// ------------------------------------------------------------------ camera
const camState = { x: 0, y: 3, look: 0, shake: 0 };
function shake(a) { camState.shake = Math.max(camState.shake, a); }
function freeze(s) { if (run) run.freeze = Math.max(run.freeze, s); }   // a hair of hit-stop sells the impact
function updateCamera(dt) {
  const k = 1 - Math.exp(-5 * dt);
  if (run && world?.kind === 'level' && ['play', 'quiz', 'paused', 'complete', 'over'].includes(state)) {
    const b = run.body;
    camState.look += ((b.facing * 2.2) - camState.look) * (1 - Math.exp(-2.5 * dt));
    const portrait = camera.aspect < 1;
    camState.x += (Math.max(portrait ? 3.5 : 7, b.x + camState.look * (portrait ? 0.5 : 1)) - camState.x) * k;   // never show the void left of the start
    const ty = Math.max(3.4, b.y + 2.1);   // keep more sky than dirt above the player
    camState.y += (ty - camState.y) * (1 - Math.exp(-3 * dt));
    const s = camState.shake; camState.shake *= Math.exp(-9 * dt);
    const sx = (Math.random() - 0.5) * s, sy = (Math.random() - 0.5) * s;
    camera.position.set(camState.x + sx, camState.y + 2.2 + sy, portrait ? 15 : 15.5);
    camera.lookAt(camState.x + sx * 0.5, camState.y - 0.2 + sy * 0.5, 0);
  } else if (state === 'ending') {
    camera.position.set(0, 3, 13); camera.lookAt(0, 4.5, -10);
  } else {
    // showroom: the character stands right of centre; UI lives on the left
    const portrait = camera.aspect < 1;
    // on a phone the menus fill the bottom half, so the stage sits up top
    camera.position.set(portrait ? 0 : -2.3, portrait ? 0.9 : 2.4, portrait ? 7.4 : 9.5);
    camera.lookAt(portrait ? 0 : -2.3, portrait ? -0.75 : 1.1, 0);
    if (rig) rig.facingOffset = portrait ? 0 : -0.24;
  }
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  if (!world) return;

  if (state === 'play') { if (run.goal) goalTick(dt); else tick(dt); }
  else if (run && world.kind === 'level' && rig) rig.update(0, elapsed, run.body);

  if (world.kind !== 'level' && rig) {
    if (!drag) rig.turn *= Math.exp(-1.6 * dt);          // let go and it turns back to face you
    rig.update(dt, elapsed, null, 'menu');
    if (world.kind === 'city') rig.model.rotation.y = -0.5 + Math.sin(elapsed * 0.5) * 0.2;
  }
  bursts?.update(dt);
  updateCamera(dt);
  world.update(dt, elapsed, world.kind === 'level' ? camState.x : 0);
  renderer.render(world.scene, camera);
  if (bubbleT > 0) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) hideBubble(); }
  updateFloaters(dt);
}

const STEP = 1 / 120;
let acc = 0;
function clearEdges() { for (const k in edges) edges[k] = false; }
function tick(dt) {
  const b = run.body;
  run.time += dt;
  if (run.dead > 0) {
    run.dead -= dt;
    if (run.deathAnim) {
      const d = run.deathAnim; d.vy -= 30 * dt; d.y += d.vy * dt;
      rig.model.visible = true; rig.root.position.y = d.y; rig.flipper.rotation.z += dt * 7;   // spin about the waist
    } else rig.model.visible = false;
    if (!run.final && run.dead < 0.35) $('#fade').classList.add('on');
    for (const e of run.ents) if (Math.abs((e.obj.position.x || e.x0 || 0) - b.x) < 26) e.update(dt, elapsed, game);
    if (run.dead <= 0) {
      if (run.final) gameOver();
      else { respawn(); rig.model.visible = true; setTimeout(() => $('#fade').classList.remove('on'), 60); }
    }
    return;
  }
  if (run.freeze > 0) { run.freeze -= dt; rig.update(0, elapsed, b); return; }
  const skills = movesFrom(profile.skills);
  acc += dt;
  let jp = edges.jump, dp = edges.dash, dn = edges.down, jumpFx = null;
  const sp = edges.shoot;
  if (acc >= STEP) edges.jump = edges.dash = edges.down = edges.shoot = false;   // presses wait for a frame that runs physics
  // sambal shot: two fireballs on screen at most
  run.shootCd = Math.max(0, run.shootCd - dt);
  if (sp && skills.shoot && run.shootCd === 0 && run.shots.filter(s => s.alive).length < 2) {
    const s = makeShot(b.x + b.facing * 0.45, b.y + 0.8, b.facing);
    world.scene.add(s.obj); run.shots.push(s); run.shootCd = 0.22; audio.sfx('shoot');
  }
  while (acc >= STEP) {
    acc -= STEP;
    b.jumped = null;
    step(b, { ...keys, jumpPressed: jp, dashPressed: dp, downPressed: dn }, world.grid, skills, STEP);
    if (b.jumped === 'jump') { audio.sfx('jump'); jumpFx = 'jump'; }
    if (b.jumped === 'double') { audio.sfx('double'); jumpFx = 'double'; bursts.emit(b.x, b.y, '#ffffff', 8, 3, -1); }
    if (b.jumped === 'wall') { audio.sfx('wall'); jumpFx = 'jump'; bursts.emit(b.x + b.wallDir * 0.35, b.y + 0.6, '#d9ccb0', 8, 2, 1); }
    if (dp && b.dash > 0.17) { audio.sfx('dash'); bursts.emit(b.x, b.y + 0.7, '#4ff0c8', 10, 3, 0.5); }
    if (dn && b.pound && b.poundHang > P.poundHang - STEP * 1.5) audio.sfx('whoosh');
    if (b.landed) { audio.sfx('land'); bursts.emit(b.x, b.y + 0.05, '#d9ccb0', 5, 2, 1); }
    if (b.onGround) run.combo = 0;
    if (b.pounded) onPound(b);
    if (b.bumped) {
      const blk = run.blocks.find(k => k.x === b.bumped.x && k.y === b.bumped.y);
      if (blk) blk.hit(game); else audio.sfx('bump');
      // bumping a block from below knocks off whatever stands on it (Mario rule)
      for (const en of run.ents) {
        if (en.alive && en.box && en.dashable && en.type !== 'boss' && Math.abs(en.box.x - (b.bumped.x + 0.5)) < 0.9 && Math.abs(en.box.y - (b.bumped.y + 1)) < 0.35) kill(en, 'bump');
      }
    }
    jp = dp = dn = false;
  }
  b.jumped = jumpFx; jumpFx = null;   // the rig reads this for squash & stretch
  if (b.gliding && Math.random() < dt * 4) audio.sfx('glide');
  run.invuln = Math.max(0, run.invuln - dt);
  rig.setInvulnerable(run.invuln > 0, elapsed);
  if (run.star > 0) {
    run.star -= dt;
    rig.setGlow(run.star > 2 || Math.sin(elapsed * 30) > 0, elapsed);
    if (Math.random() < dt * 30) bursts.emit(b.x, b.y + 0.7, `hsl(${(elapsed * 300) % 360}, 100%, 65%)`, 1, 1.5, 1);
    if (run.star <= 0) { rig.setGlow(false, 0); audio.music(run.boss ? 'boss' : run.def.music); }
  }

  // only things near the player think and draw — long levels stay cheap on phones
  for (const e of run.ents) {
    const ex = e.obj.position.x || e.x0 || 0;
    const near = Math.abs(ex - b.x) < 26 || e.sliding;
    if (e.obj.visible !== near && e.alive !== false && !e.open) e.obj.visible = near;
    if (near || e.type === 'gate' || e.type === 'boss') e.update(dt, elapsed, game);
  }
  for (const s of run.shots) s.update(dt, elapsed, game);
  if (run.shots.length > 4) run.shots = run.shots.filter(s => s.alive || (world.scene.remove(s.obj), false));
  const hz = overlapsHazard(b, world.grid);
  if (b.y < -3) fallDeath('pit');
  else if (hz === 'lava') fallDeath('lava');
  else if (hz === 'spike' && run.star <= 0) { hurt(0); b.vy = 11; b.onGround = false; }

  rig.update(dt, elapsed, b);
  $('#hud-progress').style.width = `${Math.min(100, (b.x / run.goalX) * 100)}%`;
}

// ground pound landed: loose floor gives way and nearby enemies are knocked out
function onPound(b) {
  shake(0.35); audio.sfx('pound'); bursts.emit(b.x, b.y + 0.05, '#d9ccb0', 16, 5, 1.5);
  const row = Math.floor(b.y) - 1;
  for (let x = Math.floor(b.x - b.w / 2 + 0.05); x <= Math.floor(b.x + b.w / 2 - 0.05); x++) {
    if (cell(world.grid, x, row) === T.SOFT) { crumble(x, row, T.SOFT, '#9a7650'); b.onGround = false; }
  }
  for (const en of run.ents) {
    if (en.alive && en.box && enemyLike(en) && en.type !== 'boss' && en.type !== 'blob' && Math.abs(en.box.x - b.x) < 2.2 && Math.abs(en.box.y - b.y) < 0.9) kill(en, 'pound');
  }
}
// break a breakable tile and every one of the same kind touching it
function crumble(x, y, kind, color) {
  const g = world.grid, stack = [[x, y]];
  let n = 0;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h || g.cells[cy * g.w + cx] !== kind) continue;
    world.removeTile(cx, cy); n++;
    bursts.emit(cx + 0.5, cy + 0.5, color, 8, 4, 3);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  if (n) { audio.sfx('crumble'); shake(0.3); }
}

// ------------------------------------------------------------------ debug handle (?debug) for automated checks
if (location.search.includes('debug')) window.__lari = {
  get run() { return run; }, get state() { return state; }, get world() { return world; }, get rig() { return rig; }, startLevel, profile, show, keys, edges,
  // teleport onto the highest standable surface at column x
  tp(x) {
    const g = world.grid, b = run.body; x = Math.floor(x);
    for (let y = g.h - 1; y > 0; y--) { const c = g.cells[(y - 1) * g.w + x], up = g.cells[y * g.w + x]; if ([1, 2, 3, 4, 7, 9, 10].includes(c) && !up) { Object.assign(b, { x: x + 0.5, y, vx: 0, vy: 0 }); return y; } }
  },
  learn(...ids) { for (const id of ids) profile.skills[id] = true; save(); hud(); touchButtons(); },
  coins(n) { profile.coins += n; save(); updateWallet(); },
};

// ------------------------------------------------------------------ boot
(async () => {
  show('loading');
  const quips = t('quips');
  let qi = 0;
  $('#load-text').textContent = quips[0];
  const q = setInterval(() => { $('#load-text').textContent = quips[++qi % quips.length]; }, 700);
  try {
    await loadAll((p) => { $('#load-bar').style.width = `${Math.round(p * 100)}%`; });
  } catch (err) {
    clearInterval(q);
    $('#load-text').textContent = t('loadFail');
    console.error(err); return;
  }
  clearInterval(q);
  show('title');
  requestAnimationFrame(frame);
  setTimeout(() => { if (state === 'title' && rig) greet(); }, 1200);
})();
