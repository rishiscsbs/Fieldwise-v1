/* Fieldwise — app state, storage and small helpers shared by every other script. */
'use strict';

const BRAND = { name: 'Fieldwise' };

/* localStorage wrapper. Storage can be missing or blocked, so every call is guarded. */
const store = {
  get(k, d) { try { const v = localStorage.getItem('fw_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fw_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};

const _mo = new Date().getMonth();
const curSeason = (_mo >= 5 && _mo <= 8) ? 'kharif' : (_mo >= 9 || _mo <= 1) ? 'rabi' : 'zaid';

let lang = store.get('lang', 'en');

/* Farm profile: drives every screen. */
let P = Object.assign({
  district: 'nagpur', season: curSeason, soil: 'black', ph: 7.6,
  N: 240, P: 14, K: 310, irrigation: 'partial', area: 2, crop: null
}, store.get('profile', {}));

let tickets = store.get('tickets', null) || [
  { id: 1, name: 'Ramesh Wankhede', village: 'Katol', crop: 'cotton', q: 'Leaves on my cotton are turning red at the edges. What should I do?', reply: 'This is usually magnesium shortage after heavy rain. Spray magnesium sulphate @ 10 g/L twice, 10 days apart.', ts: Date.now() - 86400000 * 3 },
  { id: 2, name: 'Sunita Bhoyar', village: 'Kalmeshwar', crop: 'chickpea', q: 'When should I give the first irrigation to gram sown on 2 November?', reply: '', ts: Date.now() - 86400000 }
];
let alerts = store.get('alerts', null) || [
  { id: 1, d: 'nagpur', level: 'warn', txt: { en: 'Pod borer moths rising in chickpea fields around Nagpur. Put up bird perches and pheromone traps this week.', hi: 'नागपुर के आसपास चने के खेतों में फली छेदक पतंगे बढ़ रहे हैं। इस सप्ताह पक्षी ठिकाने और फेरोमोन ट्रैप लगाएँ।' }, ts: Date.now() - 3600e3 }
];

function saveProfile() { store.set('profile', P); }

/* i18n lookup: t('key', ...args). Falls back to English, then to the key. */
const t = (k, ...a) => { let v = T[lang][k]; if (v === undefined) v = T.en[k]; return typeof v === 'function' ? v(...a) : (v ?? k); };
/* Pick the current language from a {en, hi} object. */
const L = o => o == null ? '' : (typeof o === 'string' ? o : (o[lang] || o.en));

const fmt = n => Math.round(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Soil Health Card thresholds (kg/ha). */
const lvlN = v => v < 280 ? 'low' : v > 560 ? 'high' : 'med';
const lvlP = v => v < 10 ? 'low' : v > 25 ? 'high' : 'med';
const lvlK = v => v < 110 ? 'low' : v > 280 ? 'high' : 'med';

/* Deterministic RNG so simulated data is stable for a given day + district. */
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }

const locale = () => lang === 'hi' ? 'hi-IN' : 'en-IN';
const dayName = d => d.toLocaleDateString(locale(), { weekday: 'short' });
const dayLong = d => d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
