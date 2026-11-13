// The sky follows the clock: the aurora colours glide between dawn, day,
// sunset, evening and night. Colours are interpolated per minute.

const ANCHORS = [
  { h: 0,    base: '#050816', a1: '#2f5bff', a2: '#1fc7b6', a3: '#6a4cff' }, // night
  { h: 4.5,  base: '#060a1c', a1: '#3a4bd8', a2: '#1aa6a0', a3: '#5b3fd1' }, // before dawn
  { h: 6.5,  base: '#150d2b', a1: '#ff7eb3', a2: '#ffb38a', a3: '#7a5cff' }, // dawn
  { h: 9,    base: '#0a1431', a1: '#4fa8ff', a2: '#38e0c8', a3: '#5b6cff' }, // morning
  { h: 16,   base: '#0b1331', a1: '#5a8bff', a2: '#3ee6c0', a3: '#8b6cff' }, // afternoon
  { h: 19,   base: '#160a28', a1: '#ff8a5c', a2: '#ff5fa2', a3: '#8b5cff' }, // sunset
  { h: 20.5, base: '#0e0823', a1: '#b46cff', a2: '#39f0a8', a3: '#ff5fa2' }, // evening aurora
  { h: 23,   base: '#060918', a1: '#3456ff', a2: '#1fc7b6', a3: '#7a4cff' }, // night
  { h: 24,   base: '#050816', a1: '#2f5bff', a2: '#1fc7b6', a3: '#6a4cff' },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const smooth = (t) => t * t * (3 - 2 * t);

export function paletteAt(hour) {
  let i = 0;
  while (i < ANCHORS.length - 2 && hour >= ANCHORS[i + 1].h) i++;
  const from = ANCHORS[i];
  const to = ANCHORS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (hour - from.h) / (to.h - from.h))));
  return {
    base: mix(from.base, to.base, t),
    a1: mix(from.a1, to.a1, t),
    a2: mix(from.a2, to.a2, t),
    a3: mix(from.a3, to.a3, t),
  };
}

/** Current hour as a decimal. `?hour=7.5` in the URL overrides it (handy for previewing). */
export function currentHour() {
  const forced = new URLSearchParams(location.search).get('hour');
  if (forced !== null && !Number.isNaN(parseFloat(forced))) return ((parseFloat(forced) % 24) + 24) % 24;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

export function applyTheme() {
  const p = paletteAt(currentHour());
  const root = document.documentElement.style;
  root.setProperty('--base', p.base);
  root.setProperty('--a1', p.a1);
  root.setProperty('--a2', p.a2);
  root.setProperty('--a3', p.a3);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.base);
  return p;
}

export function startTheme() {
  applyTheme();
  setInterval(applyTheme, 60_000);
}
