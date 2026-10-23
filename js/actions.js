/* Spieleraktionen: Kaufen, Forschen, Abtauchen, Fähigkeiten.
   Jede Aktion prüft selbst alle Bedingungen und gibt {ok, reason} zurück. */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = AB.Economy;
  const U = AB.Unlocks;
  const A = {};

  const fail = (reason) => ({ ok: false, reason });
  const OK = (extra) => Object.assign({ ok: true }, extra || {});

  function pay(st, cost) {
    for (const k in cost) st.res[k] = Math.max(0, st.res[k] - cost[k]);
  }

  // Menge auflösen: -1 = Maximum
  function resolveAmount(amount, max) {
    if (amount === -1) return Math.max(1, max);
    return Math.max(1, Math.floor(amount || 1));
  }

  A.click = function (st) {
    const v = E.clickValue(st);
    U.grant(st, { lumen: v });
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
    if (st.res.lumen < cost - 1e-9) return fail('Nicht genug Lumen.');
    st.res.lumen = Math.max(0, st.res.lumen - cost);
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
    if (st.res.lumen < cost - 1e-9) return fail('Nicht genug Lumen.');
    st.res.lumen = Math.max(0, st.res.lumen - cost);
    st.miners[id] += n;
    return OK({ n, cost });
  };

  A.buySonar = function (st, amount) {
    if (st.depth < C.SONAR.depth) return fail('Benötigt ' + C.DEPTHS[C.SONAR.depth].name + '.');
    const n = resolveAmount(amount, E.sonarMax(st));
    const cost = E.sonarCost(st, n);
    if (!E.canAfford(st, cost)) return fail(st.res.lumen < cost.lumen ? 'Nicht genug Lumen.' : 'Nicht genug Mangan.');
    pay(st, cost);
    st.sonar += n;
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
    if (st.res.mangan < cost - 1e-9) return fail('Nicht genug Mangan.');
    st.res.mangan = Math.max(0, st.res.mangan - cost);
    st.reinforce[id]++;
    E.invalidate();
    return OK();
  };

  A.research = function (st, id) {
    const r = C.RESEARCH_BY_ID[id];
    if (!r) return fail('Unbekannt.');
    const s = U.researchState(st, r);
    if (s === 'done') return fail('Bereits erforscht.');
    if (s === 'depth') return fail('Benötigt ' + C.DEPTHS[r.depth].name + '.');
    if (s === 'req') return fail('Benötigt: ' + r.req.filter((x) => !st.research[x]).map((x) => C.RESEARCH_BY_ID[x].name).join(', ') + '.');
    if (st.res.data < r.cost - 1e-9) return fail('Nicht genug Daten.');
    st.res.data = Math.max(0, st.res.data - r.cost);
    st.research[id] = true;
    E.invalidate();
    return OK();
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
    if (next >= C.DEPTHS.length) return fail('Tiefer geht es nicht.');
    const cost = E.descentCost(st, next);
    if (!E.canAfford(st, cost)) return fail('Ressourcen reichen nicht.');
    pay(st, cost);
    st.depth = next;
    if (next > st.stats.maxDepth) st.stats.maxDepth = next;
    E.invalidate();
    return OK({ depth: next });
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
    return OK();
  };

  A.startExpedition = function (st, id) {
    const x = C.EXPEDITION_BY_ID[id];
    if (!x) return fail('Unbekannt.');
    if (st.depth < 3) return fail('Benötigt Abyssal.');
    if (st.expedition.active) return fail('Es läuft bereits eine Expedition.');
    if (st.expedition.levels[id] >= x.maxLevel) return fail('Artefakt voll ausgebaut.');
    const cost = E.expeditionCost(st, id);
    if (!E.canAfford(st, cost)) return fail('Ressourcen reichen nicht.');
    pay(st, cost);
    const dur = E.expeditionDuration(st, id);
    st.expedition.active = { id, endsAt: st.time + dur, duration: dur };
    return OK();
  };

  A.completeExpedition = function (st) {
    const act = st.expedition.active;
    if (!act) return null;
    st.expedition.active = null;
    st.expedition.levels[act.id] = Math.min(C.EXPEDITION_BY_ID[act.id].maxLevel, (st.expedition.levels[act.id] || 0) + 1);
    st.stats.expeditions++;
    st.run.expeditions++;
    E.invalidate();
    return act.id;
  };

  // Irrlicht einsammeln. rnd in [0,1) bestimmt das Ergebnis nach den Gewichten.
  A.catchEvent = function (st, rnd) {
    const outs = C.EVENTS.outcomes;
    const total = outs.reduce((s, o) => s + o.weight, 0);
    let r = rnd * total, pick = outs[outs.length - 1];
    for (const o of outs) { if (r < o.weight) { pick = o; break; } r -= o.weight; }
    st.stats.events++;
    const result = { outcome: pick };
    if (pick.id === 'burst') {
      const gain = { lumen: Math.max(E.lps(st, true) * pick.seconds, E.clickValue(st) * 50) };
      if (st.depth >= 1 && pick.manganSeconds) gain.mangan = Math.max(E.mps(st) * pick.manganSeconds, 10);
      U.grant(st, gain);
      result.gain = gain;
    } else {
      st.buffs = st.buffs.filter((b) => b.id !== 'frenzy');
      st.buffs.push({ id: 'frenzy', name: pick.name, mult: pick.mult, until: st.time + pick.duration });
    }
    return result;
  };

  A.buyShop = function (st, id) {
    const s = C.SHOP_BY_ID[id];
    if (!s) return fail('Unbekannt.');
    if (st.prestige.shop[id] >= s.maxLevel) return fail('Maximalstufe erreicht.');
    const cost = E.shopCost(st, id);
    if (st.perlen < cost) return fail('Nicht genug Perlen.');
    st.perlen -= cost;
    st.prestige.shop[id]++;
    E.invalidate();
    return OK();
  };

  // Automaton: kauft die günstigste bezahlbare Anlage (max. ein paar pro Schritt)
  A.autobuy = function (st) {
    if (!E.agg(st).autobuy || !st.settings.autobuy) return 0;
    let bought = 0;
    for (let i = 0; i < 20; i++) {
      let best = null, bestCost = Infinity;
      for (const g of C.GENERATORS) {
        if (st.depth < g.depth) continue;
        const c = E.genCost(st, g.id, 1);
        if (c < bestCost) { bestCost = c; best = g.id; }
      }
      if (!best || st.res.lumen < bestCost) break;
      A.buyGen(st, best, 1);
      bought++;
    }
    return bought;
  };

  AB.Actions = A;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
