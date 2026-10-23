/* Spieleraktionen. Jede Aktion prüft selbst alle Bedingungen und gibt
   {ok, reason} zurück – die UI zeigt den Grund an, wenn etwas nicht geht. */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const U = AB.Unlocks;
  const S = AB.State;
  const A = {};

  const fail = (reason) => ({ ok: false, reason });
  const OK = (extra) => Object.assign({ ok: true }, extra || {});
  const RN = (k) => C.RESOURCES[k].name;

  function pay(st, cost) {
    for (const k in cost) {
      if (k === 'perlen') st.perlen = Math.max(0, st.perlen - cost[k]);
      else if (k === 'urlicht') st.world.urlicht = Math.max(0, st.world.urlicht - cost[k]);
      else st.res[k] = Math.max(0, st.res[k] - cost[k]);
    }
  }
  function missing(st, cost) {
    for (const k in cost) {
      const have = k === 'perlen' ? st.perlen : k === 'urlicht' ? st.world.urlicht : st.res[k];
      if (have < cost[k] - 1e-9) return 'Nicht genug ' + RN(k) + '.';
    }
    return '';
  }

  // Menge auflösen: -1 = Maximum
  function resolveAmount(amount, max) {
    if (amount === -1) return Math.max(1, max);
    return Math.max(1, Math.floor(amount || 1));
  }

  A.click = function (st) {
    if (st.probe && st.probe.id === 'silent') return fail('Tiefenprobe „Stille Wasser“: Der Puls ist deaktiviert.');
    const v = E.clickValue(st);
    const gain = { lumen: v };
    const a = E.agg(st);
    if (a.clickResources) {
      const f = E.flows(st);
      gain.mangan = E.mps(st);
      gain.alloy = f.alloyOut;
      gain.crystal = f.crystalOut;
    }
    U.grant(st, gain);
    if (a.clickChain) {
      const oc = st.buffs.find((b) => b.id === 'overcharge' && b.until > st.time);
      if (oc) {
        oc.ext = oc.ext || 0;
        if (oc.ext < 60) { oc.until += 0.25; oc.ext += 0.25; }
      }
    }
    st.stats.clicks++;
    st.run.clicks++;
    return OK({ value: v });
  };

  A.buyGen = function (st, id, amount) {
    const g = C.GEN_BY_ID[id];
    if (!g) return fail('Unbekannte Anlage.');
    if (st.depth < g.depth) return fail('Benötigt ' + C.DEPTHS[g.depth].name + '.');
    const n = resolveAmount(amount, E.genMax(st, id));
    const cost = E.genCost(st, id, n);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.gens[id] += n;
    E.invalidate();
    return OK({ n, cost });
  };

  A.buyMiner = function (st, id, amount) {
    const m = C.MINER_BY_ID[id];
    if (!m) return fail('Unbekannt.');
    if (st.depth < m.depth) return fail('Benötigt ' + C.DEPTHS[m.depth].name + '.');
    const n = resolveAmount(amount, E.minerMax(st, id));
    const cost = E.minerCost(st, id, n);
    const ms = missing(st, cost);
    if (ms) return fail(ms);
    pay(st, cost);
    st.miners[id] += n;
    E.invalidate();
    return OK({ n, cost });
  };

  A.buySonar = function (st, amount) {
    if (st.depth < C.SONAR.depth) return fail('Benötigt ' + C.DEPTHS[C.SONAR.depth].name + '.');
    const n = resolveAmount(amount, E.sonarMax(st));
    const cost = E.sonarCost(st, n);
    const ms = missing(st, cost);
    if (ms) return fail(ms);
    pay(st, cost);
    st.sonar += n;
    E.invalidate();
    return OK({ n, cost });
  };

  A.buyUpgrade = function (st, id) {
    const u = C.UPGRADE_BY_ID[id];
    if (!u) return fail('Unbekannt.');
    if (st.upgrades[id]) return fail('Bereits gekauft.');
    if (!U.met(st, u.req)) return fail('Voraussetzung nicht erfüllt.');
    if (st.res.lumen < u.cost - 1e-9) return fail('Nicht genug Lumen.');
    st.res.lumen = Math.max(0, st.res.lumen - u.cost);
    st.upgrades[id] = true;
    E.invalidate();
    return OK();
  };

  A.reinforce = function (st, id) {
    const g = C.GEN_BY_ID[id];
    if (!g) return fail('Unbekannt.');
    if (st.depth < 1) return fail('Benötigt Dämmerzone.');
    if (st.gens[id] < 1) return fail('Erst eine ' + g.name + ' bauen.');
    if (st.reinforce[id] >= C.REINFORCE.maxLevel) return fail('Maximalstufe erreicht.');
    const cost = E.reinforceCost(st, id);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.reinforce[id]++;
    E.invalidate();
    return OK();
  };

  // Forschung. Bei Gabelungen ersetzt der Kauf die andere Seite (Umrüsten).
  A.research = function (st, id) {
    const r = C.RESEARCH_BY_ID[id];
    if (!r) return fail('Unbekannt.');
    const s = U.researchState(st, r);
    if (s === 'done') return fail('Bereits erforscht.');
    if (s === 'depth') return fail('Benötigt ' + C.DEPTHS[r.depth].name + '.');
    if (s === 'req') return fail('Benötigt: ' + U.reqText(r.req, (x) => C.RESEARCH_BY_ID[x].name, (x) => st.research[x]) + '.');
    const cost = E.techCost(st, r) * (s === 'alt' ? C.RESEARCH_SWITCH_FACTOR : 1);
    if (st.res.data < cost - 1e-9) return fail('Nicht genug Daten.');
    st.res.data = Math.max(0, st.res.data - cost);
    if (r.group) C.RESEARCH.forEach((x) => { if (x.group === r.group) delete st.research[x.id]; });
    st.research[id] = true;
    E.invalidate();
    return OK({ switched: s === 'alt' });
  };

  A.analysis = function (st) {
    if (st.depth < C.ANALYSIS.depth) return fail('Benötigt ' + C.DEPTHS[C.ANALYSIS.depth].name + '.');
    if (st.analysis >= C.ANALYSIS.maxLevel) return fail('Maximalstufe erreicht.');
    const cost = E.analysisCost(st);
    if (st.res.data < cost - 1e-9) return fail('Nicht genug Daten.');
    st.res.data = Math.max(0, st.res.data - cost);
    st.analysis++;
    E.invalidate();
    return OK();
  };

  // Protokoll aktivieren. Das erste ist gratis, danach kostet ein Wechsel Daten.
  A.setProtocol = function (st, id) {
    const p = C.PROTOCOL_BY_ID[id];
    if (!p) return fail('Unbekannt.');
    if (!E.agg(st).protocolUnlock) return fail('Benötigt Forschung: Protokoll-Kern.');
    if (st.protocols.indexOf(id) >= 0) return fail('Bereits aktiv.');
    const max = E.maxProtocols(st);
    if (st.protocols.length < max) {
      st.protocols.push(id);
    } else {
      const cost = E.protocolSwitchCost(st);
      if (st.res.data < cost) return fail('Wechsel kostet ' + AB.Format.num(cost) + ' Daten.');
      st.res.data -= cost;
      st.protocolSwitches++;
      st.protocols.shift();
      st.protocols.push(id);
    }
    E.invalidate();
    return OK();
  };

  A.descend = function (st) {
    const next = st.depth + 1;
    if (next >= C.DEPTHS.length) return fail('Tiefer geht es nicht – aber der Tiefenrekord wartet.');
    if (!E.depthAllowed(st, next)) return fail(C.DEPTHS[next].name + ' ist erst nach ' + C.DEPTHS[next].reqPrestige + ' Gezeitenwende(n) erreichbar.');
    const cost = E.descentCost(st, next);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.depth = next;
    if (next > st.stats.maxDepth) st.stats.maxDepth = next;
    if (next > st.run.maxDepth) st.run.maxDepth = next;
    E.invalidate();
    const probe = AB.Core ? AB.Core.checkProbe(st) : null;
    return OK({ depth: next, probe });
  };

  A.useAbility = function (st) {
    const ab = E.ability(st);
    if (!ab.unlocked) return fail('Benötigt Forschung: Überladung.');
    if (ab.readyIn > 0) return fail('Lädt noch ' + AB.Format.clock(ab.readyIn) + '.');
    st.buffs = st.buffs.filter((b) => b.id !== 'overcharge');
    st.buffs.push({ id: 'overcharge', name: C.ABILITY.name, mult: ab.mult, until: st.time + ab.duration });
    st.ability.readyAt = st.time + ab.cooldown;
    st.stats.abilityUses++;
    st.run.abilityUses++;
    E.invalidate();
    return OK();
  };

  // ---- Station --------------------------------------------------------------
  function cellCheck(st, i) {
    if (!(i >= 0 && i < st.station.cells.length) || !Number.isInteger(i)) return 'Ungültiges Feld.';
    if (!E.cellActive(st, i)) return 'Dieses Feld ist noch nicht ausgebaut.';
    return '';
  }

  A.buildModule = function (st, i, type) {
    const def = C.MODULE_BY_ID[type];
    if (!def) return fail('Unbekanntes Modul.');
    if (st.depth < 1) return fail('Benötigt Dämmerzone.');
    const cc = cellCheck(st, i);
    if (cc) return fail(cc);
    if (st.station.cells[i]) return fail('Feld ist belegt.');
    if (st.depth < def.depth) return fail(def.name + ' benötigt ' + C.DEPTHS[def.depth].name + '.');
    const cost = E.moduleBuildCost(st, type);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.station.cells[i] = { t: type, lvl: 1, on: true };
    E.invalidate();
    return OK();
  };

  A.upgradeModule = function (st, i) {
    const cc = cellCheck(st, i);
    if (cc) return fail(cc);
    const c = st.station.cells[i];
    if (!c) return fail('Hier steht kein Modul.');
    if (c.lvl >= C.GRID.maxLevel) return fail('Maximalstufe erreicht.');
    const cost = E.moduleUpgradeCost(st, c);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    c.lvl++;
    E.invalidate();
    return OK();
  };

  A.toggleModule = function (st, i) {
    const c = st.station.cells[i];
    if (!c) return fail('Hier steht kein Modul.');
    c.on = !c.on;
    E.invalidate();
    return OK({ on: c.on });
  };

  // Verschieben/Tauschen ist kostenlos – Nachbarschaft soll man ausprobieren können.
  A.moveModule = function (st, from, to) {
    const c1 = cellCheck(st, from) || cellCheck(st, to);
    if (c1) return fail(c1);
    if (from === to) return fail('Gleiches Feld.');
    if (!st.station.cells[from]) return fail('Hier steht kein Modul.');
    const tmp = st.station.cells[to];
    st.station.cells[to] = st.station.cells[from];
    st.station.cells[from] = tmp;
    E.invalidate();
    return OK();
  };

  A.demolishModule = function (st, i) {
    const c = st.station.cells[i];
    if (!c) return fail('Hier steht kein Modul.');
    st.station.cells[i] = null;
    const refund = E.moduleBuildCost(st, c.t);
    for (const k in refund) st.res[k] = Math.min(C.MAX_VALUE, st.res[k] + refund[k] * C.GRID.demolishRefund);
    E.invalidate();
    return OK();
  };

  // Alle Verarbeitungsmodule (Schmelzen, Fertigungen) gemeinsam an/aus
  A.setProcessing = function (st, on) {
    let n = 0;
    st.station.cells.forEach((c) => { if (c && (c.t === 'smelter' || c.t === 'foundry') && c.on !== on) { c.on = on; n++; } });
    E.invalidate();
    return n ? OK({ n }) : fail(on ? 'Alle Verarbeitungsmodule laufen bereits.' : 'Keine laufenden Verarbeitungsmodule.');
  };

  // ---- Strömungen -----------------------------------------------------------
  A.holdCurrent = function (st) {
    if (!E.agg(st).currentHold) return fail('Benötigt Forschung: Strömungslenkung.');
    if (!st.current) return fail('Keine Strömung aktiv.');
    if (st.current.charge < C.CURRENTS.holdRecharge) return fail('Lenkung lädt noch (' + st.current.charge + '/' + C.CURRENTS.holdRecharge + ' Wechsel).');
    st.current.endsAt += C.CURRENTS.period;
    st.current.charge = 0;
    st.stats.holds++;
    return OK();
  };

  // ---- Tiefseekarte ---------------------------------------------------------
  A.buildSub = function (st) {
    if (E.mapLocked(st)) return fail('Die Tiefseekarte ist nicht verfügbar.');
    if (st.map.subs >= E.subCapacity(st)) return fail('Kein freier Dockplatz – baue oder verbessere ein U-Boot-Dock in der Station.');
    const cost = E.subCost(st);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.map.subs++;
    return OK();
  };

  A.scanSector = function (st, i) {
    if (E.mapLocked(st)) return fail(st.probe && st.probe.id === 'lonely' ? 'Tiefenprobe „Einsiedler“: Karte gesperrt.' : 'Benötigt Abyssal.');
    const s = st.map.sectors[i];
    if (!s) return fail('Unbekannter Sektor.');
    if (s.state !== 'unknown') return fail('Dieser Sektor ist bereits erkundet.');
    if (s.zone > st.depth) return fail('Zu tief – erst ' + C.DEPTHS[s.zone].name + ' erreichen.');
    if (E.subsBusy(st) >= E.subsTotal(st)) return fail('Alle U-Boote sind unterwegs.');
    const cost = E.scanCost(st, s.zone);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    const dur = E.scanDuration(st, s.zone);
    s.state = 'scanning';
    st.map.missions.push({ sector: i, endsAt: st.time + dur, duration: dur });
    return OK({ duration: dur });
  };

  A.completeScan = function (st, mission) {
    st.map.missions = st.map.missions.filter((m) => m !== mission);
    const s = st.map.sectors[mission.sector];
    if (s && s.state === 'scanning') s.state = 'revealed';
    st.stats.scans++;
    return mission.sector;
  };

  A.exploitSector = function (st, i) {
    const s = st.map.sectors[i];
    if (!s || s.state !== 'revealed') return fail('Nur erkundete, unberührte Sektoren können ausgebeutet werden.');
    if (E.mapLocked(st)) return fail('Karte gesperrt.');
    if (E.outpostsUsed(st) >= E.outpostsMax(st)) return fail('Alle Außenposten belegt. Gib einen anderen Sektor auf oder erhöhe die Zahl der Außenposten.');
    s.state = 'exploited';
    E.invalidate();
    return OK();
  };

  A.abandonSector = function (st, i) {
    const s = st.map.sectors[i];
    if (!s || s.state !== 'exploited') return fail('Kein Außenposten.');
    s.state = 'depleted';
    E.invalidate();
    return OK();
  };

  // Bergen: sofortiger Ertrag, Sektor ist danach erschöpft. rnd entscheidet Relikte.
  A.salvageSector = function (st, i, rnd, rnd2) {
    const s = st.map.sectors[i];
    if (!s || s.state !== 'revealed') return fail('Nur erkundete, unberührte Sektoren können geborgen werden.');
    if (E.mapLocked(st)) return fail('Karte gesperrt.');
    const gain = E.salvageReward(st, s);
    U.grant(st, gain);
    let relic = null;
    const chance = E.relicChance(st, s);
    if (chance > 0 && (rnd === undefined ? S.rand(st) : rnd) < chance) {
      const pool = E.availableRelics(st, s.zone);
      if (pool.length) {
        const r = pool[Math.floor((rnd2 === undefined ? S.rand(st) : rnd2) * pool.length) % pool.length];
        st.relics[r.id] = (st.relics[r.id] || 0) + 1;
        relic = r.id;
        E.invalidate();
      } else {
        gain.crystal = (gain.crystal || 0) + 50 * s.zone * s.zone;
        U.grant(st, { crystal: 50 * s.zone * s.zone });
      }
    }
    s.state = 'depleted';
    return OK({ gain, relic });
  };

  // ---- Irrlichter -----------------------------------------------------------
  A.catchEvent = function (st, rnd) {
    const outs = C.EVENTS.outcomes;
    const total = outs.reduce((s, o) => s + o.weight, 0);
    let r = rnd * total, pick = outs[outs.length - 1];
    for (const o of outs) { if (r < o.weight) { pick = o; break; } r -= o.weight; }
    st.stats.events++;
    const a = E.agg(st);
    const result = { outcome: pick };
    if (pick.id === 'burst') {
      const k = a.eventReward;
      const gain = { lumen: Math.max(E.lps(st, true) * pick.seconds, E.clickValue(st) * 50) * k };
      if (st.depth >= 1 && pick.manganSeconds) {
        gain.mangan = Math.max(E.mps(st) * pick.manganSeconds, 10) * k;
        const ao = E.flows(st).alloyOut;
        if (ao > 0) gain.alloy = ao * pick.manganSeconds * k;
      }
      if (a.eventCrystals) gain.crystal = Math.max(E.flows(st).crystalOut * 120, 5 * Math.max(1, st.depth)) * k;
      U.grant(st, gain);
      result.gain = gain;
    } else {
      st.buffs = st.buffs.filter((b) => b.id !== 'frenzy');
      st.buffs.push({ id: 'frenzy', name: pick.name, mult: pick.mult, until: st.time + pick.duration });
      if (a.eventCrystals) {
        const g = { crystal: Math.max(E.flows(st).crystalOut * 60, 5 * Math.max(1, st.depth)) * a.eventReward };
        U.grant(st, g);
        result.gain = g;
      }
      E.invalidate();
    }
    return result;
  };

  // ---- Gezeiten-Baum --------------------------------------------------------
  A.buyTree = function (st, id) {
    const n = C.TREE_BY_ID[id];
    if (!n) return fail('Unbekannt.');
    const s = U.treeState(st, n);
    if (s === 'max') return fail('Maximalstufe erreicht.');
    if (s === 'req') return fail('Benötigt: ' + U.reqText(n.req, (x) => C.TREE_BY_ID[x].name, (x) => st.prestige.tree[x] > 0) + '.');
    if (s === 'alt') return fail('Die andere Seite dieser Gabel ist gewählt. Neu verteilen geht bei der nächsten Gezeitenwende.');
    if (s === 'cap') return fail('Du kannst nur ' + E.maxCapstones(st) + ' Capstones gleichzeitig haben.');
    const cost = E.treeCost(st, id);
    if (st.perlen < cost) return fail('Nicht genug Perlen.');
    st.perlen -= cost;
    st.prestige.tree[id] = (st.prestige.tree[id] || 0) + 1;
    E.invalidate();
    return OK();
  };

  // Summe aller im Baum ausgegebenen Perlen
  A.treeSpent = function (st) {
    let sum = 0;
    for (const n of C.TREE) {
      const lvl = st.prestige.tree[n.id] || 0;
      for (let i = 0; i < lvl; i++) sum += Math.ceil(n.cost.base * Math.pow(n.cost.growth, i));
    }
    return sum;
  };

  // ---- Ursprung (Urlicht) ---------------------------------------------------
  A.buyOrigin = function (st, id) {
    const n = C.ORIGIN_BY_ID[id];
    if (!n) return fail('Unbekannt.');
    if ((st.world.origin[id] || 0) >= n.max) return fail('Maximalstufe erreicht.');
    const cost = E.originCost(st, id);
    if (st.world.urlicht < cost) return fail('Nicht genug Urlicht.');
    st.world.urlicht -= cost;
    st.world.origin[id] = (st.world.origin[id] || 0) + 1;
    E.invalidate();
    return OK();
  };

  A.setArchetype = function (st, id) {
    if (!st.world.origin.o_heritage) return fail('Benötigt Ursprung: Erbstationen.');
    if (!C.ARCHETYPE_BY_ID[id]) return fail('Unbekannt.');
    st.prestige.nextArchetype = id;
    return OK();
  };

  // ---- Tiefenrekord ---------------------------------------------------------
  A.drill = function (st) {
    if (st.depth < C.RECORD.depth) return fail('Benötigt ' + C.DEPTHS[C.RECORD.depth].name + '.');
    const cost = E.recordCost(st);
    const m = missing(st, cost);
    if (m) return fail(m);
    pay(st, cost);
    st.record++;
    E.invalidate();
    return OK();
  };

  // ---- Automatik ------------------------------------------------------------
  // Kauft die günstigste bezahlbare Anlage (max. ein paar pro Schritt)
  A.autobuy = function (st) {
    const a = E.agg(st);
    let done = 0;
    if (a.autobuy && st.settings.autobuy) {
      for (let i = 0; i < 20; i++) {
        let best = null, bestCost = Infinity;
        for (const g of C.GENERATORS) {
          if (st.depth < g.depth) continue;
          const c = E.genCost(st, g.id, 1);
          if (!E.canAfford(st, c)) continue;
          if (c.lumen < bestCost) { bestCost = c.lumen; best = g.id; }
        }
        if (!best) break;
        A.buyGen(st, best, 1);
        done++;
      }
    }
    if (a.autoUpgrades && st.settings.autoUpgrades) {
      for (const u of U.availableUpgrades(st)) { if (st.res.lumen >= u.cost) { A.buyUpgrade(st, u.id); done++; } else break; }
    }
    if (a.autoReinforce && st.settings.autoReinforce && st.depth >= 1) {
      // nur Mangan-Überschuss nutzen: höchstens 25 % des Bestands pro Kauf
      for (const g of C.GENERATORS) {
        if (st.gens[g.id] > 0 && st.reinforce[g.id] < C.REINFORCE.maxLevel && E.reinforceCost(st, g.id).mangan < st.res.mangan * 0.25) { A.reinforce(st, g.id); done++; }
      }
    }
    if (a.autoResearch && st.settings.autoResearch && st.depth >= 2) {
      // forscht den günstigsten offenen Knoten, ohne Gabeln umzuwerfen
      const open = C.RESEARCH.filter((r) => U.researchState(st, r) === 'open').sort((x, y) => x.cost - y.cost);
      if (open.length && st.res.data >= E.techCost(st, open[0])) { A.research(st, open[0].id); done++; }
    }
    if (a.autoDescend && st.settings.autoDescend) {
      const nd = st.depth + 1;
      if (C.DEPTHS[nd] && E.depthAllowed(st, nd) && E.canAfford(st, E.descentCost(st, nd))) { A.descend(st); done++; }
    }
    return done;
  };

  AB.Actions = A;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
