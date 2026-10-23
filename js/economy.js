/* Produktions- und Kostenberechnung (rein, ohne DOM) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = {};

  // ---- Effekt-Aggregation ---------------------------------------------------
  // Alle Boni (Upgrades, Forschung, Protokolle, Artefakte, Perlen-Shop) laufen
  // durch dieselbe Effekt-Engine. Ergebnis wird gecacht, bis E.invalidate().
  let cache = null;
  let cacheState = null;

  E.invalidate = function () { cache = null; };

  function blank() {
    const a = {
      genMult: {}, all: 1, synergies: [], synergyBoost: 1,
      clickMult: 1, clickPct: 0, clickFlat: 0,
      manganMult: 1, dataMult: 1, depthAdd: 0,
      eventFreq: 1, eventDur: 1, offlineHours: 0,
      ability: false, abilityDur: 1, abilityCd: 1, abilityPowerAdd: 0,
      reinforceEff: 0, expSpeed: 1, perBuildingPct: 0, protocolUnlock: false,
      unspentBonusAdd: 0, descentDiscount: 0, autobuy: false, dualProtocol: false,
      achievements: 0,
    };
    C.GENERATORS.forEach((g) => { a.genMult[g.id] = 1; });
    return a;
  }

  const MULT = { allMult: 'all', synergyBoost: 'synergyBoost', clickMult: 'clickMult', manganMult: 'manganMult', dataMult: 'dataMult',
    eventFreq: 'eventFreq', eventDur: 'eventDur', abilityDur: 'abilityDur', abilityCd: 'abilityCd', expSpeed: 'expSpeed' };
  const ADD = { clickPct: ['clickPct', 'pct'], clickFlat: ['clickFlat', 'add'], depthAdd: ['depthAdd', 'add'], offlineHours: ['offlineHours', 'add'],
    abilityPowerAdd: ['abilityPowerAdd', 'add'], reinforceEff: ['reinforceEff', 'add'], perBuildingPct: ['perBuildingPct', 'pct'],
    unspentBonusAdd: ['unspentBonusAdd', 'add'], descentDiscount: ['descentDiscount', 'add'] };
  const FLAG = { abilityUnlock: 'ability', protocolUnlock: 'protocolUnlock', autobuy: 'autobuy', dualProtocol: 'dualProtocol' };

  E.applyEffect = function (a, e, lvl) {
    if (!lvl) return;
    if (e.type === 'genMult') a.genMult[e.gen] *= Math.pow(e.mult, lvl);
    else if (e.type === 'synergy') a.synergies.push({ gen: e.gen, src: e.src, perUnit: e.perUnit });
    else if (MULT[e.type]) a[MULT[e.type]] *= Math.pow(e.mult, lvl);
    else if (ADD[e.type]) a[ADD[e.type][0]] += e[ADD[e.type][1]] * lvl;
    else if (FLAG[e.type]) a[FLAG[e.type]] = true;
  };

  E.agg = function (st) {
    if (cache && cacheState === st) return cache;
    const a = blank();
    const ap = (list, lvl) => list.forEach((e) => E.applyEffect(a, e, lvl));
    for (const id in st.upgrades) if (st.upgrades[id] && C.UPGRADE_BY_ID[id]) ap(C.UPGRADE_BY_ID[id].effects, 1);
    for (const id in st.research) if (st.research[id] && C.RESEARCH_BY_ID[id]) ap(C.RESEARCH_BY_ID[id].effects, 1);
    st.protocols.forEach((p) => { if (C.PROTOCOL_BY_ID[p]) ap(C.PROTOCOL_BY_ID[p].effects, 1); });
    C.EXPEDITIONS.forEach((x) => ap(x.effects, st.expedition.levels[x.id] || 0));
    C.PRESTIGE_SHOP.forEach((x) => ap(x.effects, st.prestige.shop[x.id] || 0));
    if (st.analysis) a.all *= Math.pow(C.ANALYSIS.mult, st.analysis);
    for (const id in st.achievements) if (st.achievements[id]) a.achievements++;
    cache = a;
    cacheState = st;
    return a;
  };

  // ---- Multiplikatoren ------------------------------------------------------
  E.buildings = function (st) {
    let n = 0;
    for (const id in st.gens) n += st.gens[id];
    return n;
  };

  E.achievementMult = (st) => 1 + E.agg(st).achievements * C.ACHIEVEMENT_BONUS;
  E.perlenBonusPer = (st) => C.PRESTIGE.unspentBonus + E.agg(st).unspentBonusAdd;
  E.perlenMult = (st) => 1 + st.perlen * E.perlenBonusPer(st);
  E.depthPer = (st) => C.DEPTH_MULT + E.agg(st).depthAdd;
  E.depthMult = (st) => Math.pow(E.depthPer(st), st.depth);
  E.swarmMult = (st) => 1 + E.agg(st).perBuildingPct * E.buildings(st);

  E.buffMult = function (st) {
    let m = 1;
    for (const b of st.buffs) if (b.until > st.time) m *= b.mult;
    return m;
  };

  // Produktions-Multiplikator für alle Lumen-Anlagen (ohne Einzelboni)
  E.globalMult = function (st, noBuff) {
    const a = E.agg(st);
    return a.all * E.achievementMult(st) * E.perlenMult(st) * E.depthMult(st) * E.swarmMult(st) * (noBuff ? 1 : E.buffMult(st));
  };

  E.reinforcePer = (st) => C.REINFORCE.mult + E.agg(st).reinforceEff;
  E.reinforceMult = (st, id) => Math.pow(E.reinforcePer(st), st.reinforce[id] || 0);

  E.synergyMult = function (st, id) {
    const a = E.agg(st);
    let m = 1;
    for (const s of a.synergies) if (s.gen === id) m *= 1 + s.perUnit * a.synergyBoost * (st.gens[s.src] || 0);
    return m;
  };

  // Gesamtmultiplikator einer einzelnen Anlage (ohne globale Boni)
  E.genLocalMult = (st, id) => E.agg(st).genMult[id] * E.reinforceMult(st, id) * E.synergyMult(st, id);

  E.genEach = function (st, id, noBuff) {
    return C.GEN_BY_ID[id].baseProd * E.genLocalMult(st, id) * E.globalMult(st, noBuff);
  };
  E.genTotal = (st, id, noBuff) => E.genEach(st, id, noBuff) * (st.gens[id] || 0);

  E.lps = function (st, noBuff) {
    const g = E.globalMult(st, noBuff);
    let sum = 0;
    for (const def of C.GENERATORS) {
      const n = st.gens[def.id];
      if (n > 0) sum += def.baseProd * n * E.genLocalMult(st, def.id);
    }
    return Math.min(sum * g, C.MAX_VALUE);
  };

  E.clickBase = (st) => (C.CLICK.base + E.agg(st).clickFlat) * E.agg(st).clickMult;
  E.clickValue = (st) => E.clickBase(st) + E.agg(st).clickPct * E.lps(st);

  E.mps = function (st) {
    const a = E.agg(st);
    let s = 0;
    for (const m of C.MINERS) s += (st.miners[m.id] || 0) * m.prod;
    return s * a.manganMult;
  };
  E.dps = (st) => st.sonar * C.SONAR.prod * E.agg(st).dataMult;

  // ---- Kosten ---------------------------------------------------------------
  // Summe einer geometrischen Reihe: base*g^owned * (g^n - 1)/(g - 1)
  E.seriesCost = function (base, growth, owned, n) {
    if (n <= 0) return 0;
    return base * Math.pow(growth, owned) * (Math.pow(growth, n) - 1) / (growth - 1);
  };
  E.seriesMax = function (base, growth, owned, money) {
    const first = base * Math.pow(growth, owned);
    if (money < first) return 0;
    return Math.max(0, Math.floor(Math.log(money * (growth - 1) / first + 1) / Math.log(growth)));
  };

  E.genCost = (st, id, n) => { const g = C.GEN_BY_ID[id]; return E.seriesCost(g.baseCost, g.growth, st.gens[id], n || 1); };
  E.genMax = (st, id) => { const g = C.GEN_BY_ID[id]; return E.seriesMax(g.baseCost, g.growth, st.gens[id], st.res.lumen); };

  E.minerCost = (st, id, n) => { const m = C.MINER_BY_ID[id]; return E.seriesCost(m.baseCost, m.growth, st.miners[id], n || 1); };
  E.minerMax = (st, id) => { const m = C.MINER_BY_ID[id]; return E.seriesMax(m.baseCost, m.growth, st.miners[id], st.res.lumen); };

  E.sonarCost = function (st, n) {
    n = n || 1;
    return {
      lumen: E.seriesCost(C.SONAR.baseCost.lumen, C.SONAR.growth, st.sonar, n),
      mangan: E.seriesCost(C.SONAR.baseCost.mangan, C.SONAR.growth, st.sonar, n),
    };
  };
  E.sonarMax = function (st) {
    return Math.min(
      E.seriesMax(C.SONAR.baseCost.lumen, C.SONAR.growth, st.sonar, st.res.lumen),
      E.seriesMax(C.SONAR.baseCost.mangan, C.SONAR.growth, st.sonar, st.res.mangan));
  };

  E.reinforceCost = function (st, id) {
    const R = C.REINFORCE;
    return R.baseCost * Math.pow(R.tierScale, C.GEN_BY_ID[id].tier) * Math.pow(R.growth, st.reinforce[id] || 0);
  };

  E.descentCost = function (st, depth) {
    const d = C.DEPTHS[depth];
    if (!d) return null;
    const f = Math.max(0.1, 1 - E.agg(st).descentDiscount);
    const out = {};
    for (const k in d.cost) out[k] = d.cost[k] * f;
    return out;
  };

  E.expeditionCost = function (st, id) {
    const x = C.EXPEDITION_BY_ID[id];
    const f = Math.pow(x.growth, st.expedition.levels[id] || 0);
    const out = {};
    for (const k in x.cost) out[k] = x.cost[k] * f;
    return out;
  };
  E.expeditionDuration = (st, id) => C.EXPEDITION_BY_ID[id].duration * E.agg(st).expSpeed;

  E.shopCost = function (st, id) {
    const s = C.SHOP_BY_ID[id];
    return Math.ceil(s.cost.base * Math.pow(s.cost.growth, st.prestige.shop[id] || 0));
  };

  E.analysisCost = (st) => C.ANALYSIS.baseCost * Math.pow(C.ANALYSIS.growth, st.analysis);

  E.protocolSwitchCost = (st) => C.PROTOCOL_SWITCH_COST * Math.pow(2, st.protocolSwitches);

  E.canAfford = function (st, cost) {
    for (const k in cost) if ((st.res[k] || 0) < cost[k] - 1e-9) return false;
    return true;
  };

  // ---- Sonstiges ------------------------------------------------------------
  E.offlineCapSeconds = (st) => (C.OFFLINE.baseCapHours + E.agg(st).offlineHours) * 3600;

  E.ability = function (st) {
    const a = E.agg(st);
    return {
      unlocked: a.ability,
      duration: C.ABILITY.duration * a.abilityDur,
      cooldown: C.ABILITY.cooldown * a.abilityCd,
      mult: C.ABILITY.mult + a.abilityPowerAdd,
      readyIn: Math.max(0, st.ability.readyAt - st.time),
    };
  };

  E.eventDelay = function (st, rnd) {
    const ev = C.EVENTS;
    return (ev.minDelay + (ev.maxDelay - ev.minDelay) * rnd) * E.agg(st).eventFreq;
  };
  E.eventLifetime = (st) => C.EVENTS.lifetime * E.agg(st).eventDur;

  E.prestigeGain = function (st) {
    const P = C.PRESTIGE;
    if (st.run.lumen <= 0) return 0;
    return Math.floor(P.scale * Math.pow(st.run.lumen / P.base, P.exponent));
  };
  E.prestigeNextAt = function (st) {
    const P = C.PRESTIGE;
    const g = E.prestigeGain(st) + 1;
    return P.base * Math.pow(g / P.scale, 1 / P.exponent);
  };

  E.maxProtocols = (st) => (E.agg(st).dualProtocol ? 2 : 1);

  AB.Economy = E;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
