  const L = d3.formatLocale({decimal: ',', thousands: ' ', grouping: [3], currency: ['', '']});
  const f1 = L.format(',.1~f'), fi = L.format(',d');
  const MON = ['січ','лют','бер','квіт','трав','черв','лип','серп','вер','жовт','лист','груд'];
  const SK = window.SK = {};
  SK.f1 = v => (v == null || isNaN(v)) ? '—' : f1(v);
  SK.fi = v => (v == null || isNaN(v)) ? '—' : fi(v);
  SK.signed = v => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f1(Math.abs(v));
  SK.withUnit = (v, u) => SK.f1(v) + (u === '%' ? '%' : u ? ' ' + u : '');
  SK.month = m => { const p = String(m).split('-'); return MON[+p[1] - 1] + ' ' + p[0].slice(2); };
  SK.quarter = q => { const p = String(q).split('-Q'); return ['I','II','III','IV'][+p[1] - 1] + ' кв. ' + p[0].slice(2); };
  SK.num = v => (v === '' || v == null) ? null : +v;
  SK.el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  SK.mark = (e, src, field, where) => { e.setAttribute('data-source', src); e.setAttribute('data-field', field); if (where) e.setAttribute('data-where', where); return e; };
  SK.STATUS = {
    green: {cls: 'sk-ok', icon: '✓', text: 'У межах цілі'},
    amber: {cls: 'sk-warn', icon: '◐', text: 'Близько до цілі'},
    red: {cls: 'sk-bad', icon: '✕', text: 'Поза ціллю'}
  };
  SK.statusEl = (s, worsening) => {
    const st = SK.STATUS[s] || {cls: '', icon: '', text: '—'};
    const span = SK.el('span', st.cls, st.icon + ' ' + st.text);
    if (worsening >= 3) {
      const w = SK.el('span', 'sk-warn', ' · ⚠ погіршується ' + worsening + ' міс. поспіль');
      const box = SK.el('span'); box.append(span, w); return box;
    }
    return span;
  };
  // Shared state handling: returns true when every result is ok.
  SK.ready = (el, results) => {
    if (results.some(r => r.status === 'error')) {
      el.classList.remove('dash-skeleton');
      el.replaceChildren(SK.el('span', 'sk-muted', 'Не вдалося завантажити дані для цього блоку.'));
      return false;
    }
    if (results.some(r => r.status !== 'ok')) {
      if (results.some(r => r.status === 'loading')) el.classList.add('dash-skeleton');
      else el.classList.remove('dash-skeleton');
      if (!el.firstChild && el.tagName !== 'TBODY') el.textContent = '—';
      return false;
    }
    el.classList.remove('dash-skeleton');
    return true;
  };
  SK.series = (rows, id) => rows.filter(r => r.kpi_id === id)
    .map(r => ({month: r.month, value: +r.value, p90: SK.num(r.p90)}))
    .sort((a, b) => a.month < b.month ? -1 : 1);
  SK.tip = (host) => {
    const t = SK.el('div', 'sk-tip'); t.hidden = true; host.appendChild(t);
    return {
      show(lines, x, y) {
        t.replaceChildren(...lines.filter(l => l).map(l => SK.el('div', null, l)));
        t.hidden = false;
        const hw = host.clientWidth, tw = t.offsetWidth;
        let left = x + 12; if (left + tw > hw) left = Math.max(0, x - tw - 12);
        t.style.left = left + 'px'; t.style.top = Math.max(0, y - 10) + 'px';
      },
      hide() { t.hidden = true; }
    };
  };
  SK.textWidth = (svg, strings) => {
    let w = 0;
    strings.forEach(s => { const t = svg.append('text').attr('class', 'sk-axis').text(s); w = Math.max(w, t.node().getComputedTextLength()); t.remove(); });
    return w;
  };
  // Line chart; compact = sparkline.
  SK.line = (host, o) => {
    host.replaceChildren();
    const W = Math.max(120, host.clientWidth || 200), H = o.compact ? 44 : 200;
    const svg = d3.select(host).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img').attr('aria-label', o.label || 'Графік');
    const s = o.series;
    if (!s.length) return;
    const vals = s.flatMap(d => [d.value, d.p90]).filter(v => v != null);
    if (o.target != null) vals.push(o.target);
    let lo = d3.min(vals), hi = d3.max(vals);
    if (o.zero) lo = 0;
    const padv = (hi - lo) * 0.1 || 1; lo = o.zero ? 0 : lo - padv; hi = hi + padv;
    if (!o.zero && d3.min(vals) >= 0 && lo < 0) lo = 0;
    const y = d3.scaleLinear().domain([lo, hi]);
    if (!o.compact) y.nice(4);
    const ticks = y.ticks(4);
    const ml = o.compact ? 3 : SK.textWidth(svg, ticks.map(SK.f1)) + 10;
    const m = o.compact ? {t: 4, r: 4, b: 4, l: 3} : {t: 10, r: 12, b: 24, l: ml};
    y.range([H - m.b, m.t]);
    const x = d3.scalePoint().domain(s.map(d => d.month)).range([m.l, W - m.r]);
    if (!o.compact) {
      svg.append('g').attr('transform', 'translate(' + m.l + ',0)')
        .call(d3.axisLeft(y).tickValues(ticks).tickFormat(SK.f1).tickSize(-(W - m.l - m.r)))
        .call(g => g.select('.domain').remove());
      const every = W < 380 ? 3 : 2;
      const labels = s.map(d => d.month).filter((d, i, a) => (a.length - 1 - i) % every === 0);
      svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')')
        .call(d3.axisBottom(x).tickValues(labels).tickFormat(SK.month).tickSize(0).tickPadding(8))
        .call(g => g.select('.domain').remove());
    }
    if (o.target != null) {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(o.target)).attr('y2', y(o.target))
        .style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '2 3').style('stroke-width', 1.5);
    }
    const ln = d3.line().x(d => x(d.month)).y(d => y(d.v));
    if (o.p90) {
      const p = s.filter(d => d.p90 != null).map(d => ({month: d.month, v: d.p90}));
      svg.append('path').datum(p).attr('d', ln).style('fill', 'none').style('stroke', dash.colors[1]).style('stroke-width', 1.5).style('stroke-dasharray', '4 3');
    }
    svg.append('path').datum(s.map(d => ({month: d.month, v: d.value}))).attr('d', ln)
      .style('fill', 'none').style('stroke', dash.colors[0]).style('stroke-width', o.compact ? 1.75 : 2);
    const last = s[s.length - 1];
    svg.append('circle').attr('cx', x(last.month)).attr('cy', y(last.value)).attr('r', 3).style('fill', dash.colors[0]);
    // tooltip
    const tip = SK.tip(host);
    const guide = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)').style('opacity', 0);
    svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', Math.max(1, W - m.l - m.r)).attr('height', H).style('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev);
        let best = s[0]; s.forEach(d => { if (Math.abs(x(d.month) - px) < Math.abs(x(best.month) - px)) best = d; });
        guide.attr('x1', x(best.month)).attr('x2', x(best.month)).style('opacity', 1);
        const lines = [SK.month(best.month) + ': ' + SK.withUnit(best.value, o.unit)];
        if (best.p90 != null) lines.push('P90: ' + SK.withUnit(best.p90, o.unit));
        if (o.target != null) lines.push('Ціль: ' + (o.targetLabel || SK.withUnit(o.target, o.unit)));
        const r = host.getBoundingClientRect(), sv = svg.node().getBoundingClientRect();
        tip.show(lines, x(best.month) * (sv.width / W) + (sv.left - r.left), y(best.value) * (sv.height / H));
      })
      .on('pointerleave', () => { tip.hide(); guide.style('opacity', 0); });
  };

  // ---------- Calcs ----------
  dash.calc('kpi_latest', {
    title: 'Останні значення KPI і статус',
    description: 'Останній місяць кожної метрики, зміна до попереднього місяця, статус за правилом з паспорта і кількість місяців поспіль із погіршенням',
    inputs: ['kpi_monthly', 'kpi_catalog'],
    fn: (monthly, catalog) => catalog
      .filter(c => c.target !== '' && monthly.some(r => r.kpi_id === c.kpi_id))
      .map(c => {
        const s = monthly.filter(r => r.kpi_id === c.kpi_id).sort((a, b) => a.month < b.month ? -1 : 1);
        const last = s[s.length - 1], prev = s[s.length - 2];
        const v = +last.value, p = prev ? +prev.value : null;
        const t = +c.target, a = +c.amber_limit, higher = c.direction === 'higher';
        const status = higher ? (v >= t ? 'green' : v >= a ? 'amber' : 'red') : (v <= t ? 'green' : v <= a ? 'amber' : 'red');
        let worsening = 0;
        for (let i = s.length - 1; i > 0; i--) {
          const d = +s[i].value - +s[i - 1].value;
          if ((higher && d < 0) || (!higher && d > 0)) worsening++; else break;
        }
        return {
          kpi_id: c.kpi_id, name: c.name, unit: c.unit, direction: c.direction, month: last.month,
          value: v, p90: last.p90 === '' ? null : +last.p90, prev: p,
          delta: p == null ? null : Math.round((v - p) * 10) / 10,
          target: t, target_label: c.target_label, target_tag: c.target_tag, target_source: c.target_source,
          status, worsening, owner: c.owner
        };
      })
  });
  dash.calc('kpi_summary', {
    title: 'Скільки метрик у кожній зоні',
    description: 'Кількість операційних метрик у зеленій, жовтій і червоній зоні за останній місяць',
    inputs: ['kpi_latest'],
    fn: (latest) => [{
      green: latest.filter(r => r.status === 'green').length,
      amber: latest.filter(r => r.status === 'amber').length,
      red: latest.filter(r => r.status === 'red').length,
      total: latest.length
    }]
  });
  dash.calc('incidents_latest', {
    title: 'Вчасність повідомлень, останній квартал з повідомленнями',
    description: 'Частка вчасно поданих етапів регуляторних повідомлень в останньому кварталі, де вони були потрібні',
    inputs: ['incidents_quarterly'],
    fn: (rows) => {
      const r = rows.filter(x => +x.notif_due > 0).sort((a, b) => a.quarter < b.quarter ? -1 : 1);
      if (!r.length) return [];
      const last = r[r.length - 1], prev = r[r.length - 2];
      const pct = q => Math.round(+q.notif_on_time / +q.notif_due * 1000) / 10;
      return [{quarter: last.quarter, due: +last.notif_due, on_time: +last.notif_on_time, pct: pct(last),
        prev_quarter: prev ? prev.quarter : null, prev_pct: prev ? pct(prev) : null}];
    }
  });
  dash.calc('mdr_summary', {
    title: 'Порушення SLA провайдера MDR',
    description: 'Кількість місяців за останні 12, коли частка пріоритетних кейсів з реакцією до 60 хв була нижчою за договірні 90%',
    inputs: ['soc_diag'],
    fn: (rows) => [{breaches: rows.slice(-12).filter(r => +r.mdr_sla_pct < 90).length}]
  });
  const AS_OF = '2026-11-24';
  dash.calc('remediation_board', {
  title: 'Знахідки з поточним етапом',
  description: 'Усі знахідки з файлу; етап береться з останнього переміщення картки на дошці, якщо воно було, інакше з файлу; дні рахуються від дати зрізу 24.11.2026',
  inputs: ['remediation', 'remediation_moves'],
  fn: (findings, moves) => findings.map(r => {
    const m = moves.find(x => x.id === r.finding_id);
    const days = Math.round((Date.parse(r.due + 'T00:00:00Z') - Date.parse('2026-11-24T00:00:00Z')) / 86400000);
    return {finding_id: r.finding_id, finding: r.finding, origin: r.origin, severity: r.severity, owner: r.owner, due: r.due,
      stage: m && m.stage ? m.stage : r.stage, moved: !!m, days_left: days, overdue_days: days < 0 ? -days : 0};
  })
});
dash.calc('remediation_view', {
    title: 'Відкриті знахідки з днями до строку',
    description: 'Відкриті знахідки, відсортовані за цільовою датою, з кількістю днів до строку на дату зрізу 24.11.2026 (від’ємне — прострочено)',
    inputs: ['remediation_board'],
  fn: (board) => board.filter(r => r.stage !== 'Готово')
    .map(r => ({finding_id: r.finding_id, finding: r.finding, origin: r.origin, severity: r.severity, owner: r.owner, stage: r.stage, due: r.due, days_left: r.days_left}))
      .sort((a, b) => a.due < b.due ? -1 : 1)
  });
  dash.calc('remediation_summary', {
    title: 'Підсумок трекера усунення',
    description: 'Кількість відкритих і прострочених знахідок, частка прострочених і кількість прострочених критичних',
    inputs: ['remediation_view'],
    fn: (view) => {
      const od = view.filter(r => r.days_left < 0);
      return [{open: view.length, overdue: od.length,
        overdue_pct: view.length ? Math.round(od.length / view.length * 1000) / 10 : 0,
        overdue_critical: od.filter(r => r.severity === 'Критична').length}];
    }
  });
  SK.AS_OF = AS_OF;
