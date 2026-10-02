/* =========================================================
   LARI.js sound — everything is synthesised with Web Audio:
   no files to download, nothing to license.

   Ten soundtracks, each a small generative sequencer:
   · menu    — lo-fi Rhodes-ish chords, lazy drums (84 bpm)
   · village — night kampung: slendro bells, gong, crickets, bamboo flute (72 bpm)
   · forest  — marimba arpeggios, shaker, bouncy bass (116 bpm)
   · volcano — driving phrygian bass, toms, brass stabs (138 bpm)
   · beach   — sunset joget: steel-drum melody, ukulele strums, waves (104 bpm)
   · cave    — drips, a low drone, slow pelog bells, deep echoes (78 bpm)
   · kota    — KL at night: synthwave bass, four-on-the-floor, neon arps (124 bpm)
   · boss    — tense minor riff, double kicks, alarm stabs (150 bpm)
   · star    — invincible: bright fast arpeggios (168 bpm)
   · finale  — the city welcome: warm pads, bells, slow drums (92 bpm)
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

// a steel-drum-ish strike (bright FM, fast decay)
function steel(m, t, dur, peak, out) { bell(m, t, dur, peak, out, 2.0); osc('sine', hz(m) * 2, t, dur * 0.4, peak * 0.3, out); }
const SONGS2 = {
  beach: {
    bpm: 104,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];   // C Am F G
      const ch = chords[bar];
      if (k === 0 || k === 6 || k === 8 || k === 14) ch.forEach((m, j) => pluck(m, t + j * 0.012, 0.35, 0.05, musicBus));   // ukulele strum
      if (k === 0 || k === 10) osc('triangle', hz(ch[0] - 24), t, s * 3, 0.3, musicBus, { lp: 500 });
      if (k === 4 || k === 12) osc('triangle', hz(ch[0] - 17), t, s * 2, 0.22, musicBus, { lp: 500 });
      if (k % 4 === 0) kick(t, 0.45);
      if (k === 4 || k === 12) snare(t, 0.1);
      noise(t, 0.03, k % 2 ? 0.035 : 0.06, musicBus, { type: 'bandpass', f: 6500, q: 1.5 });   // shaker
      const melody = [[76, 79, 81, 79, 76, 74, 72, 74], [72, 76, 79, 76, 81, 79, 76, 72], [77, 76, 74, 72, 74, 76, 77, 79], [79, 81, 79, 76, 74, 76, 79, 83]][bar];
      if (k % 2 === 0 && (k % 8 !== 6 || bar % 2)) steel(melody[k / 2], t, 0.32, 0.06, musicBus);
      if (k === 0 && bar % 2 === 0) noise(t, 3.2, 0.05, musicBus, { type: 'lowpass', f: 700, a: 1.3 });   // a wave rolls in
      if (k === 14 && Math.random() < 0.25) osc('sine', 1900, t, 0.18, 0.025, musicBus, { glide: 1400 });  // a gull, far off
    },
  },
  cave: {
    bpm: 78,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const pelog = [62, 63, 65, 69, 70, 74, 75, 77];
      if (k === 0) { pad([38, 45, 50], t, s * 16, 0.03); osc('sine', hz(26 + (bar === 2 ? 1 : 0)), t, s * 14, 0.22, musicBus, { a: 0.6 }); }
      if (k === 0 || k === 10) kick(t, 0.35);
      if (k % 4 === 2 && Math.random() < 0.7) bell(pelog[(bar * 3 + k) % pelog.length], t, 2.2, 0.05, musicBus, 1.41);
      if (Math.random() < 0.12) {                                   // water dripping in the dark
        const d = 1600 + Math.random() * 1600;
        osc('sine', d, t, 0.09, 0.05, musicBus, { glide: d * 0.55 });
        osc('sine', d * 0.8, t + 0.22, 0.07, 0.015, musicBus, { glide: d * 0.45 });
      }
      if (k === 8 && bar === 3) noise(t, 2.4, 0.03, musicBus, { type: 'bandpass', f: 400, q: 2, a: 1.5 });
      if (k === 12 && bar % 2 === 1) [74, 77, 75, 70].forEach((m, j) => osc('sine', hz(m), t + j * s * 1.5, s * 2, 0.035, musicBus, { a: 0.04 }));
    },
  },
  kota: {
    bpm: 124,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const roots = [45, 41, 48, 43];                                // Am F C G
      const r = roots[bar];
      if (k % 4 === 0) kick(t, 0.8);
      if (k % 4 === 2) noise(t, 0.09, 0.09, musicBus, { f: 7500 });  // open hat on the off-beat
      if (k === 4 || k === 12) snare(t, 0.25);
      osc('sawtooth', hz((k % 2 ? r + 12 : r) - 12), t, s * 0.9, 0.12, musicBus, { lp: 900 });   // octave bass
      if (k === 0) pad([r + 12, r + 15 + (bar === 2 || bar === 3 ? 1 : 0), r + 19], t, s * 16, 0.028);
      const arp = [0, 7, 12, 15, 19, 15, 12, 7];
      if (k % 2 === 0) osc('square', hz(r + 24 + arp[(k / 2) % 8]), t, s * 0.8, 0.035, musicBus, { lp: 2600 });
      if (bar === 3 && k >= 8 && k % 2 === 0) bell(r + 36 + (k - 8), t, 0.3, 0.04, musicBus, 3);
    },
  },
  boss: {
    bpm: 150,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const riff = [40, 40, 52, 40, 46, 40, 51, 40, 40, 52, 40, 46, 49, 47, 46, 43];
      const shift = [0, 0, 3, -2][bar];
      osc('sawtooth', hz(riff[k] + shift), t, s * 0.8, 0.13, musicBus, { lp: 1100 });
      if (k % 2 === 0 || k === 15) kick(t, 0.75);
      if (k === 4 || k === 12) snare(t, 0.32);
      if (k % 2 === 1) hat(t, 0.07);
      if (k === 0) for (const m of [64 + shift, 67 + shift, 70 + shift]) osc('sawtooth', hz(m), t, s * 2, 0.04, musicBus, { lp: 2200 });
      if (bar === 3 && (k === 8 || k === 12)) { bell(88, t, 0.4, 0.06, musicBus, 1.5); bell(94, t + s, 0.4, 0.05, musicBus, 1.5); }
    },
  },
  star: {
    bpm: 168,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 2;
      const r = bar ? 65 : 60;
      kick(t, k % 4 === 0 ? 0.6 : 0.0001);
      if (k % 2 === 1) hat(t, 0.08);
      if (k === 4 || k === 12) snare(t, 0.2);
      const up = [0, 4, 7, 12, 16, 12, 7, 4];
      osc('square', hz(r + 12 + up[k % 8]), t, s * 0.7, 0.05, musicBus, { lp: 3200 });
      if (k % 4 === 0) osc('triangle', hz(r - 12), t, s * 1.5, 0.28, musicBus);
      if (k === 0) bell(r + 24, t, 0.5, 0.06, musicBus, 2);
    },
  },
  finale: {
    bpm: 92,
    step(i, t, s) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      const chords = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];   // D A Bm G
      if (k === 0) { pad(chords[bar], t, s * 16, 0.04); osc('sine', hz(chords[bar][0] - 24), t, s * 12, 0.28, musicBus); }
      if (k === 0 || k === 8) kick(t, 0.5);
      if (k === 4 || k === 12) snare(t, 0.14);
      if (k % 2 === 0) hat(t, 0.04);
      const tune = [[74, 76, 78, 81], [76, 73, 69, 73], [78, 74, 71, 74], [79, 78, 76, 74]][bar];
      if (k % 4 === 0) bell(tune[k / 4], t, 1.0, 0.07, musicBus, 2);
    },
  },
};
Object.assign(SONGS, SONGS2);

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

// a character "speaking": a few syllable blips at the character's own pitch (robots beep)
export function voice(pitch = 1, beep = false) {
  if (!ctx) init();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02, n = 5 + Math.floor(Math.random() * 3);
  for (let j = 0; j < n; j++) {
    const t = t0 + j * 0.075, f = 220 * pitch * (0.9 + Math.random() * 0.45) * (j === n - 1 ? 1.25 : 1);
    if (beep) osc('square', f * 2, t, 0.05, 0.05, sfxBus, { lp: 3000 });
    else {
      osc('triangle', f, t, 0.06, 0.09, sfxBus, { glide: f * (0.85 + Math.random() * 0.3) });
      noise(t, 0.04, 0.03, sfxBus, { type: 'bandpass', f: 1200 * pitch + Math.random() * 900, q: 4 });
    }
  }
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
    case 'fall': osc('sine', 900, t, 0.7, 0.12, o, { glide: 120 }); break;
    case 'alert': osc('square', 1180, t, 0.05, 0.06, o, { lp: 3000 }); osc('square', 1580, t + 0.07, 0.07, 0.06, o, { lp: 3000 }); break;
    case 'rumble': noise(t, 0.5, 0.18, o, { type: 'lowpass', f: 300, a: 0.08 }); break;
    case 'crumble': for (let j = 0; j < 4; j++) noise(t + j * 0.06, 0.14, 0.2 - j * 0.04, o, { type: 'bandpass', f: 900 - j * 150, q: 0.8 }); break;
    case 'powerup': [67, 71, 74, 79, 83].forEach((m, j) => osc('square', hz(m), t + j * 0.05, 0.1, 0.07, o, { lp: 2600 })); break;
    case 'oneup': [76, 79, 88, 84, 86, 91].forEach((m, j) => osc('square', hz(m), t + j * 0.08, 0.1, 0.07, o, { lp: 3000 })); break;
    case 'star': [84, 88, 91, 96].forEach((m, j) => bell(m, t + j * 0.05, 0.5, 0.08, o, 2)); noise(t, 0.4, 0.05, o, { f: 8000 }); break;
    case 'shoot': osc('square', 880, t, 0.12, 0.08, o, { glide: 300, lp: 2400 }); noise(t, 0.08, 0.06, o, { type: 'bandpass', f: 2500 }); break;
    case 'burn': noise(t, 0.25, 0.12, o, { type: 'highpass', f: 3000 }); osc('sine', 300, t, 0.15, 0.1, o, { glide: 120 }); break;
    case 'whoosh': noise(t, 0.18, 0.12, o, { type: 'bandpass', f: 1500, q: 1.2, a: 0.03 }); break;
    case 'pound': osc('sine', 140, t, 0.3, 0.6, o, { glide: 40 }); noise(t, 0.2, 0.25, o, { type: 'lowpass', f: 700 }); break;
    case 'wall': osc('triangle', 520, t, 0.08, 0.12, o, { glide: 760 }); noise(t, 0.04, 0.08, o, { f: 3000 }); break;
    case 'thud': osc('sine', 90, t, 0.5, 0.7, o, { glide: 30 }); noise(t, 0.3, 0.2, o, { type: 'lowpass', f: 400 }); break;
    case 'bosshit': bell(64, t, 0.5, 0.18, o, 1.41); osc('square', 200, t, 0.2, 0.12, o, { glide: 90, lp: 1500 }); break;
    case 'bossdie': for (let j = 0; j < 5; j++) { noise(t + j * 0.12, 0.3, 0.2, o, { type: 'lowpass', f: 900 - j * 120 }); bell(84 - j * 3, t + j * 0.12, 0.6, 0.06, o, 2); } break;
    case 'flag': osc('triangle', 1200, t, 0.9, 0.1, o, { glide: 300 }); break;
    case 'firework': noise(t, 0.05, 0.15, o, { f: 2000 }); for (let j = 0; j < 5; j++) noise(t + 0.1 + j * 0.05, 0.03, 0.05, o, { f: 6000 + j * 400 }); break;
  }
}
