const BOARD_KPIS = ['K03', 'K04b', 'K08a', 'K10', 'K11', 'K07', 'K13'];
dash.calc('risk_view', {
  title: 'Сценарії ризику з висновком',
  description: 'Кожен сценарій зі статусом: найімовірніші річні втрати порівняно з нормою (апетит) і максимумом (толерантність), які встановила рада',
  inputs: ['risk_scenarios'],
  fn: (scenarios) => scenarios.map(r => {
    const med = +r.ale_median, app = +r.appetite, tol = +r.tolerance;
    return {scenario: r.scenario, ale_median: med, ale_p90: +r.ale_p90, appetite: app, tolerance: tol,
      status: med > tol ? 'red' : med > app ? 'amber' : 'green'};
  }).sort((a, b) => b.ale_median - a.ale_median)
});
dash.calc('board_summary', {
  title: 'Підсумок для ради',
  description: 'Скільки сценаріїв ризику вийшли за межі ради і скільки з 7 показників захисту для ради в нормі',
  inputs: ['risk_view', 'kpi_latest'],
  fn: (risks, latest) => {
    const k = latest.filter(r => BOARD_KPIS.includes(r.kpi_id));
    return [{
      risk_red: risks.filter(r => r.status === 'red').length,
      risk_amber: risks.filter(r => r.status === 'amber').length,
      risk_total: risks.length,
      kpi_green: k.filter(r => r.status === 'green').length,
      kpi_amber: k.filter(r => r.status === 'amber').length,
      kpi_red: k.filter(r => r.status === 'red').length,
      kpi_total: k.length
    }];
  }
});
dash.calc('incidents_now', {
  title: 'Інциденти поточного кварталу',
  description: 'Значні й суттєві інциденти та вчасність регуляторних повідомлень в останньому кварталі',
  inputs: ['incidents_quarterly'],
  fn: (quarters) => {
    const q = quarters.slice().sort((a, b) => a.quarter < b.quarter ? -1 : 1).pop();
    return q ? [{quarter: q.quarter, significant: +q.significant, material: +q.material, due: +q.notif_due, on_time: +q.notif_on_time}] : [];
  }
});

(function(){
  const SK = window.SK;
  const money = d3.formatLocale({decimal: ',', thousands: '\u00a0', grouping: [3], currency: ['', '']}).format(',.1f');
  dash.draw('b-num', el => {
    const d = dash.data(el.getAttribute('data-source'));
    const f = el.getAttribute('data-field'), where = el.getAttribute('data-where');
    if (d.status !== 'ok' || !Array.isArray(d.data)) { el.textContent = '—'; return; }
    let row = d.data[0];
    if (where) { const i = where.indexOf('='); const k = where.slice(0, i), v = where.slice(i + 1); row = d.data.find(r => String(r[k]) === v); }
    if (!row || row[f] == null) { el.textContent = '—'; return; }
    el.textContent = el.getAttribute('data-fmt') === 'i' ? SK.fi(+row[f]) : SK.f1(+row[f]);
  });
  dash.draw('b-top-risk', el => {
    const d = dash.data('risk_view');
    if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
    const red = d.data.filter(r => r.status === 'red').map(r => '«' + r.scenario + '»');
    el.textContent = red.length
      ? 'Найгостріше: ' + red.join(', ') + ': ймовірні втрати вищі за граничну суму, тому потрібне рішення ради (див. блок 4).'
      : 'Жоден сценарій не загрожує втратами понад граничну суму.';
  });
  const PLAIN = {green: ['sk-ok', '✓ У нормі'], amber: ['sk-warn', '◐ Майже в нормі'], red: ['sk-bad', '✕ Потребує уваги']};
  dash.draw('q-status', el => {
    const ids = el.getAttribute('data-kpi').split(' '), labels = (el.getAttribute('data-label') || '').split('|');
    const k = dash.data('kpi_latest'), m = dash.data('kpi_monthly');
    if (!SK.ready(el, [k, m])) return;
    el.replaceChildren();
    ids.forEach((id, i) => {
      const r = k.data.find(x => x.kpi_id === id);
      if (!r) return;
      const line = SK.el('div');
      if (labels[i]) line.append(SK.el('span', 'sk-muted', labels[i] + ': '));
      const p = PLAIN[r.status] || ['', '—'];
      line.append(SK.el('span', p[0], p[1]));
      const s = SK.series(m.data, id);
      if (r.worsening >= 3) line.append(SK.el('span', 'sk-warn', ' · ⚠ погіршується ' + r.worsening + ' міс. поспіль'));
      else if (s.length >= 4) {
        const a = s[s.length - 4].value, b = s[s.length - 1].value;
        const better = r.direction === 'higher' ? b > a : b < a;
        line.append(SK.el('span', 'sk-muted', a === b ? ' · без змін за 3 міс.' : better ? ' · покращується за 3 міс.' : ' · погіршилось за 3 міс.'));
      }
      el.append(line);
    });
  });
  dash.draw('q-spark', el => {
    const id = el.getAttribute('data-kpi');
    const k = dash.data('kpi_latest'), m = dash.data('kpi_monthly');
    if (!SK.ready(el, [k, m])) return;
    const r = k.data.find(x => x.kpi_id === id);
    if (!r) { el.textContent = '—'; return; }
    SK.line(el, {series: SK.series(m.data, id), target: r.target, unit: r.unit, targetLabel: r.target_label, compact: true,
      label: r.name + ': як змінювалось за 12 місяців проти мети'});
  });
  const VERDICT = {red: ['sk-bad', '✕ Понад граничну суму — потрібне рішення ради'], amber: ['sk-warn', '◐ Понад прийнятну суму — потрібен план дій'], green: ['sk-ok', '✓ У межах прийнятного']};
  dash.draw('risk-table', tb => {
    const d = dash.data('risk_view');
    if (d.status === 'error') { const tr = document.createElement('tr'); const td = SK.el('td', 'sk-muted', 'Не вдалося завантажити дані.'); td.colSpan = 6; tr.append(td); tb.replaceChildren(tr); return; }
    if (d.status !== 'ok' || !d.data) return;
    tb.replaceChildren(...d.data.map(r => {
      const tr = document.createElement('tr');
      if (r.status === 'red') tr.className = 'sk-row-flag';
      const v = VERDICT[r.status];
      tr.append(SK.el('td', null, r.scenario), SK.el('td', 'num', money(r.ale_median)), SK.el('td', 'num', money(r.ale_p90)),
        SK.el('td', 'num', money(r.appetite)), SK.el('td', 'num', money(r.tolerance)), SK.el('td', v[0], v[1]));
      return tr;
    }));
  });
  dash.draw('inc-quarter', el => {
    const d = dash.data('incidents_now');
    el.textContent = d.status === 'ok' && d.data && d.data[0] ? SK.quarter(d.data[0].quarter) : '—';
  });
})();
