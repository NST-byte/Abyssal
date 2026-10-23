/* Hintergrund-Canvas: Wasser, Lichtstrahlen, Meeresschnee, leuchtende Wesen.
   Ändert sich mit der Tiefe und der Produktion. */
(function (AB) {
  'use strict';
  const Scene = {};
  const ZONES = [
    { top: [14, 82, 112], bot: [5, 30, 48], glow: ['#7ff6ff', '#a6ffde'], rays: 0.11 },
    { top: [9, 50, 78], bot: [3, 18, 34], glow: ['#5ff2e6', '#7fb8ff'], rays: 0.05 },
    { top: [5, 24, 48], bot: [1, 7, 18], glow: ['#5ff2e6', '#9d8cff', '#5f9dff'], rays: 0 },
    { top: [4, 12, 32], bot: [1, 2, 9], glow: ['#9d8cff', '#5ff2e6', '#ff7fd8'], rays: 0 },
    { top: [10, 5, 28], bot: [0, 0, 4], glow: ['#ff7fd8', '#ffb35f', '#9d8cff', '#ff5f7f'], rays: 0 },
  ];

  let cv, cx, W = 0, H = 0, dpr = 1;
  let snow = [], blobs = [];
  let depthF = 0, targetDepth = 0, intensity = 0;
  let reduced = false, lastStatic = 0, lastT = 0;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixColor(a, b, t) { return [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t))); }
  function zoneAt(f) {
    const i = Math.min(ZONES.length - 1, Math.floor(f));
    const j = Math.min(ZONES.length - 1, i + 1);
    const t = f - i;
    return { top: mixColor(ZONES[i].top, ZONES[j].top, t), bot: mixColor(ZONES[i].bot, ZONES[j].bot, t), rays: lerp(ZONES[i].rays, ZONES[j].rays, t), glow: ZONES[Math.round(f)].glow };
  }

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastStatic = 0;
  }

  function makeSnow() {
    snow = [];
    const n = Math.round(Math.min(110, W * H / 14000));
    for (let i = 0; i < n; i++) snow.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, v: Math.random() * 8 + 4, a: Math.random() * 0.4 + 0.15, ph: Math.random() * 6 });
  }

  function makeBlob(glow) {
    return {
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 26 + 10,
      vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 6,
      ph: Math.random() * 6.28, sp: Math.random() * 1.2 + 0.4,
      c: glow[Math.floor(Math.random() * glow.length)],
    };
  }

  Scene.init = function (canvas) {
    cv = canvas;
    cx = cv.getContext('2d');
    resize();
    makeSnow();
    window.addEventListener('resize', () => { resize(); makeSnow(); });
  };

  // Tiefe und "Lebendigkeit" (aus der Produktion) setzen
  Scene.setState = function (depth, lps, reducedMotion) {
    targetDepth = depth;
    reduced = !!reducedMotion;
    intensity = Math.min(1, Math.log10(1 + lps) / 14);
  };

  function wantedBlobs() {
    return Math.round(5 + targetDepth * 5 + intensity * 18);
  }

  Scene.frame = function (t) {
    if (!cx) return;
    const dt = Math.min(0.1, (t - lastT) / 1000 || 0);
    lastT = t;
    if (reduced) {
      depthF = targetDepth;
      if (t - lastStatic < 2000) return;
      lastStatic = t;
    } else {
      depthF += (targetDepth - depthF) * Math.min(1, dt * 0.8);
      if (Math.abs(targetDepth - depthF) < 0.002) depthF = targetDepth;
    }
    const z = zoneAt(depthF);
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + z.top.join(',') + ')');
    g.addColorStop(1, 'rgb(' + z.bot.join(',') + ')');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);

    // Lichtstrahlen von oben (nur flache Zonen)
    if (z.rays > 0.005) {
      cx.save();
      cx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = W * (0.12 + i * 0.2) + Math.sin(t / 4000 + i) * 40;
        const rg = cx.createLinearGradient(x, 0, x + 120, H * 0.8);
        rg.addColorStop(0, 'rgba(180,240,255,' + z.rays + ')');
        rg.addColorStop(1, 'rgba(180,240,255,0)');
        cx.fillStyle = rg;
        cx.beginPath();
        cx.moveTo(x - 30, 0); cx.lineTo(x + 50, 0); cx.lineTo(x + 260, H * 0.85); cx.lineTo(x + 80, H * 0.85);
        cx.closePath(); cx.fill();
      }
      cx.restore();
    }

    // leuchtende Wesen
    const want = wantedBlobs();
    while (blobs.length < want) blobs.push(makeBlob(z.glow));
    if (blobs.length > want) blobs.length = want;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      if (!reduced) {
        b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(t / 1300 + b.ph) * 4 * dt;
        if (b.x < -60) b.x = W + 60; if (b.x > W + 60) b.x = -60;
        if (b.y < -60) b.y = H + 60; if (b.y > H + 60) b.y = -60;
      }
      const pulse = 0.55 + 0.45 * Math.sin(t / 1000 * b.sp + b.ph);
      const r = b.r * (0.8 + pulse * 0.4);
      const rg = cx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.4);
      rg.addColorStop(0, hexA(b.c, 0.32 * pulse + 0.06));
      rg.addColorStop(0.35, hexA(b.c, 0.1 * pulse));
      rg.addColorStop(1, hexA(b.c, 0));
      cx.fillStyle = rg;
      cx.beginPath(); cx.arc(b.x, b.y, r * 2.4, 0, 6.283); cx.fill();
      cx.fillStyle = hexA('#ffffff', 0.35 * pulse);
      cx.beginPath(); cx.arc(b.x, b.y, Math.max(1, r * 0.08), 0, 6.283); cx.fill();
    }
    cx.restore();

    // Meeresschnee
    cx.fillStyle = '#dff6ff';
    for (const s of snow) {
      if (!reduced) {
        s.y += s.v * dt; s.x += Math.sin(t / 2000 + s.ph) * 3 * dt;
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
      }
      cx.globalAlpha = s.a * (1 - depthF * 0.12);
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.283); cx.fill();
    }
    cx.globalAlpha = 1;

    // Vignette
    const vg = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,' + (0.35 + depthF * 0.08) + ')');
    cx.fillStyle = vg;
    cx.fillRect(0, 0, W, H);
  };

  const hexCache = {};
  function hexA(hex, a) {
    let rgb = hexCache[hex];
    if (!rgb) {
      const n = parseInt(hex.slice(1), 16);
      rgb = hexCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
    }
    return 'rgba(' + rgb + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }

  AB.Scene = Scene;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
