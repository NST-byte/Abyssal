/* Produktions-, Fluss- und Kostenberechnung (rein, ohne DOM) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const E = {};
  const MAXC = C.GRID.maxCols;

  // ---- Effekt-Aggregation ---------------------------------------------------
  // Alle Boni (Upgrades, Forschung, Protokolle, Relikte, Gezeiten-Baum, Proben,
  // Ursprung, Erbstation, Außenposten) laufen durch dieselbe Effekt-Engine.
  // Ergebnis wird gecacht, bis E.invalidate() aufgerufen wird.
  let cache = null;
  let cacheState = null;
  let flowCache = null;

  E.invalidate = function () { cache = null; flowCache = null; };

  function blank() {
    const a = {
      genMult: {}, tierMults: [], all: 1, synergies: [], synergyBoost: 1,
      clickMult: 1, clickPct: 0, clickFlat: 0,
      manganMult: 1, dataMult: 1, depthAdd: 0,
      smelterMult: 1, foundryMult: 1, reactorMult: 1, chainInput: 1, recipes: {},
      eventFreq: 1, eventDur: 1, eventReward: 1, eventCrystals: false, offlineHours: 0, offlineMult: 1,
      ability: false, abilityDur: 1, abilityCd: 1, abilityPowerAdd: 0, abilityChains: false,
      reinforceEff: 0, perBuildingPct: 0, protocolUnlock: false,
      descentDiscount: 0, deepDiscount: 1, dualProtocol: false,
      autobuy: false, autoUpgrades: false, autoReinforce: false, autoResearch: false, autoDescend: false,
      gridCols: 0, gridRows: 0, moduleCost: 1, techCost: 1,
      subSpeed: 1, salvageMult: 1, subs: 0, outposts: 0, relicChance: 0,
      currentPower: 1, currentForecast: 0, currentHold: false,
      clickChain: false, clickResources: false,
      perlenMult: 1, capstones: 0, relicPower: 1,
      exploit: { manganPct: 0, lumenPct: 0, dataPct: 0, crystalPct: 0, energy: 0, subSpeedPct: 0 },
      achievements: 0,
    };
    C.GENERATORS.forEach((g) => { a.genMult[g.id] = 1; });
    return a;
  }

  const MULT = { allMult: 'all', synergyBoost: 'synergyBoost', clickMult: 'clickMult', manganMult: 'manganMult', dataMult: 'dataMult',
    eventFreq: 'eventFreq', eventDur: 'eventDur', eventReward: 'eventReward', abilityDur: 'abilityDur', abilityCd: 'abilityCd',
    smelterMult: 'smelterMult', foundryMult: 'foundryMult', reactorMult: 'reactorMult', chainInput: 'chainInput',
    moduleCost: 'moduleCost', techCost: 'techCost', subSpeed: 'subSpeed', salvageMult: 'salvageMult', currentPower: 'currentPower',
    perlenMult: 'perlenMult', offlineMult: 'offlineMult', deepDiscount: 'deepDiscount', relicPower: 'relicPower' };
  const ADD = { clickPct: ['clickPct', 'pct'], clickFlat: ['clickFlat', 'add'], depthAdd: ['depthAdd', 'add'], offlineHours: ['offlineHours', 'add'],
    abilityPowerAdd: ['abilityPowerAdd', 'add'], reinforceEff: ['reinforceEff', 'add'], perBuildingPct: ['perBuildingPct', 'pct'],
    descentDiscount: ['descentDiscount', 'add'], gridCols: ['gridCols', 'add'], gridRows: ['gridRows', 'add'], subs: ['subs', 'add'],
    outposts: ['outposts', 'add'], relicChance: ['relicChance', 'add'], currentForecast: ['currentForecast', 'add'], capstones: ['capstones', 'add'] };
  const FLAG = { abilityUnlock: 'ability', protocolUnlock: 'protocolUnlock', autobuy: 'autobuy', dualProtocol: 'dualProtocol',
    autoUpgrades: 'autoUpgrades', autoReinforce: 'autoReinforce', autoResearch: 'autoResearch', autoDescend: 'autoDescend',
    eventCrystals: 'eventCrystals', abilityChains: 'abilityChains', currentHold: 'currentHold', clickChain: 'clickChain', clickResources: 'clickResources' };

  // lvl darf gebrochen sein (z. B. verstärkte Relikte)
  E.applyEffect = function (a, e, lvl) {
    if (!lvl) return;
    if (e.type === 'genMult') a.genMult[e.gen] *= Math.pow(e.mult, lvl);
    else if (e.type === 'tierMult') a.tierMults.push({ min: e.min, max: e.max, mult: Math.pow(e.mult, lvl) });
    else if (e.type === 'synergy') a.synergies.push({ gen: e.gen, src: e.src, perUnit: e.perUnit });
    else if (e.type === 'recipe') a.recipes[e.machine] = e.recipe;
    else if (MULT[e.type]) a[MULT[e.type]] *= Math.pow(e.mult, lvl);
    else if (ADD[e.type]) a[ADD[e.type][0]] += e[ADD[e.type][1]] * lvl;
    else if (FLAG[e.type]) a[FLAG[e.type]] = true;
  };

  E.agg = function (st) {
    if (cache && cacheState === st) return cache;
    const a = blank();
    const ap = (list, lvl) => list.forEach((e) => E.applyEffect(a, e, lvl));
    C.ORIGIN.forEach((x) => ap(x.effects, st.world.origin[x.id] || 0));
    for (const id in st.upgrades) if (st.upgrades[id] && C.UPGRADE_BY_ID[id]) ap(C.UPGRADE_BY_ID[id].effects, 1);
    for (const id in st.research) if (st.research[id] && C.RESEARCH_BY_ID[id]) ap(C.RESEARCH_BY_ID[id].effects, 1);
    st.protocols.forEach((p) => { if (C.PROTOCOL_BY_ID[p]) ap(C.PROTOCOL_BY_ID[p].effects, 1); });
    const rp = a.relicPower;
    C.RELICS.forEach((x) => ap(x.effects, (st.relics[x.id] || 0) * rp));
    C.TREE.forEach((x) => ap(x.effects, st.prestige.tree[x.id] || 0));
    C.PROBES.list.forEach((x) => ap(x.effects, st.probes[x.id] || 0));
    const arch = C.ARCHETYPE_BY_ID[st.archetype];
    if (arch && arch.effects) ap(arch.effects, 1);
    if (st.analysis) a.all *= Math.pow(C.ANALYSIS.mult, st.analysis);
    if (st.record) a.all *= Math.pow(C.RECORD.mult, st.record);
    // Außenposten der Karte
    for (const s of st.map.sectors) {
      if (s.state !== 'exploited') continue;
      const ex = C.SECTOR_BY_ID[s.type].exploit;
      const zf = 1 + 0.5 * (s.zone - 1);
      for (const k in ex) a.exploit[k] += k === 'energy' ? ex[k] * s.zone : ex[k] * zf;
    }
    for (const id in st.achievements) if (st.achievements[id]) a.achievements++;
    cache = a;
    cacheState = st;
    return a;
  };

  // ---- Strömungen -----------------------------------------------------------
  let curCache = { key: null, val: null };
  E.currentAgg = function (st) {
    const a = E.agg(st);
    const type = st.current && st.depth >= C.CURRENTS.depth ? st.current.type : null;
    const key = type + '|' + a.currentPower;
    if (curCache.key === key && curCache.agg === a) return curCache.val;
    const c = { smelterMult: 1, foundryMult: 1, manganMult: 1, dataMult: 1, subSpeed: 1, salvageMult: 1, clickMult: 1, eventFreq: 1, tierMults: [] };
    if (type) {
      for (const e of C.CURRENT_BY_ID[type].effects) {
        const m = e.mult < 1 ? Math.pow(e.mult, a.currentPower) : 1 + (e.mult - 1) * a.currentPower;
        if (e.type === 'tierMult') c.tierMults.push({ min: e.min, max: e.max, mult: m });
        else c[e.type] *= m;
      }
    }
    curCache = { key, agg: a, val: c };
    return c;
  };
  E.mod = (st, key) => E.agg(st)[key] * E.currentAgg(st)[key];

  // ---- Multiplikatoren ------------------------------------------------------
  E.buildings = function (st) {
    let n = 0;
    for (const id in st.gens) n += st.gens[id];
    return n;
  };

  E.achievementMult = (st) => 1 + E.agg(st).achievements * C.ACHIEVEMENT_BONUS;
  E.perlenMult = (st) => 1 + Math.pow(Math.log10(1 + st.prestige.perlenEarned), 2) * C.PRESTIGE.earnedBonus;
  E.depthPer = (st) => C.DEPTH_MULT + E.agg(st).depthAdd;
  E.depthMult = (st) => (st.probe && st.probe.id === 'flat' ? 1 : Math.pow(E.depthPer(st), st.depth));
  E.swarmMult = (st) => 1 + E.agg(st).perBuildingPct * E.buildings(st);
  E.exploitLumenMult = (st) => 1 + E.agg(st).exploit.lumenPct;

  E.buffMult = function (st) {
    let m = 1;
    for (const b of st.buffs) if (b.until > st.time) m *= b.mult;
    return m;
  };
  E.overchargeMult = function (st) {
    for (const b of st.buffs) if (b.id === 'overcharge' && b.until > st.time) return b.mult;
    return 1;
  };

  // Produktions-Multiplikator für alle Lumen-Anlagen (ohne Einzelboni)
  E.globalMult = function (st, noBuff) {
    const a = E.agg(st);
    return a.all * E.achievementMult(st) * E.perlenMult(st) * E.depthMult(st) * E.swarmMult(st) *
      (1 + E.flows(st).prismPct) * E.exploitLumenMult(st) * (noBuff ? 1 : E.buffMult(st));
  };

  E.reinforcePer = (st) => C.REINFORCE.mult + E.agg(st).reinforceEff;
  E.reinforceMult = (st, id) => Math.pow(E.reinforcePer(st), st.reinforce[id] || 0);

  E.synergyMult = function (st, id) {
    const a = E.agg(st);
    let m = 1;
    for (const s of a.synergies) if (s.gen === id) m *= 1 + s.perUnit * a.synergyBoost * (st.gens[s.src] || 0);
    return m;
  };

  E.tierMult = function (st, tier) {
    let m = 1;
    for (const t of E.agg(st).tierMults) if (tier >= t.min && tier <= t.max) m *= t.mult;
    for (const t of E.currentAgg(st).tierMults) if (tier >= t.min && tier <= t.max) m *= t.mult;
    return m;
  };

  // Gesamtmultiplikator einer einzelnen Anlage (ohne globale Boni)
  E.genLocalMult = (st, id) => E.agg(st).genMult[id] * E.reinforceMult(st, id) * E.synergyMult(st, id) * E.tierMult(st, C.GEN_BY_ID[id].tier);

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

  E.clickBase = (st) => (C.CLICK.base + E.agg(st).clickFlat) * E.mod(st, 'clickMult');
  E.clickValue = function (st) {
    if (st.probe && st.probe.id === 'silent') return 0;
    return E.clickBase(st) + E.agg(st).clickPct * E.lps(st);
  };

  E.mps = function (st) {
    let s = 0;
    for (const m of C.MINERS) s += (st.miners[m.id] || 0) * m.prod;
    s *= E.mod(st, 'manganMult') * (1 + E.agg(st).exploit.manganPct);
    if (st.probe && st.probe.id === 'ore') s *= 0.1;
    return s;
  };
  // Daten aus Bojen (ohne Labore)
  E.sonarDps = function (st) {
    if (st.probe && st.probe.id === 'blind') return 0;
    return st.sonar * C.SONAR.prod * E.mod(st, 'dataMult') * (1 + E.agg(st).exploit.dataPct);
  };
  E.dps = (st) => E.sonarDps(st) + E.flows(st).labData;

  // ---- Station --------------------------------------------------------------
  E.gridSize = function (st) {
    const a = E.agg(st);
    return {
      cols: Math.min(C.GRID.maxCols, C.GRID.baseCols + a.gridCols),
      rows: Math.min(C.GRID.maxRows, C.GRID.baseRows + a.gridRows + (st.depth >= 3 ? 1 : 0)),
    };
  };
  E.cellActive = function (st, i) {
    const g = E.gridSize(st);
    return (i % MAXC) < g.cols && Math.floor(i / MAXC) < g.rows;
  };
  E.neighbors = function (st, i) {
    const g = E.gridSize(st);
    const r = Math.floor(i / MAXC), c = i % MAXC;
    const out = [];
    if (r > 0) out.push(i - MAXC);
    if (r < g.rows - 1) out.push(i + MAXC);
    if (c > 0) out.push(i - 1);
    if (c < g.cols - 1) out.push(i + 1);
    return out;
  };
  E.pressureMult = (st) => 1 + C.MODULE_DEPTH_BONUS * st.depth;

  // Leistung einer Modulstufe: Stufe * levelPower^(Stufe-1)
  E.levelPow = (lvl) => lvl * Math.pow(C.GRID.levelPower, lvl - 1);

  E.moduleCount = function (st, type) {
    let n = 0;
    for (const c of st.station.cells) if (c && c.t === type) n++;
    return n;
  };
  E.recipe = function (st, machine) {
    const id = E.agg(st).recipes[machine] || 'base';
    return Object.assign({ id }, C.RECIPES[machine][id]);
  };

  // Berechnet Energie, Durchsatz, Bedarf und Nachbarschaftsboni aller Module.
  // Ergebnis gilt für "volle Versorgung"; Rohstoffmangel wird in advance() begrenzt.
  E.flows = function (st) {
    const a = E.agg(st);
    const stamp = st.time + '|' + (st.current ? st.current.type : '') + '|' + st.buffs.length;
    if (flowCache && flowCache.st === st && flowCache.a === a && flowCache.stamp === stamp) return flowCache.f;
    const cells = st.station.cells;
    const info = new Array(cells.length).fill(null);
    let supply = a.exploit.energy, demand = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c || !E.cellActive(st, i)) continue;
      const def = C.MODULE_BY_ID[c.t];
      const nb = E.neighbors(st, i).map((j) => cells[j]).filter((x) => x && x.on);
      const coolers = nb.filter((x) => x.t === 'cooler');
      const relays = nb.filter((x) => x.t === 'relay');
      const resos = nb.filter((x) => x.t === 'resonator');
      const it = { energy: 0, boost: 1, mult: 1, save: 0 };
      if (c.on) {
        if (def.energy > 0) {
          it.boost = 1 + coolers.reduce((s, x) => s + 0.25 + 0.1 * (x.lvl - 1), 0);
          it.energy = def.energy * E.levelPow(c.lvl) * it.boost * a.reactorMult * (st.probe && st.probe.id === 'blackout' ? 0.5 : 1);
          supply += it.energy;
        } else if (def.energy < 0) {
          it.save = Math.min(0.8, relays.reduce((s, x) => s + 0.4 + 0.05 * (x.lvl - 1), 0));
          it.energy = def.energy * E.levelPow(c.lvl) * (1 - it.save);
          demand -= it.energy;
        }
        if (def.out || def.prismPct) {
          it.boost = 1 + coolers.reduce((s, x) => s + 0.35 + 0.1 * (x.lvl - 1), 0);
          it.mult = resos.reduce((m, x) => m * (1.5 + 0.1 * (x.lvl - 1)), 1);
        }
      }
      info[i] = it;
    }
    const eff = demand > 0 ? Math.min(1, supply / demand) : 1;
    const f = { supply, demand, eff, info, alloyOut: 0, crystalOut: 0, labData: 0, prismPct: 0, dockSubs: 0, dockSpeed: 0,
      smelterIn: {}, foundryIn: {} };
    const chain = a.chainInput;
    const oc = a.abilityChains ? E.overchargeMult(st) : 1;
    const smR = E.recipe(st, 'smelter'), foR = E.recipe(st, 'foundry');
    const smMult = E.mod(st, 'smelterMult') * oc;
    const foMult = E.mod(st, 'foundryMult') * (foR.speed || 1) * oc * (1 + a.exploit.crystalPct);
    const dataMult = E.mod(st, 'dataMult') * (1 + a.exploit.dataPct);
    const press = E.pressureMult(st);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i], it = info[i];
      if (!c || !it || !c.on) continue;
      const def = C.MODULE_BY_ID[c.t];
      const base = E.levelPow(c.lvl) * it.boost * it.mult * eff * (def.out ? press : 1);
      if (c.t === 'smelter') { it.rate = def.out.alloy * base * smMult; f.alloyOut += it.rate; }
      else if (c.t === 'foundry') { it.rate = def.out.crystal * base * foMult; f.crystalOut += it.rate; }
      else if (c.t === 'lab') { it.rate = def.out.data * base * dataMult; f.labData += it.rate; }
      else if (c.t === 'prism') { it.rate = def.prismPct * base; f.prismPct += it.rate; }
      else if (c.t === 'dock') { f.dockSubs += def.dockSubs * c.lvl; f.dockSpeed += def.dockSpeed * c.lvl; }
    }
    for (const k in smR.in) f.smelterIn[k] = smR.in[k] * chain;
    for (const k in foR.in) f.foundryIn[k] = foR.in[k] * chain;
    f.smelterRecipe = smR; f.foundryRecipe = foR;
    flowCache = { st, a, stamp, f };
    return f;
  };

  // Netto-Raten bei aktuellen Lagerbeständen (für Anzeige, dt = 1 s)
  E.netRates = function (st) {
    const f = E.flows(st);
    const lps = E.lps(st), mps = E.mps(st), dps = E.dps(st);
    const r = E.chainStep(st, 1, lps, mps, dps, f);
    return { lumen: lps - r.useLumen, mangan: mps - r.useMangan, data: dps - r.useData, alloy: r.alloy - r.useAlloy, crystal: r.crystal,
      smelterFill: r.fS, foundryFill: r.fF, grossLumen: lps, grossMangan: mps, grossData: dps };
  };

  // Verarbeitungskette für einen Zeitschritt: begrenzt durch Lager + Zufluss.
  E.chainStep = function (st, dt, lps, mps, dps, f) {
    f = f || E.flows(st);
    const sIn = f.smelterIn, fIn = f.foundryIn;
    const wantA = f.alloyOut * dt;
    let fS = 1;
    if (wantA > 0) {
      if (sIn.mangan) fS = Math.min(fS, (st.res.mangan + mps * dt) / (wantA * sIn.mangan));
      if (sIn.lumen) fS = Math.min(fS, (st.res.lumen + lps * dt) / (wantA * sIn.lumen));
      fS = Math.max(0, fS);
    }
    const alloyMade = wantA * fS;
    const wantK = f.crystalOut * dt;
    let fF = 1;
    if (wantK > 0) {
      if (fIn.alloy) fF = Math.min(fF, (st.res.alloy + alloyMade) / (wantK * fIn.alloy));
      if (fIn.data) fF = Math.min(fF, (st.res.data + dps * dt) / (wantK * fIn.data));
      fF = Math.max(0, fF);
    }
    const crystalMade = wantK * fF;
    return {
      fS, fF,
      alloy: alloyMade / dt, crystal: crystalMade / dt,
      useMangan: alloyMade * (sIn.mangan || 0) / dt, useLumen: alloyMade * (sIn.lumen || 0) / dt,
      useAlloy: crystalMade * (fIn.alloy || 0) / dt, useData: crystalMade * (fIn.data || 0) / dt,
    };
  };

  // ---- Kosten ---------------------------------------------------------------
  E.seriesCost = function (base, growth, owned, n) {
    if (n <= 0) return 0;
    return base * Math.pow(growth, owned) * (Math.pow(growth, n) - 1) / (growth - 1);
  };
  E.seriesMax = function (base, growth, owned, money) {
    const first = base * Math.pow(growth, owned);
    if (money < first) return 0;
    return Math.max(0, Math.floor(Math.log(money * (growth - 1) / first + 1) / Math.log(growth)));
  };

  E.genCost = function (st, id, n) {
    const g = C.GEN_BY_ID[id];
    n = n || 1;
    const out = { lumen: E.seriesCost(g.baseCost, g.growth, st.gens[id], n) };
    if (g.cost2) out[g.cost2.res] = E.seriesCost(g.cost2.base, g.cost2.growth, st.gens[id], n);
    return out;
  };
  E.genMax = function (st, id) {
    const g = C.GEN_BY_ID[id];
    let n = E.seriesMax(g.baseCost, g.growth, st.gens[id], st.res.lumen);
    if (g.cost2) n = Math.min(n, E.seriesMax(g.cost2.base, g.cost2.growth, st.gens[id], st.res[g.cost2.res]));
    return n;
  };

  E.minerCost = (st, id, n) => { const m = C.MINER_BY_ID[id]; return { lumen: E.seriesCost(m.baseCost, m.growth, st.miners[id], n || 1) }; };
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
    return { mangan: R.baseCost * Math.pow(R.tierScale, C.GEN_BY_ID[id].tier) * Math.pow(R.growth, st.reinforce[id] || 0) };
  };

  function scaleCost(cost, f) {
    const out = {};
    for (const k in cost) out[k] = cost[k] * f;
    return out;
  }

  E.moduleBuildCost = function (st, type) {
    const def = C.MODULE_BY_ID[type];
    return scaleCost(def.cost, Math.pow(def.countGrowth, E.moduleCount(st, type)) * E.agg(st).moduleCost);
  };
  E.moduleUpgradeCost = function (st, cell) {
    const def = C.MODULE_BY_ID[cell.t];
    return scaleCost(def.cost, Math.pow(C.GRID.levelGrowth, cell.lvl) * E.agg(st).moduleCost);
  };

  E.descentCost = function (st, depth) {
    const d = C.DEPTHS[depth];
    if (!d) return null;
    const a = E.agg(st);
    const f = Math.max(0.1, 1 - a.descentDiscount) * (depth >= 5 ? a.deepDiscount : 1);
    return scaleCost(d.cost, f);
  };

  E.techCost = (st, r) => Math.ceil(r.cost * E.agg(st).techCost);
  E.analysisCost = (st) => C.ANALYSIS.baseCost * Math.pow(C.ANALYSIS.growth, st.analysis) * E.agg(st).techCost;
  E.protocolSwitchCost = (st) => C.PROTOCOL_SWITCH_COST * Math.pow(2, st.protocolSwitches);

  E.treeCost = (st, id) => { const n = C.TREE_BY_ID[id]; return Math.ceil(n.cost.base * Math.pow(n.cost.growth, st.prestige.tree[id] || 0)); };
  E.originCost = (st, id) => { const n = C.ORIGIN_BY_ID[id]; return Math.ceil(n.cost.base * Math.pow(n.cost.growth, st.world.origin[id] || 0)); };

  E.recordCost = function (st) {
    const R = C.RECORD.cost;
    return { crystal: R.crystal * Math.pow(R.crystalGrowth, st.record), lumen: R.lumen * Math.pow(R.lumenGrowth, st.record) };
  };

  E.canAfford = function (st, cost) {
    for (const k in cost) {
      const have = k === 'perlen' ? st.perlen : k === 'urlicht' ? st.world.urlicht : (st.res[k] || 0);
      if (have < cost[k] - 1e-9) return false;
    }
    return true;
  };

  // ---- Karte ----------------------------------------------------------------
  E.mapLocked = (st) => st.depth < C.MAP.depth || (st.probe && st.probe.id === 'lonely');
  E.subsTotal = (st) => C.MAP.baseSubs + E.agg(st).subs + st.map.subs;
  E.subsBusy = (st) => st.map.missions.length;
  E.subCapacity = (st) => E.flows(st).dockSubs; // gebaute U-Boote brauchen Dockplätze
  E.subCost = (st) => ({ alloy: C.MAP.subCost.alloy * Math.pow(C.MAP.subCost.growth, st.map.subs) });
  E.outpostsMax = (st) => C.MAP.baseOutposts + E.agg(st).outposts;
  E.outpostsUsed = (st) => st.map.sectors.filter((s) => s.state === 'exploited').length;
  E.subSpeed = (st) => E.mod(st, 'subSpeed') * (1 + E.flows(st).dockSpeed) * (1 + E.agg(st).exploit.subSpeedPct);
  E.scanDuration = (st, zone) => C.MAP.scanTime * Math.pow(C.MAP.scanGrowth, zone - 1) / E.subSpeed(st);
  E.scanCost = function (st, zone) {
    const out = { alloy: C.MAP.scanCost.alloy * Math.pow(C.MAP.scanCost.growth, zone - 1) };
    if (zone >= C.MAP.scanCrystalFrom) out.crystal = C.MAP.scanCrystal * Math.pow(C.MAP.scanCost.growth, zone - C.MAP.scanCrystalFrom);
    return out;
  };
  E.relicChance = function (st, sector) {
    const sv = C.SECTOR_BY_ID[sector.type].salvage;
    if (!sv.relic) return 0;
    if (sv.relic >= 1) return 1;
    return Math.min(1, sv.relic + E.agg(st).relicChance);
  };
  E.availableRelics = (st, zone) => C.RELICS.filter((r) => r.minZone <= zone && (st.relics[r.id] || 0) < r.max);

  // Bergungsertrag (ohne Relikt) eines Sektors – skaliert mit aktueller Produktion
  E.salvageReward = function (st, sector) {
    const sv = C.SECTOR_BY_ID[sector.type].salvage;
    const zf = (1 + 0.5 * (sector.zone - 1)) * E.mod(st, 'salvageMult');
    const f = E.flows(st);
    const out = {};
    if (sv.mangan) out.mangan = Math.max(E.mps(st) * sv.mangan, 200 * sector.zone) * zf;
    if (sv.alloy) out.alloy = Math.max(f.alloyOut * sv.alloy, 60 * sector.zone * sector.zone) * zf;
    if (sv.lumen) out.lumen = Math.max(E.lps(st, true) * sv.lumen, 1e4) * zf;
    if (sv.data) out.data = Math.max(E.dps(st) * sv.data, 80 * sector.zone) * zf;
    if (sv.crystal) out.crystal = Math.max(f.crystalOut * sv.crystal, 10 * sector.zone * sector.zone) * zf;
    return out;
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
    return (ev.minDelay + (ev.maxDelay - ev.minDelay) * rnd) * E.mod(st, 'eventFreq');
  };
  E.eventLifetime = (st) => C.EVENTS.lifetime * E.agg(st).eventDur;

  // Gezeitenwende
  E.perlenFactor = function (st) {
    const P = C.PRESTIGE;
    return (1 + P.deepBonus * Math.max(0, st.run.maxDepth - 4)) * E.agg(st).perlenMult * (1 + C.RECORD.perlenPer * st.record);
  };
  E.prestigeGain = function (st) {
    const P = C.PRESTIGE;
    if (st.run.lumen <= 0) return 0;
    return Math.floor(P.scale * Math.pow(st.run.lumen / P.base, P.exponent) * E.perlenFactor(st));
  };
  E.prestigeNextAt = function (st) {
    const P = C.PRESTIGE;
    const g = E.prestigeGain(st) + 1;
    return P.base * Math.pow(g / (P.scale * E.perlenFactor(st)), 1 / P.exponent);
  };

  // Weltenwende
  E.worldGain = function (st) {
    const W = C.WORLD;
    const l = Math.log10(Math.max(1, st.prestige.perlenEarned)) - W.minLog;
    return l > 0 ? Math.floor(W.scale * Math.pow(l, W.exponent)) : 0;
  };

  E.maxProtocols = (st) => (E.agg(st).dualProtocol ? 2 : 1);
  E.maxCapstones = (st) => C.MAX_CAPSTONES + E.agg(st).capstones;
  E.capstonesUsed = (st) => C.TREE.filter((n) => n.capstone && st.prestige.tree[n.id]).length;
  E.depthAllowed = function (st, depth) {
    const d = C.DEPTHS[depth];
    return !!d && (!d.reqPrestige || st.prestige.total >= d.reqPrestige);
  };

  AB.Economy = E;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
