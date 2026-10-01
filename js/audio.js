/* =========================================================
   LARI.js sound — everything is synthesised with Web Audio:
   no files to download, nothing to license.

   Four soundtracks, each a small generative sequencer:
   · menu    — lo-fi Rhodes-ish chords, lazy drums (84 bpm)
   · village — night kampung: slendro bells, gong, crickets, bamboo flute (72 bpm)
   · forest  — marimba arpeggios, shaker, bouncy bass (116 bpm)
   · volcano — driving phrygian bass, toms, brass stabs (138 bpm)
   ========================================================= */
let ctx = null, master, musicBus, sfxBus, verb, noiseBuf;
let muted = false, current = null, timer = null;

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}
export function isMuted() { return muted; }

export function unlock() {
  if (!ctx) init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  verb = ctx.createConvolver(); verb.buffer = impulse(2.2); verb.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  const ms = ctx.createGain(); ms.gain.value = 0.35; musicBus.connect(ms).connect(verb);
  const ss = ctx.createGain(); ss.gain.value = 0.1; sfxBus.connect(ss).connect(verb);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
}

function impulse(sec) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = b.getChannelData(c); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  return b;
}

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- voices
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}
function osc(type, f, t, dur, peak, out, { a = 0.005, detune = 0, glide = null, lp = null } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  env(g, t, a, peak, dur);
  let node = o;
  if (lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
  node.connect(g).connect(out);
  o.start(t); o.stop(t + a + dur + 0.05);
}
function bell(m, t, dur, peak, out, ratio = 3.5) {   // two-operator FM bell / gamelan key
  const c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = hz(m); mo.frequency.value = hz(m) * ratio;
  mg.gain.setValueAtTime(hz(m) * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
  mo.connect(mg).connect(c.frequency);
  env(g, t, 0.003, peak, dur);
  c.connect(g).connect(out);
  c.start(t); mo.start(t); c.stop(t + dur + 0.1); mo.stop(t + dur + 0.1);
}
function pluck(m, t, dur, peak, out, type = 'triangle') { osc(type, hz(m), t, dur, peak, out, { lp: 2400 }); }
function noise(t, dur, peak, out, { type = 'highpass', f = 6000, q = 0.7, a = 0.002 } = {}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  env(g, t, a, peak, dur);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
}
function kick(t, peak = 0.9, out = musicBus) { osc('sine', 120, t, 0.3, peak, out, { glide: 38 }); }
function snare(t, peak = 0.35, out = musicBus) { noise(t, 0.16, peak, out, { type: 'bandpass', f: 1800, q: 0.8 }); osc('triangle', 190, t, 0.08, peak * 0.5, out); }
function hat(t, peak = 0.12, out = musicBus) { noise(t, 0.04, peak, out, { f: 8000 }); }
function pad(ms, t, dur, peak, out = musicBus) {
  for (const m of ms) for (const d of [-7, 7]) osc('sawtooth', hz(m), t, dur, peak, out, { a: dur * 0.35, detune: d, lp: 900 });
}

// ---------------------------------------------------------------- songs
// each song: bpm, steps per bar (16ths), and step(i, t) that schedules notes
const SONGS = {
  menu: {
    bpm: 84,
    step(i, t, s) {
      const bar = Math.floor(i / 16) % 4, k = i % 16;
      const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];  // Fmaj7 Em7 Dm7 Cmaj7
      if (k === 0) { pad(chords[bar], t, s * 15, 0.035); osc('sine', hz(chords[bar][0] - 24), t, s * 6, 0.25, musicBus); }
      if (k === 0 || k === 7 || k === 10) kick(t, 0.5);
      if (k === 4 || k === 12) snare(t, 0.12);
      if (k % 2 === 0) hat(t, k % 4 ? 0.04 : 0.07);
      if (k % 4 === 2 && Math.random() < 0.55) {
        const scale = [72, 74, 76, 79, 81, 84];
        bell(scale[Math.floor(Math.random() * scale.length)], t, 1.4, 0.06, musicBus, 2);
      }
    },
  },
  village: {
    bpm: 72,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 8;
      const slendro = [62, 64, 67, 69, 72, 74, 76, 79];
      // interlocking bells (saron) on 8ths, a slow balungan line
      const line = [0, 2, 1, 3, 2, 4, 3, 1];
      if (k % 4 === 0) bell(slendro[line[(i / 4) % 8 | 0]], t, 1.2, 0.08, musicBus);
      if (k % 4 === 2) bell(slendro[line[((i / 4) % 8 | 0)] + 2] + 12, t, 0.6, 0.035, musicBus);
      if (k === 0 && bar % 2 === 0) { bell(38, t, 4.5, 0.22, musicBus, 1.41); osc('sine', hz(38), t, 3, 0.18, musicBus); }  // gong
      if (k === 8) osc('sine', hz(50), t, 0.8, 0.1, musicBus, { glide: hz(48) });                                          // kempul
      if (Math.random() < 0.18) noise(t, 0.03, 0.03, musicBus, { type: 'bandpass', f: 5200, q: 12 });                       // crickets
      if (k === 0 && bar % 4 === 3) {                                                                                       // suling phrase
        const notes = [79, 76, 74, 76, 72];
        notes.forEach((n, j) => osc('sine', hz(n), t + j * s * 2, s * 2.4, 0.06, musicBus, { a: 0.05 }));
      }
    },
  },
  forest: {
    bpm: 116,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const roots = [55, 52, 48, 50];                               // G Em C D
      const triad = [[0, 4, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7]][bar];
      const arp = [0, 1, 2, 1, 2, 3, 2, 1];
      const n = roots[bar] + 12 + (arp[k % 8] === 3 ? 12 : triad[arp[k % 8]]);
      if (k % 2 === 0) pluck(n, t, 0.25, 0.11, musicBus, 'sine');
      if (k % 2 === 0) bell(n + 12, t, 0.18, 0.025, musicBus, 4);
      if (k === 0 || k === 6 || k === 8 || k === 11) osc('triangle', hz(roots[bar] - 12), t, s * 2, 0.32, musicBus, { lp: 600 });
      if (k % 4 === 0) kick(t, 0.6);
      if (k === 4 || k === 12) snare(t, 0.18);
      noise(t, 0.03, k % 2 ? 0.05 : 0.025, musicBus, { type: 'bandpass', f: 7000, q: 2 });   // shaker
      if (k === 14 && Math.random() < 0.3) osc('sine', 2600, t, 0.12, 0.03, musicBus, { glide: 3400 });  // bird
      if (bar === 3 && k === 0) {
        [79, 81, 83, 86].forEach((m, j) => bell(m, t + j * s * 2, 0.5, 0.05, musicBus, 3));
      }
    },
  },
  volcano: {
    bpm: 138,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const root = [38, 38, 39, 36][bar];                            // D D Eb C — phrygian menace
      if (k % 2 === 0) osc('sawtooth', hz(root), t, s * 1.6, 0.16, musicBus, { lp: 700 });
      if (k % 2 === 0) osc('square', hz(root - 12), t, s * 1.6, 0.1, musicBus, { lp: 300 });
      if (k === 0 || k === 3 || k === 8 || k === 10) kick(t, 0.85);
      if (k === 4 || k === 12) snare(t, 0.3);
      if (k % 2 === 1) hat(t, 0.06);
      if (k === 14 || k === 15) osc('sine', [110, 90][k - 14], t, 0.2, 0.3, musicBus, { glide: 55 });   // toms
      if (k === 0 && bar % 2 === 0) for (const m of [root + 24, root + 27, root + 31]) osc('sawtooth', hz(m), t, s * 3, 0.05, musicBus, { lp: 1800 });
      if (bar === 3 && (k === 8 || k === 10 || k === 12)) osc('square', hz(root + 36 - (k - 8)), t, s, 0.04, musicBus, { lp: 2500 });
    },
  },
};

export function music(name) {
  if (!ctx) init();
  if (!ctx || current === name) return;
  stopMusic();
  current = name;
  const song = SONGS[name]; if (!song) return;
  const s = 60 / song.bpm / 4;
  let i = 0, next = ctx.currentTime + 0.1;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicBus.gain.exponentialRampToValueAtTime(0.42, ctx.currentTime + 1.2);
  timer = setInterval(() => {
    while (next < ctx.currentTime + 0.18) { song.step(i++, next, s); next += s; }
  }, 50);
}
export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null; current = null;
}
export function duck(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.15 : 0.42, ctx.currentTime, 0.15); }

// ---------------------------------------------------------------- effects
export function sfx(name) {
  if (!ctx) init();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005, o = sfxBus;
  switch (name) {
    case 'jump': osc('square', 330, t, 0.16, 0.12, o, { glide: 660, lp: 2200 }); break;
    case 'double': osc('square', 520, t, 0.14, 0.11, o, { glide: 1040, lp: 2600 }); bell(88, t + 0.04, 0.2, 0.05, o); break;
    case 'dash': noise(t, 0.22, 0.28, o, { type: 'bandpass', f: 1200, q: 0.6, a: 0.02 }); osc('sawtooth', 200, t, 0.2, 0.08, o, { glide: 600, lp: 1500 }); break;
    case 'glide': noise(t, 0.4, 0.06, o, { type: 'bandpass', f: 700, q: 1.5, a: 0.1 }); break;
    case 'coin': bell(83, t, 0.08, 0.14, o, 2); bell(88, t + 0.07, 0.35, 0.14, o, 2); break;
    case 'stomp': osc('sine', 220, t, 0.14, 0.4, o, { glide: 60 }); noise(t, 0.08, 0.2, o, { type: 'lowpass', f: 900 }); break;
    case 'hurt': osc('sawtooth', 440, t, 0.4, 0.18, o, { glide: 110, lp: 1600 }); noise(t, 0.2, 0.15, o, { type: 'lowpass', f: 1200 }); break;
    case 'bump': osc('sine', 160, t, 0.12, 0.35, o, { glide: 80 }); break;
    case 'reward': [76, 83, 88].forEach((m, j) => bell(m, t + j * 0.06, 0.3, 0.1, o, 2)); break;
    case 'heart': [72, 76, 79, 84].forEach((m, j) => osc('triangle', hz(m), t + j * 0.06, 0.2, 0.15, o)); break;
    case 'spring': osc('sine', 180, t, 0.45, 0.35, o, { glide: 720 }); break;
    case 'check': [79, 84, 91].forEach((m, j) => bell(m, t + j * 0.09, 0.8, 0.09, o, 3)); break;
    case 'gate': [60, 64, 67, 72, 76, 79, 84].forEach((m, j) => bell(m, t + j * 0.07, 0.9, 0.08, o, 2.5)); noise(t, 1.2, 0.05, o, { f: 5000, a: 0.4 }); break;
    case 'correct': [72, 76, 79, 84].forEach((m, j) => osc('triangle', hz(m), t + j * 0.08, 0.3, 0.16, o)); break;
    case 'wrong': osc('square', 140, t, 0.35, 0.14, o, { lp: 900 }); osc('square', 133, t, 0.35, 0.14, o, { lp: 900 }); break;
    case 'buy': bell(84, t, 0.15, 0.12, o, 2); bell(91, t + 0.1, 0.6, 0.12, o, 2); noise(t, 0.1, 0.08, o, { f: 7000 }); break;
    case 'click': osc('triangle', 900, t, 0.04, 0.08, o); break;
    case 'land': osc('sine', 120, t, 0.08, 0.15, o, { glide: 70 }); break;
    case 'complete': [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.6], [72, 0.72]].forEach(([m, d]) => {
      osc('square', hz(m), t + d, 0.22, 0.08, o, { lp: 2400 }); bell(m + 12, t + d, 0.4, 0.05, o, 2);
    }); break;
    case 'gameover': [67, 64, 60, 55].forEach((m, j) => osc('triangle', hz(m), t + j * 0.22, 0.4, 0.16, o)); break;
    case 'die': osc('square', 660, t, 0.6, 0.12, o, { glide: 80, lp: 2000 }); break;
  }
}
