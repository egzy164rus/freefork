/* FreeFork — бесплатный счётчик калорий. Все данные хранятся только в браузере пользователя. */
(() => {
'use strict';

/* ───────────── helpers ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const flat = a => a.flat(Infinity);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  const props = [];
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'selected', 'disabled', 'indeterminate'].includes(k)) props.push([k, v]);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of flat(kids)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  for (const [k, v] of props) el[k] = v;
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of flat(kids)) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => ymd(new Date());
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
const debounce = (fn, ms) => { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; };

/* ───────────── i18n ───────────── */
function t(key, p) {
  const dict = window.I18N[S.lang] || window.I18N.ru;
  let s = dict[key] ?? window.I18N.ru[key] ?? key;
  if (p) for (const [k, v] of Object.entries(p)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
const locale = () => (S.lang === 'ru' ? 'ru-RU' : 'en-GB');

/* ───────────── state ───────────── */
const KEY = 'freefork.v1';
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICON = { breakfast: '🍳', lunch: '🥗', dinner: '🍝', snack: '🍎' };
const SPLITS = { balanced: [0.25, 0.30, 0.45], protein: [0.35, 0.30, 0.35], lowcarb: [0.30, 0.40, 0.30] };
const GOAL_DELTA = { lose: -500, lose_slow: -300, maintain: 0, gain: 300 };

function defaults() {
  return {
    v: 1, lang: (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en',
    theme: 'auto', flex: true, configured: false,
    profile: { sex: 'f', age: 30, height: 168, weight: 68, activity: 1.375, goal: 'maintain', split: 'balanced', manual: null },
    days: {}, weights: {}, custom: [], recent: [], favs: [], demoKeys: [],
  };
}
function load() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      Object.assign(d, raw);
      d.profile = Object.assign(defaults().profile, raw.profile || {});
    }
  } catch { /* повреждённые данные — начинаем с нуля */ }
  return d;
}
let S = load();
let saveTimer;
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast(t('storageFull')); }
}
function save(touch = true) {
  if (touch) S.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 50);
  scheduleSync();
}
let view = 'today';
let cur = today();

/* ───────────── расчёты ───────────── */
function bmr(p) { return 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161); }
function tdee(p) { return bmr(p) * p.activity; }
function targets() {
  const p = S.profile;
  let kcal = p.manual ? p.manual : Math.round((tdee(p) + GOAL_DELTA[p.goal]) / 10) * 10;
  kcal = Math.max(1200, kcal);
  const sp = SPLITS[p.split] || SPLITS.balanced;
  return { kcal, p: r0(kcal * sp[0] / 4), f: r0(kcal * sp[1] / 9), c: r0(kcal * sp[2] / 4) };
}
const EMPTY_DAY = Object.freeze({ entries: [], water: 0 });
const getDay = (k, create = false) => {
  if (!S.days[k]) { if (!create) return EMPTY_DAY; S.days[k] = { entries: [], water: 0 }; }
  if (create) S.days[k].mt = Date.now();   // метка изменения — нужна для слияния между устройствами
  return S.days[k];
};
function entNut(e) {
  const g = e.grams / 100;
  return { kcal: e.per.kcal * g, p: e.per.p * g, f: e.per.f * g, c: e.per.c * g, fiber: (e.per.fiber || 0) * g };
}
function totals(k, meal) {
  const d = getDay(k);
  const s = { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, n: 0 };
  for (const e of d.entries) {
    if (meal && e.meal !== meal) continue;
    const n = entNut(e);
    s.kcal += n.kcal; s.p += n.p; s.f += n.f; s.c += n.c; s.fiber += n.fiber; s.n++;
  }
  return s;
}
const waterGoal = () => Math.max(1500, Math.round(S.profile.weight * 30 / 250) * 250);

/** «Гибкая неделя»: недоел/переел — остаток недельного бюджета делится на оставшиеся дни. */
function weekStart(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
function flexInfo(k) {
  const base = targets().kcal;
  const d = parseYmd(k);
  const ws = weekStart(d);
  const idx = (d.getDay() + 6) % 7;
  let past = 0;
  for (let i = 0; i < idx; i++) {
    const kk = ymd(addDays(ws, i));
    const tk = totals(kk).kcal;
    // день без записей или с заведомо неполными записями считаем «по норме»
    past += tk >= base * 0.5 ? tk : base;
  }
  const left = 7 - idx;
  const week = base * 7;
  let target = base;
  if (S.flex) target = clamp(Math.round((week - past) / left / 10) * 10, Math.max(1200, base * 0.8), base * 1.25);
  return { base, target, past, left, week, ws, idx };
}
function dayTarget(k) { return S.flex ? flexInfo(k).target : targets().kcal; }
function remainingFor(k) {
  const tg = targets(), tot = totals(k), kc = dayTarget(k);
  return { kcal: Math.max(0, r0(kc - tot.kcal)), p: Math.max(0, r0(tg.p * kc / tg.kcal - tot.p)), f: Math.max(0, r0(tg.f * kc / tg.kcal - tot.f)), c: Math.max(0, r0(tg.c * kc / tg.kcal - tot.c)) };
}
function defaultMeal() {
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
}
const MEAL_HOUR = { breakfast: 8, lunch: 13, dinner: 19, snack: 16 };
function entryTs(date, meal) {
  if (date === today()) return Date.now();
  const d = parseYmd(date); d.setHours(MEAL_HOUR[meal] || 12, 0, 0, 0); return d.getTime();
}
function addEntry(food, grams, meal, date) {
  const d = getDay(date, true);
  d.entries.push({
    id: uid(), meal, grams: r0(grams), ts: entryTs(date, meal),
    name: food.name + (food.brand ? ` (${food.brand})` : ''),
    per: { kcal: food.kcal, p: food.p, f: food.f, c: food.c, fiber: food.fiber || 0 },
  });
  if (food.source !== 'recipe') {
    S.recent = [food, ...S.recent.filter(x => x.id !== food.id)].slice(0, 30);
  }
  save();
}

/* ───────────── UI primitives ───────────── */
function toast(msg) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.classList.add('hide'), 2200);
  setTimeout(() => el.remove(), 2700);
}
function modal(title, build, opts = {}) {
  const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay) api.close(); } });
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'sheet-head' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => api.close() }, '✕')), body);
  overlay.append(sheet);
  document.body.append(overlay);
  document.body.classList.add('noscroll');
  const api = {
    body, close() {
      if (!overlay.isConnected) return;
      overlay.remove();
      if (!$('.overlay')) document.body.classList.remove('noscroll');
      opts.onClose && opts.onClose();
    },
  };
  build(api);
  return api;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const all = document.querySelectorAll('.overlay'); if (all.length) all[all.length - 1].querySelector('.sheet-head .icon-btn')?.click(); }
});
function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
}
function select(options, value, onChange) {
  return h('select', { value, onchange: e => onChange(e.target.value) }, options.map(([v, l]) => h('option', { value: v }, l)));
}
/** Раньше это были запросы к серверу; теперь всё считается в браузере (js/engine.js). */
async function apiCall(path, body) {
  const E = window.Engine;
  if (path === '/parse') return E.parse(body.text, body.lang);
  if (path === '/fridge') return E.fridge(body);
  const u = new URL(path, 'http://local');
  const q = u.searchParams.get('q') || '', lang = u.searchParams.get('lang') || S.lang;
  if (u.pathname === '/foods/search') return E.search(q, lang);
  if (u.pathname === '/foods/online') return E.online(q, lang);
  if (u.pathname.startsWith('/foods/barcode/')) {
    const f = await E.barcode(decodeURIComponent(u.pathname.split('/').pop()), lang);
    if (!f) throw new Error('not found');
    return f;
  }
  throw new Error('unknown route ' + path);
}
const mealName = m => t('meal.' + m);
const fmtMacros = f => `${t('p')} ${r1(f.p)} · ${t('f')} ${r1(f.f)} · ${t('c')} ${r1(f.c)}`;

/* ───────────── графики ───────────── */
function ring(eaten, target) {
  const R = 70, C = 2 * Math.PI * R;
  const frac = clamp(eaten / target, 0, 1);
  const over = clamp((eaten - target) / target, 0, 1);
  return sv('svg', { viewBox: '0 0 180 180', class: 'ring', role: 'img', 'aria-label': `${r0(eaten)} / ${target}` },
    sv('circle', { cx: 90, cy: 90, r: R, class: 'ring-bg' }),
    sv('circle', { cx: 90, cy: 90, r: R, class: 'ring-fg', 'stroke-dasharray': `${C * frac} ${C}`, transform: 'rotate(-90 90 90)' }),
    over > 0 ? sv('circle', { cx: 90, cy: 90, r: R - 12, class: 'ring-over', 'stroke-dasharray': `${2 * Math.PI * (R - 12) * over} ${2 * Math.PI * (R - 12)}`, transform: 'rotate(-90 90 90)' }) : null);
}
function barChart(values, target, labels) {
  const W = 320, H = 130, pl = 6, pr = 6, pb = 18, pt = 8;
  const max = Math.max(target * 1.4, ...values, 1);
  const bw = (W - pl - pr) / values.length;
  const y = v => pt + (H - pt - pb) * (1 - v / max);
  const el = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  el.append(sv('line', { x1: pl, x2: W - pr, y1: y(target), y2: y(target), class: 'chart-target' }));
  values.forEach((v, i) => {
    const hh = Math.max(0, (H - pt - pb) * v / max);
    el.append(sv('rect', { x: pl + i * bw + 2, y: H - pb - hh, width: Math.max(2, bw - 4), height: hh, rx: 3, class: v > target * 1.05 ? 'bar bar-over' : 'bar' }));
    if (labels && (i % 2 === 0 || values.length <= 8)) el.append(sv('text', { x: pl + i * bw + bw / 2, y: H - 4, class: 'chart-label', 'text-anchor': 'middle' }, labels[i]));
  });
  return el;
}
function lineChart(points) {
  const W = 320, H = 140, pl = 30, pr = 8, pt = 10, pb = 18;
  const el = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  if (points.length < 2) return el;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.floor(Math.min(...ys) - 0.5), y1 = Math.ceil(Math.max(...ys) + 0.5);
  const X = v => pl + (W - pl - pr) * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0));
  const Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0 || 1));
  [y0, (y0 + y1) / 2, y1].forEach(v => {
    el.append(sv('line', { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), class: 'grid' }), sv('text', { x: pl - 4, y: Y(v) + 3, class: 'chart-label', 'text-anchor': 'end' }, r1(v)));
  });
  el.append(sv('polyline', { points: points.map(p => `${X(p.x)},${Y(p.y)}`).join(' '), class: 'line' }));
  points.forEach(p => el.append(sv('circle', { cx: X(p.x), cy: Y(p.y), r: 3, class: 'dot' })));
  return el;
}

/* ───────────── каркас ───────────── */
const VIEWS = [['today', '📓'], ['fridge', '🧊'], ['insights', '📈'], ['settings', '⚙️']];

function render() {
  const y = window.scrollY;
  document.documentElement.lang = S.lang;
  const theme = S.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme;
  document.documentElement.dataset.theme = theme;
  const root = $('#app');
  let main;
  try { main = ({ today: viewToday, fridge: viewFridge, insights: viewInsights, settings: viewSettings })[view](); }
  catch (e) { console.error(e); main = h('div', { class: 'card' }, 'Error: ' + e.message); }
  root.replaceChildren(
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, '🍴'), h('span', null, 'FreeFork'), h('span', { class: 'badge-free' }, t('free'))),
      h('div', { class: 'top-actions' },
        Cloud.enabled && !Cloud.user ? h('button', { class: 'chip login', onclick: () => openAuth('signin') }, t('acc.signinShort')) : null,
        Cloud.enabled && Cloud.user ? h('button', { id: 'sync-badge', class: 'chip sync', onclick: () => { view = 'settings'; render(); window.scrollTo(0, 0); } }) : null,
        h('button', { class: 'chip', onclick: () => { S.lang = S.lang === 'ru' ? 'en' : 'ru'; save(); render(); }, 'aria-label': 'Language' }, S.lang === 'ru' ? 'RU' : 'EN'),
        h('button', { class: 'chip', onclick: () => { S.theme = theme === 'dark' ? 'light' : 'dark'; save(); render(); }, 'aria-label': 'Theme' }, theme === 'dark' ? '☀️' : '🌙'))),
    h('main', { class: 'content' }, main),
    h('nav', { class: 'bottom-nav' }, VIEWS.map(([v, ic]) =>
      h('button', { class: v === view ? 'active' : '', onclick: () => { view = v; render(); window.scrollTo(0, 0); } }, h('span', { class: 'nav-ic' }, ic), h('span', null, t('nav.' + v))))));
  updateBadge();
  window.scrollTo(0, y);
}

/* ───────────── ДНЕВНИК ───────────── */
function viewToday() {
  const tg = targets();
  const tot = totals(cur);
  const fx = flexInfo(cur);
  const target = S.flex ? fx.target : tg.kcal;
  const left = target - tot.kcal;
  const scale = target / tg.kcal;
  const d = getDay(cur);
  const dt = parseYmd(cur);
  const isToday = cur === today();
  const nodes = [];

  if (!S.configured) {
    nodes.push(h('div', { class: 'card banner' },
      h('div', null, h('b', null, t('welcome.title')), h('p', null, t('welcome.text'))),
      h('button', { class: 'btn', onclick: () => { view = 'settings'; render(); } }, t('welcome.cta'))));
  }

  if (Cloud.enabled && !Cloud.user && !S.hideCloudBanner) {
    nodes.push(h('div', { class: 'card banner cloud-banner' },
      h('div', null, h('b', null, '☁️ ' + t('acc.bannerTitle')), h('p', null, t('acc.bannerText'))),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => openAuth('signup') }, t('acc.signin')),
        h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => { S.hideCloudBanner = true; save(false); render(); } }, '✕'))));
  }

  nodes.push(h('div', { class: 'datebar' },
    h('button', { class: 'icon-btn', 'aria-label': 'prev', onclick: () => { cur = ymd(addDays(dt, -1)); render(); } }, '‹'),
    h('button', { class: 'date-label', onclick: () => { if (!isToday) { cur = today(); render(); } } },
      isToday ? t('today') + ' · ' : '', dt.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'long' })),
    h('button', { class: 'icon-btn', 'aria-label': 'next', onclick: () => { cur = ymd(addDays(dt, 1)); render(); } }, '›')));

  // сводка
  const macro = (key, label) => {
    const goal = Math.max(1, r0(tg[key] * scale));
    return h('div', { class: 'macro' },
      h('div', { class: 'macro-top' }, h('span', null, label), h('span', null, `${r0(tot[key])} / ${goal} ${t('g')}`)),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill m-' + key, style: { width: clamp(tot[key] / goal * 100, 0, 100) + '%' } })));
  };
  nodes.push(h('section', { class: 'card summary' },
    h('div', { class: 'ring-wrap' }, ring(tot.kcal, target),
      h('div', { class: 'ring-center' },
        h('div', { class: 'ring-num' }, left >= 0 ? r0(left) : '+' + r0(-left)),
        h('div', { class: 'ring-sub' }, left >= 0 ? t('kcalLeft') : t('kcalOver')))),
    h('div', { class: 'sum-side' },
      h('div', { class: 'sum-row' }, h('span', null, t('eaten')), h('b', null, r0(tot.kcal))),
      h('div', { class: 'sum-row' }, h('span', null, t('goal')), h('b', null, target)),
      h('div', { class: 'sum-row' }, h('span', null, t('fiber')), h('b', null, r0(tot.fiber) + ' ' + t('g')))),
    h('div', { class: 'macros' }, macro('p', t('protein')), macro('f', t('fat')), macro('c', t('carbs'))),
    left < -50 ? h('p', { class: 'soft-note' }, t('overNote')) : null));

  // гибкая неделя
  if (S.flex) {
    const bars = [];
    for (let i = 0; i < 7; i++) {
      const k = ymd(addDays(fx.ws, i));
      const v = totals(k).kcal;
      bars.push(h('button', { class: 'wk-col' + (k === cur ? ' sel' : '') + (v === 0 ? ' empty' : ''), onclick: () => { cur = k; render(); } },
        h('div', { class: 'wk-bar-wrap' }, h('div', { class: 'wk-bar', style: { height: clamp(v / (fx.base * 1.4) * 100, 3, 100) + '%' } })),
        h('span', null, addDays(fx.ws, i).toLocaleDateString(locale(), { weekday: 'short' }).slice(0, 2))));
    }
    const diff = fx.target - fx.base;
    nodes.push(h('section', { class: 'card flex-card' },
      h('div', { class: 'card-title' }, h('span', null, '🗓️ ' + t('flex.title')), h('span', { class: 'pill' }, (diff >= 0 ? '+' : '') + diff + ' ' + t('kcal'))),
      h('div', { class: 'wk' }, bars),
      h('p', { class: 'muted' }, t('flex.text', { target: fx.target, base: fx.base, left: fx.left })),
      diff < -30 ? h('p', { class: 'soft-note' }, t('flex.lowerNote')) : diff > 30 ? h('p', { class: 'soft-note' }, t('flex.higherNote')) : null));
  }

  // быстрый ввод текстом
  const input = h('input', { type: 'text', class: 'quick-input', placeholder: t('quick.placeholder'), maxlength: 300, enterkeyhint: 'go',
    onkeydown: e => { if (e.key === 'Enter') go(); } });
  const goBtn = h('button', { class: 'btn', onclick: () => go() }, t('quick.btn'));
  async function go() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    goBtn.disabled = true; goBtn.textContent = '…';
    try {
      const items = await apiCall('/parse', { text, lang: S.lang });
      if (!items.length) toast(t('quick.none'));
      else openParseReview(items, cur);
    } catch { toast(t('offline')); }
    goBtn.disabled = false; goBtn.textContent = t('quick.btn');
  }
  nodes.push(h('section', { class: 'card quick' },
    h('div', { class: 'card-title' }, h('span', null, '✨ ' + t('quick.title'))),
    h('div', { class: 'quick-row' }, input, goBtn),
    h('p', { class: 'muted small' }, t('quick.hint'))));

  // приёмы пищи
  for (const m of MEALS) {
    const list = d.entries.filter(e => e.meal === m);
    const mt = totals(cur, m);
    const prev = ymd(addDays(dt, -1));
    const canCopy = !list.length && getDay(prev).entries.some(e => e.meal === m);
    nodes.push(h('section', { class: 'card meal' },
      h('div', { class: 'meal-head' },
        h('div', { class: 'meal-title' }, h('span', { class: 'meal-ic' }, MEAL_ICON[m]), h('b', null, mealName(m)), h('span', { class: 'muted' }, list.length ? ` · ${r0(mt.kcal)} ${t('kcal')}` : '')),
        h('div', { class: 'meal-actions' },
          canCopy ? h('button', { class: 'icon-btn', title: t('copyYesterday'), 'aria-label': t('copyYesterday'), onclick: () => {
            const src = getDay(prev).entries.filter(e => e.meal === m);
            const dd = getDay(cur, true);
            for (const e of src) dd.entries.push({ ...e, id: uid(), ts: entryTs(cur, m) });
            save(); render(); toast(t('copied'));
          } }, '↺') : null,
          h('button', { class: 'icon-btn add', 'aria-label': t('add'), onclick: () => openAddFood(m, cur) }, '＋'))),
      list.length ? h('ul', { class: 'entries' }, list.map(e => {
        const n = entNut(e);
        return h('li', { onclick: () => openEditEntry(e, cur) },
          h('div', { class: 'e-main' }, h('div', { class: 'e-name' }, e.name), h('div', { class: 'e-sub' }, `${e.grams} ${t('g')} · ${fmtMacros(n)}`)),
          h('div', { class: 'e-kcal' }, r0(n.kcal)));
      })) : h('p', { class: 'muted empty-line' }, t('emptyMeal'))));
  }

  // вода
  const goalMl = waterGoal();
  const glasses = Math.round(d.water / 250 * 10) / 10;
  nodes.push(h('section', { class: 'card water' },
    h('div', { class: 'card-title' }, h('span', null, '💧 ' + t('water')), h('span', { class: 'muted' }, `${(d.water / 1000).toFixed(2).replace(/\.?0+$/, '') || 0} / ${(goalMl / 1000).toFixed(1)} ${t('l')}`)),
    h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill m-w', style: { width: clamp(d.water / goalMl * 100, 0, 100) + '%' } })),
    h('div', { class: 'water-btns' },
      h('button', { class: 'btn ghost', onclick: () => { const dd = getDay(cur, true); dd.water = Math.max(0, dd.water - 250); save(); render(); } }, '− 250'),
      h('span', { class: 'muted' }, `${glasses} ${t('glasses')}`),
      h('button', { class: 'btn', onclick: () => { const dd = getDay(cur, true); dd.water += 250; save(); render(); } }, '+ 250 ' + t('ml')))));

  // самочувствие
  const scale5 = (key, icons) => h('div', { class: 'scale' }, icons.map((ic, i) =>
    h('button', { class: 'scale-btn' + (d[key] === i + 1 ? ' on' : ''), 'aria-label': String(i + 1), onclick: () => { const dd = getDay(cur, true); dd[key] = dd[key] === i + 1 ? null : i + 1; save(); render(); } }, ic)));
  nodes.push(h('section', { class: 'card checkin' },
    h('div', { class: 'card-title' }, h('span', null, '🧠 ' + t('checkin.title'))),
    h('p', { class: 'muted small' }, t('checkin.hint')),
    h('div', { class: 'ci-row' }, h('span', null, t('mood')), scale5('mood', ['😞', '😕', '😐', '🙂', '😄'])),
    h('div', { class: 'ci-row' }, h('span', null, t('energy')), scale5('energy', ['🥱', '😪', '😐', '💪', '🚀'])),
    h('div', { class: 'ci-row' }, h('span', null, t('sleep')),
      h('div', { class: 'sleep-in' }, h('input', { type: 'number', inputmode: 'decimal', min: 0, max: 16, step: 0.5, value: d.sleep ?? '', placeholder: '7.5',
        onchange: e => { const dd = getDay(cur, true); const v = e.target.value === '' ? null : clamp(num(e.target.value), 0, 16); dd.sleep = v; save(); render(); } }), h('span', { class: 'muted' }, t('hours'))))));

  return h('div', { class: 'stack' }, nodes);
}

/* ───────────── добавление продукта ───────────── */
function foodRow(f, onPick, star = true) {
  const isFav = S.favs.some(x => x.id === f.id);
  return h('li', { class: 'food-row', onclick: () => onPick(f) },
    h('div', { class: 'e-main' },
      h('div', { class: 'e-name' }, f.name),
      h('div', { class: 'e-sub' }, `${f.brand ? f.brand + ' · ' : ''}${r0(f.kcal)} ${t('kcal')}/100 ${t('g')} · ${t('p')} ${r1(f.p)} · ${t('f')} ${r1(f.f)} · ${t('c')} ${r1(f.c)}`)),
    star ? h('button', { class: 'icon-btn star' + (isFav ? ' on' : ''), 'aria-label': 'favorite', onclick: e => {
      e.stopPropagation();
      if (S.favs.some(x => x.id === f.id)) S.favs = S.favs.filter(x => x.id !== f.id); else S.favs.unshift(f);
      save(); e.currentTarget.classList.toggle('on');
      e.currentTarget.textContent = e.currentTarget.classList.contains('on') ? '★' : '☆';
    } }, isFav ? '★' : '☆') : null);
}

function openAddFood(meal, date, initial = '') {
  let tab = 'search';
  const m = modal(`${t('add')} · ${mealName(meal)}`, api => {
    const tabs = h('div', { class: 'tabs' });
    const content = h('div', { class: 'tab-content' });
    api.body.append(tabs, content);
    const pick = f => openAmount(f, meal, date, () => { api.close(); render(); });
    function drawTabs() {
      tabs.replaceChildren(...[['search', t('tab.search')], ['recent', t('tab.recent')], ['favs', t('tab.favs')], ['custom', t('tab.custom')], ['barcode', t('tab.barcode')]]
        .map(([k, l]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => { tab = k; drawTabs(); drawContent(); } }, l)));
    }
    function drawContent() {
      content.replaceChildren();
      if (tab === 'search') drawSearch();
      else if (tab === 'recent') content.append(list(S.recent, t('noRecent')));
      else if (tab === 'favs') content.append(list(S.favs, t('noFavs')));
      else if (tab === 'custom') drawCustom();
      else drawBarcode();
    }
    const list = (arr, emptyMsg) => arr.length ? h('ul', { class: 'food-list' }, arr.map(f => foodRow(f, pick))) : h('p', { class: 'muted pad' }, emptyMsg);
    function drawSearch() {
      const results = h('div', { class: 'results' });
      let seq = 0;
      const input = h('input', { type: 'search', class: 'search-in', placeholder: t('search.placeholder'), autocomplete: 'off', value: initial });
      const run = async () => {
        const q = input.value.trim(); const my = ++seq;
        if (q.length < 2) { results.replaceChildren(h('p', { class: 'muted pad' }, t('search.hint'))); return; }
        let local = [];
        try { local = await apiCall(`/foods/search?q=${encodeURIComponent(q)}&lang=${S.lang}`); } catch { /* офлайн */ }
        if (my !== seq) return;
        const cust = S.custom.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
        const online = h('div', { class: 'online' }, h('p', { class: 'muted pad' }, '🌍 ' + t('search.loadingOnline')));
        results.replaceChildren(
          cust.length || local.length ? h('ul', { class: 'food-list' }, [...cust, ...local].map(f => foodRow(f, pick))) : h('p', { class: 'muted pad' }, t('search.noLocal')),
          h('div', { class: 'section-label' }, t('search.online')), online);
        try {
          const res = await apiCall(`/foods/online?q=${encodeURIComponent(q)}&lang=${S.lang}`);
          if (my !== seq) return;
          online.replaceChildren(!res.ok ? h('p', { class: 'muted pad' }, t('search.onlineFail'))
            : res.items.length ? h('ul', { class: 'food-list' }, res.items.map(f => foodRow(f, pick)))
              : h('p', { class: 'muted pad' }, t('search.noOnline')));
        } catch { if (my === seq) online.replaceChildren(h('p', { class: 'muted pad' }, t('offline'))); }
      };
      input.addEventListener('input', debounce(run, 350));
      content.append(input, results);
      run();
      setTimeout(() => input.focus(), 50);
    }
    function drawCustom() {
      const v = { name: '', kcal: '', p: '', f: '', c: '', portion: '' };
      const inp = (k, label, type = 'text') => field(label, h('input', { type, inputmode: type === 'number' ? 'decimal' : null, step: 'any', oninput: e => { v[k] = e.target.value; } }));
      content.append(h('div', { class: 'form' },
        h('p', { class: 'muted small' }, t('custom.hint')),
        inp('name', t('custom.name')),
        h('div', { class: 'grid2' }, inp('kcal', t('kcal') + ' / 100 ' + t('g'), 'number'), inp('p', t('protein'), 'number'), inp('f', t('fat'), 'number'), inp('c', t('carbs'), 'number')),
        inp('portion', t('custom.portion'), 'number'),
        h('button', { class: 'btn wide', onclick: () => {
          if (!v.name.trim() || v.kcal === '') { toast(t('custom.need')); return; }
          const f = { id: 'custom:' + uid(), name: v.name.trim(), kcal: num(v.kcal), p: num(v.p), f: num(v.f), c: num(v.c), fiber: 0, portionG: num(v.portion, 100) || 100, pieceG: null, pieceName: null, source: 'custom' };
          S.custom.unshift(f); S.favs.unshift(f); save(); pick(f);
        } }, t('custom.save'))));
    }
    function drawBarcode() {
      const inp = h('input', { type: 'text', inputmode: 'numeric', placeholder: '4600000000000', class: 'search-in', maxlength: 14 });
      const status = h('p', { class: 'muted pad' }, t('barcode.hint'));
      const find = async code => {
        status.textContent = t('barcode.searching');
        try { const f = await apiCall(`/foods/barcode/${encodeURIComponent(code)}?lang=${S.lang}`); status.textContent = ''; pick(f); }
        catch { status.textContent = t('barcode.notfound'); }
      };
      content.append(h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: () => find(inp.value.trim()) }, t('find'))),
        'BarcodeDetector' in window ? h('button', { class: 'btn ghost wide', onclick: () => scanBarcode(code => { inp.value = code; find(code); }) }, '📷 ' + t('barcode.scan')) : h('p', { class: 'muted small pad' }, t('barcode.noCamera')),
        status);
    }
    drawTabs(); drawContent();
  });
  return m;
}

async function scanBarcode(onCode) {
  let stream, stopped = false;
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const msg = h('p', { class: 'muted pad' }, t('barcode.pointCamera'));
  const m = modal(t('barcode.scan'), api => api.body.append(video, msg), { onClose: () => { stopped = true; stream && stream.getTracks().forEach(tr => tr.stop()); } });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream; await video.play();
    const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const tick = async () => {
      if (stopped) return;
      try { const codes = await det.detect(video); if (codes.length) { m.close(); onCode(codes[0].rawValue); return; } } catch { /* кадр не готов */ }
      setTimeout(tick, 250);
    };
    tick();
  } catch { msg.textContent = t('barcode.cameraDenied'); }
}

function openAmount(food, meal, date, done) {
  let grams = food.portionG && food.portionG !== 100 ? food.portionG : (food.pieceG || 100);
  modal(food.name, api => {
    const preview = h('div', { class: 'preview' });
    const inp = h('input', { type: 'number', inputmode: 'decimal', min: 1, step: 'any', value: grams, class: 'grams-in', oninput: e => { grams = num(e.target.value); draw(); } });
    function draw() {
      const k = grams / 100;
      preview.replaceChildren(h('div', { class: 'pv-kcal' }, r0(food.kcal * k), h('small', null, ' ' + t('kcal'))),
        h('div', { class: 'muted' }, fmtMacros({ p: food.p * k, f: food.f * k, c: food.c * k })));
    }
    const presets = [50, 100, 150, 200, 250].map(g => h('button', { class: 'chip', onclick: () => { grams = g; inp.value = g; draw(); } }, g + ' ' + t('g')));
    if (food.pieceG) presets.unshift(h('button', { class: 'chip', onclick: () => { grams = food.pieceG; inp.value = grams; draw(); } }, `1 ${food.pieceName || t('pc')} (${r0(food.pieceG)} ${t('g')})`));
    if (food.portionG && food.portionG !== 100 && food.portionG !== food.pieceG) presets.unshift(h('button', { class: 'chip', onclick: () => { grams = food.portionG; inp.value = grams; draw(); } }, `${t('portion')} (${r0(food.portionG)} ${t('g')})`));
    api.body.append(
      h('div', { class: 'muted small' }, `${r0(food.kcal)} ${t('kcal')} / 100 ${t('g')}`),
      field(t('amount') + ' (' + t('g') + ' / ' + t('ml') + ')', inp), h('div', { class: 'chips' }, presets), preview,
      h('button', { class: 'btn wide', onclick: () => { if (grams <= 0) return; addEntry(food, grams, meal, date); api.close(); toast(t('added')); done && done(); } }, t('add')));
    draw();
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  });
}

function openEditEntry(e, date) {
  modal(e.name, api => {
    let grams = e.grams, meal = e.meal;
    api.body.append(
      field(t('amount') + ' (' + t('g') + ')', h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: grams, oninput: ev => { grams = num(ev.target.value); } })),
      field(t('meal'), select(MEALS.map(x => [x, mealName(x)]), meal, v => { meal = v; })),
      h('div', { class: 'row' },
        h('button', { class: 'btn danger-soft', onclick: () => { const d = getDay(date, true); d.entries = d.entries.filter(x => x.id !== e.id); save(); api.close(); render(); } }, t('delete')),
        h('button', { class: 'btn grow', onclick: () => { if (grams > 0) { e.grams = r0(grams); e.meal = meal; getDay(date, true); save(); api.close(); render(); } } }, t('save'))));
  });
}

function openParseReview(items, date) {
  const rows = items.map(it => ({ it, food: it.food, grams: it.grams || 100, on: !!it.food }));
  let meal = defaultMeal();
  modal(t('review.title'), api => {
    const list = h('div', { class: 'review-list' });
    const foot = h('div', { class: 'review-foot' });
    function draw() {
      list.replaceChildren(...rows.map(r => {
        if (!r.food) return h('div', { class: 'review-row unmatched' }, h('span', null, `❓ ${t('review.unknown')}: «${r.it.query}»`),
          h('button', { class: 'chip', onclick: () => { api.close(); openAddFood(meal, date, r.it.query); } }, t('review.findManual')));
        const opts = [r.it.food, ...r.it.alternatives].filter(Boolean);
        const k = r.grams / 100;
        return h('div', { class: 'review-row' + (r.on ? '' : ' off') },
          h('input', { type: 'checkbox', checked: r.on, 'aria-label': 'include', onchange: e => { r.on = e.target.checked; draw(); } }),
          h('div', { class: 'rv-main' },
            h('select', { value: r.food.id, onchange: e => { r.food = opts.find(o => o.id === e.target.value); draw(); } }, opts.map(o => h('option', { value: o.id }, o.name))),
            h('div', { class: 'rv-sub' }, h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: r.grams, 'aria-label': t('g'), onchange: e => { r.grams = Math.max(1, num(e.target.value, 1)); draw(); } }), h('span', { class: 'muted' }, t('g') + ' · ' + fmtMacros({ p: r.food.p * k, f: r.food.f * k, c: r.food.c * k })))),
          h('div', { class: 'e-kcal' }, r0(r.food.kcal * k)));
      }));
      const total = rows.filter(r => r.on && r.food).reduce((s, r) => s + r.food.kcal * r.grams / 100, 0);
      foot.replaceChildren(
        field(t('meal'), select(MEALS.map(x => [x, mealName(x)]), meal, v => { meal = v; })),
        h('button', { class: 'btn wide', onclick: () => {
          const sel = rows.filter(r => r.on && r.food);
          if (!sel.length) return;
          sel.forEach(r => addEntry(r.food, r.grams, meal, date));
          api.close(); render(); toast(t('added'));
        } }, `${t('review.addAll')} · ${r0(total)} ${t('kcal')}`));
    }
    api.body.append(h('p', { class: 'muted small' }, t('review.hint')), list, foot);
    draw();
  });
}

/* ───────────── ХОЛОДИЛЬНИК ───────────── */
const fridgeState = { text: '', meal: '', staples: true, fit: true, result: null, loading: false };
function viewFridge() {
  const st = fridgeState;
  const rem = remainingFor(today());
  const input = h('textarea', { rows: 3, class: 'fridge-in', placeholder: t('fridge.placeholder'), oninput: e => { st.text = e.target.value; } }, st.text);
  const nodes = [h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '🧊 ' + t('fridge.title'))),
    h('p', { class: 'muted' }, t('fridge.text')),
    input,
    h('div', { class: 'chips' }, (S.lang === 'ru' ? ['куриная грудка', 'рис', 'яйца', 'помидоры', 'творог', 'гречка', 'брокколи', 'тунец'] : ['chicken breast', 'rice', 'eggs', 'tomatoes', 'cottage cheese', 'buckwheat', 'broccoli', 'tuna'])
      .map(x => h('button', { class: 'chip', onclick: () => { st.text = (st.text.trim() ? st.text.replace(/[,\s]*$/, '') + ', ' : '') + x; input.value = st.text; } }, '+ ' + x))),
    h('div', { class: 'grid2' },
      field(t('meal'), select([['', t('anyMeal')], ...MEALS.map(x => [x, mealName(x)])], st.meal, v => { st.meal = v; })),
      h('div', { class: 'checks' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.staples, onchange: e => { st.staples = e.target.checked; } }), t('fridge.staples')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.fit, onchange: e => { st.fit = e.target.checked; } }), t('fridge.fit')))),
    st.fit ? h('div', { class: 'remain' }, h('b', null, t('fridge.remaining')), ` ${rem.kcal} ${t('kcal')} · ${t('p')} ${rem.p} · ${t('f')} ${rem.f} · ${t('c')} ${rem.c}`) : null,
    h('button', { class: 'btn wide', disabled: st.loading, onclick: runFridge }, st.loading ? '…' : t('fridge.go')))];

  async function runFridge() {
    st.loading = true; render();
    try {
      st.result = await apiCall('/fridge', { text: st.text, meal: st.meal || null, assumeStaples: st.staples, lang: S.lang, remaining: st.fit ? remainingFor(today()) : null });
    } catch { toast(t('offline')); }
    st.loading = false; render();
  }

  if (st.result) {
    const r = st.result;
    nodes.push(h('section', { class: 'card' },
      r.recognized.length ? h('div', null, h('b', null, t('fridge.recognized') + ': '), r.recognized.join(', ')) : h('div', { class: 'muted' }, t('fridge.browse')),
      r.unrecognized.length ? h('div', { class: 'muted small' }, t('fridge.unrecognized') + ': ' + r.unrecognized.join(', ')) : null));
    if (!r.recipes.length) nodes.push(h('div', { class: 'card muted' }, t('fridge.none')));
    r.recipes.forEach(rc => nodes.push(recipeCard(rc)));
  }
  return h('div', { class: 'stack' }, nodes);
}

function recipeCard(rc) {
  const missing = rc.ingredients.filter(i => !i.have);
  const det = h('details', { class: 'recipe-det' },
    h('summary', null, t('fridge.details')),
    h('ul', { class: 'ing' }, rc.ingredients.map(i => h('li', { class: i.have ? 'have' : 'miss' }, (i.have ? '✓ ' : '＋ ') + `${i.name} — ${i.grams} ${t('g')}`))),
    h('ol', { class: 'steps' }, rc.steps.map(s => h('li', null, s))));
  return h('section', { class: 'card recipe' },
    h('div', { class: 'card-title' }, h('b', null, rc.name), h('span', { class: 'pill' }, `⏱ ${rc.minutes} ${t('min')}`)),
    h('div', { class: 'r-kcal' }, h('span', { class: 'big' }, rc.kcalScaled), ' ', t('kcal'),
      rc.scale !== 1 ? h('span', { class: 'pill soft' }, `${t('fridge.portion')} ×${rc.scale}`) : null),
    h('div', { class: 'muted' }, fmtMacros({ p: rc.pScaled, f: rc.fScaled, c: rc.cScaled })),
    h('div', { class: 'cov' + (missing.length ? '' : ' full') }, missing.length ? `${t('fridge.missing')}: ${missing.map(m => m.name).join(', ')}` : '✓ ' + t('fridge.allHave')),
    det,
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => addRecipe(rc) }, t('fridge.addToDiary'))));
}
function addRecipe(rc) {
  const grams = rc.ingredients.reduce((s, i) => s + i.grams, 0) || 100;
  const food = { id: 'recipe:' + rc.id, name: rc.name, kcal: rc.kcalScaled / grams * 100, p: rc.pScaled / grams * 100, f: rc.fScaled / grams * 100, c: rc.cScaled / grams * 100, fiber: 0, source: 'recipe' };
  modal(rc.name, api => {
    let meal = rc.meals.includes(defaultMeal()) ? defaultMeal() : (rc.meals[0] || 'lunch');
    api.body.append(field(t('meal'), select(MEALS.map(x => [x, mealName(x)]), meal, v => { meal = v; })),
      h('button', { class: 'btn wide', onclick: () => { addEntry(food, grams, meal, today()); api.close(); toast(t('added')); } }, `${t('add')} · ${rc.kcalScaled} ${t('kcal')}`));
  });
}

/* ───────────── ИНСАЙТЫ ───────────── */
function lastDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(ymd(addDays(new Date(), -i))); return out; }
function pearson(a, b) {
  const n = a.length; if (n < 3) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; sab += (a[i] - ma) * (b[i] - mb); }
  return sa && sb ? sab / Math.sqrt(sa * sb) : 0;
}
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

function computeInsights() {
  const rows = [];
  for (const [k, d] of Object.entries(S.days)) {
    const tot = totals(k);
    if (tot.kcal < 300) continue;
    rows.push({ k, kcal: tot.kcal, protein: tot.p, carbs: tot.c, fat: tot.f, fiber: tot.fiber, water: (d.water || 0) / 1000, sleep: d.sleep ?? null, mood: d.mood ?? null, energy: d.energy ?? null });
  }
  const feats = [['protein', 'g'], ['carbs', 'g'], ['fat', 'g'], ['fiber', 'g'], ['kcal', 'kcal'], ['water', 'l'], ['sleep', 'h']];
  const outs = [['mood', ''], ['energy', ''], ['kcal', 'kcal']];
  const res = [];
  for (const [f, fu] of feats) for (const [o, ou] of outs) {
    if (f === o) continue;
    if (o === 'kcal' && f !== 'sleep' && f !== 'water') continue;   // калории как результат — только для сна и воды
    if (f === 'kcal' && o === 'kcal') continue;
    const pts = rows.filter(r => r[f] != null && r[o] != null);
    if (pts.length < 7) continue;
    const xs = pts.map(p => p[f]), ys = pts.map(p => p[o]);
    const r = pearson(xs, ys);
    const med = median(xs);
    const hi = pts.filter(p => p[f] >= med), lo = pts.filter(p => p[f] < med);
    if (hi.length < 3 || lo.length < 3) continue;
    res.push({ f, fu, o, ou, r, n: pts.length, med, hi: mean(hi.map(p => p[o])), lo: mean(lo.map(p => p[o])) });
  }
  res.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { rows, list: res.filter(x => Math.abs(x.r) >= 0.25).slice(0, 6), all: res };
}

function viewInsights() {
  const base = targets().kcal;
  const days = lastDays(14);
  const vals = days.map(k => r0(totals(k).kcal));
  const logged = vals.filter(v => v > 0);
  const last7 = lastDays(7).map(k => totals(k)).filter(x => x.kcal > 0);
  const nodes = [];

  nodes.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '📊 ' + t('ins.last14'))),
    barChart(vals, base, days.map(k => parseYmd(k).getDate())),
    h('div', { class: 'stats' },
      h('div', null, h('b', null, last7.length ? r0(mean(last7.map(x => x.kcal))) : '—'), h('span', null, t('ins.avgKcal'))),
      h('div', null, h('b', null, last7.length ? r0(mean(last7.map(x => x.p))) : '—'), h('span', null, t('ins.avgProtein'))),
      h('div', null, h('b', null, logged.length + '/14'), h('span', null, t('ins.daysLogged'))))));

  // умные инсайты
  const ins = computeInsights();
  const unit = (v, u, f) => f === 'water' ? `${r1(v)} ${t('l')}` : f === 'sleep' ? `${r1(v)} ${t('hours')}` : u === 'g' ? `${r0(v)} ${t('g')}` : u === 'kcal' ? `${r0(v)} ${t('kcal')}` : r1(v);
  const card = h('section', { class: 'card insights' },
    h('div', { class: 'card-title' }, h('span', null, '🔬 ' + t('ins.smart'))),
    h('p', { class: 'muted small' }, t('ins.smartHint')));
  if (!ins.list.length) {
    const needed = ins.rows.length < 7;
    card.append(h('p', { class: 'muted' }, needed ? t('ins.needData', { n: ins.rows.length }) : t('ins.noPattern')));
  } else {
    ins.list.forEach(x => {
      const diff = x.hi - x.lo;
      const strength = Math.abs(x.r) >= 0.6 ? t('ins.strong') : Math.abs(x.r) >= 0.4 ? t('ins.medium') : t('ins.weak');
      const oFmt = v => x.o === 'kcal' ? `${r0(v)} ${t('kcal')}` : `${r1(v)}/5`;
      card.append(h('div', { class: 'insight' },
        h('div', { class: 'ins-title' }, `${t('feat.' + x.f)} → ${t('out.' + x.o)}`, h('span', { class: 'pill ' + (diff >= 0 ? 'up' : 'down') }, (diff >= 0 ? '+' : '−') + (x.o === 'kcal' ? r0(Math.abs(diff)) : r1(Math.abs(diff))))),
        h('div', { class: 'ins-body' }, t('ins.compare', { feat: t('feat.' + x.f).toLowerCase(), thr: unit(x.med, x.fu, x.f), out: t('out.' + x.o).toLowerCase(), hi: oFmt(x.hi), lo: oFmt(x.lo) })),
        h('div', { class: 'muted small' }, `${strength} (r = ${x.r.toFixed(2)}, ${t('ins.days', { n: x.n })})`)));
    });
    card.append(h('p', { class: 'muted small' }, '⚠️ ' + t('ins.disclaimer')));
  }
  const hasDemo = S.demoKeys.length > 0;
  if (!Cloud.user) card.append(h('div', { class: 'row' },
    hasDemo ? h('button', { class: 'btn ghost', onclick: () => { removeDemo(); render(); toast(t('ins.demoRemoved')); } }, t('ins.removeDemo'))
      : h('button', { class: 'btn ghost', onclick: () => { if (fillDemo()) { render(); toast(t('ins.demoAdded')); } } }, '🎲 ' + t('ins.demo'))));
  nodes.push(card);

  // вес
  const wk = Object.keys(S.weights).sort();
  const last = wk.length ? S.weights[wk[wk.length - 1]] : null;
  const first = wk.length ? S.weights[wk[0]] : null;
  const wInput = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: 20, max: 400, placeholder: last ? String(last) : '70.0' });
  nodes.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '⚖️ ' + t('weight.title')), last ? h('span', { class: 'pill' }, `${last} ${t('kg')}${wk.length > 1 ? ` (${last - first >= 0 ? '+' : ''}${r1(last - first)})` : ''}`) : null),
    wk.length > 1 ? lineChart(wk.slice(-60).map(k => ({ x: parseYmd(k).getTime(), y: S.weights[k] }))) : h('p', { class: 'muted' }, t('weight.hint')),
    h('div', { class: 'row' }, wInput, h('button', { class: 'btn', onclick: () => {
      const v = num(wInput.value);
      if (v < 20 || v > 400) { toast(t('weight.bad')); return; }
      S.weights[today()] = r1(v); S.profile.weight = r1(v); save(); render(); toast(t('saved'));
    } }, t('weight.log')))));

  return h('div', { class: 'stack' }, nodes);
}

/* демо-данные, чтобы сразу увидеть, как работают инсайты */
function fillDemo() {
  let seed = 1234;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const names = S.lang === 'ru' ? ['Завтрак (демо)', 'Обед (демо)', 'Ужин (демо)', 'Перекус (демо)'] : ['Breakfast (demo)', 'Lunch (demo)', 'Dinner (demo)', 'Snack (demo)'];
  const keys = [];
  for (let i = 28; i >= 1; i--) {
    const k = ymd(addDays(new Date(), -i));
    if (S.days[k] && (S.days[k].entries.length || S.days[k].mood)) continue;
    const sleep = Math.round((5 + rnd() * 4) * 2) / 2;
    const protein = 60 + rnd() * 80, fiber = 12 + rnd() * 28;
    const kcal = 1750 + (7 - sleep) * 140 + (rnd() - 0.5) * 300;
    const fat = kcal * (0.27 + rnd() * 0.08) / 9;
    const carbs = Math.max(80, (kcal - protein * 4 - fat * 9) / 4);
    const energy = clamp(Math.round(2.7 + 0.022 * (protein - 100) + 0.3 * (sleep - 7) + 0.03 * (fiber - 25) + (rnd() - 0.5) * 1.2), 1, 5);
    const mood = clamp(Math.round(3.3 + 0.35 * (sleep - 7) + 0.01 * (protein - 100) - 0.004 * (carbs - 220) + (rnd() - 0.5) * 1.3), 1, 5);
    const split = [0.25, 0.35, 0.28, 0.12];
    S.days[k] = {
      water: 1000 + Math.round(rnd() * 6) * 250, sleep, mood, energy,
      entries: MEALS.map((m, j) => ({ id: uid(), meal: m, grams: 100, ts: entryTs(k, m), name: names[j],
        per: { kcal: kcal * split[j], p: protein * split[j], f: fat * split[j], c: carbs * split[j], fiber: fiber * split[j] } })),
    };
    keys.push(k);
  }
  if (!keys.length) { toast(t('ins.demoNoRoom')); return false; }
  const w0 = S.profile.weight;
  for (let i = 28; i >= 1; i -= 3) {
    const k = ymd(addDays(new Date(), -i));
    if (S.weights[k] == null) { S.weights[k] = r1(w0 + 1.5 - (28 - i) * 0.055 + (rnd() - 0.5) * 0.4); keys.push('w:' + k); }
  }
  S.demoKeys = keys; save();
  return true;
}
function removeDemo() {
  for (const k of S.demoKeys) { if (k.startsWith('w:')) delete S.weights[k.slice(2)]; else delete S.days[k]; }
  S.demoKeys = []; save();
}

/* ───────────── НАСТРОЙКИ ───────────── */
function viewSettings() {
  const p = S.profile;
  const tg = targets();
  const upd = (k, v) => { p[k] = v; S.configured = true; save(); };
  const numField = (k, label, min, max, step = 1) => field(label, h('input', { type: 'number', inputmode: 'decimal', min, max, step, value: p[k], onchange: e => { upd(k, clamp(num(e.target.value, p[k]), min, max)); render(); } }));
  const nodes = [];

  const acc = accountCard();
  if (acc) nodes.push(acc);

  nodes.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '👤 ' + t('set.profile'))),
    h('div', { class: 'grid2' },
      field(t('set.sex'), select([['f', t('set.female')], ['m', t('set.male')]], p.sex, v => { upd('sex', v); render(); })),
      numField('age', t('set.age'), 14, 100),
      numField('height', t('set.height'), 120, 230),
      numField('weight', t('set.weight'), 30, 300, 0.1)),
    field(t('set.activity'), select([[1.2, t('act.1')], [1.375, t('act.2')], [1.55, t('act.3')], [1.725, t('act.4')], [1.9, t('act.5')]], p.activity, v => { upd('activity', parseFloat(v)); render(); })),
    field(t('set.goal'), select([['lose', t('goal.lose')], ['lose_slow', t('goal.lose_slow')], ['maintain', t('goal.maintain')], ['gain', t('goal.gain')]], p.goal, v => { upd('goal', v); render(); })),
    field(t('set.split'), select([['balanced', t('split.balanced')], ['protein', t('split.protein')], ['lowcarb', t('split.lowcarb')]], p.split, v => { upd('split', v); render(); })),
    field(t('set.manual'), h('input', { type: 'number', inputmode: 'numeric', min: 1200, max: 6000, step: 10, value: p.manual || '', placeholder: t('set.auto'), onchange: e => { upd('manual', e.target.value ? clamp(num(e.target.value), 1200, 6000) : null); render(); } }), t('set.manualHint')),
    h('div', { class: 'target-box' },
      h('div', null, h('span', { class: 'muted' }, t('set.bmr')), h('b', null, r0(bmr(p)) + ' ' + t('kcal'))),
      h('div', null, h('span', { class: 'muted' }, t('set.tdee')), h('b', null, r0(tdee(p)) + ' ' + t('kcal'))),
      h('div', { class: 'hl' }, h('span', { class: 'muted' }, t('set.target')), h('b', null, tg.kcal + ' ' + t('kcal'))),
      h('div', null, h('span', { class: 'muted' }, t('protein') + ' / ' + t('fat') + ' / ' + t('carbs')), h('b', null, `${tg.p} / ${tg.f} / ${tg.c} ${t('g')}`)))));

  nodes.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '🗓️ ' + t('set.flexTitle'))),
    h('label', { class: 'check big' }, h('input', { type: 'checkbox', checked: S.flex, onchange: e => { S.flex = e.target.checked; save(); render(); } }), t('set.flexOn')),
    h('p', { class: 'muted small' }, t('set.flexHint'))));

  nodes.push(h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '💾 ' + t('set.data'))),
    h('p', { class: 'muted small' }, t('set.dataHint')),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn ghost', onclick: exportJson }, t('set.exportJson')),
      h('button', { class: 'btn ghost', onclick: exportCsv }, t('set.exportCsv')),
      h('label', { class: 'btn ghost file' }, t('set.import'), h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importJson }))),
    h('div', { class: 'row' }, h('button', { class: 'btn danger-soft', onclick: wipeAll }, t('set.wipe')))));

  nodes.push(h('section', { class: 'card about' },
    h('div', { class: 'card-title' }, h('span', null, '💚 ' + t('about.title'))),
    h('ul', { class: 'about-list' }, ['about.1', 'about.2', 'about.3', 'about.4', 'about.5', 'about.6'].map(k => h('li', null, t(k)))),
    h('p', { class: 'muted small' }, t('about.disclaimer'))));

  return h('div', { class: 'stack' }, nodes);
}

/* ───────────── облако: слияние, синхронизация, вход ───────────── */
const sync = { state: 'off', last: null, timer: null, busy: false, again: false, err: '' };

function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  return JSON.stringify(o);
}
/** Слияние локальных и облачных данных: дни — по времени последнего изменения, настройки — от более свежей версии. */
function mergeStates(local, remote) {
  const base = defaults();
  const r = Object.assign(base, remote);
  r.profile = Object.assign(defaults().profile, remote.profile || {});
  const newer = (local.updatedAt || 0) >= (r.updatedAt || 0) ? local : r;
  const out = JSON.parse(JSON.stringify(newer));
  out.lang = local.lang; out.theme = local.theme;
  out.days = {};
  const keys = new Set([...Object.keys(local.days || {}), ...Object.keys(r.days || {})]);
  for (const k of keys) {
    const a = (local.days || {})[k], b = (r.days || {})[k];
    out.days[k] = !a ? b : !b ? a : ((a.mt || 0) >= (b.mt || 0) ? a : b);
  }
  out.weights = Object.assign({}, newer === local ? r.weights : local.weights, newer.weights);
  out.demoKeys = [];
  out.updatedAt = Math.max(local.updatedAt || 0, r.updatedAt || 0);
  return out;
}
function setSyncState(st) { sync.state = st; updateBadge(); }
function syncLabel() {
  if (sync.state === 'syncing') return t('sync.syncing');
  if (sync.state === 'pending') return t('sync.pending');
  if (sync.state === 'error') return t('sync.error');
  if (sync.last) return t('sync.ok', { time: new Date(sync.last).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) });
  return t('sync.idle');
}
function updateBadge() {
  const b = $('#sync-badge');
  if (b) { b.textContent = ({ syncing: '🔄', pending: '☁️…', error: '⚠️', ok: '☁️✓', off: '☁️', idle: '☁️' })[sync.state] || '☁️'; b.title = syncLabel(); b.dataset.state = sync.state; }
  const l = $('#sync-line');
  if (l) l.textContent = syncLabel() + (sync.state === 'error' && sync.err ? ' — ' + sync.err : '');
}
function scheduleSync(delay = 2500) {
  if (!Cloud.enabled || !Cloud.user) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(syncNow, delay);
  if (!sync.busy) setSyncState('pending');
}
async function syncNow() {
  if (!Cloud.user) return;
  if (sync.busy) { sync.again = true; return; }
  sync.busy = true; setSyncState('syncing');
  try {
    const beforeStr = stable(S);
    persist();
    const remote = await Cloud.pull();
    let remoteStr = null;
    if (remote && remote.data && typeof remote.data === 'object' && remote.data.days && typeof remote.data.days === 'object') {
      remoteStr = stable(remote.data);
      S = mergeStates(S, remote.data);
    }
    if (remoteStr !== stable(S)) await Cloud.push(S);
    persist();
    sync.last = Date.now(); sync.err = '';
    setSyncState('ok');
    if (stable(S) !== beforeStr) render();
  } catch (e) {
    sync.err = authError(e);
    setSyncState('error');
  } finally {
    sync.busy = false;
    if (sync.again) { sync.again = false; scheduleSync(500); }
  }
}
function authError(e) {
  const m = String((e && e.message) || e || '');
  if (/invalid login credentials/i.test(m)) return t('err.badLogin');
  if (/already (been )?registered/i.test(m)) return t('err.exists');
  if (/not confirmed/i.test(m)) return t('err.notConfirmed');
  if (/at least \d+ char|weak|should contain/i.test(m)) return t('err.weakPass');
  if (/rate limit|too many|security purposes/i.test(m)) return t('err.rate');
  if (/failed to fetch|network|abort|timeout|load failed|fetch/i.test(m)) return t('err.network');
  return m || t('err.unknown');
}

function accountCard() {
  if (!Cloud.enabled) return null;
  if (!Cloud.user) {
    return h('section', { class: 'card' },
      h('div', { class: 'card-title' }, h('span', null, '☁️ ' + t('acc.title'))),
      h('p', { class: 'muted' }, t('acc.pitch')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => openAuth('signin') }, t('acc.signin')), h('button', { class: 'btn ghost', onclick: () => openAuth('signup') }, t('acc.signup'))));
  }
  return h('section', { class: 'card' },
    h('div', { class: 'card-title' }, h('span', null, '☁️ ' + t('acc.title'))),
    h('p', null, h('b', null, Cloud.user.email || 'Google')),
    h('p', { id: 'sync-line', class: 'muted small' }, syncLabel()),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: () => syncNow() }, t('sync.now')),
      h('button', { class: 'btn ghost', onclick: logout }, t('acc.signout')),
      h('button', { class: 'btn ghost', onclick: () => openNewPassword() }, t('acc.changePass'))),
    h('details', { class: 'recipe-det' }, h('summary', null, t('acc.danger')),
      h('p', { class: 'muted small' }, t('acc.dangerText')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn danger-soft', onclick: deleteCloud }, t('acc.deleteCloud')),
        h('button', { class: 'btn danger-soft', onclick: deleteAccount }, t('acc.deleteAccount')))));
}
async function logout() {
  await syncNow();   // последняя отправка перед выходом
  try { await Cloud.signOut(); } catch { /* уже вышли */ }
  if (confirm(t('acc.clearLocal'))) { localStorage.removeItem(KEY); S = defaults(); }
  view = 'today'; render(); toast(t('acc.signedOut'));
}
async function deleteCloud() {
  if (!confirm(t('acc.deleteCloudConfirm'))) return;
  try { await Cloud.deleteData(); sync.last = null; toast(t('acc.cloudDeleted')); } catch (e) { toast(authError(e)); }
  render();
}
async function deleteAccount() {
  if (!confirm(t('acc.deleteAccountConfirm'))) return;
  try {
    await Cloud.deleteAccount();
    toast(t('acc.accountDeleted'));
    Cloud.user = null; setSyncState('off'); render();
  } catch (e) { toast(authError(e)); }
}
async function wipeAll() {
  if (Cloud.user) {
    if (!confirm(t('set.wipeCloudConfirm'))) return;
    try { await Cloud.deleteData(); } catch (e) { toast(authError(e)); return; }
  } else if (!confirm(t('set.wipeConfirm'))) return;
  clearTimeout(sync.timer);
  localStorage.removeItem(KEY); S = defaults(); render(); toast(t('set.wiped'));
}

function openAuth(mode = 'signin') {
  modal(t('acc.title'), api => {
    let m = mode, busy = false;
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' });
    const pass = h('input', { type: 'password', minlength: 6 });
    const tabs = h('div', { class: 'tabs' });
    const submit = h('button', { class: 'btn wide', onclick: go }, '');
    const forgot = h('button', { class: 'link-btn', onclick: async () => {
      if (!/@/.test(email.value)) { show(t('err.needEmail')); return; }
      try { const { error } = await Cloud.resetPassword(email.value.trim()); if (error) throw error; show(t('acc.resetSent'), true); } catch (e) { show(authError(e)); }
    } }, t('acc.forgot'));
    const passField = field(t('acc.password'), pass, null);
    function show(text, ok = false) { msg.textContent = text; msg.className = 'form-msg' + (ok ? ' ok' : ''); }
    function draw() {
      tabs.replaceChildren(...[['signin', t('acc.signin')], ['signup', t('acc.signup')]].map(([k, l]) =>
        h('button', { class: 'tab' + (k === m ? ' on' : ''), onclick: () => { m = k; show(''); draw(); } }, l)));
      submit.textContent = m === 'signin' ? t('acc.signin') : t('acc.signup');
      pass.autocomplete = m === 'signin' ? 'current-password' : 'new-password';
      forgot.style.display = m === 'signin' ? '' : 'none';
    }
    async function go() {
      if (busy) return;
      const em = email.value.trim(), pw = pass.value;
      if (!/^\S+@\S+\.\S+$/.test(em)) { show(t('err.needEmail')); return; }
      if (pw.length < 6) { show(t('err.weakPass')); return; }
      busy = true; submit.disabled = true; show('…', true);
      try {
        if (m === 'signin') {
          const { error } = await Cloud.signIn(em, pw);
          if (error) throw error;
          api.close();
        } else {
          const { data, error } = await Cloud.signUp(em, pw);
          if (error) throw error;
          if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('already registered');
          if (!data.session) show(t('acc.checkMail'), true); else api.close();
        }
      } catch (e) { show(authError(e)); }
      busy = false; submit.disabled = false;
    }
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    api.body.append(tabs,
      field('Email', email), passField, submit, forgot, msg,
      Cloud.google ? h('div', null, h('div', { class: 'or' }, t('acc.or')),
        h('button', { class: 'btn ghost wide google', onclick: async () => { try { const { error } = await Cloud.signInGoogle(); if (error) throw error; } catch (e) { show(authError(e)); } } }, 'G  ' + t('acc.google'))) : null,
      h('p', { class: 'muted small' }, t('acc.privacy')));
    draw();
    setTimeout(() => email.focus(), 60);
  });
}
function openNewPassword() {
  modal(t('acc.changePass'), api => {
    const pass = h('input', { type: 'password', autocomplete: 'new-password', minlength: 6 });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    api.body.append(field(t('acc.newPassword'), pass), msg, h('button', { class: 'btn wide', onclick: async () => {
      if (pass.value.length < 6) { msg.textContent = t('err.weakPass'); return; }
      try { const { error } = await Cloud.updatePassword(pass.value); if (error) throw error; api.close(); toast(t('saved')); }
      catch (e) { msg.textContent = authError(e); }
    } }, t('save')));
    setTimeout(() => pass.focus(), 60);
  });
}

if (Cloud.enabled) {
  Cloud.on((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { openNewPassword(); return; }
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
      if (!session) { if (event === 'INITIAL_SESSION') render(); return; }
      if (S.demoKeys.length) { removeDemo(); }          // демо-данные в облако не уходят
      if (event === 'SIGNED_IN') toast(t('acc.signedIn'));
      render();
      syncNow();
    } else if (event === 'SIGNED_OUT') { setSyncState('off'); render(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Cloud.user && (!sync.last || Date.now() - sync.last > 30000)) scheduleSync(300); });
  window.addEventListener('online', () => scheduleSync(500));
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportJson() { download(`freefork-backup-${today()}.json`, JSON.stringify(S, null, 1), 'application/json'); }
function exportCsv() {
  const rows = [['date', 'meal', 'name', 'grams', 'kcal', 'protein', 'fat', 'carbs', 'fiber']];
  for (const k of Object.keys(S.days).sort()) for (const e of S.days[k].entries) {
    const n = entNut(e);
    rows.push([k, e.meal, `"${e.name.replaceAll('"', '""')}"`, e.grams, r1(n.kcal), r1(n.p), r1(n.f), r1(n.c), r1(n.fiber)]);
  }
  download(`freefork-diary-${today()}.csv`, '\ufeff' + rows.map(r => r.join(',')).join('\n'), 'text/csv');
}
function importJson(e) {
  const file = e.target.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      if (!data || typeof data.days !== 'object') throw new Error('bad');
      if (!confirm(t('set.importConfirm'))) return;
      S = Object.assign(defaults(), data); S.profile = Object.assign(defaults().profile, data.profile || {});
      save(); render(); toast(t('set.imported'));
    } catch { toast(t('set.importBad')); }
  };
  rd.readAsText(file);
}

/* ───────────── старт ───────────── */
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.theme === 'auto') render(); });
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__freefork = { get state() { return S; }, render, mergeStates, stable, syncNow };
})();
