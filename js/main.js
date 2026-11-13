import { destinations } from './apps.js';
import { startTheme, currentHour } from './theme.js';
import { createSky } from './sky.js';
import { createSearch } from './search.js';
import { createOrbit } from './orbit.js';
import * as sound from './sound.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const byId = (id) => destinations.find((d) => d.id === id);
const shortcutOf = (d) => destinations.indexOf(d) + 1;

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`starport.${key}`);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`starport.${key}`, JSON.stringify(value));
    } catch {
      /* private mode or storage blocked: Starport still works, it just forgets */
    }
  },
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const state = {
  favourites: new Set(store.get('favorites', []).filter(byId)),
  recent: store.get('recent', {}),
  view: store.get('view', 'grid') === 'orbit' ? 'orbit' : 'grid',
  caught: Number(store.get('starsCaught', 0)) || 0,
  launching: false,
};

// ---------------------------------------------------------------------------
// sky, theme, clock
// ---------------------------------------------------------------------------

startTheme();
const sky = createSky($('#stars'), { reducedMotion });

const GREETINGS = [
  [5, 'Late night', 'Quiet skies tonight. Where to, before bed?'],
  [12, 'Good morning', 'Fresh skies ahead. Where are we flying today?'],
  [18, 'Good afternoon', 'Where are we flying today?'],
  [23, 'Good evening', 'The stars are out. Where to next?'],
  [24, 'Late night', 'Quiet skies tonight. Where to, before bed?'],
];

function updateClock() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  $('#clock').dateTime = now.toISOString();
  $('#date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = currentHour();
  const [, word, line] = GREETINGS.find(([until]) => h < until);
  $('#greetWord').textContent = word;
  $('#subtitle').textContent = line;
  renderRecent();
}
updateClock();
setTimeout(() => {
  updateClock();
  setInterval(updateClock, 60_000);
}, (60 - new Date().getSeconds()) * 1000 + 50);

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------

const ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>';
const ICON_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';

function sceneHTML(kind) {
  let html = '';
  for (let i = 0; i < 12; i++) {
    const size = kind === 'dice' ? 8 + Math.random() * 9 : 6 + Math.random() * 9;
    html += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(1)}px;--d:${(8 + Math.random() * 7).toFixed(1)}s;--delay:${(-Math.random() * 15).toFixed(1)}s;--o:${(0.14 + Math.random() * 0.2).toFixed(2)}"></i>`;
  }
  return `<span class="scene scene--${kind}" aria-hidden="true">${html}</span>`;
}

function cardHTML(d, index) {
  const game = d.kind === 'game';
  const fav = state.favourites.has(d.id);
  const meta = game
    ? `<span class="card-play">Play now ${ICON_PLAY}</span><kbd class="card-key" title="Keyboard shortcut">${shortcutOf(d)}</kbd><span class="card-recent"></span>`
    : `<kbd class="card-key" title="Keyboard shortcut">${shortcutOf(d)}</kbd><span class="card-recent"></span><span class="card-go" aria-hidden="true">${ICON_ARROW}</span>`;
  return `
    <article class="card card--${d.kind}${fav ? ' is-fav' : ''}" data-id="${d.id}"
             style="--accent:${d.accent};--accent2:${d.accent2};--i:${index}">
      <span class="card-glow" aria-hidden="true"></span>
      ${game ? sceneHTML(d.scene || 'stars') : ''}
      <div class="card-icon" style="view-transition-name: icon-${d.id}">
        <img src="${esc(d.icon)}" alt="" width="128" height="128" decoding="async" />
      </div>
      <div class="card-body">
        <p class="card-kicker">${esc(d.kicker)}</p>
        <h3 class="card-title"><a class="card-link" href="${esc(d.url)}" data-launch="${d.id}">${esc(d.name)}</a></h3>
        <p class="card-desc">${esc(d.desc)}</p>
        <div class="card-meta">${meta}</div>
      </div>
      <button class="fav" type="button" aria-pressed="${fav}" aria-label="${fav ? 'Unpin' : 'Pin'} ${esc(d.name)} ${fav ? 'from' : 'to'} favourites">
        ${ICON_STAR}<span class="fav-burst" aria-hidden="true"></span>
      </button>
    </article>`;
}

const grids = { app: $('#appsGrid'), game: $('#gamesGrid') };

function sorted(list) {
  return [...list].sort((a, b) => {
    const fa = state.favourites.has(a.id) ? 0 : 1;
    const fb = state.favourites.has(b.id) ? 0 : 1;
    return fa - fb || destinations.indexOf(a) - destinations.indexOf(b);
  });
}

function renderGrids() {
  let i = 0;
  for (const kind of ['app', 'game']) {
    const list = sorted(destinations.filter((d) => d.kind === kind));
    grids[kind].innerHTML = list.map((d) => cardHTML(d, i++)).join('');
  }
  const appsN = destinations.filter((d) => d.kind === 'app').length;
  const gamesN = destinations.filter((d) => d.kind === 'game').length;
  $('#appsCount').textContent = `${appsN} destinations`;
  $('#gamesCount').textContent = `${gamesN} worlds to explore`;
}

/** Reorder cards inside a grid by favourites, animating the move (FLIP). */
function reorder(kind) {
  const grid = grids[kind];
  const cards = [...grid.children];
  const first = new Map(cards.map((c) => [c.dataset.id, c.getBoundingClientRect()]));
  const order = sorted(destinations.filter((d) => d.kind === kind));
  order.forEach((d) => grid.appendChild(grid.querySelector(`[data-id="${d.id}"]`)));
  if (reducedMotion) return;
  for (const card of grid.children) {
    const a = first.get(card.dataset.id);
    const b = card.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (dx || dy) {
      card.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
        duration: 650,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    }
  }
}

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return `on ${new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function renderRecent() {
  const entries = Object.entries(state.recent)
    .filter(([id]) => byId(id))
    .sort((a, b) => b[1] - a[1]);
  const wrap = $('#recent');
  if (!entries.length) {
    wrap.hidden = true;
  } else {
    wrap.hidden = false;
    $('#recentList').innerHTML = entries
      .slice(0, 3)
      .map(([id, ts]) => {
        const d = byId(id);
        return `<a class="recent-pill" href="${esc(d.url)}" data-launch="${d.id}" style="--accent:${d.accent}">
          <img src="${esc(d.icon)}" alt="" width="24" height="24" />${esc(d.name)} <small>${ago(ts)}</small></a>`;
      })
      .join('');
  }
  document.querySelectorAll('.card').forEach((card) => {
    const ts = state.recent[card.dataset.id];
    const el = card.querySelector('.card-recent');
    if (el) el.textContent = ts ? `Opened ${ago(ts)}` : '';
  });
}

renderGrids();
renderRecent();
// after the entry animation, stop it from replaying when cards move or views switch
setTimeout(() => document.querySelectorAll('.card').forEach((c) => (c.style.animation = 'none')), 1800);

// ---------------------------------------------------------------------------
// card tilt + spotlight (mouse only)
// ---------------------------------------------------------------------------

if (finePointer && !reducedMotion) {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.card');
    if (!card || e.pointerType !== 'mouse') return;
    const r = card.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ry', `${((nx - 0.5) * 9).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - ny) * 7).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`);
  });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.card');
    if (!card || card.contains(e.relatedTarget)) return;
    card.classList.remove('tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

// ---------------------------------------------------------------------------
// favourites
// ---------------------------------------------------------------------------

const toastEl = $('#toast');
let toastTimer = 0;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function toggleFavourite(d, button) {
  const on = !state.favourites.has(d.id);
  if (on) state.favourites.add(d.id);
  else state.favourites.delete(d.id);
  store.set('favorites', [...state.favourites]);

  const card = button.closest('.card');
  card.classList.toggle('is-fav', on);
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', `${on ? 'Unpin' : 'Pin'} ${d.name} ${on ? 'from' : 'to'} favourites`);
  if (on && !reducedMotion) {
    button.classList.remove('pop');
    void button.offsetWidth;
    button.classList.add('pop');
    const burst = button.querySelector('.fav-burst');
    burst.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}deg"></i>`).join('');
    setTimeout(() => (burst.innerHTML = ''), 700);
  }
  reorder(d.kind);
  orbit.setFavourites(state.favourites);
  toast(on ? `★ ${d.name} pinned to the top` : `${d.name} unpinned`);
}

document.addEventListener('click', (e) => {
  const button = e.target.closest('.fav');
  if (!button) return;
  const d = byId(button.closest('.card').dataset.id);
  toggleFavourite(d, button);
});

// ---------------------------------------------------------------------------
// orbit view + view switch
// ---------------------------------------------------------------------------

const orbit = createOrbit({
  container: $('#orbit'),
  planetsEl: $('#planets'),
  ringsSvg: $('#orbitRings'),
  destinations,
  reducedMotion,
  getPointer: () => sky.pointer,
});
orbit.setFavourites(state.favourites);

const viewSwitch = $('#viewSwitch');
function syncSwitch() {
  const btn = viewSwitch.querySelector(`[data-view="${state.view}"]`);
  viewSwitch.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
  viewSwitch.style.setProperty('--thumb-x', `${btn.offsetLeft - 3}px`);
  viewSwitch.style.setProperty('--thumb-w', `${btn.offsetWidth}px`);
}

function applyView() {
  $('#viewGrid').hidden = state.view !== 'grid';
  $('#viewOrbit').hidden = state.view !== 'orbit';
  document.body.classList.toggle('is-orbit', state.view === 'orbit');
  if (state.view === 'orbit') orbit.start();
  else orbit.stop();
}

function setView(view) {
  if (view === state.view) return;
  state.view = view;
  store.set('view', view);
  syncSwitch();
  if (document.startViewTransition && !reducedMotion) {
    const vt = document.startViewTransition(applyView);
    // a transition can be skipped (e.g. the window resized mid-way); the view still switches
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
  } else {
    applyView();
    const el = view === 'orbit' ? $('#viewOrbit') : $('#viewGrid');
    if (!reducedMotion) {
      el.classList.remove('view-enter');
      void el.offsetWidth;
      el.classList.add('view-enter');
    }
  }
}

viewSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
});
viewSwitch.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    setView(state.view === 'grid' ? 'orbit' : 'grid');
    viewSwitch.querySelector(`[data-view="${state.view}"]`).focus();
  }
});
applyView();
syncSwitch();
window.addEventListener('resize', syncSwitch);
document.fonts?.ready.then(syncSwitch);

// ---------------------------------------------------------------------------
// warp launch
// ---------------------------------------------------------------------------

function originFor(d) {
  if (state.view === 'orbit') return orbit.elementFor(d.id);
  return document.querySelector(`.card[data-id="${d.id}"]`);
}

function remember(d) {
  state.recent[d.id] = Date.now();
  store.set('recent', state.recent);
}

async function launch(d, originEl, event) {
  if (state.launching) return;
  state.launching = true;
  remember(d);

  const rect = originEl?.getBoundingClientRect();
  const fromPointer = event && event.detail > 0 && (event.clientX || event.clientY);
  const x = fromPointer ? event.clientX : rect ? rect.left + rect.width / 2 : innerWidth / 2;
  const y = fromPointer ? event.clientY : rect ? rect.top + rect.height / 2 : innerHeight / 2;

  const flash = $('#warpFlash');
  flash.style.setProperty('--ox', `${x}px`);
  flash.style.setProperty('--oy', `${y}px`);
  flash.style.setProperty('--flash', d.accent);

  // safety net: if navigation never happens (offline, blocked), come back
  const safety = setTimeout(resetWarp, 8000);

  if (reducedMotion) {
    document.body.classList.add('warping-soft');
    await wait(260);
  } else {
    originEl?.classList.add('launching');
    sound.whoosh();
    document.body.classList.add('warping');
    await sky.warp({ x, y, color: d.accent, duration: 950 });
  }
  if (state.launching) {
    window.location.href = d.url;
  } else {
    clearTimeout(safety);
  }
}

function resetWarp() {
  state.launching = false;
  document.body.classList.remove('warping', 'warping-soft');
  document.querySelectorAll('.launching').forEach((el) => el.classList.remove('launching'));
  sky.reset();
  renderRecent();
}

// coming back with the browser's Back button restores the page from cache
window.addEventListener('pageshow', (e) => {
  if (e.persisted) resetWarp();
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-launch]');
  if (!a) return;
  const d = byId(a.dataset.launch);
  if (!d) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    remember(d); // opening in a new tab still counts as a visit
    setTimeout(renderRecent, 50);
    return;
  }
  e.preventDefault();
  launch(d, a.closest('.card, .planet, .recent-pill') || a, e);
});
document.addEventListener('auxclick', (e) => {
  const a = e.target.closest('a[data-launch]');
  if (a && e.button === 1) {
    remember(byId(a.dataset.launch));
    setTimeout(renderRecent, 50);
  }
});

// ---------------------------------------------------------------------------
// search palette
// ---------------------------------------------------------------------------

const search = createSearch({
  dialog: $('#palette'),
  input: $('#paletteInput'),
  list: $('#paletteList'),
  empty: $('#paletteEmpty'),
  shortcutOf,
  getOrder: () => sorted(destinations),
  onLaunch: (d) => launch(d, originFor(d), null),
});
$('#searchBtn').addEventListener('click', () => search.open());

// ---------------------------------------------------------------------------
// sound
// ---------------------------------------------------------------------------

const soundBtn = $('#soundBtn');
function setSound(on) {
  soundBtn.setAttribute('aria-pressed', String(on));
  store.set('sound', on);
  sound.setEnabled(on);
  toast(on ? '♪ Ambient sound on' : 'Sound off');
}
soundBtn.addEventListener('click', () => setSound(!sound.isEnabled()));

if (store.get('sound', false)) {
  // browsers only allow audio after a gesture, so resume on the first one
  soundBtn.setAttribute('aria-pressed', 'true');
  const resume = (e) => {
    if (e.target.closest?.('#soundBtn')) return; // that click toggles on its own
    if (soundBtn.getAttribute('aria-pressed') === 'true') sound.setEnabled(true);
    ['pointerup', 'keydown'].forEach((t) => window.removeEventListener(t, resume, true));
  };
  ['pointerup', 'keydown'].forEach((t) => window.addEventListener(t, resume, true));
}

// ---------------------------------------------------------------------------
// parallax: mouse, or tilting the phone
// ---------------------------------------------------------------------------

const aurora = $('#aurora');
let auroraFrame = 0;
function setParallax(nx, ny) {
  sky.setPointer(nx, ny);
  if (reducedMotion || auroraFrame) return;
  auroraFrame = requestAnimationFrame(() => {
    auroraFrame = 0;
    aurora.style.setProperty('--px', sky.pointer.tx.toFixed(3));
    aurora.style.setProperty('--py', sky.pointer.ty.toFixed(3));
  });
}

window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  setParallax((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
});

let baseBeta = null;
function onOrientation(e) {
  if (e.gamma == null || e.beta == null) return;
  if (baseBeta === null) baseBeta = e.beta;
  baseBeta += (e.beta - baseBeta) * 0.01; // slowly re-centre on how you hold the phone
  setParallax(e.gamma / 25, (e.beta - baseBeta) / 20);
}

if (!reducedMotion && !finePointer && 'DeviceOrientationEvent' in window) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS: ask once, on the first tap that isn't a launch
    if (!store.get('motionAsked', false)) {
      const ask = (e) => {
        if (e.target.closest('a[data-launch]')) return;
        window.removeEventListener('click', ask, true);
        store.set('motionAsked', true);
        DeviceOrientationEvent.requestPermission()
          .then((r) => r === 'granted' && window.addEventListener('deviceorientation', onOrientation))
          .catch(() => {});
      };
      window.addEventListener('click', ask, true);
    } else {
      // permission was asked before; if it was granted this simply works
      window.addEventListener('deviceorientation', onOrientation);
    }
  } else {
    window.addEventListener('deviceorientation', onOrientation);
  }
}

// ---------------------------------------------------------------------------
// shooting stars: catch them!
// ---------------------------------------------------------------------------

function renderCaught() {
  $('#caughtCount').textContent = state.caught ? ` · ${state.caught} shooting star${state.caught === 1 ? '' : 's'} caught` : '';
}
renderCaught();

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, dialog, .card')) return;
  const hit = sky.tryCatch(e.clientX, e.clientY, e.pointerType === 'touch' ? 60 : 46);
  if (!hit) return;
  state.caught += 1;
  store.set('starsCaught', state.caught);
  renderCaught();
  sound.sparkle();
  toast(`✦ You caught a shooting star! #${state.caught}`);
});

// ---------------------------------------------------------------------------
// easter egg: tap the logo (or station) 5 times, or the Konami code
// ---------------------------------------------------------------------------

let taps = [];
function meteorShower() {
  if (reducedMotion) {
    toast('☄️ Meteor shower! (motion is reduced, so imagine it)');
    return;
  }
  sky.meteorShower();
  sound.sparkle();
  toast('☄️ Meteor shower incoming!');
}

function boop(el, x, y) {
  el.classList.remove('boop');
  void el.offsetWidth;
  el.classList.add('boop');
  const now = Date.now();
  taps = taps.filter((t) => now - t < 2500);
  taps.push(now);
  if (!reducedMotion) sky.burst(x, y, ['159,232,255', '255,255,255', '185,164,255'], 10);
  if (taps.length >= 5) {
    taps = [];
    meteorShower();
  }
}

for (const el of [$('#brand'), $('#station')]) {
  el.addEventListener('click', (e) => {
    const r = el.querySelector('img').getBoundingClientRect();
    boop(el, e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
  });
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konami = [];

// ---------------------------------------------------------------------------
// keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  konami = [...konami, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
  if (konami.join() === KONAMI.join()) {
    konami = [];
    meteorShower();
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    search.open();
    return;
  }
  if (search.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;

  if (e.key === '/') {
    e.preventDefault();
    search.open();
  } else if (/^[1-9]$/.test(e.key)) {
    const d = destinations[Number(e.key) - 1];
    if (d) launch(d, originFor(d), null);
  } else if (e.key === 'v' || e.key === 'V') {
    setView(state.view === 'grid' ? 'orbit' : 'grid');
  } else if (e.key === 'm' || e.key === 'M') {
    setSound(!sound.isEnabled());
  }
});

// ---------------------------------------------------------------------------
// topbar background once you scroll
// ---------------------------------------------------------------------------

const topbar = $('.topbar');
const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------------------------------------------------------------------------
// installable app (service worker)
// ---------------------------------------------------------------------------

const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
