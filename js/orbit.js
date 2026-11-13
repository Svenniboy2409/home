// Orbit view: the Starport station in the middle, apps on the inner ring,
// games (with Saturn rings) on the outer ring. Planets are real links.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SVG_NS = 'http://www.w3.org/2000/svg';
// radians per second: the inner ring of apps turns faster than the outer ring of games
const SPEED = { inner: 0.1, outer: 0.055 };

export function createOrbit({ container, planetsEl, ringsSvg, destinations, reducedMotion, finePointer = true, getPointer }) {
  const planets = [];
  let geo = null;
  let raf = 0;
  let running = false;
  let last = 0;
  let time = 0;
  let speed = 1; // eased towards 0 while a planet is hovered/focused
  let hold = 0;
  let frozen = false;
  let ringAnims = [];

  // Saturn ring poses: at rest (same as the CSS), arriving and leaving
  const RING_REST = 'translate(-50%, -50%) rotate(-18deg) scale(1)';
  const RING_ARRIVE = 'translate(-50%, -50%) rotate(-62deg) scale(0.35)';
  const RING_GONE = 'translate(-50%, -50%) rotate(14deg) scale(0.4)';
  const ringEls = () => [...planetsEl.querySelectorAll('.planet-ring')];

  const apps = destinations.filter((d) => d.kind === 'app');
  const games = destinations.filter((d) => d.kind === 'game');

  function planetHTML(d) {
    const ring = d.kind === 'game';
    return `
      ${ring ? '<span class="planet-ring back" aria-hidden="true"></span>' : ''}
      <span class="planet-body"><img src="${esc(d.icon)}" alt="" /></span>
      ${ring ? '<span class="planet-ring front" aria-hidden="true"></span>' : ''}
      <span class="planet-label">${esc(d.name)}<small>${esc(d.kicker)}</small></span>`;
  }

  function build() {
    const add = (list, ring) =>
      list.forEach((d, i) => {
        const a = document.createElement('a');
        a.className = `planet planet--${d.kind}`;
        a.href = d.url;
        a.dataset.launch = d.id;
        a.dataset.id = d.id;
        a.setAttribute('aria-label', `${d.name}, ${d.kicker}`);
        a.style.setProperty('--accent', d.accent);
        a.style.setProperty('--accent2', d.accent2);
        a.innerHTML = planetHTML(d);
        planetsEl.appendChild(a);
        const offset = ring === 'inner' ? 0.35 : 1.05;
        planets.push({ el: a, d, ring, base: offset + (i / list.length) * Math.PI * 2 });
        // hovering holds the orbit still (mouse only: a tap on a phone just launches)
        a.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && hold++);
        a.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (hold = Math.max(0, hold - 1)));
        a.addEventListener('focus', () => hold++);
        a.addEventListener('blur', () => (hold = Math.max(0, hold - 1)));
      });
    add(apps, 'inner');
    add(games, 'outer');
  }

  function layout() {
    const W = container.clientWidth;
    if (!W) return;
    const portrait = W < 640;
    // the station stays small enough for planets to pass behind it without touching
    const station = portrait ? clamp(W * 0.19, 62, 84) : clamp(W * 0.11, 84, 140);
    const appSize = portrait ? clamp(W * 0.13, 42, 52) : clamp(W * 0.07, 56, 88);
    const gameSize = portrait ? clamp(W * 0.155, 50, 62) : clamp(W * 0.088, 68, 112);
    const tilt = ((portrait ? -16 : -10) * Math.PI) / 180;
    const inner = portrait ? { rx: W * 0.27, ry: W * 0.27 * 0.62 } : { rx: W * 0.25, ry: W * 0.25 * 0.38 };
    const outer = portrait ? { rx: W * 0.42, ry: W * 0.42 * 0.62 } : { rx: W * 0.41, ry: W * 0.41 * 0.36 };

    const bboxH = (e) => 2 * Math.sqrt((e.rx * Math.sin(tilt)) ** 2 + (e.ry * Math.cos(tilt)) ** 2);
    const H = Math.round(Math.max(bboxH(outer) + gameSize * 1.2 + 64, station + 240));
    container.style.height = `${H}px`;
    container.style.setProperty('--station', `${station}px`);

    geo = { W, H, cx: W / 2, cy: H / 2, tilt, inner, outer, appSize, gameSize };
    planets.forEach((p) => p.el.style.setProperty('--size', `${p.ring === 'inner' ? appSize : gameSize}px`));

    // rings
    const deg = (tilt * 180) / Math.PI;
    ringsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ringsSvg.innerHTML = '';
    for (const [e, cls] of [[outer, 'ring--outer'], [inner, 'ring--inner']]) {
      for (const kind of ['ring-glow', 'ring']) {
        const el = document.createElementNS(SVG_NS, 'ellipse');
        el.setAttribute('cx', W / 2);
        el.setAttribute('cy', H / 2);
        el.setAttribute('rx', e.rx);
        el.setAttribute('ry', e.ry);
        el.setAttribute('transform', `rotate(${deg} ${W / 2} ${H / 2})`);
        el.setAttribute('class', `${kind} ${cls}`);
        if (kind === 'ring-glow') el.style.stroke = 'var(--a2)';
        ringsSvg.appendChild(el);
      }
    }
    place();
  }

  function place() {
    if (!geo) return;
    const ptr = getPointer?.() ?? { x: 0, y: 0 };
    const cos = Math.cos(geo.tilt);
    const sin = Math.sin(geo.tilt);
    for (const p of planets) {
      const e = p.ring === 'inner' ? geo.inner : geo.outer;
      const th = p.base + time * SPEED[p.ring];
      const ex = e.rx * Math.cos(th);
      const ey = e.ry * Math.sin(th);
      const depth = Math.sin(th); // -1 = far side, 1 = near side
      const par = p.ring === 'inner' ? 8 : 14;
      const x = geo.cx + ex * cos - ey * sin - ptr.x * par;
      const y = geo.cy + ex * sin + ey * cos - ptr.y * par * 0.7;
      const hovered = (finePointer && p.el.matches(':hover')) || p.el.matches(':focus-visible');
      const launching = p.el.classList.contains('launching');
      const scale = hovered || launching ? 1.04 : 0.8 + 0.2 * ((depth + 1) / 2);
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      // Stack planets by how close they are to you: the lower on the (tilted) orbit,
      // the nearer. This works across both rings, so when two planets overlap the one
      // drawn in front is also the one a tap or click reaches. The station sits at 1000.
      p.el.style.zIndex = launching ? 4000 : hovered ? 3000 : String(Math.round(1000 + ey * 2));
      p.el.style.filter = hovered ? '' : `brightness(${(0.68 + 0.32 * ((depth + 1) / 2)).toFixed(3)})`;
      // names fade out on the far side of the orbit and come back as planets swing round
      p.el.style.setProperty('--label-o', clamp((depth + 0.45) / 0.6, 0, 1).toFixed(2));
    }
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!frozen) {
      const target = hold > 0 ? 0 : 1;
      speed += (target - speed) * (1 - Math.exp(-dt * 5));
      time += dt * speed;
      place();
    }
    raf = requestAnimationFrame(frame);
  }

  build();
  const ro = new ResizeObserver(() => layout());
  ro.observe(container);

  return {
    start() {
      running = true;
      layout();
      if (reducedMotion) return;
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    /** Hold every planet exactly where it is (icons are flying to or from them). */
    freeze() {
      frozen = true;
      speed = 0;
    },
    /** Let go again: the orbit picks up speed gently. */
    unfreeze() {
      frozen = false;
    },
    /** Forget any hover hold (e.g. after coming back to the page). */
    release() {
      hold = 0;
    },
    /** Put planets in place right now (e.g. to bring a launching planet to the front). */
    refresh() {
      place();
    },
    /**
     * Saturn rings of the game planets. They are only shown while a planet
     * sits still in its orbit: they spin away before an icon leaves its
     * planet and swoop back in once an icon has landed.
     */
    hideRings({ instant = false, speed = 1 } = {}) {
      const els = ringEls();
      ringAnims.forEach((a) => a.cancel());
      if (instant || reducedMotion) {
        els.forEach((el) => (el.style.opacity = '0'));
        return Promise.resolve();
      }
      ringAnims = els.map((el) =>
        el.animate(
          [
            { opacity: getComputedStyle(el).opacity, transform: RING_REST },
            { opacity: 0, transform: RING_GONE },
          ],
          { duration: 280 * speed, easing: 'cubic-bezier(0.55, 0, 0.8, 0.3)', fill: 'forwards' },
        ),
      );
      return Promise.all(ringAnims.map((a) => a.finished.catch(() => {}))).then(() => {
        els.forEach((el) => (el.style.opacity = '0'));
        ringAnims.forEach((a) => a.cancel());
        ringAnims = [];
      });
    },
    showRings({ instant = false, speed = 1 } = {}) {
      const els = ringEls();
      ringAnims.forEach((a) => a.cancel());
      els.forEach((el) => (el.style.opacity = ''));
      if (instant || reducedMotion) return Promise.resolve();
      ringAnims = els.map((el) => {
        // the back half of a ring is fainter than the front; land on each one's own opacity
        const rest = getComputedStyle(el).opacity;
        const planet = planets.findIndex((p) => p.el.contains(el));
        const order = planets.filter((p) => p.ring === 'outer').indexOf(planets[planet]);
        return el.animate(
          [
            { opacity: 0, transform: RING_ARRIVE },
            { opacity: rest, offset: 0.45 },
            { opacity: rest, transform: RING_REST },
          ],
          { duration: 720 * speed, delay: Math.max(0, order) * 110 * speed, easing: 'cubic-bezier(0.34, 1.45, 0.64, 1)', fill: 'backwards' },
        );
      });
      return Promise.all(ringAnims.map((a) => a.finished.catch(() => {}))).then(() => (ringAnims = []));
    },
    setFavourites(favs) {
      for (const p of planets) {
        const has = favs.has(p.d.id);
        const moon = p.el.querySelector('.planet-moon');
        if (has && !moon) p.el.insertAdjacentHTML('beforeend', '<span class="planet-moon" aria-hidden="true"></span>');
        if (!has && moon) moon.remove();
      }
    },
    elementFor(id) {
      return planets.find((p) => p.d.id === id)?.el;
    },
  };
}
