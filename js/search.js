// Command palette: "/" or Ctrl/Cmd+K, type a few letters, Enter to warp.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function subsequenceGaps(text, q) {
  let ti = 0;
  let gaps = 0;
  let lastHit = -1;
  for (const ch of q) {
    const found = text.indexOf(ch, ti);
    if (found < 0) return -1;
    if (lastHit >= 0) gaps += found - lastHit - 1;
    lastHit = found;
    ti = found + 1;
  }
  return gaps;
}

export function score(d, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;
  const fields = [
    [d.name, 3],
    [d.kicker, 2],
    ...d.keywords.map((k) => [k, 2]),
    [d.desc, 1],
  ];
  let best = 0;
  for (const [text, weight] of fields) {
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx >= 0) {
      let s = weight * 100 - idx * 0.5;
      if (idx === 0) s += 60;
      else if (/[\s\-–]/.test(t[idx - 1])) s += 30;
      best = Math.max(best, s);
    } else if (weight >= 2 && q.length > 1) {
      const gaps = subsequenceGaps(t, q);
      // loose letter matching ("cktl" → cocktail), but only when the letters sit close together
      if (gaps >= 0 && gaps <= q.length) best = Math.max(best, weight * 25 - gaps * 2);
    }
  }
  return best;
}

function highlight(name, q) {
  const query = q.trim().toLowerCase();
  const idx = query ? name.toLowerCase().indexOf(query) : -1;
  if (idx < 0) return esc(name);
  return esc(name.slice(0, idx)) + '<mark>' + esc(name.slice(idx, idx + query.length)) + '</mark>' + esc(name.slice(idx + query.length));
}

export function createSearch({ dialog, input, list, empty, getOrder, onLaunch, shortcutOf }) {
  let results = [];
  let active = 0;

  function render() {
    const q = input.value;
    results = getOrder()
      .map((d) => ({ d, s: score(d, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.d);
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results
      .map(
        (d, i) => `
      <li role="none">
        <a class="palette-item" role="option" id="opt-${d.id}" href="${esc(d.url)}" data-id="${d.id}"
           aria-selected="${i === active}" style="--accent:${d.accent};--accent2:${d.accent2}" tabindex="-1">
          <img src="${esc(d.icon)}" alt="" width="40" height="40" />
          <span><strong>${highlight(d.name, q)}</strong><small>${esc(d.kicker)}</small></span>
          <kbd>${shortcutOf(d)}</kbd>
        </a>
      </li>`,
      )
      .join('');
    empty.hidden = results.length > 0;
    syncActive();
  }

  function syncActive() {
    list.querySelectorAll('.palette-item').forEach((el, i) => el.setAttribute('aria-selected', String(i === active)));
    const el = list.children[active]?.firstElementChild;
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function open() {
    if (dialog.open) return;
    input.value = '';
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function go(d, event) {
    close();
    onLaunch(d, event);
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, results.length);
      syncActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + results.length) % Math.max(1, results.length);
      syncActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) go(results[active], null);
    }
  });

  list.addEventListener('click', (e) => {
    const a = e.target.closest('.palette-item');
    if (!a) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const d = results.find((r) => r.id === a.dataset.id);
    if (d) go(d, null);
  });

  list.addEventListener('pointermove', (e) => {
    const a = e.target.closest('.palette-item');
    if (!a) return;
    const i = results.findIndex((r) => r.id === a.dataset.id);
    if (i >= 0 && i !== active) {
      active = i;
      syncActive();
    }
  });

  // click on the backdrop closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  return { open, close, get isOpen() { return dialog.open; } };
}
