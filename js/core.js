/* Zeitsimulation, Offline-Fortschritt und Gezeitenwende */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const A = AB.Actions;
  const Core = {};

  // Produktion ist innerhalb eines Schritts linear. Schritte werden an
  // Buff-Enden und Expeditions-Enden geteilt, damit nichts zu lang/kurz wirkt.
  Core.advance = function (st, dt) {
    const notes = [];
    if (!(dt > 0) || !isFinite(dt)) return notes;
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-9 && guard++ < 100000) {
      let step = Math.min(remaining, C.MAX_STEP);
      for (const b of st.buffs) if (b.until > st.time) step = Math.min(step, b.until - st.time);
      const ex = st.expedition.active;
      if (ex && ex.endsAt > st.time) step = Math.min(step, ex.endsAt - st.time);
      step = Math.max(step, 1e-6);

      const l = E.lps(st) * step;
      const m = E.mps(st) * step;
      const d = E.dps(st) * step;
      st.res.lumen = Math.min(C.MAX_VALUE, st.res.lumen + l);
      st.res.mangan = Math.min(C.MAX_VALUE, st.res.mangan + m);
      st.res.data = Math.min(C.MAX_VALUE, st.res.data + d);
      st.run.lumen += l; st.run.mangan += m; st.run.data += d;
      st.stats.lumenAll += l; st.stats.manganAll += m; st.stats.dataAll += d;
      st.time += step;
      st.run.time += step;
      st.stats.playTime += step;
      remaining -= step;

      if (st.buffs.length) st.buffs = st.buffs.filter((b) => b.until > st.time + 1e-9);
      if (ex && st.time >= ex.endsAt - 1e-9) {
        const id = A.completeExpedition(st);
        if (id) notes.push({ type: 'expedition', id });
      }
      if (A.autobuy(st) > 0) notes.push({ type: 'autobuy' });
    }
    return notes;
  };

  // Offline-Zeit anrechnen (gedeckelt). Liefert einen Bericht.
  Core.applyOffline = function (st, nowMs) {
    const away = Math.max(0, (nowMs - st.lastTick) / 1000);
    st.lastTick = nowMs;
    if (away < C.OFFLINE.minSeconds) {
      if (away > 0) Core.advance(st, away);
      return null;
    }
    const cap = E.offlineCapSeconds(st);
    const credited = Math.min(away, cap);
    const before = { lumen: st.res.lumen, mangan: st.res.mangan, data: st.res.data };
    const notes = Core.advance(st, credited);
    st.events.nextAt = st.time + C.EVENTS.minDelay * 0.5;
    return {
      away, credited, capped: away > cap, cap,
      gain: { lumen: st.res.lumen - before.lumen, mangan: st.res.mangan - before.mangan, data: st.res.data - before.data },
      expeditions: notes.filter((n) => n.type === 'expedition').map((n) => n.id),
    };
  };

  Core.canPrestige = (st) => st.depth >= C.PRESTIGE.requireDepth && E.prestigeGain(st) >= 1;

  Core.prestige = function (st) {
    if (!Core.canPrestige(st)) return { ok: false, reason: 'Hadal erreichen und mindestens 1 Perle verdienen.' };
    const gain = E.prestigeGain(st);
    const runTime = st.run.time;
    st.perlen += gain;
    st.prestige.perlenEarned += gain;
    st.prestige.count++;
    if (!st.prestige.bestRunTime || runTime < st.prestige.bestRunTime) st.prestige.bestRunTime = runTime;
    AB.State.resetRun(st);
    E.invalidate();
    return { ok: true, gain, runTime };
  };

  AB.Core = Core;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
