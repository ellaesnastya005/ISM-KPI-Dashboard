const KB_STAGES = ['Треба зробити', 'Цього тижня', 'В роботі', 'Перевірка', 'Готово'];
const KB_SEV = ['Критична', 'Висока', 'Середня', 'Низька'];
dash.calc('kanban_counts', {
  title: 'Скільки карток у кожній колонці дошки',
  description: 'Кількість знахідок на кожному етапі і кількість ще не закритих знахідок за критичністю',
  inputs: ['remediation_board'],
  fn: (board) => [
    ...KB_STAGES.map(s => ({by: 'stage', column: s, count: board.filter(r => r.stage === s).length})),
    ...KB_SEV.map(s => ({by: 'severity', column: s, count: board.filter(r => r.stage !== 'Готово' && r.severity === s).length}))
  ]
});

(function(){
  const SK = window.SK;
  const SEV_CLS = {'Критична': 'sk-bad', 'Висока': 'sk-warn'};
  const PATH = 'data/team/remediation_status/';
  const fmtDate = d => String(d).split('-').reverse().join('.');
  const showSaved = ok => document.querySelectorAll('#kanban-unsaved').forEach(p => { p.hidden = ok; });
  async function saveStage(id, stage) {
    let ok = true;
    try { const db = await claude.use('db'); await db.doc(PATH + id).set({stage: stage, at: new Date().toISOString()}); }
    catch (e) { ok = false; }
    showSaved(ok);
  }
  SK.kanbanGroup = 'stage';
  dash.draw('kanban', el => {
    const b = dash.data('remediation_board'), c = dash.data('kanban_counts');
    if (!SK.ready(el, [b, c])) return;
    el.replaceChildren();
    const by = SK.kanbanGroup;
    const cols = by === 'stage' ? KB_STAGES : KB_SEV;
    const rank = s => KB_SEV.indexOf(s);
    cols.forEach(col => {
      const items = b.data
        .filter(r => by === 'stage' ? r.stage === col : (r.stage !== 'Готово' && r.severity === col))
        .sort((x, y) => (by === 'stage' ? rank(x.severity) - rank(y.severity) : 0) || (x.due < y.due ? -1 : x.due > y.due ? 1 : 0));
      const colEl = SK.el('div', 'sk-kcol');
      const head = SK.el('div', 'sk-khead');
      head.append(SK.el('span', null, col));
      const cnt = c.data.find(r => r.by === by && r.column === col);
      head.append(SK.mark(SK.el('span', 'sk-kcount', SK.fi(cnt ? cnt.count : 0)), 'kanban_counts', 'count', 'by=' + by + '&column=' + col));
      colEl.append(head);
      if (!items.length) colEl.append(SK.el('p', 'sk-muted sk-kempty', 'Порожньо'));
      items.forEach(r => {
        const done = r.stage === 'Готово', late = !done && r.days_left < 0;
        const card = SK.el('div', 'sk-kcard' + (late ? ' is-overdue' : ''));
        const top = SK.el('div', 'sk-ktop');
        top.append(SK.el('span', 'sk-muted', r.finding_id), SK.el('span', SEV_CLS[r.severity] || 'sk-muted', r.severity));
        card.append(top, SK.el('div', 'sk-ktitle', r.finding), SK.el('div', 'sk-muted', r.owner + ' · ' + r.origin));
        const due = SK.el('div', late ? 'sk-bad' : 'sk-muted', 'До ' + fmtDate(r.due));
        if (done) due.append(' · закрито');
        else if (late) { due.append(' · прострочено на '); due.append(SK.mark(SK.el('span', null, SK.fi(r.overdue_days)), 'remediation_board', 'overdue_days', 'finding_id=' + r.finding_id)); due.append(' дн.'); }
        else { due.append(' · лишилось '); due.append(SK.mark(SK.el('span', null, SK.fi(r.days_left)), 'remediation_board', 'days_left', 'finding_id=' + r.finding_id)); due.append(' дн.'); }
        card.append(due);
        const lab = SK.el('label', 'sk-kmove');
        lab.append(SK.el('span', 'sk-muted', 'Етап:'));
        const sel = document.createElement('select');
        sel.className = 'dash-select sk-ksel';
        sel.setAttribute('aria-label', 'Етап знахідки ' + r.finding_id);
        KB_STAGES.forEach(s => sel.append(new Option(s, s)));
        sel.value = r.stage;
        sel.addEventListener('change', () => saveStage(r.finding_id, sel.value));
        lab.append(sel);
        card.append(lab);
        colEl.append(card);
      });
      el.append(colEl);
    });
    if (by === 'severity') {
      const d = c.data.find(r => r.by === 'stage' && r.column === 'Готово');
      const note = SK.el('p', 'sk-muted sk-knote', 'Тут лише незакриті знахідки. Готові (');
      note.append(SK.mark(SK.el('span', null, SK.fi(d ? d.count : 0)), 'kanban_counts', 'count', 'by=stage&column=Готово'), ') видно в групуванні за етапом.');
      el.append(note);
    }
  });
  document.querySelectorAll('[data-group]').forEach(btn => btn.addEventListener('click', () => {
    SK.kanbanGroup = btn.getAttribute('data-group');
    document.querySelectorAll('[data-group]').forEach(o => { const on = o === btn; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    dash.draw('kanban');
  }));
  document.querySelectorAll('#kanban-reset').forEach(btn => btn.addEventListener('click', async () => {
    const b = dash.data('remediation_board');
    if (b.status !== 'ok' || !b.data) return;
    let ok = true;
    try { const db = await claude.use('db'); await Promise.all(b.data.filter(r => r.moved).map(r => db.doc(PATH + r.finding_id).delete())); }
    catch (e) { ok = false; }
    showSaved(ok);
  }));
})();
