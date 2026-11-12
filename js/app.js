/* Fieldwise — views, routing and event handling.
   Each view returns { html, after?, say? }:
     html  — markup for the page body
     after — optional function run once the markup is in the DOM (used to draw charts)
     say   — text read out by the "Read aloud" button */
'use strict';

const VIEWS = ['overview', 'profile', 'planner', 'nutrients', 'health', 'weather', 'market', 'desk'];
const NAV_GROUPS = [['navGroup1', ['overview', 'profile']], ['navGroup2', ['planner', 'nutrients', 'health', 'weather', 'market']], ['navGroup3', ['desk']]];

const ICON = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  profile: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  planner: '<path d="M12 21V11"/><path d="M12 13c-4 0-6-2.5-6-6 4 0 6 2.5 6 6zM12 11c0-4 2-6.5 6-6.5 0 4-2 6.5-6 6.5z"/><path d="M5 21h14"/>',
  nutrients: '<path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/>',
  health: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  weather: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z"/><path d="M9 21l1-1.5M13 21l1-1.5"/>',
  market: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  desk: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
  speaker: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
};
const icon = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

/* UI state that is not saved */
let symSel = [], pestCrop = null, photoRes = null, role = 'farmer', pendingQ = '', sayText = '';

/* ---------- shared bits ---------- */
const opt = (obj, sel, lab = x => L(x)) => Object.keys(obj).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(lab(obj[k]))}</option>`).join('');
const cropOpts = sel => CROPS.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(L(c.n))}</option>`).join('');
const badge = (cls, txt) => `<span class="badge ${cls}">${esc(txt)}</span>`;
const lvlBadge = l => badge(l === 'low' ? 'bad' : l === 'high' ? 'good' : 'warn', t(l));
const card = (title, sub, body, { span = 12, actions = '', cls = '' } = {}) =>
  `<section class="card span-${span} ${cls}"><header class="card-h"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${actions}</header><div class="card-b">${body}</div></section>`;
const kpi = (label, value, meta, tone = '') => `<div class="kpi ${tone}"><div class="kpi-l">${esc(label)}</div><div class="kpi-v">${value}</div><div class="kpi-m">${esc(meta)}</div></div>`;
const seasonName = () => L(SEASONS[P.season]).split(' (')[0];
const districtShort = () => L(DISTRICTS[P.district].name).split(',')[0];
const seriesColors = ['--series-1', '--series-2', '--series-3', '--series-4'].map(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim());
const visibleAlerts = () => alerts.filter(a => a.d === P.district || a.d === 'all');
const alertList = list => list.length ? `<ul class="list">${list.map(a => `<li><span class="dot warn" aria-hidden="true"></span><div><p>${esc(L(a.txt))}</p><time>${new Date(a.ts).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div></li>`).join('')}</ul>` : `<p class="empty">${t('noAlerts')}</p>`;

/* ---------- views ---------- */
function vOverview() {
  const r = ensureCrop(), top = r.list[0], c = C(P.crop);
  const fc = forecast(), wp = waterPlan(fc, c), fi = wp.days.findIndex(d => d.irr > 0);
  const f = fertPlan(c), md = mandiData(c), best = md.reduce((a, b) => b.today > a.today ? b : a);
  const open = tickets.filter(x => !x.reply);
  const html = `
  <div class="kpis">
    ${kpi(t('kpi_crop'), esc(L(top.c.n)), t('kpi_score', top.score), 'good')}
    ${kpi(t('kpi_irr'), fi >= 0 ? `${esc(dayLong(fc[fi].d))}` : esc(t('kpi_none')), fi >= 0 ? `${wp.days[fi].irr} mm, ${L(c.n)}` : t('kpi_none_m'), fi >= 0 ? 'info' : '')}
    ${kpi(t('kpi_cost'), '₹' + fmt(f.cost), t('kpi_field', P.area))}
    ${kpi(t('kpi_price'), '₹' + fmt(best.today) + '<small>/q</small>', t('kpi_wk', best.ch, best.m))}
  </div>
  <div class="grid">
    ${card(t('ch_suit'), t('ch_suit_sub'), '<div id="chSuit" class="chart"></div>', { span: 8, actions: `<a class="btn ghost sm" href="#planner">${t('viewAll')}</a>` })}
    <div class="span-4 stack">
      ${card(t('alertsT'), '', alertList(visibleAlerts().slice(0, 3)))}
      ${card(t('queriesT'), '', open.length ? `<ul class="list">${open.slice(0, 3).map(q => `<li><span class="dot" aria-hidden="true"></span><div><p><b>${esc(q.name)}</b>: ${esc(q.q)}</p></div></li>`).join('')}</ul>` : `<p class="empty">${t('noOpen')}</p>`, { actions: `<a class="btn ghost sm" href="#desk">${t('viewAll')}</a>` })}
    </div>
    ${card(t('ch_rain'), t('ch_rain_sub'), '<div id="chRain" class="chart"></div>', { span: 6 })}
    ${card(t('ch_temp'), t('ch_temp_sub'), '<div id="chTemp" class="chart"></div>', { span: 6 })}
    ${card(t('ch_mandi', L(c.n)), t('ch_mandi_sub'), '<div id="chMandi" class="chart"></div>', { span: 12, actions: `<a class="btn ghost sm" href="#market">${t('viewAll')}</a>` })}
  </div>`;
  return {
    html,
    say: `${t('kpi_crop')}: ${L(top.c.n)}. ${fi >= 0 ? t('irrNow', dayLong(fc[fi].d), wp.days[fi].irr) : t('irrNone')}. ${t('kpi_price')}: ${best.m}, ${fmt(best.today)}.`,
    after() {
      Charts.hbars(document.getElementById('chSuit'), { max: 100, aria: t('ch_suit'), items: r.list.slice(0, 7).map(x => ({ label: L(x.c.n), value: x.score, hl: x.c.id === P.crop, rows: [[t('score'), x.score + ' / 100'], [t('duration'), x.c.d + ' ' + t('days')]] })) });
      drawWeatherCharts(fc, 'chRain', 'chTemp');
      drawMandi(md, 'chMandi');
    }
  };
}
function drawWeatherCharts(fc, rainId, tempId) {
  const labels = fc.map(f => dayName(f.d));
  Charts.vbars(document.getElementById(rainId), { labels, values: fc.map(f => f.rain), unit: ' mm', aria: t('ch_rain'), tipRows: i => [[t('rain'), fc[i].rain + ' mm'], [t('rainP'), fc[i].rp + '%']] });
  Charts.range(document.getElementById(tempId), { labels, lo: fc.map(f => f.tmin), hi: fc.map(f => f.tmax), aria: t('ch_temp'), maxLabel: 'Max', minLabel: 'Min' });
}
function drawMandi(md, id) {
  const labels = md[0].s.map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }); });
  Charts.lines(document.getElementById(id), { labels, aria: 'Price trend', fmtv: v => '₹' + fmt(v), series: md.map((m, i) => ({ name: m.m, values: m.s, color: seriesColors[i] })) });
}

function vProfile() {
  const D = DISTRICTS[P.district], water = Math.round(D.rain * RAIN_SHARE[P.season] + IRR[P.irrigation].mm);
  const field = (lab, inner, extra = '') => `<label class="field">${esc(lab)}${inner}${extra}</label>`;
  const html = `
  <div class="grid">
    ${card(t('profile'), '', `
      <div class="form">
        ${field(t('district'), `<select data-k="district">${opt(DISTRICTS, P.district, x => L(x.name))}</select>`)}
        ${field(t('season'), `<select data-k="season">${opt(SEASONS, P.season)}</select>`)}
        ${field(t('soil'), `<select data-k="soil">${opt(SOILS, P.soil)}</select>`)}
        ${field(t('area'), `<input type="number" min="0.25" step="0.25" data-k="area" value="${P.area}">`)}
        ${field(t('irrigation'), `<select data-k="irrigation">${opt(IRR, P.irrigation)}</select>`)}
      </div>
      <h3 class="sec">${t('shc')}</h3>
      <div class="form">
        ${field(t('ph'), `<input type="number" step="0.1" min="3" max="10" data-k="ph" value="${P.ph}">`)}
        ${field(t('N'), `<input type="number" min="0" data-k="N" value="${P.N}">`, lvlBadge(lvlN(+P.N)))}
        ${field(t('P'), `<input type="number" min="0" data-k="P" value="${P.P}">`, lvlBadge(lvlP(+P.P)))}
        ${field(t('K'), `<input type="number" min="0" data-k="K" value="${P.K}">`, lvlBadge(lvlK(+P.K)))}
      </div>
      <div class="actions"><a class="btn primary" href="#planner">${t('viewPlan')}</a></div>`, { span: 8 })}
    ${card(L({ en: 'Derived values', hi: 'गणना किए गए मान' }), L({ en: 'Used by the advisory engines', hi: 'सलाह इंजन इनका उपयोग करते हैं' }), `
      <dl class="dl">
        <div><dt>${L({ en: 'Seasonal water available', hi: 'मौसमी उपलब्ध पानी' })}</dt><dd>${water} mm</dd></div>
        <div><dt>${L({ en: 'Annual rainfall (district)', hi: 'वार्षिक वर्षा (ज़िला)' })}</dt><dd>${D.rain} mm</dd></div>
        <div><dt>${L({ en: 'Average temperature', hi: 'औसत तापमान' })}</dt><dd>${D.temp[P.season]}°C</dd></div>
        <div><dt>${L({ en: 'Safe soil-water depletion', hi: 'सुरक्षित मृदा-जल कमी' })}</dt><dd>${SOIL_TAW[P.soil]} mm</dd></div>
        <div><dt>${L({ en: 'Default soil for district', hi: 'ज़िले की सामान्य मिट्टी' })}</dt><dd>${esc(L(SOILS[D.soil]))}</dd></div>
      </dl>`, { span: 4 })}
  </div>`;
  return { html, say: t('ps_profile') };
}

function vPlanner() {
  const r = ensureCrop(), top = r.list[0];
  const rows = r.list.map((x, i) => {
    const c = x.c, warns = x.R.filter(q => !q[0]), inc = c.y * c.p * (+P.area || 1);
    return `<tr class="${P.crop === c.id ? 'sel' : ''}">
      <td class="n muted">${i + 1}</td>
      <td><b>${esc(L(c.n))}</b>${i === 0 ? ' ' + badge('good', t('top')) : ''}</td>
      <td class="nw"><div class="scorebar"><span style="width:${x.score}%"></span></div><b class="num">${x.score}</b></td>
      <td class="n">${c.d}</td><td class="n">${c.y}</td><td class="n">₹${fmt(inc)}</td>
      <td class="why">${warns.length ? warns.map(w => `<div class="w">${esc(w[1])}</div>`).join('') : `<span class="ok">${L({ en: 'All checks passed', hi: 'सभी जाँच सफल' })}</span>`}</td>
      <td>${P.crop === c.id ? badge('neutral', t('chosen')) : `<button class="btn sm" data-choose="${c.id}">${t('choose')}</button>`}</td>
    </tr>`;
  }).join('');
  const html = `
  <div class="callout good"><b>${esc(t('crops_lead', L(top.c.n), seasonName()))}.</b> ${esc(top.R.filter(q => q[0]).map(q => q[1]).join('. '))}.</div>
  <div class="grid">${card(t('pt_planner'), t('crops_sub'), `
    <div class="table-wrap"><table class="table">
      <thead><tr><th class="n">#</th><th>${t('crop')}</th><th>${t('score')}</th><th class="n">${t('duration')} (${t('days')})</th><th class="n">${t('yield')} (${t('qpa')})</th><th class="n">${t('income')}</th><th>${L({ en: 'Watch-outs', hi: 'ध्यान दें' })}</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="foot">${esc(t('notSeason', r.out.map(c => L(c.n)).join(', ')))}</p>`)}</div>`;
  return { html, say: t('crops_lead', L(top.c.n), seasonName()) + '. ' + top.R.filter(q => q[0]).map(q => q[1]).join('. ') };
}

function vNutrients() {
  ensureCrop();
  const c = C(P.crop), f = fertPlan(c), names = ['N', 'P₂O₅', 'K₂O'];
  const u = f.kg.urea, d = Math.round(f.kg.dap), m = Math.round(f.kg.mop);
  const steps = c.leg ? [t('basalLeg', d, m, Math.round(u))] : [t('basal', Math.round(u / 3), d, m), t('top1', Math.round(u / 3)), t('top2', Math.round(u / 3))];
  const controls = `<div class="inline"><label class="field compact">${t('crop')}<select id="fcrop">${cropOpts(P.crop)}</select></label><label class="field compact w-sm">${t('area')}<input type="number" min="0.25" step="0.25" id="farea" value="${P.area}"></label></div>`;
  const html = `
  <div class="toolbar">${controls}</div>
  <div class="kpis">
    ${['urea', 'dap', 'mop'].map(k => kpi(L(FERT[k].n), `${f.bags[k]}<small> ${f.bags[k] === 1 ? t('bag1') : t('bags')}</small>`, `${fmt(f.kg[k])} kg, ₹${fmt(f.bags[k] * FERT[k].cost)}`)).join('')}
    ${kpi(t('cost'), '₹' + fmt(f.cost), t('fert_lead', L(c.n), P.area), 'good')}
  </div>
  <div class="grid">
    ${card(t('breakdown'), t('fert_sub'), `
      <div class="table-wrap"><table class="table"><thead><tr><th>${t('nutrient')}</th><th>${L({ en: 'Soil level', hi: 'मिट्टी स्तर' })}</th><th class="n">${t('rec')}</th><th class="n">${t('adj')}</th><th class="n">${t('total')}</th></tr></thead>
      <tbody>${names.map((n, i) => `<tr><td><b>${n}</b></td><td>${lvlBadge(f.lv[i])}</td><td class="n">${c.npk[i]}</td><td class="n">${fmt(f.ha[i])}</td><td class="n">${fmt(f.perField[i])}</td></tr>`).join('')}</tbody></table></div>
      <p class="foot">${L({ en: 'Prices: urea ₹266.50 / 45 kg, DAP ₹1,350 / 50 kg, MOP about ₹1,650 / 50 kg (indicative subsidised rates).', hi: 'मूल्य: यूरिया ₹266.50 / 45 किग्रा, डीएपी ₹1,350 / 50 किग्रा, एमओपी लगभग ₹1,650 / 50 किग्रा (अनुमानित सब्सिडी दर)।' })}</p>`, { span: 7 })}
    ${card(t('schedule'), '', `<ol class="timeline">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><div class="callout">${t('organic')}</div>`, { span: 5 })}
  </div>`;
  return { html, say: t('fertSay', L(c.n), f.bags.urea, f.bags.dap, f.bags.mop, fmt(f.cost)) + ' ' + steps.join(' ') };
}

function vHealth() {
  ensureCrop(); if (!pestCrop) pestCrop = P.crop;
  const html = `
  <div class="grid">
    ${card(t('symptoms'), t('pest_sub'), `
      <label class="field compact" style="max-width:280px">${t('crop')}<select id="pcrop">${cropOpts(pestCrop)}</select></label>
      <div class="chips">${Object.keys(SYM).map(k => `<button class="chip" data-sym="${k}" aria-pressed="${symSel.includes(k)}">${esc(L(SYM[k]))}</button>`).join('')}</div>
      <div class="actions"><button class="btn primary" id="dxBtn">${t('diagnose')}</button><button class="btn" id="dxClear">${t('clear')}</button></div>`, { span: 7 })}
    ${card(t('photo'), t('photoHint'), `
      <label class="drop" for="leaf">${icon('health', 22)}<span>${L({ en: 'Upload leaf photo', hi: 'पत्ती की फोटो अपलोड करें' })}</span><input type="file" id="leaf" accept="image/*" hidden></label>
      <div id="photoOut">${photoRes ? photoHtml(photoRes) : ''}</div>`, { span: 5 })}
    <section class="card span-12" id="dxCard" hidden><header class="card-h"><div><h2>${t('results')}</h2></div></header><div class="card-b" id="dxOut"></div></section>
  </div>`;
  return { html, say: t('pest_lead'), after() { if (symSel.length) diagnose(); } };
}
function diagnose() {
  const cardEl = document.getElementById('dxCard'), out = document.getElementById('dxOut'); cardEl.hidden = false;
  if (!symSel.length) { out.innerHTML = `<p class="empty">${t('noSigns')}</p>`; return; }
  const res = PESTS.filter(p => p.c.includes(pestCrop) || p.c.includes('*')).map(p => {
    const m = p.s.filter(s => symSel.includes(s)).length; let sc = 2 * m / (p.s.length + symSel.length);
    if (p.c.includes('*')) sc *= .8; return { p, sc: Math.round(sc * 100) };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3);
  if (!res.length) { out.innerHTML = `<p class="empty">${t('noMatch')}</p>`; return; }
  sayText = L(res[0].p.n) + '. ' + t('organicT') + ': ' + L(res[0].p.o) + ' ' + t('chemT') + ': ' + L(res[0].p.ch);
  out.innerHTML = `<div class="dx-grid">${res.map((x, i) => `
    <article class="dx ${i === 0 ? 'first' : ''}">
      <div class="dx-h"><div><span class="muted sm">${i === 0 ? t('likely') : t('alsoP')}</span><h3>${esc(L(x.p.n))}</h3></div><span class="num">${x.sc}%</span></div>
      <div class="scorebar red"><span style="width:${x.sc}%"></span></div>
      <dl class="dl tight"><div><dt>${t('organicT')}</dt><dd>${esc(L(x.p.o))}</dd></div><div><dt>${t('chemT')}</dt><dd>${esc(L(x.p.ch))}</dd></div><div><dt>${t('prevT')}</dt><dd>${esc(L(x.p.pv))}</dd></div></dl>
    </article>`).join('')}</div>
    <div class="callout warn">${t('safety')}</div>
    <div class="actions"><a class="btn sm" href="#desk" id="toExpert">${t('askExpert')}</a></div>`;
}
function analyzeLeaf(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const cv = document.createElement('canvas'), sc = Math.min(1, 260 / Math.max(img.width, img.height));
    cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0, cv.width, cv.height);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let g = 0, y = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, bb = d[i + 2] / 255, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), v = mx, s = mx ? (mx - mn) / mx : 0;
      let h = 0; if (mx !== mn) { h = mx === r ? ((gg - bb) / (mx - mn)) % 6 : mx === gg ? (bb - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
      if (v < .12) continue;
      if (s < .15 && v > .78) { w++; continue; }
      if (s < .18) continue;
      if (h >= 70 && h <= 170) g++; else if (h >= 42 && h < 70 && v > .4) y++; else b++;
    }
    const tot = g + y + b + w || 1; photoRes = { url, g: g / tot * 100, y: y / tot * 100, b: b / tot * 100, w: w / tot * 100 };
    document.getElementById('photoOut').innerHTML = photoHtml(photoRes);
  };
  img.src = url;
}
function photoHtml(p) {
  const msgs = [], add = [];
  if (p.y > 20) { msgs.push(t('ph_y')); add.push('yellow'); }
  if (p.b > 12) { msgs.push(t('ph_b')); add.push('spots'); }
  if (p.w > 10 && p.g > 20) { msgs.push(t('ph_w')); add.push('powder'); }
  if (!msgs.length) msgs.push(t('ph_ok'));
  const bar = (lab, v, col) => `<div class="pbar"><span>${esc(lab)}</span><span class="track"><i style="width:${v.toFixed(0)}%;background:${col}"></i></span><b class="num">${v.toFixed(0)}%</b></div>`;
  return `<div class="photo"><img src="${p.url}" alt="">
    <div>${bar(t('green'), p.g, 'var(--primary)')}${bar(t('yellowC'), p.y, 'var(--series-4)')}${bar(t('brown'), p.b, '#8A5A3B')}${bar(t('white'), p.w, '#9AA5A0')}</div></div>
    ${msgs.map(m => `<p class="strong">${esc(m)}</p>`).join('')}
    ${add.length ? `<button class="btn sm" data-addsym="${add.join(',')}">${t('addSigns')}</button>` : ''}
    <p class="foot">${t('photoNote')}</p>`;
}

function vWeather() {
  ensureCrop();
  const c = C(P.crop), fc = forecast(), wp = waterPlan(fc, c), fi = wp.days.findIndex(d => d.irr > 0);
  const lead = fi >= 0 ? t('irrNow', dayLong(fc[fi].d), wp.days[fi].irr) : t('irrNone');
  let run = 0, maxRun = 0; fc.forEach(f => { if (f.hum >= 80 && f.tmax <= 33 && f.tmin >= 15) { run++; maxRun = Math.max(maxRun, run); } else run = 0; });
  const cond = f => f.rain > 15 ? L({ en: 'Heavy rain', hi: 'भारी वर्षा' }) : f.rain > 0 ? L({ en: 'Showers', hi: 'बौछारें' }) : f.rp > 45 ? L({ en: 'Cloudy', hi: 'बादल' }) : L({ en: 'Clear', hi: 'साफ़' });
  const html = `
  <div class="callout info"><b>${esc(lead)}.</b> ${esc(t('weather_sub', L(c.n)))}</div>
  ${maxRun >= 3 ? `<div class="callout warn">${t('fungal')}</div>` : ''}
  <div class="grid">
    ${card(t('irrPlan'), t('asOf'), `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>${t('day')}</th><th>${L({ en: 'Conditions', hi: 'मौसम' })}</th><th class="n">${t('tempT')} (°C)</th><th class="n">${t('rainP')}</th><th class="n">${t('rain')} (mm)</th><th class="n">${t('windT')} (km/h)</th><th class="n">${t('humT')}</th><th class="n">ETc (mm)</th><th>${t('irrigation')}</th><th>${t('sprayWin')}</th></tr></thead>
        <tbody>${fc.map((f, i) => { const w = wp.days[i]; return `<tr>
          <td><b>${esc(dayName(f.d))}</b> <span class="muted">${f.d.getDate()}/${f.d.getMonth() + 1}</span></td><td>${esc(cond(f))}</td>
          <td class="n">${f.tmax} / ${f.tmin}</td><td class="n">${f.rp}%</td><td class="n">${f.rain}</td><td class="n">${f.wind}</td><td class="n">${f.hum}%</td><td class="n">${w.etc.toFixed(1)}</td>
          <td>${w.irr ? badge('info', `${t('irr')} ${w.irr} mm`) : `<span class="muted">${t('noirr')}</span>`}</td>
          <td>${w.spray ? badge('good', t('sprayOk')) : badge('bad', t('sprayNo'))}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="foot">${t('howCalc')} ${t('simW')}</p>`)}
    ${card(t('ch_rain'), t('ch_rain_sub'), '<div id="wRain" class="chart"></div>', { span: 6 })}
    ${card(t('ch_temp'), t('ch_temp_sub'), '<div id="wTemp" class="chart"></div>', { span: 6 })}
  </div>`;
  const sprayDays = fc.filter((f, i) => wp.days[i].spray).map(f => dayName(f.d));
  return { html, say: lead + '. ' + t('sprayOk') + ': ' + sprayDays.join(', '), after() { drawWeatherCharts(fc, 'wRain', 'wTemp'); } };
}

function vMarket() {
  ensureCrop();
  const c = C(P.crop), md = mandiData(c), best = md.reduce((a, b) => b.today > a.today ? b : a);
  const avgCh = md.reduce((s, x) => s + x.ch, 0) / md.length;
  let adv = avgCh > 2 ? t('rising') : avgCh < -2 ? t('falling') : t('stable');
  if (c.msp && best.today < c.msp) adv = t('belowMsp');
  const html = `
  <div class="toolbar"><label class="field compact">${t('crop')}<select id="mcrop">${cropOpts(P.crop)}</select></label></div>
  <div class="kpis">
    ${kpi(t('kpi_price'), '₹' + fmt(best.today) + '<small>/q</small>', best.m, 'good')}
    ${kpi(t('msp') + ' 2025–26', c.msp ? '₹' + fmt(c.msp) + '<small>/q</small>' : '—', c.msp ? (c.id === 'sugarcane' ? 'FRP' : (best.today >= c.msp ? L({ en: 'Market is above MSP', hi: 'मंडी भाव एमएसपी से ऊपर' }) : L({ en: 'Market is below MSP', hi: 'मंडी भाव एमएसपी से नीचे' }))) : t('noMsp'))}
    ${kpi(t('wk'), `${avgCh >= 0 ? '+' : ''}${avgCh.toFixed(1)}%`, L({ en: 'Average across markets', hi: 'सभी मंडियों का औसत' }), avgCh >= 0 ? 'good' : 'bad')}
  </div>
  <div class="callout ${c.msp && best.today < c.msp ? 'warn' : 'info'}">${esc(adv)}</div>
  <div class="grid">
    ${card(t('ch_mandi', L(c.n)), t('ch_mandi_sub'), '<div id="mChart" class="chart"></div>', { span: 12 })}
    ${card(t('market'), t('simM'), `
      <div class="table-wrap"><table class="table"><thead><tr><th>${t('market')}</th><th class="n">${t('today')}</th><th class="n">${t('wk')}</th><th class="n">vs ${t('msp')}</th><th>${t('trend')}</th></tr></thead>
      <tbody>${md.map(x => `<tr class="${x === best ? 'sel' : ''}"><td><b>${esc(x.m)}</b>${x === best ? ' ' + badge('good', L({ en: 'Best', hi: 'सर्वोत्तम' })) : ''}</td><td class="n">₹${fmt(x.today)}</td><td class="n ${x.ch >= 0 ? 'up' : 'down'}">${x.ch >= 0 ? '▲' : '▼'} ${Math.abs(x.ch).toFixed(1)}%</td><td class="n">${c.msp ? (x.today >= c.msp ? '+' : '') + fmt(x.today - c.msp) : '—'}</td><td>${Charts.spark(x.s)}</td></tr>`).join('')}</tbody></table></div>`)}
  </div>`;
  return { html, say: t('mandi_lead', L(c.n), best.m, fmt(best.today)) + '. ' + adv, after() { drawMandi(md, 'mChart'); } };
}

function vDesk() {
  const list = tickets.slice().sort((a, b) => b.ts - a.ts), open = tickets.filter(x => !x.reply).length;
  const tk = x => `<li class="ticket">
      <div class="ticket-h"><div><b>${esc(x.name)}</b> <span class="muted">${esc(x.village || '')}${C(x.crop) ? ', ' + esc(L(C(x.crop).n)) : ''}</span></div>${x.reply ? badge('good', t('ans')) : badge('warn', t('open'))}</div>
      <p>${esc(x.q)}</p>
      ${x.reply ? `<div class="reply">${esc(x.reply)}</div>` : ''}
      ${role === 'officer' && !x.reply ? `<div class="inline"><input class="input grow rin" data-id="${x.id}" placeholder="${t('replyPh')}"><button class="btn primary sm" data-reply="${x.id}">${t('replyB')}</button></div>` : ''}
    </li>`;
  const left = role === 'farmer' ? card(t('expert_lead'), t('expert_sub'), `
      <div class="form">
        <label class="field">${t('name')}<input id="qn"></label>
        <label class="field">${t('village')}<input id="qv"></label>
        <label class="field">${t('crop')}<select id="qc">${cropOpts(P.crop)}</select></label>
      </div>
      <label class="field">${t('question')}<textarea id="qq">${esc(pendingQ)}</textarea></label>
      <div class="actions"><button class="btn primary" id="qsend">${t('send')}</button></div>`, { span: 5 })
    : card(t('broadcast'), t('expert_sub'), `
      <div class="kpis three">${kpi(t('total'), tickets.length, '')}${kpi(t('pending'), open, '', 'warn')}${kpi(t('answered'), tickets.length - open, '', 'good')}</div>
      <label class="field">${t('district')}<select id="ad">${opt(DISTRICTS, P.district, x => L(x.name))}</select></label>
      <label class="field">${t('alertWord')}<textarea id="at" placeholder="${t('alertPh')}"></textarea></label>
      <div class="actions"><button class="btn primary" id="asend">${t('sendAlert')}</button></div>`, { span: 5 });
  const html = `<div class="grid">${left}${card(t('myQ'), '', list.length ? `<ul class="tickets">${list.map(tk).join('')}</ul>` : `<p class="empty">${t('noQ')}</p>`, { span: 7 })}</div>`;
  return { html, say: t('expert_sub') };
}

/* ---------- speech ---------- */
function speak(text, btn) {
  try {
    const ss = window.speechSynthesis; if (!ss) { toast('Voice is not available on this device'); return; }
    if (ss.speaking) { ss.cancel(); btn.classList.remove('on'); return; }
    const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = .95;
    const v = ss.getVoices().find(v => v.lang === u.lang); if (v) u.voice = v;
    u.onend = () => btn.classList.remove('on');
    ss.speak(u); btn.classList.add('on');
  } catch (e) { toast('Voice is not available on this device'); }
}
function toast(m) { const e = document.getElementById('toast'); e.textContent = m; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2200); }

/* ---------- render ---------- */
const current = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'overview'; };
const RENDER = { overview: vOverview, profile: vProfile, planner: vPlanner, nutrients: vNutrients, health: vHealth, weather: vWeather, market: vMarket, desk: vDesk };
let lastAfter = null;

function renderChrome() {
  document.documentElement.lang = lang;
  document.title = `${t('nav2')[current()]} | ${BRAND.name}`;
  const cur = current();
  document.getElementById('nav').innerHTML = NAV_GROUPS.map(([g, items]) => `<div class="nav-g"><div class="nav-gl">${t(g)}</div>${items.map(v => `<a href="#${v}" class="nav-i" ${v === cur ? 'aria-current="page"' : ''}>${icon(v)}<span>${t('nav2')[v]}</span>${v === 'desk' && tickets.some(x => !x.reply) ? `<span class="count">${tickets.filter(x => !x.reply).length}</span>` : ''}</a>`).join('')}</div>`).join('');
  document.getElementById('brandTag').textContent = t('tag');
  document.getElementById('sideFarm').innerHTML = `<div class="sf-l">${esc(districtShort())}</div><div class="sf-m">${esc(seasonName())}, ${P.area} ${L({ en: 'acres', hi: 'एकड़' })}</div><div class="sf-m">${esc(L(SOILS[P.soil]))}</div>`;
  document.getElementById('topDistrict').innerHTML = opt(DISTRICTS, P.district, x => L(x.name));
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  document.querySelectorAll('[data-role]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.role === role); b.textContent = t(b.dataset.role); });
  document.getElementById('roleSeg').hidden = cur !== 'desk';
}
function render() {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  Charts.hideTip();
  renderChrome();
  const v = current(), out = RENDER[v]();
  sayText = out.say || '';
  document.getElementById('page').innerHTML = `
    <div class="page-h">
      <div><h1>${esc(t('pt_' + v))}</h1><p>${esc(t('ps_' + v))} <span class="muted">${esc(t('ctx', L(DISTRICTS[P.district].name), seasonName(), P.area))}</span></p></div>
      <button class="btn" id="sayBtn">${icon('speaker', 16)}<span>${t('readAloud')}</span></button>
    </div>${out.html}`;
  lastAfter = out.after || null;
  if (lastAfter) lastAfter();
}
window.addEventListener('hashchange', () => { render(); document.getElementById('page').scrollTop = 0; window.scrollTo(0, 0); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (lastAfter) lastAfter(); }, 150); });

/* ---------- events ---------- */
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.k || el.id === 'topDistrict') {
    const k = el.dataset.k || 'district'; P[k] = el.type === 'number' ? (+el.value || 0) : el.value;
    if (k === 'district') { const D = DISTRICTS[P.district]; P.soil = D.soil; P.ph = D.ph; }
    if (k === 'season' || k === 'district' || k === 'soil') P.crop = null;
    saveProfile(); render(); toast(t('saved'));
  }
  if (el.id === 'fcrop' || el.id === 'mcrop') { P.crop = el.value; saveProfile(); render(); }
  if (el.id === 'farea') { P.area = +el.value || 1; saveProfile(); render(); }
  if (el.id === 'pcrop') { pestCrop = el.value; if (symSel.length) diagnose(); }
  if (el.id === 'leaf' && el.files[0]) analyzeLeaf(el.files[0]);
});
document.addEventListener('click', e => {
  const b = e.target.closest('button,a'); if (!b) return;
  if (b.dataset.lang) { lang = b.dataset.lang; store.set('lang', lang); render(); }
  else if (b.id === 'sayBtn') speak(sayText, b);
  else if (b.dataset.choose) { P.crop = b.dataset.choose; saveProfile(); render(); }
  else if (b.dataset.sym) { const k = b.dataset.sym; symSel = symSel.includes(k) ? symSel.filter(x => x !== k) : [...symSel, k]; b.setAttribute('aria-pressed', symSel.includes(k)); }
  else if (b.id === 'dxBtn') diagnose();
  else if (b.id === 'dxClear') { symSel = []; document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false')); document.getElementById('dxCard').hidden = true; }
  else if (b.dataset.addsym) { b.dataset.addsym.split(',').forEach(s => { if (!symSel.includes(s)) symSel.push(s); }); document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', symSel.includes(c.dataset.sym))); diagnose(); }
  else if (b.id === 'toExpert') { pendingQ = `${L(C(pestCrop).n)}: ${symSel.map(s => L(SYM[s])).join(', ')}. `; role = 'farmer'; }
  else if (b.dataset.role) { role = b.dataset.role; render(); }
  else if (b.id === 'qsend') {
    const n = document.getElementById('qn').value.trim(), q = document.getElementById('qq').value.trim();
    if (!n || !q) { toast(t('fillAll')); return; }
    tickets.push({ id: Date.now(), name: n, village: document.getElementById('qv').value.trim(), crop: document.getElementById('qc').value, q, reply: '', ts: Date.now() });
    pendingQ = ''; store.set('tickets', tickets); render(); toast(t('sent'));
  }
  else if (b.dataset.reply) {
    const inp = document.querySelector(`.rin[data-id="${b.dataset.reply}"]`); if (!inp.value.trim()) return;
    tickets.find(x => String(x.id) === b.dataset.reply).reply = inp.value.trim(); store.set('tickets', tickets); render(); toast(t('replied'));
  }
  else if (b.id === 'asend') {
    const txt = document.getElementById('at').value.trim(); if (!txt) return;
    alerts.unshift({ id: Date.now(), d: document.getElementById('ad').value, level: 'warn', txt: { en: txt, hi: txt }, ts: Date.now() });
    store.set('alerts', alerts); render(); toast(t('alertSent'));
  }
});
try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) { /* ignore */ }
render();
