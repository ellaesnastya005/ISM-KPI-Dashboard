(function(){
  const SK = window.SK;
  // ---------- Header summary ----------
  ['green', 'amber', 'red', 'total'].forEach(k => {
    dash.draw('sum-' + k, el => {
      const s = dash.data('kpi_summary');
      if (s.status !== 'ok' || !s.data || !s.data.length) { el.textContent = '—'; return; }
      el.textContent = SK.fi(s.data[0][k]);
    });
  });
  dash.draw('sum-detail', el => {
    const k = dash.data('kpi_latest');
    if (k.status !== 'ok') { el.textContent = '—'; return; }
    const red = k.data.filter(r => r.status === 'red').map(r => r.name);
    const worse = k.data.filter(r => r.worsening >= 3).map(r => r.name);
    let t = red.length ? 'Найбільше відставання: ' + red.slice(0, 3).join('; ') + (red.length > 3 ? ' та ін' : '') + '.' : 'Червоних метрик немає.';
    if (worse.length) t += ' Погіршуються 3+ місяці поспіль: ' + worse.join('; ') + '.';
    el.textContent = t;
  });

  // ---------- Tiles ----------
  dash.draw('tile', el => {
    const id = el.getAttribute('data-kpi');
    const k = dash.data('kpi_latest'), m = dash.data('kpi_monthly');
    if (!SK.ready(el, [k, m])) return;
    const r = k.data.find(x => x.kpi_id === id);
    if (!r) { el.textContent = '—'; return; }
    el.replaceChildren();
    const row = SK.el('div', 'sk-valrow');
    row.append(SK.mark(SK.el('span', 'sk-big', SK.f1(r.value)), 'kpi_latest', 'value', 'kpi_id=' + id), SK.el('span', 'sk-unit', r.unit));
    el.append(row);
    const st = SK.el('div', 'sk-line'); st.append(SK.statusEl(r.status, r.worsening)); el.append(st);
    const tg = SK.el('div', 'sk-line sk-muted', 'Ціль ' + r.target_label);
    const tag = SK.el('span', 'sk-tag', r.target_tag); tag.setAttribute('aria-label', 'Джерело цілі: ' + r.target_source);
    tg.append(tag); el.append(tg);
    if (r.delta != null) {
      const better = r.direction === 'higher' ? r.delta > 0 : r.delta < 0;
      const dl = SK.el('div', 'sk-line');
      const num = SK.mark(SK.el('span', r.delta === 0 ? 'sk-muted' : better ? 'sk-ok' : 'sk-bad', SK.signed(r.delta)), 'kpi_latest', 'delta', 'kpi_id=' + id);
      dl.append(num, SK.el('span', 'sk-muted', (r.unit === '%' ? ' п.п.' : ' ' + r.unit) + ' за місяць (' + SK.month(r.month) + ')'));
      el.append(dl);
    }
    const sp = SK.el('div', 'sk-chart'); sp.style.marginTop = '8px'; el.append(sp);
    SK.line(sp, {series: SK.series(m.data, id), target: r.target, unit: r.unit, targetLabel: r.target_label, compact: true,
      label: r.name + ': тренд за 12 місяців проти цілі'});
    el.append(SK.el('div', 'sk-line sk-muted', 'Власник: ' + r.owner));
  });
  dash.draw('tile-incidents', el => {
    const k = dash.data('incidents_latest');
    if (!SK.ready(el, [k])) return;
    const r = k.data[0];
    if (!r) { el.textContent = 'Повідомлень не було.'; return; }
    el.replaceChildren();
    const row = SK.el('div', 'sk-valrow');
    const big = SK.mark(SK.el('span', 'sk-big', SK.f1(r.pct)), 'incidents_latest', 'pct', null); big.setAttribute('data-row', '0');
    row.append(big, SK.el('span', 'sk-unit', '%'));
    el.append(row);
    const st = SK.el('div', 'sk-line'); st.append(SK.statusEl(r.pct >= 100 ? 'green' : 'red', 0)); el.append(st);
    const tg = SK.el('div', 'sk-line sk-muted', 'Ціль 100% етапів вчасно (24 год / 72 год / 1 міс.)');
    tg.append(SK.el('span', 'sk-tag', 'Д')); el.append(tg);
    const d = SK.el('div', 'sk-line sk-muted');
    const a = SK.mark(SK.el('span', null, SK.fi(r.on_time)), 'incidents_latest', 'on_time', null); a.setAttribute('data-row', '0');
    const b = SK.mark(SK.el('span', null, SK.fi(r.due)), 'incidents_latest', 'due', null); b.setAttribute('data-row', '0');
    d.append(SK.quarter(r.quarter) + ': вчасно ', a, ' з ', b, ' етапів');
    if (r.prev_quarter) {
      const pp = SK.mark(SK.el('span', null, SK.f1(r.prev_pct)), 'incidents_latest', 'prev_pct', null); pp.setAttribute('data-row', '0');
      d.append('; ' + SK.quarter(r.prev_quarter) + ': ', pp, '%');
    }
    el.append(d);
    el.append(SK.el('div', 'sk-line sk-muted', 'Власник: CISO + юридичний відділ'));
  });

  // ---------- Risk scenarios (bullet-style) ----------
  dash.draw('risk', el => {
    const d = dash.data('risk_scenarios');
    if (!SK.ready(el, [d])) return;
    el.replaceChildren();
    const rows = d.data.map(r => ({s: r.scenario, med: +r.ale_median, p90: +r.ale_p90, app: +r.appetite, tol: +r.tolerance}));
    const W = Math.max(280, el.clientWidth), rowH = 52, m = {t: 4, r: 16, b: 26, l: 8};
    const H = m.t + rows.length * rowH + m.b;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', 'Очікувані річні втрати за 5 сценаріями ризику порівняно з апетитом і толерантністю');
    const max = d3.max(rows, r => Math.max(r.p90, r.tol)) * 1.05;
    const x = d3.scaleLinear().domain([0, max]).range([m.l, W - m.r]).nice();
    const xmax = x.domain()[1];
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')')
      .call(d3.axisBottom(x).ticks(W < 420 ? 4 : 6).tickFormat(SK.f1).tickSize(0).tickPadding(8))
      .call(g => g.select('.domain').remove());
    const tip = SK.tip(el);
    rows.forEach((r, i) => {
      const y0 = m.t + i * rowH, by = y0 + 22, bh = 16;
      const status = r.med > r.tol ? 'red' : r.med > r.app ? 'amber' : 'green';
      const st = SK.STATUS[status];
      const g = svg.append('g');
      g.append('text').attr('x', m.l).attr('y', y0 + 13).text(r.s).style('fill', 'var(--color-fg)').style('font-size', 'var(--cds-font-size-caption)');
      const stt = g.append('text').attr('x', W - m.r).attr('y', y0 + 13).attr('text-anchor', 'end').text(st.icon + ' ' + st.text)
        .style('font-size', 'var(--cds-font-size-caption)').style('fill', status === 'green' ? 'var(--color-ok)' : status === 'amber' ? 'var(--color-warn)' : 'var(--color-bad)');
      g.append('rect').attr('x', x(0)).attr('y', by).attr('width', x(r.app) - x(0)).attr('height', bh).style('fill', 'var(--color-fg)').style('opacity', 0.06);
      g.append('rect').attr('x', x(r.app)).attr('y', by).attr('width', x(r.tol) - x(r.app)).attr('height', bh).style('fill', 'var(--color-fg)').style('opacity', 0.13);
      g.append('rect').attr('x', x(r.tol)).attr('y', by).attr('width', Math.max(0, x(xmax) - x(r.tol))).attr('height', bh).style('fill', 'var(--color-fg)').style('opacity', 0.22);
      g.append('line').attr('x1', x(r.med)).attr('x2', x(r.p90)).attr('y1', by + bh / 2).attr('y2', by + bh / 2).style('stroke', dash.colors[0]).style('stroke-width', 2);
      g.append('line').attr('x1', x(r.p90)).attr('x2', x(r.p90)).attr('y1', by + 4).attr('y2', by + bh - 4).style('stroke', dash.colors[0]).style('stroke-width', 2);
      g.append('circle').attr('cx', x(r.med)).attr('cy', by + bh / 2).attr('r', 5.5).style('fill', dash.colors[0]).style('stroke', 'var(--color-panel)').style('stroke-width', 1.5);
      g.append('rect').attr('x', m.l).attr('y', y0).attr('width', W - m.l - m.r).attr('height', rowH).style('fill', 'transparent')
        .on('pointermove', ev => {
          const [px, py] = d3.pointer(ev, el);
          tip.show([r.s, 'Медіана: ' + SK.f1(r.med) + ' млн $ · P90: ' + SK.f1(r.p90) + ' млн $', 'Апетит: ' + SK.f1(r.app) + ' · толерантність: ' + SK.f1(r.tol), st.text], px, py);
        })
        .on('pointerleave', () => tip.hide());
    });
  });

  // ---------- Incidents by quarter ----------
  dash.draw('incidents', el => {
    const d = dash.data('incidents_quarterly');
    if (!SK.ready(el, [d])) return;
    el.replaceChildren();
    const rows = d.data.map(r => ({q: r.quarter, sig: +r.significant, mat: +r.material})).sort((a, b) => a.q < b.q ? -1 : 1);
    const W = Math.max(240, el.clientWidth), H = 200, m = {t: 18, r: 8, b: 24, l: 8};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', 'Кількість значних і суттєвих інцидентів за кварталами');
    const x = d3.scaleBand().domain(rows.map(r => r.q)).range([m.l, W - m.r]).padding(0.35);
    const y = d3.scaleLinear().domain([0, d3.max(rows, r => r.sig) || 1]).range([H - m.b, m.t]);
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')').call(d3.axisBottom(x).tickFormat(SK.quarter).tickSize(0).tickPadding(8))
      .call(g => g.select('.domain').style('stroke', 'var(--cds-chart-axis)'));
    const tip = SK.tip(el);
    rows.forEach(r => {
      svg.append('rect').attr('x', x(r.q)).attr('width', x.bandwidth()).attr('y', y(r.sig)).attr('height', y(0) - y(r.sig)).style('fill', dash.colors[0]);
      if (r.mat) svg.append('rect').attr('x', x(r.q)).attr('width', x.bandwidth()).attr('y', y(r.mat)).attr('height', y(0) - y(r.mat)).style('fill', dash.colors[1]);
      svg.append('text').attr('x', x(r.q) + x.bandwidth() / 2).attr('y', y(r.sig) - 5).attr('text-anchor', 'middle').attr('class', 'sk-axis').text(SK.fi(r.sig));
      svg.append('rect').attr('x', x(r.q)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent')
        .on('pointermove', ev => { const [px, py] = d3.pointer(ev, el); tip.show([SK.quarter(r.q), 'Значні: ' + SK.fi(r.sig), 'З них суттєві: ' + SK.fi(r.mat)], px, py); })
        .on('pointerleave', () => tip.hide());
    });
  });

  // ---------- KPI table ----------
  dash.draw('kpi-table', tb => {
    const k = dash.data('kpi_latest'), m = dash.data('kpi_monthly');
    if (k.status === 'error' || m.status === 'error') { const tr = document.createElement('tr'); const td = SK.el('td', 'sk-muted', 'Не вдалося завантажити дані.'); td.colSpan = 8; tr.append(td); tb.replaceChildren(tr); return; }
    if (k.status !== 'ok' || m.status !== 'ok') return;
    tb.replaceChildren();
    const sparks = [];
    k.data.forEach(r => {
      const tr = document.createElement('tr'); tr.setAttribute('data-key', r.kpi_id);
      if (r.status === 'red') tr.className = 'sk-row-flag';
      tr.append(SK.el('td', null, r.kpi_id), SK.el('td', null, r.name), SK.el('td', 'num', SK.withUnit(r.value, r.unit)));
      const tg = SK.el('td', null, r.target_label); tg.append(SK.el('span', 'sk-tag', r.target_tag)); tr.append(tg);
      const better = r.direction === 'higher' ? r.delta > 0 : r.delta < 0;
      tr.append(SK.el('td', 'num ' + (r.delta === 0 || r.delta == null ? 'sk-muted' : better ? 'sk-ok' : 'sk-bad'), SK.signed(r.delta)));
      const sc = SK.el('td', 'spark'); const box = SK.el('div', 'sk-chart'); sc.append(box); tr.append(sc);
      sparks.push([box, r]);
      const st = SK.el('td'); st.append(SK.statusEl(r.status, r.worsening)); tr.append(st);
      tr.append(SK.el('td', null, r.owner));
      tb.append(tr);
    });
    sparks.forEach(([box, r]) => SK.line(box, {series: SK.series(m.data, r.kpi_id), target: r.target, unit: r.unit, targetLabel: r.target_label, compact: true, label: r.name + ': тренд за 12 місяців'}));
  });

  // ---------- Units ----------
  const UNIT_MAP = {mfa: {kpi: 'K03', label: 'MFA на критичних системах'}, patch14: {kpi: 'K04a', label: 'Патчі CVSS ≥ 7 за 14 днів'}, training: {kpi: 'K09', label: 'Навчання за 12 місяців'}};
  SK.unitMetric = 'mfa';
  dash.draw('units', el => {
    const d = dash.data('by_unit'), c = dash.data('kpi_catalog');
    if (!SK.ready(el, [d, c])) return;
    el.replaceChildren();
    const key = SK.unitMetric, map = UNIT_MAP[key];
    const cat = c.data.find(r => r.kpi_id === map.kpi);
    const target = cat ? +cat.target : null;
    const rows = d.data.map(r => ({u: r.unit, v: +r[key]})).sort((a, b) => b.v - a.v);
    const W = Math.max(260, el.clientWidth), rowH = 30, m = {t: 6, r: 70, b: 22};
    const svgTmp = d3.select(el).append('svg');
    m.l = SK.textWidth(svgTmp, rows.map(r => r.u)) + 12; svgTmp.remove();
    const H = m.t + rows.length * rowH + m.b;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', map.label + ' за підрозділами, з лінією цілі');
    const lo = Math.max(0, Math.floor((d3.min(rows, r => r.v) - 10) / 10) * 10);
    const x = d3.scaleLinear().domain([lo, 100]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(rows.map(r => r.u)).range([m.t, H - m.b]).padding(0.3);
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')').call(d3.axisBottom(x).ticks(4).tickFormat(v => SK.f1(v) + '%').tickSize(0).tickPadding(6))
      .call(g => g.select('.domain').remove());
    const tip = SK.tip(el);
    rows.forEach(r => {
      svg.append('text').attr('x', m.l - 8).attr('y', y(r.u) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'sk-axis').style('fill', 'var(--color-fg)').text(r.u);
      svg.append('rect').attr('x', x(lo)).attr('y', y(r.u)).attr('width', Math.max(0, x(r.v) - x(lo))).attr('height', y.bandwidth()).style('fill', dash.colors[0]);
      const below = target != null && r.v < target;
      svg.append('text').attr('x', x(r.v) + 6).attr('y', y(r.u) + y.bandwidth() / 2).attr('dy', '0.35em').attr('class', 'sk-axis')
        .style('fill', below ? 'var(--color-bad)' : 'var(--color-fg)').text(SK.f1(r.v) + '%' + (below ? ' ▼' : ''));
      svg.append('rect').attr('x', m.l).attr('y', y(r.u)).attr('width', W - m.l).attr('height', y.bandwidth()).style('fill', 'transparent')
        .on('pointermove', ev => { const [px, py] = d3.pointer(ev, el); tip.show([r.u, map.label + ': ' + SK.f1(r.v) + '%', target != null ? (below ? 'Нижче цілі ' : 'Досягає цілі ') + SK.f1(target) + '%' : ''], px, py); })
        .on('pointerleave', () => tip.hide());
    });
    if (target != null) {
      svg.append('line').attr('x1', x(target)).attr('x2', x(target)).attr('y1', m.t - 2).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '2 3').style('stroke-width', 1.5);
    }
  });
  document.querySelectorAll('#unit-metric').forEach(sel => sel.addEventListener('change', () => { SK.unitMetric = sel.value; dash.draw('units'); }));

  // ---------- CSF profile ----------
  dash.draw('csf', el => {
    const d = dash.data('csf_profile');
    if (!SK.ready(el, [d])) return;
    el.replaceChildren();
    const rows = d.data.map(r => ({f: r.function, n: r.name, c: +r.current, t: +r.target}));
    const W = Math.max(260, el.clientWidth), rowH = 30, m = {t: 6, r: 16, b: 24};
    const tmp = d3.select(el).append('svg'); m.l = SK.textWidth(tmp, rows.map(r => r.n)) + 12; tmp.remove();
    if (m.l > W * 0.55) { rows.forEach(r => r.n = r.f); const t2 = d3.select(el).append('svg'); m.l = SK.textWidth(t2, rows.map(r => r.n)) + 12; t2.remove(); }
    const H = m.t + rows.length * rowH + m.b;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', 'Поточний і цільовий рівень зрілості за функціями NIST CSF 2.0');
    const x = d3.scaleLinear().domain([1, 4]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(rows.map(r => r.f)).range([m.t, H - m.b]);
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')').call(d3.axisBottom(x).ticks(4).tickFormat(v => 'рівень ' + v).tickSize(-(H - m.t - m.b)).tickPadding(6))
      .call(g => g.select('.domain').remove());
    rows.forEach(r => {
      const cy = y(r.f) + y.bandwidth() / 2;
      svg.append('text').attr('x', m.l - 8).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'sk-axis').style('fill', 'var(--color-fg)').text(r.n);
      svg.append('line').attr('x1', x(r.c)).attr('x2', x(r.t)).attr('y1', cy).attr('y2', cy).style('stroke', dash.colors[0]).style('stroke-width', 2).style('opacity', 0.5);
      svg.append('circle').attr('cx', x(r.t)).attr('cy', cy).attr('r', 6).style('fill', 'var(--color-panel)').style('stroke', dash.colors[0]).style('stroke-width', 2);
      svg.append('circle').attr('cx', x(r.c)).attr('cy', cy).attr('r', 6).style('fill', dash.colors[0]);
    });
  });

  // ---------- SOC line charts ----------
  dash.draw('line', el => {
    const id = el.getAttribute('data-kpi');
    const m = dash.data('kpi_monthly'), c = dash.data('kpi_catalog');
    if (!SK.ready(el, [m, c])) return;
    const cat = c.data.find(r => r.kpi_id === id);
    const s = SK.series(m.data, id);
    SK.line(el, {series: s, target: cat ? +cat.target : null, targetLabel: cat ? cat.target_label : null, unit: cat ? cat.unit : '',
      p90: s.some(d => d.p90 != null), zero: false, label: (cat ? cat.name : id) + ': 12 місяців проти цілі'});
  });

  // ---------- MDR SLA ----------
  const SLA = 90;
  dash.draw('sla-target', el => { el.textContent = SK.fi(SLA); });
  dash.draw('sla-breaches', el => {
    const s = dash.data('mdr_summary');
    el.textContent = s.status === 'ok' && s.data && s.data[0] ? SK.fi(s.data[0].breaches) : '—';
  });
  dash.draw('mdr', el => {
    const d = dash.data('soc_diag');
    if (!SK.ready(el, [d])) return;
    el.replaceChildren();
    const rows = d.data.map(r => ({mo: r.month, v: +r.mdr_sla_pct})).sort((a, b) => a.mo < b.mo ? -1 : 1).slice(-12);
    const W = Math.max(260, el.clientWidth), H = 200;
    const tmp = d3.select(el).append('svg'); const ml = SK.textWidth(tmp, ['100%']) + 10; tmp.remove();
    const m = {t: 10, r: 8, b: 24, l: ml};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', 'Частка пріоритетних кейсів з реакцією до 60 хвилин за місяцями, проти SLA 90%');
    const x = d3.scaleBand().domain(rows.map(r => r.mo)).range([m.l, W - m.r]).padding(0.25);
    const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
    svg.append('g').attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).tickValues([0, 50, 100]).tickFormat(v => v + '%').tickSize(-(W - m.l - m.r))).call(g => g.select('.domain').remove());
    const every = W < 380 ? 3 : 2;
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')').call(d3.axisBottom(x).tickValues(rows.map(r => r.mo).filter((v, i, a) => (a.length - 1 - i) % every === 0)).tickFormat(SK.month).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
    const tip = SK.tip(el);
    rows.forEach(r => {
      const bad = r.v < SLA;
      svg.append('rect').attr('x', x(r.mo)).attr('width', x.bandwidth()).attr('y', y(r.v)).attr('height', y(0) - y(r.v))
        .style('fill', bad ? 'var(--cds-chart-status-critical)' : dash.colors[0]);
      if (bad) svg.append('text').attr('x', x(r.mo) + x.bandwidth() / 2).attr('y', y(r.v) - 4).attr('text-anchor', 'middle').attr('class', 'sk-axis').text(SK.fi(r.v));
      svg.append('rect').attr('x', x(r.mo)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent')
        .on('pointermove', ev => { const [px, py] = d3.pointer(ev, el); tip.show([SK.month(r.mo), 'Вчасно: ' + SK.fi(r.v) + '%', bad ? 'Порушення SLA (' + SLA + '%)' : 'SLA виконано'], px, py); })
        .on('pointerleave', () => tip.hide());
    });
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(SLA)).attr('y2', y(SLA)).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '2 3').style('stroke-width', 1.5);
  });

  // ---------- Diagnostics table ----------
  dash.draw('diag-table', tb => {
    const d = dash.data('soc_diag');
    if (d.status === 'error') { const tr = document.createElement('tr'); const td = SK.el('td', 'sk-muted', 'Не вдалося завантажити дані.'); td.colSpan = 4; tr.append(td); tb.replaceChildren(tr); return; }
    if (d.status !== 'ok') return;
    tb.replaceChildren(...d.data.slice().sort((a, b) => a.month < b.month ? 1 : -1).map(r => {
      const tr = document.createElement('tr'); tr.setAttribute('data-key', r.month);
      tr.append(SK.el('td', null, SK.month(r.month)), SK.el('td', 'num', SK.fi(+r.alerts)), SK.el('td', 'num', SK.f1(+r.false_positive_pct)), SK.el('td', 'num', SK.f1(+r.reopened_pct)));
      return tr;
    }));
  });

  // ---------- Passport ----------
  dash.draw('passport-table', tb => {
    const c = dash.data('kpi_catalog');
    if (c.status === 'error') { const tr = document.createElement('tr'); const td = SK.el('td', 'sk-muted', 'Не вдалося завантажити дані.'); td.colSpan = 14; tr.append(td); tb.replaceChildren(tr); return; }
    if (c.status !== 'ok') return;
    const cols = ['kpi_id', 'name', 'definition', 'denominator', 'target_label', 'target_tag', 'target_source', 'rag_rule', 'freq', 'owner', 'data_source', 'nist_type', 'lead_lag', 'level'];
    tb.replaceChildren(...c.data.map(r => {
      const tr = document.createElement('tr'); tr.setAttribute('data-key', r.kpi_id);
      cols.forEach(k => tr.append(SK.el('td', null, r[k])));
      return tr;
    }));
  });

  // ---------- Tracker ----------
  [['rem-open', 'open', 'i'], ['rem-overdue', 'overdue', 'i'], ['rem-pct', 'overdue_pct', '1'], ['rem-crit', 'overdue_critical', 'i']].forEach(([name, f, t]) => {
    dash.draw(name, el => {
      const s = dash.data('remediation_summary');
      el.textContent = s.status === 'ok' && s.data && s.data[0] ? (t === 'i' ? SK.fi(s.data[0][f]) : SK.f1(s.data[0][f])) : '—';
    });
  });
  dash.draw('rem-asof', el => { el.textContent = SK.AS_OF.split('-').reverse().join('.'); });
  dash.draw('rem-table', tb => {
    const d = dash.data('remediation_view');
    if (d.status === 'error') { const tr = document.createElement('tr'); const td = SK.el('td', 'sk-muted', 'Не вдалося завантажити дані.'); td.colSpan = 7; tr.append(td); tb.replaceChildren(tr); return; }
    if (d.status !== 'ok' || !d.data) return;
    tb.replaceChildren(...d.data.map(r => {
      const tr = document.createElement('tr'); tr.setAttribute('data-key', r.finding_id);
      const od = r.days_left < 0;
      if (od) tr.className = 'sk-row-flag';
      tr.append(SK.el('td', null, r.finding_id), SK.el('td', null, r.finding), SK.el('td', null, r.origin),
        SK.el('td', r.severity === 'Критична' ? 'sk-bad' : null, r.severity), SK.el('td', null, r.owner), SK.el('td', null, r.stage),
        SK.el('td', null, r.due.split('-').reverse().join('.')),
        SK.el('td', 'num ' + (od ? 'sk-bad' : ''), (od ? '\u2212' : '') + SK.fi(Math.abs(r.days_left))));
      return tr;
    }));
  });
})();
