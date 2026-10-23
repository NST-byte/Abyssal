/* Bedingungen, Freischaltungen, Aufträge, Ziele und Logbuch */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const U = {};

  const count = (o) => { let n = 0; for (const k in o) if (o[k]) n++; return n; };
  const sum = (o) => { let n = 0; for (const k in o) n += o[k] || 0; return n; };
  U.count = count;
  U.sum = sum;

  // Liefert die Teilbedingungen mit aktuellem Wert, Zielwert und Beschriftung
  U.parts = function (st, c) {
    const out = [];
    if (c.all) { c.all.forEach((x) => out.push(...U.parts(st, x))); return out; }
    const P = (cur, need, label, extra) => out.push(Object.assign({ cur, need, label }, extra || {}));
    if (c.gen) P(st.gens[c.gen] || 0, c.n, C.GEN_BY_ID[c.gen].name);
    if (c.miner) P(st.miners[c.miner] || 0, c.n, C.MINER_BY_ID[c.miner].name);
    if (c.module) P(E.moduleCount(st, c.module), c.n, C.MODULE_BY_ID[c.module].name);
    if (c.clicks !== undefined) P(st.stats.clicks, c.clicks, 'Pulse');
    if (c.upgrades !== undefined) P(count(st.upgrades), c.upgrades, 'Verbesserungen');
    if (c.lumenRun !== undefined) P(st.run.lumen, c.lumenRun, 'Lumen (dieser Lauf)', { big: true });
    if (c.lumenAll !== undefined) P(st.stats.lumenAll, c.lumenAll, 'Lumen gesamt', { big: true });
    if (c.alloyRun !== undefined) P(st.run.alloy, c.alloyRun, 'Legierung hergestellt (Lauf)', { big: true });
    if (c.crystalRun !== undefined) P(st.run.crystal, c.crystalRun, 'Kristalle gezüchtet (Lauf)', { big: true });
    if (c.alloyAll !== undefined) P(st.stats.alloyAll, c.alloyAll, 'Legierung gesamt', { big: true });
    if (c.crystalAll !== undefined) P(st.stats.crystalAll, c.crystalAll, 'Kristalle gesamt', { big: true });
    if (c.depth !== undefined) P(st.depth, c.depth, C.DEPTHS[c.depth].name + ' erreichen', { bool: true });
    if (c.reinforce !== undefined) P(sum(st.reinforce), c.reinforce, 'Verstärkungsstufen');
    if (c.events !== undefined) P(st.stats.events, c.events, 'Irrlichter gefangen');
    if (c.buildings !== undefined) P(E.buildings(st), c.buildings, 'Anlagen insgesamt');
    if (c.modulesTotal !== undefined) P(st.station.cells.filter(Boolean).length, c.modulesTotal, 'Module in der Station');
    if (c.research !== undefined) P(count(st.research), c.research, 'Forschungen');
    if (c.forks !== undefined) P(C.RESEARCH.filter((r) => r.group && st.research[r.id]).length, c.forks, 'Gabelungen entschieden');
    if (c.protocol !== undefined) P(st.protocols.length, c.protocol, 'Protokoll aktiv', { bool: true });
    if (c.abilityUses !== undefined) P(st.stats.abilityUses, c.abilityUses, 'Überladungen');
    if (c.scans !== undefined) P(st.stats.scans, c.scans, 'Sektoren erkundet');
    if (c.exploits !== undefined) P(E.outpostsUsed(st), c.exploits, 'Außenposten aktiv');
    if (c.relics !== undefined) P(count(st.relics), c.relics, 'Verschiedene Relikte');
    if (c.holds !== undefined) P(st.stats.holds, c.holds, 'Strömungen gehalten');
    if (c.prestiges !== undefined) P(st.prestige.total, c.prestiges, 'Gezeitenwenden');
    if (c.prestigesMin !== undefined) P(st.prestige.total, c.prestigesMin, 'nach einer Gezeitenwende', { bool: true });
    if (c.treeNodes !== undefined) P(count(st.prestige.tree), c.treeNodes, 'Knoten im Gezeiten-Baum');
    if (c.capstones !== undefined) P(E.capstonesUsed(st), c.capstones, 'Capstones');
    if (c.probeLevels !== undefined) P(sum(st.probes), c.probeLevels, 'Probestufen bestanden');
    if (c.worlds !== undefined) P(st.world.count, c.worlds, 'Weltenwenden');
    if (c.record !== undefined) P(st.record, c.record, 'Tiefenrekord-Stufen');
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

  // ---- Bäume: Voraussetzungen (Array-Eintrag = einer davon genügt) ----------
  U.reqMet = function (have, req) {
    if (!req) return true;
    return req.every((r) => (Array.isArray(r) ? r.some((x) => have(x)) : have(r)));
  };
  U.reqText = function (req, nameOf, have) {
    if (!req) return '';
    return req.filter((r) => !(Array.isArray(r) ? r.some((x) => have(x)) : have(r)))
      .map((r) => (Array.isArray(r) ? r.map(nameOf).join(' oder ') : nameOf(r))).join(', ');
  };

  // Forschung: done | open | depth | req | alt (andere Seite der Gabel aktiv)
  U.researchState = function (st, r) {
    if (st.research[r.id]) return 'done';
    if (st.depth < r.depth) return 'depth';
    if (!U.reqMet((id) => st.research[id], r.req)) return 'req';
    if (r.group && C.RESEARCH.some((x) => x.group === r.group && st.research[x.id])) return 'alt';
    return 'open';
  };

  // Gezeiten-Baum: max | open | req | alt | cap
  U.treeState = function (st, n) {
    const lvl = st.prestige.tree[n.id] || 0;
    if (lvl >= n.max) return 'max';
    if (!U.reqMet((id) => st.prestige.tree[id] > 0, n.req)) return 'req';
    if (lvl === 0 && n.group && C.TREE.some((x) => x.group === n.group && x.id !== n.id && st.prestige.tree[x.id])) return 'alt';
    if (lvl === 0 && n.capstone && E.capstonesUsed(st) >= E.maxCapstones(st)) return 'cap';
    return 'open';
  };

  // ---- Feature-Flags (für Tabs und Hinweise) --------------------------------
  U.features = function (st) {
    const anyUpgradeSeen = count(st.upgrades) > 0 || U.availableUpgrades(st).length > 0;
    const a = E.agg(st);
    return {
      upgrades: anyUpgradeSeen || st.depth > 0 || st.prestige.total > 0,
      mangan: st.depth >= 1,
      reinforce: st.depth >= 1,
      station: st.depth >= 1,
      alloy: st.depth >= 1,
      data: st.depth >= 2,
      research: st.depth >= 2,
      currents: st.depth >= C.CURRENTS.depth,
      protocols: a.protocolUnlock,
      ability: a.ability,
      map: st.depth >= C.MAP.depth || st.stats.scans > 0,
      crystal: st.depth >= 3 || st.res.crystal > 0,
      prestigeTab: st.depth >= 3 || st.prestige.total > 0,
      prestige: st.depth >= C.PRESTIGE.requireDepth,
      tree: st.prestige.total > 0 || st.perlen > 0,
      probes: st.prestige.total > 0,
      record: st.depth >= C.RECORD.depth,
      origin: st.world.count > 0 || st.depth >= C.WORLD.requireDepth || st.world.urlicht > 0,
      events: st.stats.lumenAll >= 500 || st.prestige.total > 0,
      perlen: st.prestige.total > 0 || st.perlen > 0 || st.depth >= C.PRESTIGE.requireDepth,
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
    ['mangan', 'data', 'alloy', 'crystal'].forEach((k) => { if (r[k]) out[k] = r[k]; });
    return out;
  };

  U.grant = function (st, res) {
    for (const k in res) {
      if (!(k in st.res)) continue;
      st.res[k] = Math.min(C.MAX_VALUE, (st.res[k] || 0) + res[k]);
      if (k === 'lumen') { st.run.lumen += res[k]; st.stats.lumenAll += res[k]; }
    }
  };

  // ---- Ziel-Hierarchie (für die Ziele-Ansicht) ------------------------------
  // kurz: Aufträge · mittel: nächster Abstieg/Systemziel · lang: Wende, Proben, Relikte, Weltenwende
  U.goals = function (st) {
    const out = { short: U.activeMissions(st), mid: [], long: [] };
    const nd = st.depth + 1;
    if (C.DEPTHS[nd]) {
      const allowed = E.depthAllowed(st, nd);
      out.mid.push({ id: 'descent', name: 'Abstieg ' + C.DEPTHS[nd].into, progress: allowed ? descentProgress(st, nd) : 0,
        text: allowed ? 'Ressourcen für ' + C.DEPTHS[nd].meters.toLocaleString('de-DE') + ' m sammeln.' : 'Erst nach ' + C.DEPTHS[nd].reqPrestige + ' Gezeitenwende(n) erreichbar.', tab: 'descent' });
    }
    if (st.depth >= 2) {
      const forks = {};
      C.RESEARCH.forEach((r) => { if (r.group) forks[r.group] = forks[r.group] || st.research[r.id]; });
      const open = Object.keys(forks).filter((k) => !forks[k]).length;
      if (open) out.mid.push({ id: 'forks', name: 'Gabelungen im Tech-Baum', progress: 1 - open / Object.keys(forks).length, text: open + ' Entscheidung(en) offen – sie ändern, wie deine Station arbeitet.', tab: 'research' });
    }
    if (st.depth >= C.MAP.depth && !E.mapLocked(st)) {
      const unk = st.map.sectors.filter((s) => s.state === 'unknown' && s.zone <= st.depth).length;
      if (unk) out.mid.push({ id: 'map', name: 'Unerforschte Sektoren', progress: 0, text: unk + ' erreichbare Sektoren warten auf ein U-Boot.', tab: 'map' });
    }
    if (st.depth >= C.RECORD.depth) out.mid.push({ id: 'record', name: 'Tiefenrekord', progress: 0, text: 'Stufe ' + st.record + ' – jede Bohrung ×' + String(C.RECORD.mult).replace('.', ',') + ' Produktion und mehr Perlen.', tab: 'descent' });
    out.long.push({ id: 'wende', name: st.prestige.total ? 'Nächste Gezeitenwende' : 'Erste Gezeitenwende', progress: Math.min(1, st.depth / C.PRESTIGE.requireDepth),
      text: st.depth >= C.PRESTIGE.requireDepth ? '+' + E.prestigeGain(st) + ' Perlen verfügbar.' : 'Erreiche den Hadal-Graben (8.000 m).', tab: 'tides' });
    if (st.prestige.total > 0) {
      const done = sum(st.probes), all = C.PROBES.list.length * C.PROBES.goals.length;
      out.long.push({ id: 'probes', name: 'Tiefenproben', progress: done / all, text: done + ' / ' + all + ' Stufen bestanden – jede bringt eine einzigartige Dauerbelohnung.', tab: 'tides' });
    }
    if (st.depth >= C.MAP.depth || count(st.relics)) {
      out.long.push({ id: 'relics', name: 'Relikt-Sammlung', progress: sum(st.relics) / C.RELICS.reduce((s, r) => s + r.max, 0),
        text: count(st.relics) + ' / ' + C.RELICS.length + ' Relikte gefunden.', tab: 'map' });
    }
    if (st.prestige.total >= 1) {
      out.long.push({ id: 'world', name: 'Weltenwende', progress: Math.min(1, st.depth / C.WORLD.requireDepth),
        text: st.depth >= C.WORLD.requireDepth ? '+' + E.worldGain(st) + ' Urlicht verfügbar.' : 'Erreiche die Herzkammer (15.000 m, ab 3 Gezeitenwenden).', tab: 'origin' });
    }
    return out;
  };
  function descentProgress(st, d) {
    const cost = E.descentCost(st, d);
    let p = 1;
    for (const k in cost) p = Math.min(p, Math.min(1, (st.res[k] || 0) / cost[k]));
    return p;
  }

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
    if (st.depth > st.run.maxDepth) st.run.maxDepth = st.depth;
    return notes;
  };

  AB.Unlocks = U;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
