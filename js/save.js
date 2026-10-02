// Player profile in localStorage (falls back to memory if storage is blocked) + the shop catalogue.
// Names, blurbs and catchphrases live in text.js (keys chb_* / say_* / hat_* / tr_* / it_*).
const KEY = 'lari-js-save-v1';

export const SHOP = {
  characters: [
    { id: 'coder',     name: 'Dev',       price: 0 },
    { id: 'siti',      name: 'Siti',      price: 120 },
    { id: 'kucing',    name: 'Kucing',    price: 150 },
    { id: 'mei',       name: 'Mei',       price: 200 },
    { id: 'kancil',    name: 'Kancil',    price: 220 },
    { id: 'robot',     name: 'Bot-9',     price: 250 },
    { id: 'priya',     name: 'Priya',     price: 280 },
    { id: 'ninja',     name: 'Ninja',     price: 350 },
    { id: 'puteri',    name: 'Puteri',    price: 400 },
    { id: 'kenyalang', name: 'Kenyalang', price: 450 },
    { id: 'astro',     name: 'Astro',     price: 500 },
    { id: 'harimau',   name: 'Harimau',   price: 650 },
  ],
  hats: [
    { id: 'none',       price: 0 },
    { id: 'cap',        price: 60 },
    { id: 'party',      price: 60 },
    { id: 'bunga',      price: 70 },
    { id: 'ears',       price: 80 },
    { id: 'songkok',    price: 90 },
    { id: 'terendak',   price: 100 },
    { id: 'headphones', price: 120 },
    { id: 'tengkolok',  price: 200 },
    { id: 'crown',      price: 400 },
  ],
  trails: [
    { id: 'none',    price: 0,   color: null },
    { id: 'sparks',  price: 100, color: '#f2b632' },
    { id: 'neon',    price: 140, color: '#4ff0c8' },
    { id: 'sakura',  price: 180, color: '#ff5a7a' },
    { id: 'rainbow', price: 300, color: 'rainbow' },
  ],
  items: [
    { id: 'life',   price: 80,  model: 'Heart' },
    { id: 'shield', price: 90,  model: 'Shield' },
    { id: 'magnet', price: 70,  model: 'Magnet' },
    { id: 'hint',   price: 50,  model: 'Bulb' },
    { id: 'star',   price: 150, model: 'Star' },
  ],
};

const DEFAULT = {
  coins: 0,
  difficulty: 1,                 // 0 easy · 1 normal · 2 hard · 3 very hard
  sound: true,
  lang: null,                    // null → follow the browser
  owned: { characters: ['coder'], hats: ['none'], trails: ['none'] },
  equipped: { character: 'coder', hat: 'none', trail: 'none' },
  items: { life: 0, shield: 0, magnet: 0, hint: 0, star: 0 },
  skills: {},                    // lessons learned: persist / focus / … / friends / health / …
  levels: {},                    // id → { done, best, stars }
  seenIntro: false,
};

// the first version taught JavaScript; its saved lessons map onto the life lessons that replaced them
const RENAMED = { loop: 'persist', function: 'focus', async: 'patience', let: 'friends', if: 'health', array: 'nature', object: 'money', event: 'feelings', try: 'safety' };

let mem = null;
export function load() {
  if (mem) return mem;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* blocked or corrupt */ }
  mem = merge(structuredClone(DEFAULT), raw || {});
  for (const [old, now] of Object.entries(RENAMED)) if (mem.skills[old]) { mem.skills[now] = true; delete mem.skills[old]; }
  return mem;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* blocked */ } }
// reset in place: main.js holds a reference to this exact object, so swapping it out would stop saves
export function reset() {
  const keep = { lang: mem.lang, sound: mem.sound };
  for (const k of Object.keys(mem)) delete mem[k];
  Object.assign(mem, structuredClone(DEFAULT), keep); save(); return mem;
}

function merge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

// names and blurbs come from text.js: diff0…diff3, diffb0…diffb3
export const DIFFICULTY = [
  { id: 0, bugSpeed: 0.7, coinMult: 1,   quizChoices: 3, wrongCostsLife: false, timer: 0 },
  { id: 1, bugSpeed: 1.0, coinMult: 1.5, quizChoices: 4, wrongCostsLife: false, timer: 0 },
  { id: 2, bugSpeed: 1.3, coinMult: 2,   quizChoices: 4, wrongCostsLife: true,  timer: 30 },
  { id: 3, bugSpeed: 1.6, coinMult: 3,   quizChoices: 4, wrongCostsLife: true,  timer: 15 },
];
