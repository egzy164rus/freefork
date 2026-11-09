/* FreeFork engine — поиск продуктов, разбор текста, рецепты и Open Food Facts.
   Работает целиком в браузере (никакого сервера): базы лежат в data/*.json. */
(() => {
'use strict';

/* ───────────── текст ───────────── */
const STOP = new Set(['с', 'со', 'и', 'из', 'на', 'в', 'для', 'по', 'of', 'with', 'and', 'a', 'an', 'the', 'some']);
const norm = s => String(s).toLowerCase().replaceAll('ё', 'е');
const words = s => norm(s).match(/\p{L}+/gu) || [];
const content = s => words(s).filter(w => !STOP.has(w));

/** Слова совпадают, если у них общий корень: яйца~яйцо, гречки~гречка, eggs~egg. */
function stem(a, b, prefix = false) {
  if (a === b) return true;
  const m = Math.min(a.length, b.length);
  let l = 0;
  while (l < m && a[l] === b[l]) l++;
  if (prefix && l === a.length && a.length >= 2) return true;
  if (l < 3) return false;
  return l >= m - 2 && Math.max(a.length, b.length) - l <= 3;
}

/* ───────────── данные ───────────── */
let FOODS = null, RECIPES = null, IDX = null, BY_ID = null, ready = null;

function setData(foods, recipes) {
  FOODS = foods; RECIPES = recipes;
  BY_ID = new Map(foods.map(f => [f.id, f]));
  IDX = foods.map(food => {
    const phrases = [];
    for (const s of [food.ru, food.en, ...(food.aliases || [])]) {
      const w = content(s);
      if (w.length) phrases.push(w);
    }
    return { food, phrases };
  });
  ready = Promise.resolve();
}
function init() {
  if (!ready) {
    ready = Promise.all([
      fetch('data/foods.json').then(r => { if (!r.ok) throw new Error('foods'); return r.json(); }),
      fetch('data/recipes.json').then(r => { if (!r.ok) throw new Error('recipes'); return r.json(); }),
    ]).then(([f, r]) => setData(f, r)).catch(e => { ready = null; throw e; });
  }
  return ready;
}

const toDto = (f, lang) => {
  const en = String(lang).startsWith('en');
  return {
    id: f.id, name: en ? f.en : f.ru, kcal: f.kcal, p: f.p, f: f.f, c: f.c, fiber: f.fiber,
    pieceG: f.pieceG ?? null, pieceName: (en ? f.pieceEn : f.pieceRu) ?? null, portionG: f.portionG, source: 'local',
  };
};

function search(query, limit, requireAll = true, typeahead = false) {
  const qt = content(query);
  if (!qt.length) return [];
  const qNorm = qt.join(' ');
  const res = [];
  let order = 0;
  for (const { food, phrases } of IDX) {
    order++;
    let best = 0;
    for (const ph of phrases) {
      const used = new Array(ph.length).fill(false);
      let m = 0;
      for (let qi = 0; qi < qt.length; qi++) {
        const pfx = typeahead && qi === qt.length - 1;
        for (let i = 0; i < ph.length; i++) {
          if (!used[i] && stem(qt[qi], ph[i], pfx)) { used[i] = true; m++; break; }
        }
      }
      if (m === 0 || (requireAll && m < qt.length)) continue;
      const un = ph.length - m;
      let s = m * 10 - un * 2 + (un === 0 ? 5 : 0);
      if (ph.join(' ') === qNorm) s += 10;
      best = Math.max(best, s);
    }
    if (best > 0) res.push([food, best - order * 0.001]);
  }
  res.sort((a, b) => b[1] - a[1]);
  return res.slice(0, limit).map(r => r[0]);
}

/* ───────────── разбор текста: «2 яйца и тост, 150 г гречки» ───────────── */
const U = { NONE: 'None', GRAM: 'Gram', KG: 'Kg', ML: 'Ml', LITER: 'Liter', GLASS: 'Glass', TBSP: 'Tbsp', TSP: 'Tsp', PIECE: 'Piece', PORTION: 'Portion' };
const UNITS = new Map();
const addUnits = (kind, list) => list.forEach(w => UNITS.set(w, kind));
addUnits(U.GRAM, ['г', 'гр', 'грамм', 'грамма', 'граммов', 'g', 'gr', 'gram', 'grams']);
addUnits(U.KG, ['кг', 'килограмм', 'kg']);
addUnits(U.ML, ['мл', 'ml', 'миллилитров']);
addUnits(U.LITER, ['л', 'литр', 'литра', 'литров', 'l', 'liter', 'litre']);
addUnits(U.GLASS, ['стакан', 'стакана', 'стаканов', 'glass', 'glasses', 'cup', 'cups', 'кружка', 'кружки']);
addUnits(U.TBSP, ['tbsp']);
addUnits(U.TSP, ['tsp']);
addUnits(U.PIECE, ['шт', 'штука', 'штуки', 'штук', 'pc', 'pcs', 'piece', 'pieces', 'кусок', 'куска', 'кусков', 'кусочек', 'кусочка',
  'ломтик', 'ломтика', 'ломтиков', 'slice', 'slices', 'долька', 'дольки', 'зубчик', 'зубчика', 'clove', 'cloves']);
addUnits(U.PORTION, ['порция', 'порции', 'порций', 'portion', 'portions', 'serving', 'servings']);

const NUMWORDS = new Map(Object.entries({
  один: '1', одна: '1', одно: '1', одну: '1', one: '1', два: '2', две: '2', two: '2', три: '3', three: '3',
  четыре: '4', four: '4', пять: '5', five: '5', шесть: '6', six: '6', семь: '7', восемь: '8', девять: '9', десять: '10',
  полтора: '1.5', полторы: '1.5', пол: '0.5', половина: '0.5', половинка: '0.5', half: '0.5',
}));

const SPLIT_RX = /[,;\n+]|\s+и\s+|\s+and\s+|\s+&\s+/iu;
const WITH_RX = /\s+(?:с|со|with)\s+/iu;

function parse(text, lang) {
  const out = [];
  if (!text || !String(text).trim()) return out;
  text = String(text).slice(0, 1000);
  for (const raw of text.split(SPLIT_RX)) {
    const seg = (raw || '').trim();
    if (seg) out.push(...parseSegment(seg, lang));
  }
  return out;
}

function parseSegment(seg, lang) {
  let s = norm(seg);
  s = s.replace(/столов\p{L}*\s+ложк\p{L}*|(?<![\p{L}])ст\.?\s*л\.?(?![\p{L}])|(?<![\p{L}])ложк\p{L}*/gu, ' tbsp ');
  s = s.replace(/чайн\p{L}*\s+ложк\p{L}*|(?<![\p{L}])ч\.?\s*л\.?(?![\p{L}])/gu, ' tsp ');
  s = s.replace(/tablespoons?/g, ' tbsp ').replace(/teaspoons?/g, ' tsp ');
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => String(Math.round(Number(a) / Math.max(1, Number(b)) * 100) / 100));
  s = s.replace(/(?<![\p{L}])\p{L}+(?![\p{L}])/gu, m => NUMWORDS.get(m) ?? m);

  let qty = 0, unit = U.NONE, hasNum = false;
  const nm = /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*(\p{L}+)?/u.exec(s);
  if (nm) {
    qty = parseFloat(nm[1].replace(',', '.'));
    hasNum = true;
    const rest = nm[2] || '';
    if (rest && UNITS.has(rest)) {
      unit = UNITS.get(rest);
      s = s.slice(0, nm.index) + ' ' + s.slice(nm.index + nm[0].length);
    } else {
      s = s.slice(0, nm.index) + ' ' + s.slice(nm.index + nm[1].length);
    }
  }
  const ws = words(s);
  if (unit === U.NONE) {
    for (const w of ws) {
      if (w === 'tbsp') { unit = U.TBSP; break; }
      if (w === 'tsp') { unit = U.TSP; break; }
      const u1 = UNITS.get(w);
      if (u1 === U.GLASS || u1 === U.PORTION) { unit = u1; break; }
    }
  }
  if (!hasNum) qty = 1;
  const nameWords = ws.filter(w => {
    if (STOP.has(w) || w === 'tbsp' || w === 'tsp') return false;
    const uu = UNITS.get(w);
    return !(uu === U.GLASS || uu === U.PORTION || uu === U.GRAM || uu === U.ML);
  });
  if (!nameWords.length) return [];
  const name = nameWords.join(' ');

  let found = search(name, 5);
  if (!found.length) {
    const parts = (' ' + norm(seg) + ' ').split(WITH_RX).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const res = [];
      let first = true;
      for (const p of parts) {
        const cleaned = content(p.replace(/\d+([.,]\d+)?|\p{L}*ложк\p{L}*/gu, ' ')).join(' ');
        let f = search(cleaned, 5);
        if (!f.length) f = search(cleaned, 5, false);
        if (!f.length) { first = false; continue; }
        res.push(build(p, first ? qty : 1, first ? unit : U.NONE, first && hasNum, f, lang));
        first = false;
      }
      return res;
    }
    found = search(name, 5, false);
  }
  if (!found.length) return [{ query: seg, qty, unit, grams: 0, food: null, alternatives: [] }];
  return [build(seg, qty, unit, hasNum, found, lang)];
}

function build(query, qty, unit, hasNum, found, lang) {
  const f = found[0];
  const piece = f.pieceG ?? null;
  let grams;
  switch (unit) {
    case U.GRAM: grams = qty; break;
    case U.KG: grams = qty * 1000; break;
    case U.ML: grams = qty; break;
    case U.LITER: grams = qty * 1000; break;
    case U.GLASS: grams = qty * 250; break;
    case U.TBSP: grams = qty * 15; break;
    case U.TSP: grams = qty * 5; break;
    case U.PIECE: grams = qty * (piece ?? f.portionG); break;
    case U.PORTION: grams = qty * f.portionG; break;
    default:
      grams = hasNum
        ? (piece && qty < 20 ? qty * piece : (qty >= 20 ? qty : qty * f.portionG))
        : (piece ?? f.portionG);
  }
  return {
    query: query.trim(), qty, unit, grams: Math.round(grams),
    food: toDto(f, lang), alternatives: found.slice(1).map(x => toDto(x, lang)),
  };
}

/* ───────────── холодильник → рецепты ───────────── */
const STAPLES = new Set(['sunflower_oil', 'olive_oil', 'sugar', 'flour', 'soy_sauce', 'garlic', 'butter']);

function fridge(req) {
  const lang = req.lang || 'ru';
  const en = String(lang).startsWith('en');
  const recognized = [], unrecognized = [];
  const haveFamilies = new Set();
  for (const raw of String(req.text || '').split(/[,;\n]/)) {
    const item = raw.trim();
    if (!item || item.length > 60) continue;
    let found = search(item, 3);
    if (!found.length) found = search(item, 3, false);
    if (!found.length) { unrecognized.push(item); continue; }
    haveFamilies.add(found[0].family);
    recognized.push(en ? found[0].en : found[0].ru);
  }
  const rem = req.remaining;
  const hasRem = !!(rem && rem.kcal > 50);
  const assumeStaples = req.assumeStaples !== false;
  const list = [];

  for (const r of RECIPES) {
    let k = 0, p = 0, f = 0, c = 0, keyTotal = 0, keyHave = 0;
    const ings = [];
    for (const ing of r.ingredients) {
      const food = BY_ID.get(ing.food);
      k += food.kcal * ing.g / 100; p += food.p * ing.g / 100; f += food.f * ing.g / 100; c += food.c * ing.g / 100;
      const staple = STAPLES.has(food.id);
      const have = haveFamilies.has(food.family) || (staple && assumeStaples);
      if (!staple) { keyTotal++; if (have) keyHave++; }
      ings.push({ ing, food, have, staple });
    }
    const coverage = keyTotal === 0 ? 1 : keyHave / keyTotal;
    if (haveFamilies.size > 0 && coverage < 0.5) continue;
    let scale = 1;
    if (hasRem) scale = Math.min(2, Math.max(0.5, Math.round(rem.kcal / Math.max(k, 1) * 4) / 4));
    const ks = k * scale, ps = p * scale;
    const fit = hasRem ? Math.max(0, 1 - Math.abs(ks - rem.kcal) / rem.kcal) : 0.5;
    const protFit = hasRem && rem.p > 5 ? Math.min(1, ps / rem.p) : 0.5;
    const mealBonus = !req.meal || r.meals.includes(req.meal) ? 1 : 0;
    const score = (haveFamilies.size > 0 ? coverage * 60 : 0) + fit * 20 + protFit * 10 + mealBonus * 10;
    const r1 = n => Math.round(n * 10) / 10;
    list.push({
      id: r.id, name: en ? r.en : r.ru, minutes: r.minutes, meals: r.meals,
      kcal: Math.round(k), p: r1(p), f: r1(f), c: r1(c), scale,
      kcalScaled: Math.round(ks), pScaled: r1(ps), fScaled: r1(f * scale), cScaled: r1(c * scale),
      coverage: Math.round(coverage * 100) / 100, score: r1(score),
      ingredients: ings.map(x => ({ food: x.food.id, name: en ? x.food.en : x.food.ru, grams: Math.round(x.ing.g * scale), have: x.have, staple: x.staple })),
      steps: en ? r.stepsEn : r.stepsRu,
    });
  }
  list.sort((a, b) => b.score - a.score);
  return { recognized, unrecognized, recipes: list.slice(0, 12) };
}

/* ───────────── Open Food Facts (прямо из браузера) ───────────── */
const OFF_FIELDS = 'code,product_name,product_name_ru,product_name_en,brands,nutriments,serving_quantity';
const offCache = new Map();
async function offFetch(url) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally { clearTimeout(tm); }
}
const numOf = v => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };
function offToDto(p, lang) {
  const n = p.nutriments;
  if (!n) return null;
  let kcal = numOf(n['energy-kcal_100g']);
  if (kcal == null && numOf(n['energy_100g']) != null) kcal = numOf(n['energy_100g']) / 4.184;
  if (kcal == null) return null;
  let name = String(lang).startsWith('ru') ? p.product_name_ru : p.product_name_en;
  if (!name) name = p.product_name;
  name = (name || '').trim();
  if (!name) return null;
  const r1 = x => Math.round((x || 0) * 10) / 10;
  const serving = numOf(p.serving_quantity);
  const brand = (p.brands || '').split(',')[0].trim();
  return {
    id: 'off:' + (p.code || ''), name: name.slice(0, 80), kcal: r1(kcal),
    p: r1(numOf(n.proteins_100g)), f: r1(numOf(n.fat_100g)), c: r1(numOf(n.carbohydrates_100g)), fiber: r1(numOf(n.fiber_100g)),
    pieceG: null, pieceName: null, portionG: serving > 0 && serving < 2000 ? serving : 100, source: 'off', brand: brand || null,
  };
}
async function online(q, lang) {
  q = String(q).trim();
  if (q.length < 2) return { items: [], ok: true };
  const key = `${lang}:${q.toLowerCase()}`;
  if (offCache.has(key)) return { items: offCache.get(key), ok: true };
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=15' +
    `&fields=${OFF_FIELDS}&search_terms=${encodeURIComponent(q)}`;
  try {
    let data;
    try { data = await offFetch(url); } catch (e) { await new Promise(r => setTimeout(r, 600)); data = await offFetch(url); }
    const items = (data.products || []).map(p => offToDto(p, lang)).filter(Boolean);
    offCache.set(key, items);
    return { items, ok: true };
  } catch { return { items: [], ok: false }; }
}
async function barcode(code, lang) {
  code = String(code).replace(/\D/g, '');
  if (code.length < 6 || code.length > 14) return null;
  try {
    const data = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
    return data.product ? offToDto(data.product, lang) : null;
  } catch { return null; }
}

/* ───────────── публичный интерфейс ───────────── */
const Engine = {
  setData, init,
  async search(q, lang) { await init(); return q && q.length <= 80 ? search(q, 12, true, true).map(f => toDto(f, lang)) : []; },
  async parse(text, lang) { await init(); return parse(text, lang || 'ru'); },
  async fridge(req) { await init(); return fridge(req); },
  online, barcode,
};
if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else window.Engine = Engine;
})();
