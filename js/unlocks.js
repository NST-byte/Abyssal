/* Bedingungen, Freischaltungen, Aufträge und Logbuch */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const U = {};

  const count = (o) => { let n = 0; for (const k in o) if (o[k]) n++; return n; };
  const sum = (o) => { let n = 0; for (const k in o) n += o[k] || 0; return n; };

  // Liefert die Teilbedingungen mit aktuellem Wert, Zielwert und Beschriftung
  U.parts = function (st, c) {
    const out = [];
    if (c.all) { c.all.forEach((x) => out.push(...U.parts(st, x))); return out; }
    if (c.gen) out.push({ cur: st.gens[c.gen] || 0, need: c.n, label: C.GEN_BY_ID[c.gen].name });
    if (c.miner) out.push({ cur: st.miners[c.miner] || 0, need: c.n, label: C.MINER_BY_ID[c.miner].name });
    if (c.clicks !== undefined) out.push({ cur: st.stats.clicks, need: c.clicks, label: 'Pulse' });
    if (c.upgrades !== undefined) out.push({ cur: count(st.upgrades), need: c.upgrades, label: 'Verbesserungen' });
    if (c.lumenRun !== undefined) out.push({ cur: st.run.lumen, need: c.lumenRun, label: 'Lumen (dieser Lauf)', big: true });
    if (c.lumenAll !== undefined) out.push({ cur: st.stats.lumenAll, need: c.lumenAll, label: 'Lumen gesamt', big: true });
    if (c.depth !== undefined) out.push({ cur: st.depth, need: c.depth, label: C.DEPTHS[c.depth].name + ' erreichen', bool: true });
    if (c.reinforce !== undefined) out.push({ cur: sum(st.reinforce), need: c.reinforce, label: 'Verstärkungsstufen' });
    if (c.events !== undefined) out.push({ cur: st.stats.events, need: c.events, label: 'Irrlichter gefangen' });
    if (c.buildings !== undefined) out.push({ cur: E.buildings(st), need: c.buildings, label: 'Anlagen insgesamt' });
    if (c.research !== undefined) out.push({ cur: count(st.research), need: c.research, label: 'Forschungen' });
    if (c.protocol !== undefined) out.push({ cur: st.protocols.length, need: c.protocol, label: 'Protokoll aktiv', bool: true });
    if (c.expeditions !== undefined) out.push({ cur: st.stats.expeditions, need: c.expeditions, label: 'Expeditionen' });
    if (c.abilityUses !== undefined) out.push({ cur: st.stats.abilityUses, need: c.abilityUses, label: 'Überladungen' });
    if (c.prestiges !== undefined) out.push({ cur: st.prestige.count, need: c.prestiges, label: 'Gezeitenwenden' });
    if (c.prestigesMin !== undefined) out.push({ cur: st.prestige.count, need: c.prestigesMin, label: 'nach einer Gezeitenwende', bool: true });
    if (c.shopLevels !== undefined) out.push({ cur: sum(st.prestige.shop), need: c.shopLevels, label: 'Perlen-Stufen gekauft' });
    return out;
  };

  U.met = function (st, c) {
    if (!c) return true;
    return U.parts(st, c).every((p) => p.cur >= p.need);
  };

  U.progress = function (st, c) {
    const ps = U.parts(st, c);
    if (!ps.length) return 1;
    let p = 1;
    ps.forEach((x) => { p = Math.min(p, x.need > 0 ? Math.min(1, x.cur / x.need) : 1); });
    return p;
  };

  // ---- Upgrades -------------------------------------------------------------
  U.upgradeVisible = function (st, u) {
    if (st.upgrades[u.id]) return false;
    return U.met(st, u.req);
  };
  U.availableUpgrades = function (st) {
    return C.UPGRADES.filter((u) => U.upgradeVisible(st, u)).sort((a, b) => a.cost - b.cost);
  };

  // ---- Forschung ------------------------------------------------------------
  U.researchState = function (st, r) {
    if (st.research[r.id]) return 'done';
    if (st.depth < r.depth) return 'depth';
    if (r.req && !r.req.every((id) => st.research[id])) return 'req';
    return 'open';
  };

  // ---- Feature-Flags (für Tabs und Hinweise) --------------------------------
  U.features = function (st) {
    const anyUpgradeSeen = count(st.upgrades) > 0 || U.availableUpgrades(st).length > 0;
    return {
      upgrades: anyUpgradeSeen || st.depth > 0 || st.prestige.count > 0,
      mangan: st.depth >= 1,
      reinforce: st.depth >= 1,
      data: st.depth >= 2,
      research: st.depth >= 2,
      protocols: E.agg(st).protocolUnlock,
      ability: E.agg(st).ability,
      expeditions: st.depth >= 3,
      prestigeTab: st.depth >= 3 || st.prestige.count > 0,
      prestige: st.depth >= C.PRESTIGE.requireDepth,
      events: st.stats.lumenAll >= 500 || st.prestige.count > 0,
    };
  };

  // ---- Aufträge -------------------------------------------------------------
  U.activeMissions = function (st) {
    const out = [];
    for (const m of C.MISSIONS) {
      if (st.missions[m.id]) continue;
      out.push(m);
      if (out.length >= C.MISSIONS_VISIBLE) break;
    }
    return out;
  };

  U.missionReward = function (st, m) {
    const r = m.reward, out = {};
    if (r.lumen) out.lumen = r.lumen;
    if (r.lumenSec) out.lumen = Math.max(r.lumenMin || 0, E.lps(st, true) * r.lumenSec, E.clickValue(st) * 20);
    if (r.mangan) out.mangan = r.mangan;
    if (r.data) out.data = r.data;
    return out;
  };

  U.grant = function (st, res) {
    for (const k in res) {
      st.res[k] = Math.min(C.MAX_VALUE, (st.res[k] || 0) + res[k]);
      if (k === 'lumen') { st.run.lumen += res[k]; st.stats.lumenAll += res[k]; }
    }
  };

  // Prüft Aufträge und Logbuch. Gibt Benachrichtigungen für die UI zurück.
  U.check = function (st) {
    const notes = [];
    let guard = 0;
    let changed = true;
    while (changed && guard++ < 10) {
      changed = false;
      for (const m of U.activeMissions(st)) {
        if (U.met(st, m.cond)) {
          const reward = U.missionReward(st, m);
          st.missions[m.id] = true;
          U.grant(st, reward);
          notes.push({ type: 'mission', def: m, reward });
          changed = true;
        }
      }
    }
    for (const a of C.ACHIEVEMENTS) {
      if (!st.achievements[a.id] && U.met(st, a.cond)) {
        st.achievements[a.id] = true;
        E.invalidate();
        notes.push({ type: 'achievement', def: a });
      }
    }
    if (st.depth > st.stats.maxDepth) st.stats.maxDepth = st.depth;
    return notes;
  };

  AB.Unlocks = U;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
