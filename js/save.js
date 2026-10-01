// Player profile in localStorage (falls back to memory if storage is blocked) + the shop catalogue.
const KEY = 'lari-js-save-v1';

export const SHOP = {
  characters: [
    { id: 'coder',  name: 'Dev',     price: 0,   blurb: 'Hoodie, glasses, a backpack full of side projects.' },
    { id: 'kucing', name: 'Kucing',  price: 150, blurb: 'The kampung cat. Lands on its feet, mostly.' },
    { id: 'robot',  name: 'Bot-9',   price: 250, blurb: 'Runs on solar and Stack Overflow.' },
    { id: 'ninja',  name: 'Ninja',   price: 350, blurb: 'Silent commits. No merge conflicts.' },
    { id: 'astro',  name: 'Astro',   price: 500, blurb: 'Already in the cloud.' },
  ],
  hats: [
    { id: 'none',       name: 'No hat',     price: 0 },
    { id: 'cap',        name: 'Snapback',   price: 60 },
    { id: 'party',      name: 'Party hat',  price: 60 },
    { id: 'songkok',    name: 'Songkok',    price: 90 },
    { id: 'headphones', name: 'Headphones', price: 120 },
    { id: 'crown',      name: 'Crown',      price: 400 },
  ],
  trails: [
    { id: 'none',    name: 'No trail',    price: 0,   color: null },
    { id: 'sparks',  name: 'Gold sparks', price: 100, color: '#f2b632' },
    { id: 'neon',    name: 'Neon teal',   price: 140, color: '#4ff0c8' },
    { id: 'sakura',  name: 'Bunga raya',  price: 180, color: '#ff5a7a' },
  ],
  items: [
    { id: 'life',    name: 'Extra life',      price: 80, blurb: 'Start the next level with 4 hearts.' },
    { id: 'shield',  name: 'Bug shield',      price: 90, blurb: 'Blocks the first hit.' },
    { id: 'magnet',  name: 'Coin magnet',     price: 70, blurb: 'Coins fly to you.' },
    { id: 'hint',    name: 'Stack Overflow',  price: 50, blurb: 'Removes wrong answers at the next code gate.' },
  ],
};

const DEFAULT = {
  coins: 0,
  difficulty: 1,                 // 0 easy · 1 normal · 2 hard
  sound: true,
  owned: { characters: ['coder'], hats: ['none'], trails: ['none'] },
  equipped: { character: 'coder', hat: 'none', trail: 'none' },
  items: { life: 0, shield: 0, magnet: 0, hint: 0 },
  skills: {},                    // loop / function / async → true
  levels: {},                    // id → { done, best, stars }
  seenIntro: false,
};

let mem = null;
export function load() {
  if (mem) return mem;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* blocked or corrupt */ }
  mem = merge(structuredClone(DEFAULT), raw || {});
  return mem;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* blocked */ } }
export function reset() { mem = structuredClone(DEFAULT); save(); return mem; }

function merge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

export const DIFFICULTY = [
  { id: 0, name: 'Easy',   bugSpeed: 0.7, coinMult: 1,   quizChoices: 3, wrongCostsLife: false, timer: 0 },
  { id: 1, name: 'Normal', bugSpeed: 1.0, coinMult: 1.5, quizChoices: 4, wrongCostsLife: false, timer: 0 },
  { id: 2, name: 'Hard',   bugSpeed: 1.4, coinMult: 2,   quizChoices: 4, wrongCostsLife: true,  timer: 25 },
];
