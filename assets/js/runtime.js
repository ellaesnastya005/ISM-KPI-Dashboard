// Мінімальне середовище для дашборда: дані, розрахунки, малювання і збереження дошки в браузері.
(function () {
  const calcs = {};
  const draws = {};
  const cache = {};
  const STORE_KEY = 'sk-remediation-moves-v1';

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } },
    write(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; } }
  };
  const moves = () => { const o = store.read(); return Object.keys(o).map(id => Object.assign({id: id}, o[id])); };

  function resolve(id) {
    if (id === 'remediation_moves') return moves();
    const DATA = window.SK_DATA || {};
    if (DATA[id]) return DATA[id];
    const c = calcs[id];
    if (!c) return null;
    if (!(id in cache)) cache[id] = c.fn.apply(null, c.inputs.map(resolve));
    return cache[id];
  }
  const visible = el => !el.closest('[hidden]');
  function runDraw(name) {
    document.querySelectorAll('[data-draw="' + name + '"]').forEach(el => {
      if (!visible(el)) return;
      try { draws[name](el); } catch (e) { console.error('draw ' + name, e); }
    });
  }
  function runAll() { Object.keys(draws).forEach(runDraw); }
  function invalidate() { Object.keys(cache).forEach(k => delete cache[k]); runAll(); }

  window.dash = {
    colors: ['var(--series-0)', 'var(--series-1)'],
    calc(id, o) { calcs[id] = o; },
    data(id) {
      try {
        const v = resolve(id);
        if (v == null) return {status: 'missing', data: []};
        return {status: 'ok', data: v};
      } catch (e) { console.error('data ' + id, e); return {status: 'error', data: [], message: String(e)}; }
    },
    draw(name, fn) { if (fn) draws[name] = fn; else runDraw(name); },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} },
    refresh() {}
  };

  window.claude = {
    async use(name) {
      if (name !== 'db') throw new Error('Немає можливості ' + name);
      return {
        doc(path) {
          const id = path.split('/').pop();
          return {
            async set(value) { const o = store.read(); o[id] = value; if (!store.write(o)) throw new Error('Браузер не дозволив зберегти'); invalidate(); },
            async delete() { const o = store.read(); delete o[id]; store.write(o); invalidate(); }
          };
        }
      };
    }
  };

  let lastW = window.innerWidth, t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; runAll(); } }, 150);
  });
  window.SKRuntime = {runAll: runAll, invalidate: invalidate};
})();
