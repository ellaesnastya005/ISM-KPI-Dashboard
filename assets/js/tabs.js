(function () {
  const tabs = Array.from(document.querySelectorAll('.sk-tab'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  function openPanel(id, push) {
    if (!panels.some(p => p.getAttribute('data-panel') === id)) id = 'board';
    panels.forEach(p => { p.hidden = p.getAttribute('data-panel') !== id; });
    tabs.forEach(t => {
      const on = t.getAttribute('data-tab') === id;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    if (push) dash.setLink(id);
    window.SKRuntime.runAll();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => openPanel(t.getAttribute('data-tab'), true));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); openPanel(next.getAttribute('data-tab'), true);
    });
  });
  document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); openPanel(a.getAttribute('data-goto'), true);
    const top = document.getElementById('tabs'); if (top) top.scrollIntoView({block: 'start'});
  }));
  document.querySelectorAll('#print-btn').forEach(b => b.addEventListener('click', () => window.print()));
  let before = null;
  window.addEventListener('beforeprint', () => {
    if (before) return;
    before = panels.map(p => p.hidden);
    panels.forEach(p => { p.hidden = false; });
    document.querySelectorAll('details').forEach(d => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
    window.SKRuntime.runAll();
  });
  window.addEventListener('afterprint', () => {
    if (!before) return;
    panels.forEach((p, i) => { p.hidden = before[i]; });
    document.querySelectorAll('details').forEach(d => { d.open = d.dataset.wasOpen === '1'; });
    before = null;
    window.SKRuntime.runAll();
  });
  window.addEventListener('hashchange', () => openPanel((location.hash || '').replace('#', '') || 'board', false));
  openPanel((location.hash || '').replace('#', '') || 'board', false);
})();
