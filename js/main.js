// LARI.js — game controller: screens, input, the play loop, code gates, shop and save.
import * as THREE from 'three';
import { loadAll } from './assets.js';
import { World } from './world.js';
import { Rig, Bursts, spawnEntities, makeHeart } from './actors.js';
import { makeBody, step, overlapsHazard, aabb } from './physics.js';
import { LEVELS, SKILLS } from './levels.js';
import { LESSONS, pickQuestion, highlight } from './quiz.js';
import { load, save, reset as resetSave, SHOP, DIFFICULTY } from './save.js';
import * as audio from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const profile = load();
audio.setMuted(!profile.sound);

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
const keys = { left: false, right: false, jump: false, dash: false };
const edges = { jump: false, dash: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyJ: 'dash' };
addEventListener('keydown', e => {
  audio.unlock();
  if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'play') { pause(true); return; }
  if (state === 'quiz' && /^Digit[1-4]$/.test(e.code)) { $$('#quiz-options button')[+e.code.slice(5) - 1]?.click(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  if (state === 'play') e.preventDefault();
  if (!keys[k] && (k === 'jump' || k === 'dash')) edges[k] = true;
  keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pause(true); });
for (const b of $$('#touch button')) {
  const k = b.dataset.k;
  const down = e => { e.preventDefault(); audio.unlock(); if (!keys[k] && (k === 'jump' || k === 'dash')) edges[k] = true; keys[k] = true; b.classList.add('press'); };
  const up = e => { e.preventDefault(); keys[k] = false; b.classList.remove('press'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
addEventListener('pointerdown', () => audio.unlock(), { once: true });

// ------------------------------------------------------------------ screens
let state = 'loading', prevScreen = 'title';
function show(name) {
  for (const s of $$('.screen')) s.classList.toggle('on', s.dataset.screen === name);
  if (['title', 'levels', 'shop', 'settings', 'about', 'ending'].includes(name)) {
    if (name !== 'settings' && name !== 'about') prevScreen = name;
    state = name;
    if (name === 'ending') { enterCity(); }
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
let world = null, rig = null, stage = null, bursts = null;
function swapWorld(w) { world?.dispose(); rig?.dispose(); world = w; }

function enterShowroom() {
  if (world?.kind === 'showroom' && world.charKey === charKey()) return;
  const w = new World(renderer); w.kind = 'showroom'; w.charKey = charKey();
  const done = Object.keys(profile.levels).filter(k => profile.levels[k].done);
  const theme = done.includes('forest') ? 'volcano' : done.includes('village') ? 'forest' : 'village';
  stage = w.buildShowroom(theme);
  swapWorld(w);
  rig = new Rig(profile.equipped.character, profile.equipped.hat, trailColor(), w.scene);
  rig.root.position.set(0, 0, 0); w.scene.add(rig.root);
}
const charKey = () => `${profile.equipped.character}|${profile.equipped.hat}|${profile.equipped.trail}`;
const trailColor = () => SHOP.trails.find(t => t.id === profile.equipped.trail)?.color || null;

function enterCity() {
  const w = new World(renderer); w.kind = 'city'; w.buildCity(); swapWorld(w);
  rig = new Rig(profile.equipped.character, profile.equipped.hat, null, w.scene);
  w.scene.add(rig.root); rig.root.position.set(3, 0, 1.5);
  audio.music('menu');
}

// ------------------------------------------------------------------ level select
function levelUnlocked(i) { return i === 0 || profile.levels[LEVELS[i - 1].id]?.done; }
function renderRoute() {
  const r = $('#route'); r.innerHTML = '';
  const art = { village: '☾', forest: '♣', volcano: '▲', city: 'KL' };
  LEVELS.forEach((L, i) => {
    const rec = profile.levels[L.id], open = levelUnlocked(i), sk = SKILLS[L.skill];
    const b = document.createElement('button');
    b.className = 'lvl'; b.dataset.theme = L.theme; b.disabled = !open;
    b.innerHTML = `<div class="art" data-emoji="${art[L.theme]}"></div>
      <p class="sub">${L.sub}</p><h3>${L.name}</h3>
      <p class="learn">Learn <code>${sk.name}</code> → <b>${sk.power}</b></p>
      <p class="stars">${[0, 1, 2].map(k => (rec?.stars > k ? '★' : '☆')).join('')}</p>
      ${open ? '' : '<div class="lock">🔒 Finish the previous level</div>'}`;
    b.addEventListener('click', () => { audio.sfx('click'); startLevel(i); });
    r.appendChild(b);
  });
  const allDone = LEVELS.every(L => profile.levels[L.id]?.done);
  const c = document.createElement('button');
  c.className = 'lvl'; c.dataset.theme = 'city'; c.disabled = !allDone;
  c.innerHTML = `<div class="art" data-emoji="KL"></div><p class="sub">Finale</p><h3>Kuala Lumpur</h3>
    <p class="learn">The city at the end of the road.</p>${allDone ? '' : '<div class="lock">🔒 Clear all three levels</div>'}`;
  c.addEventListener('click', () => { audio.sfx('click'); show('ending'); });
  r.appendChild(c);
  $('#diff-label').textContent = DIFFICULTY[profile.difficulty].name;
}

// ------------------------------------------------------------------ shop
let shopTab = 'characters';
$$('.tabs button').forEach(b => b.addEventListener('click', () => {
  shopTab = b.dataset.tab; audio.sfx('click');
  $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderShop();
}));
function renderShop() {
  const grid = $('#shop-grid'); grid.innerHTML = '';
  const slot = { characters: 'character', hats: 'hat', trails: 'trail' }[shopTab];
  for (const it of SHOP[shopTab]) {
    const d = document.createElement('div'); d.className = 'item';
    let action;
    if (shopTab === 'items') {
      const n = profile.items[it.id];
      d.innerHTML = `<h4>${it.name}</h4><p>${it.blurb}</p><span class="count">owned: ${n}</span>`;
      action = Object.assign(document.createElement('button'), { className: 'buy', innerHTML: `<i class="coin-ic"></i>${it.price}` });
      action.disabled = profile.coins < it.price;
      action.onclick = () => buy(it, () => { profile.items[it.id]++; });
    } else {
      const owned = profile.owned[shopTab].includes(it.id), eq = profile.equipped[slot] === it.id;
      if (eq) d.classList.add('sel');
      d.innerHTML = `<h4>${it.name}</h4>${it.blurb ? `<p>${it.blurb}</p>` : ''}${it.color ? `<span class="swatch" style="background:${it.color}"></span>` : ''}`;
      action = document.createElement('button');
      if (eq) { action.className = 'buy equipped'; action.textContent = 'Equipped'; }
      else if (owned) { action.className = 'buy owned'; action.textContent = 'Equip'; action.onclick = () => { profile.equipped[slot] = it.id; save(); audio.sfx('click'); refreshShop(); }; }
      else {
        action.className = 'buy'; action.innerHTML = `<i class="coin-ic"></i>${it.price}`; action.disabled = profile.coins < it.price;
        action.onclick = () => buy(it, () => { profile.owned[shopTab].push(it.id); profile.equipped[slot] = it.id; });
      }
    }
    d.appendChild(action); grid.appendChild(d);
  }
}
function buy(it, apply) {
  if (profile.coins < it.price) { audio.sfx('wrong'); return; }
  profile.coins -= it.price; apply(); save(); audio.sfx('buy'); refreshShop();
}
function refreshShop() { renderShop(); updateWallet(); enterShowroom(); }

// ------------------------------------------------------------------ settings
function renderSettings() {
  $$('#diff-seg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.diff === profile.difficulty));
  $('#sound-btn').textContent = `Sound: ${profile.sound ? 'on' : 'off'}`;
}
$$('#diff-seg button').forEach(b => b.addEventListener('click', () => { profile.difficulty = +b.dataset.diff; save(); audio.sfx('click'); renderSettings(); }));
$('#sound-btn').addEventListener('click', () => { profile.sound = !profile.sound; save(); audio.setMuted(!profile.sound); renderSettings(); });
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Reset all coins, purchases and progress?')) return;
  Object.assign(profile, resetSave()); world = null; enterShowroom(); renderSettings(); updateWallet();
});

// ------------------------------------------------------------------ play
let run = null;   // the current level attempt
const game = {    // the interface entities talk to
  get body() { return run.body; }, get grid() { return world.grid; }, get diff() { return DIFFICULTY[run.difficulty]; },
  get magnet() { return run.magnet; }, get inQuiz() { return state === 'quiz'; },
  sfx: audio.sfx,
  collectCoin(x, y, n = 1) { run.coins += n; audio.sfx('coin'); bursts.emit(x, y, '#f2b632', 8, 3, 2); hud(); },
  touchEnemy(en) {
    const b = run.body;
    if (!aabb(b, en.box)) return;
    if (b.vy < -1 && b.y > en.box.y + en.box.h * 0.35) {          // stomp from above
      en.alive = false; b.vy = 10; b.jumpsUsed = 1; run.stomps++;
      audio.sfx('stomp'); bursts.emit(en.box.x, en.box.y + 0.4, '#c8312b', 12, 4, 3);
    } else hurt(b.x < en.box.x ? -1 : 1);
  },
  spawnHeart(x, y) { const h = makeHeart(x, y); world.scene.add(h.obj); run.ents.push(h); },
  gainHeart() { run.hearts = Math.min(run.maxHearts, run.hearts + 1); audio.sfx('heart'); bursts.emit(run.body.x, run.body.y + 1, '#e2384f', 10, 3, 3); hud(); },
  setCheckpoint(x, y) { run.check = { x, y }; audio.sfx('check'); toast('Checkpoint', 'progress saved'); },
  reachGate(gate) { openGate(gate); },
  finish() { finishLevel(); },
};

function startLevel(i) {
  const def = LEVELS[i];
  const w = new World(renderer); w.kind = 'level';
  const L = w.build(def);
  swapWorld(w);
  bursts = new Bursts(w.scene);
  rig = new Rig(profile.equipped.character, profile.equipped.hat, trailColor(), w.scene);
  w.scene.add(rig.root);
  const items = profile.items;
  run = {
    index: i, def, difficulty: profile.difficulty,
    body: makeBody(L.start.x, L.start.y), check: { ...L.start },
    hearts: 3, maxHearts: 3, shield: false, magnet: false, hint: false,
    coins: 0, totalCoins: L.ents.filter(e => e.type === 'coin').length + L.ents.filter(e => e.type === 'block' && e.gives === 'coin').length * 3,
    lost: 0, stomps: 0, invuln: 0, dead: 0, time: 0,
  };
  // consume one of each owned power-up
  if (items.life > 0) { items.life--; run.hearts = run.maxHearts = 4; }
  if (items.shield > 0) { items.shield--; run.shield = true; }
  if (items.magnet > 0) { items.magnet--; run.magnet = true; }
  save();
  run.ents = spawnEntities(L, w.scene, game);
  run.blocks = run.ents.filter(e => e.type === 'block');
  const goal = run.ents.find(e => e.type === 'goal');
  run.goalX = goal ? goal.obj.position.x : L.w;
  camState.x = run.body.x; camState.y = run.body.y;
  $('#hud-level').textContent = def.name;
  show('play'); state = 'play';
  audio.music(def.music);
  hud();
  const used = [run.maxHearts > 3 && '+1 life', run.shield && 'shield', run.magnet && 'magnet'].filter(Boolean);
  toast(`${def.sub} · ${def.name}`, used.length ? `power-ups: ${used.join(', ')}` : `Find the code gate to learn ${SKILLS[def.skill].name}`);
}

function hurt(dir) {
  const b = run.body;
  if (run.invuln > 0 || run.dead > 0) return;
  if (run.shield) { run.shield = false; run.invuln = 1.2; audio.sfx('bump'); bursts.emit(b.x, b.y + 0.8, '#4ff0c8', 14, 4, 2); hud(); return; }
  run.hearts--; run.lost++; run.invuln = 1.6;
  b.vx = dir * 7; b.vy = 8; b.onGround = false;
  audio.sfx('hurt'); bursts.emit(b.x, b.y + 0.8, '#e2384f', 10, 3, 2);
  hud();
  if (run.hearts <= 0) gameOver();
}
function fallDeath() {
  if (run.dead > 0) return;
  run.hearts--; run.lost++;
  audio.sfx('die'); hud();
  if (run.hearts <= 0) { gameOver(); return; }
  run.dead = 0.8;    // brief pause, then respawn at the checkpoint
}
function respawn() {
  const b = run.body;
  Object.assign(b, makeBody(run.check.x, run.check.y), { facing: 1 });
  run.invuln = 1.5;
}

function gameOver() {
  state = 'over';
  profile.coins += run.coins; save();
  audio.sfx('gameover'); audio.duck(true);
  $('#over').hidden = false;
}

function finishLevel() {
  if (state !== 'play') return;
  state = 'complete';
  const d = DIFFICULTY[run.difficulty];
  const pct = run.totalCoins ? run.coins / run.totalCoins : 1;
  const stars = 1 + (pct >= 0.7 ? 1 : 0) + (run.lost === 0 ? 1 : 0);
  const bonus = run.def.bonus, earned = Math.round((run.coins + bonus) * d.coinMult);
  const rec = profile.levels[run.def.id] || {};
  profile.levels[run.def.id] = { done: true, stars: Math.max(rec.stars || 0, stars), best: Math.max(rec.best || 0, run.coins) };
  profile.coins += earned; save();
  audio.sfx('complete'); audio.duck(true);
  $('#complete-title').textContent = run.def.name;
  $('#complete-stars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : 'off'}">★</span>`).join('');
  $('#complete-tally').innerHTML = `
    <dt>Coins collected</dt><dd>${run.coins} / ${run.totalCoins}</dd>
    <dt>Level bonus</dt><dd>+${bonus}</dd>
    <dt>${d.name} multiplier</dt><dd>×${d.coinMult}</dd>
    <dt class="total">Earned</dt><dd class="total">+${earned}</dd>`;
  const last = run.index === LEVELS.length - 1;
  $('#complete-unlock').textContent = last ? 'The road to Kuala Lumpur is open.' : `Unlocked: ${LEVELS[run.index + 1].name}`;
  $('#complete [data-act="next"]').textContent = last ? 'To the city →' : 'Next →';
  $('#complete').hidden = false;
}

$$('[data-act]').forEach(b => b.addEventListener('click', () => {
  audio.sfx('click');
  const a = b.dataset.act;
  $$('.modal').forEach(m => (m.hidden = true)); audio.duck(false);
  if (a === 'resume') { state = 'play'; }
  else if (a === 'restart') startLevel(run.index);
  else if (a === 'quit' || a === 'route') { show('levels'); }
  else if (a === 'shop') { show('shop'); }
  else if (a === 'next') { if (run.index === LEVELS.length - 1) show('ending'); else startLevel(run.index + 1); }
}));
$('#pause-btn').addEventListener('click', () => pause(true));
function pause(on) {
  if (on && state === 'play') { state = 'paused'; $('#pause').hidden = false; audio.duck(true); }
}

// ------------------------------------------------------------------ code gates
let quizTimer = null;
function openGate(gate) {
  if (profile.skills[gate.skill]) {
    gate.openGate(game); audio.sfx('gate'); toast('Already compiled ✓', `${SKILLS[gate.skill].power} is yours`);
    return;
  }
  state = 'quiz'; audio.duck(true);
  for (const k in keys) keys[k] = false;
  const les = LESSONS[gate.skill], d = DIFFICULTY[run.difficulty];
  const q = pickQuestion(gate.skill, run.difficulty);
  $('#quiz-kicker').textContent = `Code gate · ${SKILLS[gate.skill].name}`;
  $('#quiz-title').textContent = les.title;
  $('#quiz-body').innerHTML = les.body;
  $('#quiz-code').innerHTML = highlight(les.code);
  $('#quiz-q').textContent = q.q;
  $('#quiz-qcode').innerHTML = highlight(q.code);
  $('#quiz-feedback').textContent = ''; $('#quiz-feedback').className = 'feedback';
  // build options: Easy shows 3; a Stack Overflow hint strikes all but one wrong answer
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
    b.innerHTML = `<span class="k">${n + 1}</span>${q.o[i].replace(/</g, '&lt;')}`;
    if (struck.includes(i)) b.classList.add('gone');
    b.addEventListener('click', () => answer(i === q.a, b, gate));
    box.appendChild(b);
  });
  if (useHint) feedback('Stack Overflow hint used: wrong answers struck out.', '');
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
  $('#quiz').hidden = false;
  box.querySelector('button:not(.gone)')?.focus();
}
function feedback(text, cls) { const f = $('#quiz-feedback'); f.textContent = text; f.className = `feedback ${cls}`; }
function answer(ok, btn, gate, timeout = false) {
  const d = DIFFICULTY[run.difficulty];
  if (ok) {
    clearInterval(quizTimer);
    btn.classList.add('right'); $$('#quiz-options button').forEach(b => (b.disabled = true));
    profile.skills[gate.skill] = true; save();
    audio.sfx('correct');
    feedback('✓ Compiled! Gate opening…', 'good');
    const p = document.createElement('p'); p.className = 'power'; p.textContent = `New power — ${LESSONS[gate.skill].power}`;
    $('#quiz-feedback').after(p);
    setTimeout(() => {
      p.remove(); $('#quiz').hidden = true; audio.duck(false);
      gate.openGate(game); audio.sfx('gate'); state = 'play'; hud();
      toast(`${SKILLS[gate.skill].power} unlocked`, SKILLS[gate.skill].key);
      bursts.emit(gate.obj.position.x, gate.obj.position.y + 1.5, '#4ff0c8', 30, 6, 3);
    }, 1400);
    return;
  }
  audio.sfx('wrong');
  if (btn) { btn.classList.add('wrong'); setTimeout(() => btn.classList.add('gone'), 350); }
  if (d.wrongCostsLife) {
    run.hearts--; run.lost++; hud();
    if (run.hearts <= 0) { clearInterval(quizTimer); $('#quiz').hidden = true; gameOver(); return; }
    feedback(timeout ? `⏱ Time's up — that cost a heart. ${run.hearts} left.` : `✗ Bug! That cost a heart. ${run.hearts} left.`, 'bad');
    if (timeout) { $('#quiz').hidden = true; state = 'play'; audio.duck(false); run.body.vx = -8; run.body.x -= 1.5; }
  } else feedback('✗ Not quite — read the code again and try another answer.', 'bad');
}

// ------------------------------------------------------------------ HUD
function hud() {
  if (!run) return;
  const h = $('#hearts'); h.innerHTML = '';
  for (let i = 0; i < run.maxHearts; i++) h.insertAdjacentHTML('beforeend', `<span class="heart ${i < run.hearts ? '' : 'empty'}"></span>`);
  if (run.shield) h.insertAdjacentHTML('beforeend', '<span class="heart shield"></span>');
  $('#hud-coins').textContent = run.coins;
  $('#skills').innerHTML = Object.values(SKILLS).map(s => `<span class="chip ${profile.skills[s.id] ? '' : 'off'}" title="${s.power}">${s.power}</span>`).join('');
}
let toastT = null;
function toast(title, sub = '') {
  const t = $('#toast'); t.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

// ------------------------------------------------------------------ camera
const camState = { x: 0, y: 3, look: 0 };
function updateCamera(dt) {
  const t = 1 - Math.exp(-5 * dt);
  if (state === 'play' || state === 'quiz' || state === 'paused' || state === 'complete' || state === 'over') {
    const b = run.body;
    camState.look += ((b.facing * 2.2) - camState.look) * (1 - Math.exp(-2.5 * dt));
    const portraitCam = camera.aspect < 1;
    camState.x += (Math.max(portraitCam ? 3.5 : 7, b.x + camState.look * (portraitCam ? 0.5 : 1)) - camState.x) * t;   // never show the void left of the start
    const ty = Math.max(3.2, b.y + 1.6);
    camState.y += (ty - camState.y) * (1 - Math.exp(-3 * dt));
    const portrait = camera.aspect < 1;
    camera.position.set(camState.x, camState.y + 2.2, portrait ? 15 : 15.5);
    camera.lookAt(camState.x, camState.y - 0.2, 0);
  } else if (state === 'ending') {
    camera.position.set(0, 3, 13); camera.lookAt(0, 4.5, -10);
  } else {
    // showroom: the character stands right of centre; UI lives on the left
    const portrait = camera.aspect < 1;
    camera.position.set(portrait ? 0 : -2.3, portrait ? 3.4 : 2.4, portrait ? 12 : 9.5);
    camera.lookAt(portrait ? 0 : -2.3, portrait ? 2.4 : 1.1, 0);
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

  if (state === 'play') tick(dt);
  else if (run && world.kind === 'level' && rig) rig.update(0, elapsed, run.body);

  if (world.kind !== 'level' && rig) {
    rig.update(dt, elapsed, null, 'menu');
    if (world.kind === 'city') { rig.root.rotation.y = -0.5 + Math.sin(elapsed * 0.5) * 0.2; }
  }
  bursts?.update(dt);
  updateCamera(dt);
  world.update(dt, elapsed, world.kind === 'level' ? camState.x : 0);
  renderer.render(world.scene, camera);
}

const STEP = 1 / 120;
let acc = 0;
function tick(dt) {
  const b = run.body;
  run.time += dt;
  if (run.dead > 0) {
    run.dead -= dt; rig.model.visible = false;
    if (run.dead <= 0) { respawn(); rig.model.visible = true; }
    for (const e of run.ents) e.update(dt, elapsed, game);
    return;
  }
  const skills = { double: !!profile.skills.loop, dash: !!profile.skills.function, glide: !!profile.skills.async };
  acc += dt;
  let jp = edges.jump, dp = edges.dash, jumpFx = null; edges.jump = edges.dash = false;
  while (acc >= STEP) {
    acc -= STEP;
    b.jumped = null;
    step(b, { ...keys, jumpPressed: jp, dashPressed: dp }, world.grid, skills, STEP);
    if (b.jumped === 'jump') { audio.sfx('jump'); jumpFx = 'jump'; }
    if (b.jumped === 'double') { audio.sfx('double'); jumpFx = 'double'; bursts.emit(b.x, b.y, '#ffffff', 8, 3, -1); }
    if (dp && b.dash > 0 && b.dash > 0.17) { audio.sfx('dash'); bursts.emit(b.x, b.y + 0.7, '#4ff0c8', 10, 3, 0.5); }
    if (b.landed) { audio.sfx('land'); bursts.emit(b.x, b.y + 0.05, '#d9ccb0', 5, 2, 1); }
    if (b.bumped) {
      const blk = run.blocks.find(k => k.x === b.bumped.x && k.y === b.bumped.y);
      if (blk) blk.hit(game); else audio.sfx('bump');
    }
    jp = dp = false;
  }
  b.jumped = jumpFx; jumpFx = null;   // the rig reads this for squash & stretch
  if (b.gliding && Math.random() < dt * 4) audio.sfx('glide');
  run.invuln = Math.max(0, run.invuln - dt);
  rig.setInvulnerable(run.invuln > 0, elapsed);

  for (const e of run.ents) e.update(dt, elapsed, game);
  if (b.y < -3 || overlapsHazard(b, world.grid)) fallDeath();

  rig.update(dt, elapsed, b);
  $('#hud-progress').style.width = `${Math.min(100, (b.x / run.goalX) * 100)}%`;
}

// ------------------------------------------------------------------ debug handle (?debug) for automated checks
if (location.search.includes('debug')) window.__lari = { get run() { return run; }, get state() { return state; }, startLevel, profile, show };

// ------------------------------------------------------------------ boot
(async () => {
  show('loading');
  const quips = ['npm install kampung…', 'compiling the rainforest…', 'warming up the lava…', 'debugging the bugs…', 'git push origin KL…'];
  let qi = 0;
  const q = setInterval(() => { $('#load-text').textContent = quips[++qi % quips.length]; }, 700);
  try {
    await loadAll((p) => { $('#load-bar').style.width = `${Math.round(p * 100)}%`; });
  } catch (err) {
    clearInterval(q);
    $('#load-text').textContent = 'Could not load the 3D assets. Open the game through a web server (not file://).';
    console.error(err); return;
  }
  clearInterval(q);
  show('title');
  requestAnimationFrame(frame);
})();
