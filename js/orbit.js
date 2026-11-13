// Orbit view: the Starport station in the middle, apps on the inner ring,
// games (with Saturn rings) on the outer ring. Planets are real links.
//
// Layers inside .orbit, from back to front:
//   svg.orbit-rings  glowing orbit paths, asteroid belt, light pulses, comet tails
//   .station         the living station (dock ring, navigation lights, energy pulse)
//   .planets         the planets (only their round bodies take taps and clicks)
//   svg.orbit-fx     guide line to the planet under the mouse, and the launch beam
//   .holo            hologram card for the planet under the mouse

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const SVG_NS = 'http://www.w3.org/2000/svg';

// radians per second: the inner ring of apps turns faster than the outer ring of games
const SPEED = { inner: 0.1, outer: 0.055 };
const BELT_SPEED = 0.035; // the asteroid belt drifts slowly
const PULSE_SPEED = 0.45; // light pulses race along the orbits
const TAIL = { inner: 0.62, outer: 0.42 }; // length of a comet tail, in radians of orbit

function svg(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}
function stop(grad, offset, style) {
  return svg('stop', { offset, style }, grad);
}

export function createOrbit({
  container,
  planetsEl,
  ringsSvg,
  destinations,
  reducedMotion,
  finePointer = true,
  getPointer,
  onHover,
}) {
  const planets = [];
  let geo = null;
  let raf = 0;
  let running = false;
  let last = 0;
  let time = 0; // drives the planets (pauses while you hover a planet)
  let clock = 0; // keeps ticking for pulses and the belt
  let speed = 1; // eased towards 0 while a planet is hovered/focused
  let boost = 0; // extra spin after a drag, fades out
  let hold = 0;
  let frozen = false;
  let ringAnims = [];
  let drag = null;
  let holoFor = null;
  let holoSize = [236, 120];
  let lastDecor = 0;
  let forceDecor = true;

  // Saturn ring poses: at rest (same as the CSS), arriving and leaving
  const RING_REST = 'translate(-50%, -50%) rotate(-18deg) scale(1)';
  const RING_ARRIVE = 'translate(-50%, -50%) rotate(-62deg) scale(0.35)';
  const RING_GONE = 'translate(-50%, -50%) rotate(14deg) scale(0.4)';
  const ringEls = () => [...planetsEl.querySelectorAll('.planet-ring')];

  const apps = destinations.filter((d) => d.kind === 'app');
  const games = destinations.filter((d) => d.kind === 'game');

  // ---------- extra layers ----------

  // moving decoration lives in its own layer, so the static glowing paths are drawn once
  const dynSvg = svg('svg', { class: 'orbit-rings orbit-dyn', 'aria-hidden': 'true' });
  ringsSvg.after(dynSvg);
  const fxSvg = svg('svg', { class: 'orbit-fx', 'aria-hidden': 'true' });
  container.appendChild(fxSvg);
  const holo = document.createElement('div');
  holo.className = 'holo';
  holo.setAttribute('aria-hidden', 'true');
  container.appendChild(holo);

  // svg pieces that move every frame
  let beltDots = [];
  let pulses = [];
  let tails = [];
  let guide = null;
  let beamEls = null;

  // ---------- planets ----------

  function planetHTML(d) {
    const ring = d.kind === 'game';
    return `
      ${ring ? '<span class="planet-ring glow" aria-hidden="true"></span><span class="planet-ring back" aria-hidden="true"></span>' : ''}
      <span class="planet-body"><img src="${esc(d.icon)}" alt="" /></span>
      ${ring ? '<span class="planet-ring front" aria-hidden="true"></span>' : ''}
      <span class="planet-label">${esc(d.name)}</span>`;
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
        const p = { el: a, d, ring, base: offset + (i / list.length) * Math.PI * 2, x: 0, y: 0, size: 0 };
        planets.push(p);
        // hovering holds the orbit still (mouse only: a tap on a phone just launches)
        a.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse') return;
          hold++;
          onHover?.(d);
        });
        a.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (hold = Math.max(0, hold - 1)));
        a.addEventListener('focus', () => hold++);
        a.addEventListener('blur', () => (hold = Math.max(0, hold - 1)));
      });
    add(apps, 'inner');
    add(games, 'outer');
  }

  // ---------- layout: sizes and all the svg decoration ----------

  function layout() {
    const W = container.clientWidth;
    if (!W) return;
    const portrait = W < 640;
    // the station stays small enough for planets to pass behind it
    const station = portrait ? clamp(W * 0.19, 62, 84) : clamp(W * 0.11, 84, 140);
    const appSize = portrait ? clamp(W * 0.13, 42, 52) : clamp(W * 0.07, 56, 88);
    const gameSize = portrait ? clamp(W * 0.155, 50, 62) : clamp(W * 0.088, 68, 112);
    const tilt = ((portrait ? -16 : -10) * Math.PI) / 180;
    const inner = portrait ? { rx: W * 0.27, ry: W * 0.27 * 0.62 } : { rx: W * 0.25, ry: W * 0.25 * 0.38 };
    const outer = portrait ? { rx: W * 0.42, ry: W * 0.42 * 0.62 } : { rx: W * 0.41, ry: W * 0.41 * 0.36 };
    const belt = { rx: (inner.rx + outer.rx) / 2, ry: (inner.ry + outer.ry) / 2 };

    const bboxH = (e) => 2 * Math.sqrt((e.rx * Math.sin(tilt)) ** 2 + (e.ry * Math.cos(tilt)) ** 2);
    const H = Math.round(Math.max(bboxH(outer) + gameSize * 1.2 + 64, station + 240));
    container.style.height = `${H}px`;
    container.style.setProperty('--station', `${station}px`);

    geo = { W, H, cx: W / 2, cy: H / 2, tilt, inner, outer, belt, appSize, gameSize, station, portrait };
    planets.forEach((p) => {
      p.size = p.ring === 'inner' ? appSize : gameSize;
      p.el.style.setProperty('--size', `${p.size}px`);
    });

    buildRingsSvg();
    buildFxSvg();
    forceDecor = true;
    place();
  }

  /** The tilted plane of the orbits, centred on the station. */
  function plane(dx = 0, dy = 0) {
    return `translate(${(geo.cx + dx).toFixed(1)} ${(geo.cy + dy).toFixed(1)}) rotate(${((geo.tilt * 180) / Math.PI).toFixed(2)})`;
  }

  function buildRingsSvg() {
    const { W, H, inner, outer, belt, portrait } = geo;
    ringsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ringsSvg.innerHTML = '';
    dynSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dynSvg.innerHTML = '';
    const defs = svg('defs', {}, ringsSvg);
    const dynDefs = svg('defs', {}, dynSvg);

    const glowBlur = svg('filter', { id: 'orbit-blur', x: '-10%', y: '-30%', width: '120%', height: '160%' }, defs);
    svg('feGaussianBlur', { stdDeviation: portrait ? 3 : 4.5 }, glowBlur);

    const pulseGlow = svg('radialGradient', { id: 'pulse-glow' }, dynDefs);
    stop(pulseGlow, 0, 'stop-color:#fff;stop-opacity:1');
    stop(pulseGlow, 0.25, 'stop-color:var(--a2);stop-opacity:0.9');
    stop(pulseGlow, 1, 'stop-color:var(--a2);stop-opacity:0');

    // Nearer is brighter: a fade from the far (top) side to the near (bottom) side,
    // drawn in the tilted plane so it follows the orbits.
    const depthMask = (name, e, pad) => {
      const g = svg('linearGradient', { id: `depth-${name}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      stop(g, 0, 'stop-color:#fff;stop-opacity:0.16');
      stop(g, 0.45, 'stop-color:#fff;stop-opacity:0.42');
      stop(g, 1, 'stop-color:#fff;stop-opacity:1');
      const m = svg('mask', { id: `mask-${name}`, maskUnits: 'userSpaceOnUse', x: -e.rx - pad, y: -e.ry - pad, width: 2 * (e.rx + pad), height: 2 * (e.ry + pad) }, defs);
      svg('rect', { x: -e.rx - pad, y: -e.ry - pad, width: 2 * (e.rx + pad), height: 2 * (e.ry + pad), fill: `url(#depth-${name})` }, m);
    };

    // ---- asteroid belt between the two orbits ----
    const beltG = svg('g', { class: 'belt', transform: plane() }, dynSvg);
    const spread = (outer.rx - inner.rx) * 0.24;
    const k = belt.ry / belt.rx;
    const count = portrait ? 36 : 64;
    beltDots = Array.from({ length: count }, (_, i) => {
      const dot = svg('circle', { r: rand(0.5, i % 9 === 0 ? 1.9 : 1.25).toFixed(2), class: i % 4 === 0 ? 'tw' : '' }, beltG);
      dot.style.animationDelay = `${(-Math.random() * 4).toFixed(2)}s`;
      if (i % 5 === 0) dot.classList.add('tint');
      return { el: dot, a: Math.random() * Math.PI * 2, r: belt.rx + rand(-spread, spread), k, o: -1 };
    });

    // ---- the two orbits: glowing light paths ----
    pulses = [];
    for (const [name, e] of [['outer', outer], ['inner', inner]]) {
      // colour runs along the ring: turquoise on one side, violet on the other
      const grad = svg('linearGradient', { id: `orbit-grad-${name}`, gradientUnits: 'userSpaceOnUse', x1: -e.rx, y1: 0, x2: e.rx, y2: 0 }, defs);
      stop(grad, 0, 'stop-color:var(--a2)');
      stop(grad, 0.5, 'stop-color:color-mix(in srgb, var(--a2) 45%, var(--a1))');
      stop(grad, 1, 'stop-color:var(--a1)');
      depthMask(name, e, 30);

      const g = svg('g', { class: `orbit-path orbit-path--${name}`, transform: plane() }, ringsSvg);
      const ring = (attrs) => svg('ellipse', { cx: 0, cy: 0, rx: e.rx.toFixed(1), ry: e.ry.toFixed(1), fill: 'none', stroke: `url(#orbit-grad-${name})`, ...attrs }, g);
      ring({ class: 'path-glow', 'stroke-width': name === 'outer' ? 11 : 9, filter: 'url(#orbit-blur)', mask: `url(#mask-${name})` });
      ring({ class: 'path-base', 'stroke-width': 1 });
      ring({ class: 'path-line', 'stroke-width': name === 'outer' ? 2.4 : 2, mask: `url(#mask-${name})` });

      // light pulses that now and then race along the orbit
      const pg = svg('g', { class: 'pulses', transform: plane() }, dynSvg);
      for (let i = 0; i < 2; i++) {
        pulses.push({
          el: svg('circle', { r: portrait ? 6 : 8, fill: 'url(#pulse-glow)' }, pg),
          e,
          phase: rand(0, Math.PI * 2),
          dir: name === 'outer' ? -1 : 1,
          cycle: rand(8, 12),
          offset: rand(0, 12) + i * 5,
        });
      }
    }

    // ---- comet tails behind every planet ----
    tails = [];
    const tailLayers = {};
    for (const name of ['inner', 'outer']) {
      tailLayers[name] = svg('g', { class: 'orbit-tails' }, dynSvg);
    }
    for (const p of planets) {
      const id = `tail-${p.d.id}`;
      const grad = svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse' }, dynDefs);
      stop(grad, 0, `stop-color:${p.d.accent};stop-opacity:0`);
      stop(grad, 0.7, `stop-color:${p.d.accent};stop-opacity:0.55`);
      stop(grad, 1, `stop-color:${p.d.accent2};stop-opacity:0.95`);
      const outerG = svg('g', {}, tailLayers[p.ring]);
      const g = svg('g', { transform: plane() }, outerG);
      const wide = svg('path', { fill: 'none', stroke: `url(#${id})`, 'stroke-width': (p.size * 0.3).toFixed(1), 'stroke-linecap': 'round', opacity: 0.26 }, g);
      const thin = svg('path', { fill: 'none', stroke: `url(#${id})`, 'stroke-width': portrait ? 1.6 : 2.2, 'stroke-linecap': 'round' }, g);
      tails.push({ p, grad, outerG, g, wide, thin });
    }
  }

  function buildFxSvg() {
    const { W, H } = geo;
    fxSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    fxSvg.innerHTML = '';
    const defs = svg('defs', {}, fxSvg);
    const blur = svg('filter', { id: 'beam-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    svg('feGaussianBlur', { stdDeviation: 4 }, blur);
    guide = svg('line', { class: 'guide', x1: 0, y1: 0, x2: 0, y2: 0 }, fxSvg);
    const glow = svg('line', { class: 'beam-glow', filter: 'url(#beam-blur)' }, fxSvg);
    const line = svg('line', { class: 'beam' }, fxSvg);
    const hit = svg('circle', { class: 'beam-hit', r: 10 }, fxSvg);
    beamEls = { glow, line, hit };
  }

  // ---------- every frame ----------

  function orbitPoint(e, th) {
    return [e.rx * Math.cos(th), e.ry * Math.sin(th)];
  }

  function place() {
    if (!geo) return;
    const ptr = getPointer?.() ?? { x: 0, y: 0 };
    const cos = Math.cos(geo.tilt);
    const sin = Math.sin(geo.tilt);
    let focus = null;

    for (const p of planets) {
      const e = p.ring === 'inner' ? geo.inner : geo.outer;
      const th = p.base + time * SPEED[p.ring];
      p.th = th;
      const [ex, ey] = orbitPoint(e, th);
      const depth = Math.sin(th); // -1 = far side, 1 = near side
      const par = p.ring === 'inner' ? 8 : 14;
      p.par = par;
      const x = geo.cx + ex * cos - ey * sin - ptr.x * par;
      const y = geo.cy + ex * sin + ey * cos - ptr.y * par * 0.7;
      p.x = x;
      p.y = y;
      const hovered = (finePointer && p.el.matches(':hover')) || p.el.matches(':focus-visible');
      const launching = p.el.classList.contains('launching');
      if (hovered && !focus) focus = p;
      const scale = hovered || launching ? 1.04 : 0.8 + 0.2 * ((depth + 1) / 2);
      p.scale = scale;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      // Stack planets by how close they are to you: the lower on the (tilted) orbit,
      // the nearer. This works across both rings, so when two planets overlap the one
      // drawn in front is also the one a tap or click reaches. The station sits at 1000.
      p.el.style.zIndex = launching ? 4000 : hovered ? 3000 : String(Math.round(1000 + ey * 2));
      p.el.style.filter = hovered ? '' : `brightness(${(0.68 + 0.32 * ((depth + 1) / 2)).toFixed(3)})`;
      // names fade out on the far side of the orbit and come back as planets swing round
      p.el.style.setProperty('--label-o', clamp((depth + 0.45) / 0.6, 0, 1).toFixed(2));
      // sunlight from the station: the bright side of each planet faces the middle
      const lx = geo.cx - x;
      const ly = geo.cy - y;
      const len = Math.hypot(lx, ly) || 1;
      // (only when it changes by a whole percent: repainting a planet is not free)
      const LX = Math.round(50 + (26 * lx) / len);
      const LY = Math.round(50 + (26 * ly) / len);
      if (LX !== p.lx || LY !== p.ly) {
        p.lx = LX;
        p.ly = LY;
        p.el.style.setProperty('--lx', `${LX}%`);
        p.el.style.setProperty('--ly', `${LY}%`);
      }
    }

    // the slow-moving decoration only needs ~30 updates a second (cheaper on phones);
    // forced updates (layout, drag, launch) always draw
    const now = performance.now();
    if (forceDecor || now - lastDecor > 30) {
      lastDecor = now;
      placeTails();
      placeBelt();
    }
    forceDecor = false;
    placePulses(); // small and fast: every frame, so they glide smoothly
    placeHolo(focus);
  }

  function placeTails() {
    const ptr = getPointer?.() ?? { x: 0, y: 0 };
    for (const t of tails) {
      const { p } = t;
      const e = p.ring === 'inner' ? geo.inner : geo.outer;
      const len = TAIL[p.ring];
      const pts = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) pts.push(orbitPoint(e, p.th - len + (len * i) / steps));
      const d = 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
      t.wide.setAttribute('d', d);
      t.thin.setAttribute('d', d);
      const [x1, y1] = pts[0];
      const [x2, y2] = pts[steps];
      t.grad.setAttribute('x1', x1.toFixed(1));
      t.grad.setAttribute('y1', y1.toFixed(1));
      t.grad.setAttribute('x2', x2.toFixed(1));
      t.grad.setAttribute('y2', y2.toFixed(1));
      // follow the planet's parallax, and fade on the far side like the planet does
      t.outerG.setAttribute('transform', `translate(${(-ptr.x * p.par).toFixed(1)} ${(-ptr.y * p.par * 0.7).toFixed(1)})`);
      t.g.setAttribute('opacity', (0.35 + 0.65 * ((Math.sin(p.th) + 1) / 2)).toFixed(2));
    }
  }

  function placeBelt() {
    const turn = clock * BELT_SPEED;
    for (const b of beltDots) {
      const a = b.a + turn;
      b.el.setAttribute('cx', (b.r * Math.cos(a)).toFixed(1));
      b.el.setAttribute('cy', (b.r * b.k * Math.sin(a)).toFixed(1));
      const o = Math.round((0.2 + 0.8 * ((Math.sin(a) + 1) / 2)) * 10) / 10;
      if (o !== b.o) {
        b.o = o;
        b.el.setAttribute('opacity', o);
      }
    }
  }

  function placePulses() {
    for (const pu of pulses) {
      const th = pu.phase + pu.dir * clock * PULSE_SPEED;
      const [x, y] = orbitPoint(pu.e, th);
      // each pulse shows up now and then: a soft swell over part of its cycle
      const c = ((clock + pu.offset) % pu.cycle) / pu.cycle;
      const life = c < 0.45 ? Math.sin((c / 0.45) * Math.PI) : 0;
      const near = 0.35 + 0.65 * ((Math.sin(th) + 1) / 2);
      pu.el.setAttribute('cx', x.toFixed(1));
      pu.el.setAttribute('cy', y.toFixed(1));
      pu.el.setAttribute('opacity', (life * near).toFixed(2));
    }
  }

  // ---------- guide line + hologram card for the planet under the mouse ----------

  function placeHolo(p) {
    if (guide) {
      guide.classList.toggle('on', !!p && !p.el.classList.contains('launching'));
      if (p) {
        const [sx, sy] = stationEdge(p);
        guide.setAttribute('x1', sx.toFixed(1));
        guide.setAttribute('y1', sy.toFixed(1));
        guide.setAttribute('x2', p.x.toFixed(1));
        guide.setAttribute('y2', p.y.toFixed(1));
        guide.style.stroke = p.d.accent2;
      }
    }
    if (p !== holoFor) {
      holoFor = p;
      if (p) {
        holo.style.setProperty('--accent', p.d.accent);
        holo.style.setProperty('--accent2', p.d.accent2);
        holo.innerHTML = `
          <p class="holo-kicker">${esc(p.d.kicker)}</p>
          <p class="holo-name">${esc(p.d.name)}</p>
          <p class="holo-desc">${esc(p.d.desc)}</p>
          <p class="holo-hint">${finePointer ? 'Click' : 'Enter'} to warp <span aria-hidden="true">↗</span></p>`;
        holo.classList.remove('show');
        holoSize = [holo.offsetWidth || 236, holo.offsetHeight || 120];
        holo.classList.add('show');
      } else {
        holo.classList.remove('show');
      }
    }
    if (p) {
      const [w, h] = holoSize;
      const r = (p.size * p.scale) / 2;
      let left = p.x + r + 18;
      let side = 'left';
      if (left + w > geo.W - 6) {
        left = p.x - r - 18 - w;
        side = 'right';
      }
      left = clamp(left, 6, geo.W - w - 6);
      const top = clamp(p.y - h / 2, 6, geo.H - h - 6);
      holo.style.left = `${left.toFixed(1)}px`;
      holo.style.top = `${top.toFixed(1)}px`;
      holo.style.transformOrigin = `${side} center`;
    }
  }

  /** Where a line from the station towards planet p leaves the station's disc. */
  function stationEdge(p) {
    const dx = p.x - geo.cx;
    const dy = p.y - geo.cy;
    const len = Math.hypot(dx, dy) || 1;
    const r = geo.station * 0.42;
    return [geo.cx + (dx / len) * r, geo.cy + (dy / len) * r];
  }

  // ---------- drag the empty space to spin the system ----------

  container.addEventListener('pointerdown', (e) => {
    if (frozen || e.button > 0 || !geo) return;
    if (e.target.closest('.planet-body, .station')) return;
    drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: performance.now(), vel: 0, moved: false };
  });
  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.x0) < 6) return;
      drag.moved = true;
      boost = 0;
      container.classList.add('dragging');
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        /* not essential */
      }
    }
    const now = performance.now();
    const dx = e.clientX - drag.x;
    // grab the near side: drag right and the planets in front move right with you
    const dTime = -dx / (SPEED.inner * geo.inner.rx);
    time += dTime;
    const dt = Math.max(0.008, (now - drag.t) / 1000);
    drag.vel = drag.vel * 0.5 + (dTime / dt) * 0.5;
    drag.x = e.clientX;
    drag.t = now;
    forceDecor = true;
    if (reducedMotion || !raf) place();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      // let go: it keeps spinning a little and settles back to its own pace
      if (!reducedMotion && performance.now() - drag.t < 120) boost = clamp(drag.vel, -45, 45);
      container.classList.remove('dragging');
    }
    drag = null;
  };
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);

  // ---------- animation loop ----------

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!frozen) {
      const target = hold > 0 && !drag ? 0 : 1;
      speed += (target - speed) * (1 - Math.exp(-dt * 5));
      time += dt * (speed + boost);
      boost *= Math.exp(-dt * 1.5);
      if (Math.abs(boost) < 0.02) boost = 0;
      clock += dt;
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
      boost = 0;
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
      forceDecor = true;
      place();
    },
    /**
     * Launch beam: a ray of light shoots from the station to the planet,
     * then the warp can begin. Resolves when the beam has arrived.
     */
    beam(id) {
      const p = planets.find((q) => q.d.id === id);
      if (!p || !geo || !beamEls || reducedMotion) return Promise.resolve();
      const [sx, sy] = stationEdge(p);
      const { glow, line, hit } = beamEls;
      for (const el of [glow, line]) {
        el.setAttribute('x1', sx.toFixed(1));
        el.setAttribute('y1', sy.toFixed(1));
        el.setAttribute('x2', p.x.toFixed(1));
        el.setAttribute('y2', p.y.toFixed(1));
      }
      fxSvg.style.setProperty('--beam', p.d.accent);
      fxSvg.style.setProperty('--beam2', p.d.accent2);
      hit.setAttribute('cx', p.x.toFixed(1));
      hit.setAttribute('cy', p.y.toFixed(1));
      hit.setAttribute('r', (p.size * 0.95).toFixed(1));
      // the beam grows from the station to the planet (dash trick with the real length)
      const L = Math.hypot(p.x - sx, p.y - sy).toFixed(1);
      for (const el of [glow, line]) el.style.strokeDasharray = `${L} ${L}`;
      const shoot = { duration: 240, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' };
      const anims = [
        line.animate([{ strokeDashoffset: L, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], shoot),
        glow.animate([{ strokeDashoffset: L, opacity: 0.9 }, { strokeDashoffset: 0, opacity: 0.9 }], shoot),
        hit.animate(
          [
            { transform: 'scale(0)', opacity: 0 },
            { transform: 'scale(0)', opacity: 0, offset: 0.45 },
            { transform: 'scale(0.35)', opacity: 1, offset: 0.62 },
            { transform: 'scale(1)', opacity: 0 },
          ],
          { duration: 560, fill: 'forwards' },
        ),
      ];
      return new Promise((resolve) => setTimeout(resolve, 260)).finally(() =>
        setTimeout(() => anims.forEach((a) => a.cancel()), 1600),
      );
    },
    /**
     * Saturn rings of the game planets (and the comet tails and light pulses).
     * They only show while a planet sits still in its orbit: they spin away
     * before an icon leaves its planet and swoop back in once an icon has landed.
     */
    hideRings({ instant = false, speed: slow = 1 } = {}) {
      container.classList.add('quiet');
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
          { duration: 280 * slow, easing: 'cubic-bezier(0.55, 0, 0.8, 0.3)', fill: 'forwards' },
        ),
      );
      return Promise.all(ringAnims.map((a) => a.finished.catch(() => {}))).then(() => {
        els.forEach((el) => (el.style.opacity = '0'));
        ringAnims.forEach((a) => a.cancel());
        ringAnims = [];
      });
    },
    showRings({ instant = false, speed: slow = 1 } = {}) {
      container.classList.remove('quiet');
      const els = ringEls();
      ringAnims.forEach((a) => a.cancel());
      els.forEach((el) => (el.style.opacity = ''));
      if (instant || reducedMotion) return Promise.resolve();
      ringAnims = els.map((el) => {
        // each part of a ring has its own resting opacity (glow, back half, front half)
        const rest = getComputedStyle(el).opacity;
        const planet = planets.findIndex((p) => p.el.contains(el));
        const order = planets.filter((p) => p.ring === 'outer').indexOf(planets[planet]);
        return el.animate(
          [
            { opacity: 0, transform: RING_ARRIVE },
            { opacity: rest, offset: 0.45 },
            { opacity: rest, transform: RING_REST },
          ],
          { duration: 720 * slow, delay: Math.max(0, order) * 110 * slow, easing: 'cubic-bezier(0.34, 1.45, 0.64, 1)', fill: 'backwards' },
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
