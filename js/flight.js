// Icon flight between views.
//
// When you switch between List, Tiles and Orbit, every icon flies from its old
// spot to its new one and changes shape on the way: a rounded square (cards and
// tiles) becomes a round planet, or the other way round.
//
// This is done with real elements and the Web Animations API instead of the
// browser's View Transitions, so it looks the same in Safari, Chrome and Firefox:
//   1. lift off: a copy ("flyer") appears exactly on top of each icon and the
//      real icon hides underneath; the rest of the old view fades out;
//   2. switch: the new view is put in place (still invisible) and measured;
//   3. fly: each flyer moves and resizes to its new spot while its corners,
//      zoom, glow, depth shading and brightness blend into the new look;
//      meanwhile the new view fades in;
//   4. land: the real icons reappear exactly where the flyers stop.

const px = (n) => `${n.toFixed(2)}px`;

/** How an icon looks right now: where it is and what shape and glow it has. */
function measure(el) {
  const r = el.getBoundingClientRect();
  const round = el.classList.contains('planet-body');
  // planets get a brightness filter for depth on their parent link
  const planetStyle = round ? getComputedStyle(el.parentElement) : null;
  const filter = round ? planetStyle.filter : 'none';
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    round,
    radius: round ? '50%' : '28%',
    zoom: round ? 1.18 : 1, // planets show the icon slightly zoomed in
    shadow: getComputedStyle(el).boxShadow,
    brightness: /brightness\(([\d.]+)\)/.exec(filter)?.[1] ?? '1',
    // which side of the planet the station lights up
    light: round ? [planetStyle.getPropertyValue('--lx').trim(), planetStyle.getPropertyValue('--ly').trim()] : null,
  };
}

function frame(m) {
  return {
    left: px(m.left),
    top: px(m.top),
    width: px(m.width),
    height: px(m.height),
    borderRadius: m.radius,
    boxShadow: m.shadow,
    filter: `brightness(${m.brightness})`,
  };
}

const settle = (animations) => Promise.all(animations.map((a) => a.finished.catch(() => {})));

/**
 * @param {object} o
 * @param {string[]} o.ids              destinations to fly
 * @param {(id: string) => string} o.srcOf      icon image for a destination
 * @param {(id: string) => Element|null} o.fromIcon  icon element in the old view
 * @param {(id: string) => Element|null} o.toIcon    icon element in the new view
 * @param {() => void} o.apply          switches the view (called once, mid-way)
 * @param {Element[]} o.fadeOut         elements that fade out before the switch
 * @param {() => Element[]} o.fadeIn    elements that fade in after the switch
 * @param {number} [o.speed=1]          >1 slows everything down (for previews)
 */
export async function flyIcons({ ids, srcOf, fromIcon, toIcon, apply, fadeOut, fadeIn, speed = 1 }) {
  const lift = 170 * speed;
  const duration = 620 * speed;
  const stagger = 24 * speed;
  const easing = 'cubic-bezier(0.45, 0, 0.15, 1)';

  // 1. lift off
  const layer = document.createElement('div');
  layer.className = 'flight-layer';
  layer.setAttribute('aria-hidden', 'true');
  const flights = [];
  for (const id of ids) {
    const el = fromIcon(id);
    if (!el) continue;
    const from = measure(el);
    const flyer = document.createElement('div');
    flyer.className = 'flyer';
    Object.assign(flyer.style, frame(from));
    const img = document.createElement('img');
    img.src = srcOf(id);
    img.alt = '';
    img.style.transform = `scale(${from.zoom})`;
    const shade = document.createElement('span');
    shade.className = 'flyer-shade';
    shade.style.opacity = from.round ? '1' : '0';
    if (from.light) {
      shade.style.setProperty('--lx', from.light[0]);
      shade.style.setProperty('--ly', from.light[1]);
    }
    flyer.append(img, shade);
    layer.appendChild(flyer);
    flights.push({ id, el, from, flyer, img, shade });
  }
  // let the copies decode their image first, so the swap with the real icons is invisible
  const decoded = Promise.all(flights.map((f) => f.img.decode?.().catch(() => {})));
  await Promise.race([decoded, new Promise((r) => setTimeout(r, 120))]);
  document.body.appendChild(layer);
  flights.forEach((f) => (f.el.style.visibility = 'hidden'));

  const outs = fadeOut.map((el) =>
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: lift, easing: 'ease-in', fill: 'forwards' }),
  );
  await settle(outs);

  // 2. switch and measure the new spots
  flights.forEach((f) => (f.el.style.visibility = ''));
  apply();
  const ins = fadeIn().map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: duration * 0.8,
      delay: duration * 0.15,
      easing: 'ease-out',
      fill: 'both',
    }),
  );
  outs.forEach((a) => a.cancel()); // the fade-ins now hold these at opacity 0
  for (const f of flights) {
    f.target = toIcon(f.id);
    if (!f.target) continue;
    f.to = measure(f.target);
    f.target.style.visibility = 'hidden';
    if (f.to.light) {
      // landing on a planet: shade it from the same side the station lights it
      f.shade.style.setProperty('--lx', f.to.light[0]);
      f.shade.style.setProperty('--ly', f.to.light[1]);
    }
  }

  // 3. fly
  const flying = [];
  flights.forEach((f, i) => {
    const timing = { duration, delay: i * stagger, easing, fill: 'forwards' };
    if (!f.to) {
      flying.push(f.flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: lift, fill: 'forwards' }));
      return;
    }
    flying.push(
      f.flyer.animate([frame(f.from), frame(f.to)], timing),
      f.img.animate([{ transform: `scale(${f.from.zoom})` }, { transform: `scale(${f.to.zoom})` }], timing),
      f.shade.animate([{ opacity: f.from.round ? 1 : 0 }, { opacity: f.to.round ? 1 : 0 }], timing),
    );
  });
  await settle(flying);

  // 4. land
  flights.forEach((f) => f.target && (f.target.style.visibility = ''));
  layer.remove();
  await settle(ins);
  ins.forEach((a) => a.cancel());
}
