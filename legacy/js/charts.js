/* Fieldwise — dependency-free SVG charts with hover tooltips.
   Every chart renders into a container element and sizes itself to its width.
   Colours come from CSS custom properties defined in css/styles.css (--series-*, --primary). */
'use strict';

const Charts = (() => {
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const tipEl = () => document.getElementById('tip');

  function showTip(html, x, y) {
    const el = tipEl(); el.innerHTML = html; el.hidden = false;
    const r = el.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    el.style.left = left + 'px'; el.style.top = top + 'px';
  }
  function hideTip() { const el = tipEl(); if (el) el.hidden = true; }

  /* Any SVG/HTML element with data-tip shows a tooltip on hover. */
  document.addEventListener('pointermove', e => {
    const m = e.target.closest && e.target.closest('[data-tip]');
    if (m) showTip(m.getAttribute('data-tip'), e.clientX, e.clientY);
    else if (!(e.target.closest && e.target.closest('.xhair-zone'))) hideTip();
  });
  document.addEventListener('scroll', hideTip, true);

  function ticks(min, max, n = 4) {
    const span = (max - min) || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
    return out;
  }
  const tipHtml = (title, rows) => esc(`<div class="tip-t">${esc(title)}</div>` + rows.map(r => `<div class="tip-r">${r[2] ? `<i style="background:${r[2]}"></i>` : ''}<span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join(''));
  /* Bar with a 4px rounded data-end and a square base on the baseline. */
  const vbarPath = (x, y, w, h, r = 4) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const hbarPath = (x, y, w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };

  function grid(W, pad, H, y, tk, fmtTick) {
    return tk.map(v => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad.l - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${fmtTick(v)}</text>`).join('');
  }

  /* Vertical bars, one series. opts: labels, values, unit, color, tipRows(i) */
  function vbars(el, o) {
    const W = Math.max(280, el.clientWidth), H = o.height || 210, pad = { l: 40, r: 8, t: 12, b: 28 };
    const max = Math.max(1, ...o.values), tk = ticks(0, max), top = tk[tk.length - 1];
    const y = v => pad.t + (H - pad.t - pad.b) * (1 - v / top);
    const band = (W - pad.l - pad.r) / o.values.length, bw = Math.min(28, band * .56);
    const col = o.color || css('--series-1');
    let s = grid(W, pad, H, y, tk, v => v);
    o.values.forEach((v, i) => {
      const x = pad.l + band * i + (band - bw) / 2, yy = y(v), h = y(0) - yy;
      if (h > 0.5) s += `<path d="${vbarPath(x, yy, bw, h)}" fill="${col}"/>`;
      s += `<text x="${pad.l + band * i + band / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(o.labels[i])}</text>`;
      s += `<rect x="${pad.l + band * i}" y="${pad.t}" width="${band}" height="${H - pad.t - pad.b}" fill="transparent" data-tip="${tipHtml(o.labels[i], o.tipRows ? o.tipRows(i) : [[o.name || '', v + (o.unit || '')]])}"/>`;
    });
    s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" class="bl"/>`;
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${s}</svg>`;
  }

  /* Floating range bars (min to max), one series. opts: labels, lo, hi, unit */
  function range(el, o) {
    const W = Math.max(280, el.clientWidth), H = o.height || 210, pad = { l: 40, r: 8, t: 12, b: 28 };
    const tk = ticks(Math.min(...o.lo) - 2, Math.max(...o.hi) + 2), lo = tk[0], hi = tk[tk.length - 1];
    const y = v => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
    const band = (W - pad.l - pad.r) / o.lo.length, bw = Math.min(14, band * .3), col = o.color || css('--series-2');
    let s = grid(W, pad, H, y, tk, v => v + '°');
    o.lo.forEach((v, i) => {
      const x = pad.l + band * i + (band - bw) / 2, y1 = y(o.hi[i]), h = y(v) - y1;
      s += `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" rx="${bw / 2}" fill="${col}"/>`;
      s += `<text x="${pad.l + band * i + band / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(o.labels[i])}</text>`;
      s += `<rect x="${pad.l + band * i}" y="${pad.t}" width="${band}" height="${H - pad.t - pad.b}" fill="transparent" data-tip="${tipHtml(o.labels[i], [[o.maxLabel || 'Max', o.hi[i] + '°C'], [o.minLabel || 'Min', v + '°C']])}"/>`;
    });
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${s}</svg>`;
  }

  /* Horizontal bars with value labels. opts: items[{label, value, hl, rows}], max
     rows = tooltip lines as [label, value] pairs. */
  function hbars(el, o) {
    const W = Math.max(280, el.clientWidth), rowH = 34, labW = Math.min(170, W * .36), pad = { r: 44 };
    const H = o.items.length * rowH + 4, max = o.max || Math.max(...o.items.map(i => i.value));
    const pc = css('--primary'), pl = css('--primary-200');
    let s = '';
    o.items.forEach((it, i) => {
      const y = i * rowH + 7, bw = Math.max(2, (W - labW - pad.r) * it.value / max), h = rowH - 14;
      s += `<text x="0" y="${y + h / 2 + 4}" class="lab${it.hl ? ' hl' : ''}">${esc(it.label)}</text>`;
      s += `<rect x="${labW}" y="${y}" width="${W - labW - pad.r}" height="${h}" rx="4" class="track"/>`;
      s += `<path d="${hbarPath(labW, y, bw, h)}" fill="${it.hl ? pc : pl}"/>`;
      s += `<text x="${labW + bw + 8}" y="${y + h / 2 + 4}" class="val">${it.value}</text>`;
      s += `<rect x="0" y="${i * rowH}" width="${W}" height="${rowH}" fill="transparent" data-tip="${tipHtml(it.label, it.rows || [['', it.value]])}"/>`;
    });
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${s}</svg>`;
  }

  /* Multi-series line chart with legend, end labels and a crosshair tooltip.
     opts: labels, series[{name, values, color}], fmtv */
  function lines(el, o) {
    const W = Math.max(300, el.clientWidth), H = o.height || 240, pad = { l: 56, r: 96, t: 12, b: 28 };
    const all = o.series.flatMap(s => s.values), tk = ticks(Math.min(...all), Math.max(...all)), lo = tk[0], hi = tk[tk.length - 1];
    const n = o.labels.length, x = i => pad.l + (W - pad.l - pad.r) * i / (n - 1), y = v => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
    const fv = o.fmtv || (v => v);
    let s = grid(W, pad, H, y, tk, fv);
    [0, Math.floor(n / 2), n - 1].forEach(i => s += `<text x="${x(i)}" y="${H - 8}" class="ax" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(o.labels[i])}</text>`);
    o.series.forEach(se => { s += `<polyline points="${se.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; });
    // end labels, nudged apart so they never overlap
    const ends = o.series.map(se => ({ se, y: y(se.values[n - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(e => { s += `<circle cx="${x(n - 1)}" cy="${y(e.se.values[n - 1])}" r="4" fill="${e.se.color}" stroke="#fff" stroke-width="2"/><text x="${x(n - 1) + 10}" y="${e.y + 4}" class="endlab">${esc(e.se.name)}</text>`; });
    s += `<g class="xh" style="display:none"><line y1="${pad.t}" y2="${H - pad.b}" class="xhl"/>${o.series.map(se => `<circle r="4.5" fill="${se.color}" stroke="#fff" stroke-width="2"/>`).join('')}</g>`;
    s += `<rect class="xhair-zone" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent"/>`;
    const legend = `<div class="legend">${o.series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
    el.innerHTML = legend + `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${s}</svg>`;
    const svg = el.querySelector('svg'), zone = el.querySelector('.xhair-zone'), g = el.querySelector('.xh'), dots = g.querySelectorAll('circle'), ln = g.querySelector('line');
    zone.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - pad.l) / (W - pad.l - pad.r) * (n - 1))));
      g.style.display = ''; ln.setAttribute('x1', x(i)); ln.setAttribute('x2', x(i));
      o.series.forEach((se, k) => { dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(se.values[i])); });
      const rows = o.series.map(se => [se.name, fv(se.values[i]), se.color, se.values[i]]).sort((a, b) => b[3] - a[3]);
      const html = `<div class="tip-t">${esc(o.labels[i])}</div>` + rows.map(rw => `<div class="tip-r"><i style="background:${rw[2]}"></i><span>${esc(rw[0])}</span><b>${esc(rw[1])}</b></div>`).join('');
      showTip(html, e.clientX, e.clientY);
    });
    zone.addEventListener('pointerleave', () => { g.style.display = 'none'; hideTip(); });
  }

  /* Small inline sparkline for tables. */
  function spark(vals, w = 110, h = 28) {
    const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 3 - (v - mn) / rg * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  }

  return { vbars, range, hbars, lines, spark, hideTip };
})();
