// Four languages. t('key', {vars}) for interface strings; static HTML is tagged with data-i18n attributes.
import { STR } from './text.js?v=7';

export const LANGS = [
  { id: 'en', name: 'English' },
  { id: 'ru', name: 'Русский' },
  { id: 'zh', name: '中文' },
  { id: 'ms', name: 'Melayu' },
];
const HTML_LANG = { en: 'en', ru: 'ru', zh: 'zh-Hans', ms: 'ms' };
let lang = 'en';

export const getLang = () => lang;

// the browser's language, if we speak it
export function detectLang() {
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const k = l.toLowerCase();
    if (k.startsWith('ru')) return 'ru';
    if (k.startsWith('zh')) return 'zh';
    if (k.startsWith('ms') || k.startsWith('id')) return 'ms';
    if (k.startsWith('en')) return 'en';
  }
  return 'en';
}

export function t(key, vars) {
  const e = STR[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return s;
}

export function setLang(id) {
  lang = LANGS.some(l => l.id === id) ? id : 'en';
  document.documentElement.lang = HTML_LANG[lang];
  applyStatic();
}

// fill every tagged element: data-i18n (text), data-i18n-html (markup), data-i18n-aria (aria-label)
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
