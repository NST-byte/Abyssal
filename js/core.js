/* Zeitsimulation, Verarbeitungsketten, Strömungen, Offline-Fortschritt,
   Gezeitenwende, Tiefenproben und Weltenwende */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const A = AB.Actions;
  const S = AB.State;
  const U = AB.Unlocks;
  const Core = {};

  // ---- Strömungen -----------------------------------------------------------
  function forecastLen(st) { return Math.min(4, 1 + E.agg(st).currentForecast); }
  function rollCurrent(st, avoid) {
    const pool = C.CURRENTS.types.filter((t) => t.id !== avoid);
    return pool[Math.floor(S.rand(st) * pool.length) % pool.length].id;
  }
  Core.ensureCurrent = function (st) {
    if (st.depth < C.CURRENTS.depth) return;
    if (!st.current) {
      st.current = { type: rollCurrent(st), endsAt: st.time + C.CURRENTS.period, queue: [], charge: C.CURRENTS.holdRecharge };
    }
    while (st.current.queue.length < forecastLen(st)) {
      const last = st.current.queue.length ? st.current.queue[st.current.queue.length - 1] : st.current.type;
      st.current.queue.push(rollCurrent(st, last));
    }
  };
  function nextCurrent(st) {
    const cur = st.current;
    cur.type = cur.queue.shift() || rollCurrent(st, cur.type);
    cur.endsAt += C.CURRENTS.period;
    cur.charge = Math.min(C.CURRENTS.holdRecharge, cur.charge + 1);
    Core.ensureCurrent(st);
    E.invalidate();
  }

  // ---- Hauptsimulation ------------------------------------------------------
  // Produktion ist innerhalb eines Schritts linear. Schritte werden an
  // Buff-, Expeditions- und Strömungsgrenzen geteilt.
  // opts.prodMult: Faktor für alle Rohproduktionen (z. B. Offline-Bonus)
  Core.advance = function (st, dt, opts) {
    const notes = [];
    if (!(dt > 0) || !isFinite(dt)) return notes;
    const pm = (opts && opts.prodMult) || 1;
    let remaining = dt;
    let guard = 0;
    Core.ensureCurrent(st);
    while (remaining > 1e-9 && guard++ < 200000) {
      let step = Math.min(remaining, C.MAX_STEP);
      for (const b of st.buffs) if (b.until > st.time) step = Math.min(step, b.until - st.time);
      for (const m of st.map.missions) if (m.endsAt > st.time) step = Math.min(step, m.endsAt - st.time);
      if (st.current && st.current.endsAt > st.time) step = Math.min(step, st.current.endsAt - st.time);
      step = Math.max(step, 1e-6);

      const f = E.flows(st);
      const lps = E.lps(st) * pm, mps = E.mps(st) * pm, dps = E.dps(st) * pm;
      const ch = E.chainStep(st, step, lps, mps, dps, f);
      const R = st.res, M = C.MAX_VALUE;
      R.lumen = Math.min(M, Math.max(0, R.lumen + (lps - ch.useLumen) * step));
      R.mangan = Math.min(M, Math.max(0, R.mangan + (mps - ch.useMangan) * step));
      R.data = Math.min(M, Math.max(0, R.data + (dps - ch.useData) * step));
      R.alloy = Math.min(M, Math.max(0, R.alloy + (ch.alloy - ch.useAlloy) * step));
      R.crystal = Math.min(M, Math.max(0, R.crystal + ch.crystal * step));
      st.run.lumen += lps * step; st.run.mangan += mps * step; st.run.data += dps * step;
      st.run.alloy += ch.alloy * step; st.run.crystal += ch.crystal * step;
      st.stats.lumenAll += lps * step; st.stats.manganAll += mps * step; st.stats.dataAll += dps * step;
      st.stats.alloyAll += ch.alloy * step; st.stats.crystalAll += ch.crystal * step;
      st.time += step;
      st.run.time += step;
      st.stats.playTime += step;
      remaining -= step;

      if (st.buffs.length) {
        const before = st.buffs.length;
        st.buffs = st.buffs.filter((b) => b.until > st.time + 1e-9);
        if (st.buffs.length !== before) E.invalidate();
      }
      for (const m of st.map.missions.slice()) {
        if (st.time >= m.endsAt - 1e-9) notes.push({ type: 'scan', sector: A.completeScan(st, m) });
      }
      if (st.current && st.time >= st.current.endsAt - 1e-9) { nextCurrent(st); notes.push({ type: 'current' }); }
      if (A.autobuy(st) > 0) notes.push({ type: 'auto' });
      const pr = Core.checkProbe(st);
      if (pr) notes.push(pr);
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
    const before = Object.assign({}, st.res);
    const notes = Core.advance(st, credited, { prodMult: E.agg(st).offlineMult });
    st.events.nextAt = st.time + C.EVENTS.minDelay * 0.5;
    const gain = {};
    for (const k in st.res) gain[k] = st.res[k] - before[k];
    return {
      away, credited, capped: away > cap, cap, gain, mult: E.agg(st).offlineMult,
      scans: notes.filter((n) => n.type === 'scan').map((n) => n.sector),
      currents: notes.filter((n) => n.type === 'current').length,
      probes: notes.filter((n) => n.type === 'probe'),
    };
  };

  // ---- Tiefenproben ---------------------------------------------------------
  Core.checkProbe = function (st) {
    if (!st.probe) return null;
    const goal = C.PROBES.goals[st.probe.level - 1];
    if (st.depth < goal) return null;
    const id = st.probe.id, level = st.probe.level;
    st.probes[id] = Math.max(st.probes[id] || 0, level);
    st.probe = null;
    E.invalidate();
    return { type: 'probe', id, level };
  };

  Core.canStartProbe = function (st, id) {
    const p = C.PROBE_BY_ID[id];
    if (!p) return 'Unbekannt.';
    if (st.prestige.total < 1) return 'Tiefenproben gibt es ab der ersten Gezeitenwende.';
    if (st.probe) return 'Es läuft bereits eine Probe.';
    if ((st.probes[id] || 0) >= C.PROBES.goals.length) return 'Alle Stufen bestanden.';
    const lvl = (st.probes[id] || 0) + 1;
    const goal = C.PROBES.goals[lvl - 1];
    if (!E.depthAllowed(st, goal)) return 'Ziel ' + C.DEPTHS[goal].name + ' ist für dich noch nicht erreichbar.';
    return '';
  };

  // Startet eine Probe: neuer Lauf mit Sonderregel. Keine Perlen für den alten Lauf.
  Core.startProbe = function (st, id) {
    const why = Core.canStartProbe(st, id);
    if (why) return { ok: false, reason: why };
    const level = (st.probes[id] || 0) + 1;
    S.resetRun(st, { probe: { id, level }, archetype: st.world.origin.o_heritage ? st.prestige.nextArchetype : 'none' });
    E.invalidate();
    return { ok: true, level };
  };

  Core.abandonProbe = function (st) {
    if (!st.probe) return { ok: false, reason: 'Keine Probe aktiv.' };
    st.probe = null;
    E.invalidate();
    return { ok: true };
  };

  // ---- Gezeitenwende --------------------------------------------------------
  Core.canPrestige = (st) => st.depth >= C.PRESTIGE.requireDepth && E.prestigeGain(st) >= 1;

  // opts.respec: Gezeiten-Baum vollständig erstatten
  Core.prestige = function (st, opts) {
    opts = opts || {};
    if (!Core.canPrestige(st)) return { ok: false, reason: 'Hadal erreichen und mindestens 1 Perle verdienen.' };
    const gain = E.prestigeGain(st);
    const runTime = st.run.time;
    st.perlen += gain;
    st.prestige.perlenEarned += gain;
    st.prestige.perlenAll += gain;
    st.prestige.count++;
    st.prestige.total++;
    if (!st.prestige.bestRunTime || runTime < st.prestige.bestRunTime) st.prestige.bestRunTime = runTime;
    let refunded = 0;
    if (opts.respec) {
      refunded = A.treeSpent(st);
      st.perlen += refunded;
      for (const k in st.prestige.tree) st.prestige.tree[k] = 0;
    }
    S.resetRun(st, { archetype: st.world.origin.o_heritage ? st.prestige.nextArchetype : 'none' });
    E.invalidate();
    return { ok: true, gain, runTime, refunded };
  };

  // ---- Weltenwende ----------------------------------------------------------
  Core.canWorld = (st) => st.depth >= C.WORLD.requireDepth && E.worldGain(st) >= 1;

  Core.worldTurn = function (st) {
    if (!Core.canWorld(st)) return { ok: false, reason: 'Herzkammer erreichen und genug Perlen in diesem Zyklus sammeln.' };
    const gain = E.worldGain(st);
    st.world.urlicht += gain;
    st.world.urlichtAll += gain;
    st.world.count++;
    S.resetCycle(st);
    S.resetRun(st, { archetype: st.world.origin.o_heritage ? st.prestige.nextArchetype : 'none' });
    E.invalidate();
    return { ok: true, gain };
  };

  AB.Core = Core;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
