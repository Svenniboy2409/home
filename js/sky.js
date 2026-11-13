// The star canvas: three depth layers of twinkling stars with parallax,
// shooting stars you can catch, spark bursts, a meteor shower and the
// hyperspace warp used when launching an app.

const TINTS = ['255,255,255', '255,255,255', '214,228,255', '255,236,206', '206,255,244'];
const SHOWER_TINTS = ['255,215,106', '159,232,255', '255,154,213', '185,164,255', '255,255,255'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');

export function createSky(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars = [];
  let shooting = [];
  let sparks = [];
  let raf = 0;
  let last = performance.now();
  let nextShoot = last + rand(3500, 7000);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const warp = { active: false, t: 0, dur: 0.9, ox: 0, oy: 0, rgb: '255,255,255', streaks: [] };

  function makeStar() {
    const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;
    const depth = [0.25, 0.55, 1][layer];
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      d: depth,
      r: (layer === 2 ? rand(0.9, 1.7) : layer === 1 ? rand(0.6, 1.15) : rand(0.35, 0.8)),
      a: rand(0.35, 1),
      sp: rand(0.4, 2.2),
      ph: Math.random() * Math.PI * 2,
      tint: pick(TINTS),
      flare: layer === 2 && Math.random() < 0.18,
    };
  }

  function resize() {
    const prevW = W || window.innerWidth;
    const prevH = H || window.innerHeight;
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.max(120, Math.min(420, Math.round((W * H) / 4200)));
    if (!stars.length) {
      stars = Array.from({ length: target }, makeStar);
    } else {
      for (const s of stars) {
        s.x *= W / prevW;
        s.y *= H / prevH;
      }
      while (stars.length < target) stars.push(makeStar());
      if (stars.length > target) stars.length = target;
    }
    if (reducedMotion) draw(performance.now(), 0);
  }

  // ---------- shooting stars & sparks ----------

  function spawnShootingStar(opts = {}) {
    const speed = opts.speed ?? rand(520, 760);
    const fromRight = opts.fromRight ?? Math.random() < 0.72;
    const ang = (rand(18, 34) * Math.PI) / 180;
    const vx = (fromRight ? -1 : 1) * Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    shooting.push({
      x: opts.x ?? (fromRight ? rand(W * 0.35, W * 1.1) : rand(-W * 0.1, W * 0.65)),
      y: opts.y ?? rand(-H * 0.05, H * 0.4),
      vx,
      vy,
      len: opts.len ?? rand(140, 240),
      life: opts.life ?? rand(1.5, 2.3),
      age: -(opts.delay ?? 0),
      rgb: opts.rgb ?? '255,255,255',
      w: opts.w ?? rand(1.4, 2.2),
    });
  }

  function burst(x, y, rgbList = ['255,215,106', '255,255,255'], count = 30) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(60, 280);
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.55, 1.1),
        age: 0,
        r: rand(1, 2.6),
        rgb: pick(rgbList),
      });
    }
    kick();
  }

  // ---------- drawing ----------

  function drawStars(now, dt) {
    const t = now / 1000;
    const px = pointer.x;
    const py = pointer.y;
    for (const s of stars) {
      if (!reducedMotion) {
        s.x -= s.d * 2.2 * dt; // slow drift so the sky feels alive
        if (s.x < -4) s.x += W + 8;
      }
      let x = s.x - px * 22 * s.d;
      let y = s.y - py * 14 * s.d;
      x = ((x % W) + W) % W;
      const tw = reducedMotion ? 0.9 : 0.62 + 0.38 * Math.sin(t * s.sp + s.ph);
      const alpha = s.a * tw;
      ctx.fillStyle = `rgba(${s.tint},${alpha})`;
      if (s.r < 0.9) {
        ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        // soft halo for the bright ones
        ctx.fillStyle = `rgba(${s.tint},${alpha * 0.12})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        if (s.flare) {
          const f = s.r * 5 * tw;
          ctx.strokeStyle = `rgba(${s.tint},${alpha * 0.45})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - f, y);
          ctx.lineTo(x + f, y);
          ctx.moveTo(x, y - f);
          ctx.lineTo(x, y + f);
          ctx.stroke();
        }
      }
    }
  }

  function drawShooting(dt) {
    for (let i = shooting.length - 1; i >= 0; i--) {
      const s = shooting[i];
      s.age += dt;
      if (s.age < 0) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.age > s.life) {
        shooting.splice(i, 1);
        continue;
      }
      const fadeIn = Math.min(1, s.age / 0.18);
      const fadeOut = Math.min(1, (s.life - s.age) / 0.45);
      const a = Math.min(fadeIn, fadeOut);
      const sp = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / sp) * s.len * fadeIn;
      const ty = s.y - (s.vy / sp) * s.len * fadeIn;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, `rgba(${s.rgb},${a})`);
      g.addColorStop(0.25, `rgba(${s.rgb},${a * 0.45})`);
      g.addColorStop(1, `rgba(${s.rgb},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = s.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 10);
      hg.addColorStop(0, `rgba(255,255,255,${a})`);
      hg.addColorStop(0.3, `rgba(${s.rgb},${a * 0.5})`);
      hg.addColorStop(1, `rgba(${s.rgb},0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) {
        sparks.splice(i, 1);
        continue;
      }
      p.vx *= 1 - 2.2 * dt;
      p.vy = p.vy * (1 - 2.2 * dt) + 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      ctx.fillStyle = `rgba(${p.rgb},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function startWarpStreaks() {
    const maxD = Math.hypot(W, H);
    warp.streaks = Array.from({ length: Math.min(520, stars.length + 200) }, () => ({
      ang: Math.random() * Math.PI * 2,
      d: rand(4, maxD * 0.6),
      w: rand(0.6, 2),
      tint: pick(TINTS),
    }));
  }

  function drawWarp(dt) {
    warp.t += dt;
    const p = Math.min(1, warp.t / warp.dur);
    const speed = 0.25 + 9 * p * p;
    const stretch = 0.04 + 0.55 * p * p;
    const maxD = Math.hypot(W, H);
    for (const s of warp.streaks) {
      s.d += s.d * speed * dt + 30 * speed * dt;
      if (s.d > maxD) {
        s.d = rand(4, 40);
        s.ang = Math.random() * Math.PI * 2;
      }
      const cx = Math.cos(s.ang);
      const cy = Math.sin(s.ang);
      const d0 = s.d * (1 - stretch);
      const a = Math.min(1, s.d / 120) * (0.5 + 0.5 * p);
      const rgb = p > 0.5 && Math.random() < 0.5 ? warp.rgb : s.tint;
      ctx.strokeStyle = `rgba(${rgb},${a})`;
      ctx.lineWidth = s.w * (1 + p * 1.6);
      ctx.beginPath();
      ctx.moveTo(warp.ox + cx * d0, warp.oy + cy * d0);
      ctx.lineTo(warp.ox + cx * s.d, warp.oy + cy * s.d);
      ctx.stroke();
    }
  }

  function draw(now, dt) {
    ctx.clearRect(0, 0, W, H);
    if (warp.active) {
      drawWarp(dt);
    } else {
      drawStars(now, dt);
      drawShooting(dt);
    }
    drawSparks(dt);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const ease = 1 - Math.exp(-dt * 3.2);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;

    if (!reducedMotion && !warp.active && now > nextShoot) {
      spawnShootingStar();
      nextShoot = now + rand(6000, 14000);
    }
    draw(now, dt);

    const busy = warp.active || shooting.length || sparks.length;
    if (!reducedMotion || busy) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      nextShoot = performance.now() + rand(3000, 8000);
      kick();
    }
  });
  window.addEventListener('resize', resize);
  resize();
  if (reducedMotion) draw(performance.now(), 0);
  else kick();

  return {
    setPointer(nx, ny) {
      if (reducedMotion) return;
      pointer.tx = Math.max(-1, Math.min(1, nx));
      pointer.ty = Math.max(-1, Math.min(1, ny));
    },
    get pointer() {
      return pointer;
    },
    warp({ x = W / 2, y = H / 2, color = '#ffffff', duration = 900 } = {}) {
      warp.active = true;
      warp.t = 0;
      warp.dur = duration / 1000;
      warp.ox = x;
      warp.oy = y;
      warp.rgb = hexToRgb(color);
      shooting = [];
      startWarpStreaks();
      kick();
      return new Promise((resolve) => setTimeout(resolve, duration));
    },
    reset() {
      warp.active = false;
      warp.t = 0;
      sparks = [];
      if (reducedMotion) draw(performance.now(), 0);
      kick();
    },
    /** Returns the catch position if a shooting star was near (x, y). */
    tryCatch(x, y, radius = 46) {
      for (let i = 0; i < shooting.length; i++) {
        const s = shooting[i];
        if (s.age < 0) continue;
        const sp = Math.hypot(s.vx, s.vy);
        // distance to the bright front part of the trail
        const tx = s.x - (s.vx / sp) * 70;
        const ty = s.y - (s.vy / sp) * 70;
        const vx = s.x - tx;
        const vy = s.y - ty;
        const t = Math.max(0, Math.min(1, ((x - tx) * vx + (y - ty) * vy) / (vx * vx + vy * vy)));
        const dist = Math.hypot(x - (tx + vx * t), y - (ty + vy * t));
        if (dist < radius) {
          shooting.splice(i, 1);
          burst(s.x, s.y, ['255,215,106', '255,255,255', s.rgb], 34);
          return { x: s.x, y: s.y };
        }
      }
      return null;
    },
    burst,
    meteorShower() {
      for (let i = 0; i < 40; i++) {
        spawnShootingStar({
          delay: i * 0.1 + rand(0, 0.25),
          speed: rand(700, 1050),
          len: rand(160, 300),
          life: rand(1.3, 2),
          fromRight: true,
          rgb: pick(SHOWER_TINTS),
          w: rand(1.6, 2.8),
          x: rand(W * 0.2, W * 1.25),
          y: rand(-H * 0.25, H * 0.3),
        });
      }
      kick();
    },
    spawnShootingStar(opts) {
      spawnShootingStar(opts);
      kick();
    },
  };
}
