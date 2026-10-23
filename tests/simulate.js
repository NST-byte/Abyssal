// Wirtschafts-Simulation v2: Ein Bot spielt mit der echten Spiellogik –
// inklusive Station, Verarbeitungsketten, Tech-Gabeln, Karte, Strömungen,
// Gezeitenwenden, Gezeiten-Baum und Weltenwende.
// Aufruf: node tests/simulate.js [stunden] [profil] [build]
//   profil: active | passive | idle      build: flow | pulse | swarm | deep
'use strict';
const { load } = require('./harness');

const PROFILES = {
  active: { cpsEarly: 4, cpsLate: 1.5, checkEvery: 5, events: 1.0, ability: true, protocol: 'pulse' },
  passive: { cpsEarly: 1, cpsLate: 0.2, checkEvery: 30, events: 0.4, ability: true, protocol: 'swarm' },
  idle: { cpsEarly: 0.3, cpsLate: 0, checkEvery: 120, events: 0.1, ability: false, protocol: 'current' },
};

const BUILDS = {
  flow: ['t_memory', 't_known', 't_memory', 't_flotsam', 't_forge', 't_memory', 't_cap_flow', 't_compass', 't_archive', 't_charts', 't_fleet', 't_memory', 't_flotsam', 't_rest', 't_auto', 't_colony', 't_selfrun', 't_cap_deep', 't_flotsam', 't_compass', 't_compass', 't_colony', 't_colony'],
  pulse: ['t_pulse', 't_memory', 't_start', 't_known', 't_pulse', 't_lure', 't_chainreact', 't_memory', 't_cap_pulse', 't_flotsam', 't_memory', 't_compass', 't_archive', 't_charts', 't_archeo', 't_memory', 't_pulse', 't_lure', 't_cap_deep', 't_rest', 't_auto'],
  swarm: ['t_rest', 't_memory', 't_auto', 't_known', 't_colony', 't_memory', 't_selfrun', 't_colony', 't_memory', 't_cap_swarm', 't_flotsam', 't_colony', 't_compass', 't_archive', 't_charts', 't_fleet', 't_memory', 't_cap_deep', 't_rest', 't_rest'],
  deep: ['t_compass', 't_memory', 't_charts', 't_known', 't_archive', 't_fleet', 't_memory', 't_compass', 't_cap_deep', 't_memory', 't_flotsam', 't_forge', 't_cap_flow', 't_compass', 't_memory', 't_rest', 't_auto', 't_colony', 't_selfrun'],
};
const ORIGIN_ORDER = ['o_command', 'o_light', 'o_heritage', 'o_light', 'o_pearl', 'o_light', 'o_grid', 'o_dual', 'o_light', 'o_pearl', 'o_third', 'o_relic', 'o_light'];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function runSim(opts) {
  const AB = opts.AB || load();
  const { Economy: E, Actions: A, Core, Unlocks: U, CONFIG: C, State: S } = AB;
  const prof = Object.assign({}, PROFILES[opts.profile || 'active'], opts.override || {});
  const build = BUILDS[opts.build || 'flow'];
  const rng = makeRng(opts.seed || 42);
  const st = opts.state || S.create(0);
  st.rng = (opts.seed || 42) * 7919 >>> 0;
  if (!opts.state) st.map.sectors = S.makeSectors(st); // Karte aus dem Seed, nicht aus der Uhrzeit
  const log = [];
  const T0 = st.stats.playTime;
  const hours = opts.hours || 2;
  const endT = T0 + hours * 3600;
  const dt = opts.dt || 1;
  const mark = (msg) => log.push({ t: st.stats.playTime - T0, msg });
  const checkpoints = [];
  let nextEvent = st.stats.playTime + 200;
  let lastShop = -1e9;
  let bestRatio = 0;
  let lastDepth = 0, depthAt = 0;
  let runStartLumen = 0;
  const seenMissions = new Set(Object.keys(st.missions));
  let wendeTimes = [];
  let lastCheckpoint = -1;

  // ---- Entscheidungen -------------------------------------------------------
  function research() {
    const order = C.RESEARCH.filter((r) => U.researchState(st, r) === 'open').map((r) => {
      let score = E.techCost(st, r);
      if (r.group === 'breed') {
        const deepShare = C.GENERATORS.filter((g) => g.tier >= 4).reduce((s, g) => s + E.genTotal(st, g.id, true), 0) / (E.lps(st, true) + 1e-9);
        if ((r.id === 'r_deep') !== (deepShare > 0.5)) score *= 50;
      }
      if (r.group === 'smelt' && r.id === 'r_light') score *= 50;
      if (r.group === 'forge') { const want = st.res.data > 5000 ? 'r_compress' : 'r_grow'; if (r.id !== want) score *= 50; }
      if (r.group === 'sonar') { const want = opts.build === 'deep' ? 'r_deepsonar' : 'r_broad'; if (r.id !== want) score *= 50; }
      return { r, score };
    }).sort((a, b) => a.score - b.score);
    const pick = order[0];
    if (pick && st.res.data >= E.techCost(st, pick.r) && pick.score < st.res.data * 20) return A.research(st, pick.r.id).ok;
    // Gabel umrüsten, wenn sich die Lage gedreht hat
    if (st.research.r_cold) {
      const f = E.flows(st);
      if (f.alloyOut * 6000 < E.lps(st, true) * 0.04 && st.res.data > E.techCost(st, C.RESEARCH_BY_ID.r_light) * 3) return A.research(st, 'r_light').ok;
    }
    return false;
  }

  function freeCell() {
    for (let i = 0; i < st.station.cells.length; i++) if (E.cellActive(st, i) && !st.station.cells[i]) return i;
    return -1;
  }
  function afford(cost, share) {
    for (const k in cost) if ((st.res[k] || 0) * (share || 1) < cost[k]) return false;
    return true;
  }
  // Wie ein Spieler: Verarbeitung drosseln, wenn sie den Abstieg blockiert
  function manageChains() {
    const nd = st.depth + 1;
    const need = C.DEPTHS[nd] && E.depthAllowed(st, nd) ? E.descentCost(st, nd) : null;
    const f = E.flows(st);
    const starveData = need && need.data && st.res.data < need.data && f.foundryIn.data;
    const starveMangan = need && need.mangan && st.res.mangan < need.mangan && f.smelterIn.mangan;
    // Schmelzen fressen zu viel Lumen? (mit allen Schmelzen an gerechnet)
    const lpsNow = E.lps(st);
    const potAlloy = st.station.cells.reduce((sum, c) => sum + (c && c.t === 'smelter' ? E.levelPow(c.lvl) : 0), 0) * C.MODULE_BY_ID.smelter.out.alloy * E.mod(st, 'smelterMult') * E.pressureMult(st);
    const eatsLumen = f.smelterIn.lumen && potAlloy * f.smelterIn.lumen > lpsNow * 0.5 && st.res.alloy > 200;
    let changed = false;
    st.station.cells.forEach((c, i) => {
      if (!c) return;
      let on = c.on;
      if (c.t === 'foundry') on = !starveData;
      if (c.t === 'smelter') on = !starveMangan && !eatsLumen;
      if (on !== c.on) { A.toggleModule(st, i); changed = true; }
    });
    return changed;
  }

  function dataShort() {
    const nd = st.depth + 1;
    const need = C.DEPTHS[nd] && E.depthAllowed(st, nd) ? E.descentCost(st, nd) : null;
    return !!(need && need.data && st.res.data < need.data && E.dps(st) * 1800 < need.data - st.res.data);
  }

  function station() {
    if (st.depth < 1) return false;
    const f = E.flows(st);
    const nr = E.netRates(st);
    const cnt = (t) => E.moduleCount(st, t);
    const wants = [];
    if (f.demand > f.supply * 0.98) wants.push('reactor');
    if (st.depth >= 3 && cnt('foundry') === 0) wants.push('foundry');
    if (st.depth >= 3 && cnt('dock') < 1) wants.push('dock');
    if (st.depth >= 3 && (cnt('foundry') < Math.max(1, Math.floor(cnt('smelter') / 2)) || (st.res.alloy > 5000 && nr.foundryFill > 0.95)) && nr.alloy > 0) wants.push('foundry');
    if (cnt('smelter') === 0 || (nr.smelterFill >= 0.99 && E.mps(st) > f.alloyOut * (f.smelterIn.mangan || 0) * 1.4)) wants.push('smelter');
    if (st.depth >= 2 && dataShort() && cnt('lab') < 6) wants.push('lab');
    if (st.depth >= 2 && cnt('cooler') < 2) wants.push('cooler');
    if (st.depth >= 2 && cnt('lab') < 2) wants.push('lab');
    if (st.depth >= 2 && cnt('prism') < 2) wants.push('prism');
    if (st.depth >= 5 && cnt('resonator') < 1) wants.push('resonator');
    for (const want of wants) {
      if (C.MODULE_BY_ID[want].depth > st.depth) continue;
      const cost = E.moduleBuildCost(st, want);
      if (!afford(cost, 0.5)) continue; // unbezahlbar: nächstes Ziel versuchen
      let cell = freeCell();
      // Raster voll: für wichtige Module eine überzählige Schmelze umbauen
      if (cell < 0 && (want === 'lab' || want === 'foundry' || (want === 'dock' && cnt('dock') === 0)) && cnt('smelter') > 3) {
        const i = st.station.cells.findIndex((c) => c && c.t === 'smelter');
        if (i >= 0) { A.demolishModule(st, i); cell = i; }
      }
      if (cell >= 0) return A.buildModule(st, cell, want).ok;
    }
    // Raster voll: das Engpass-Modul verbessern
    const prefer = f.demand > f.supply * 0.95 ? ['reactor'] : dataShort() ? ['lab', 'reactor', 'foundry', 'smelter'] : ['smelter', 'foundry', 'reactor', 'lab', 'prism', 'cooler', 'dock', 'resonator'];
    let best = null;
    st.station.cells.forEach((c, i) => {
      if (!c || !E.cellActive(st, i) || c.lvl >= C.GRID.maxLevel || prefer.indexOf(c.t) < 0) return;
      const cost = E.moduleUpgradeCost(st, c);
      const rank = prefer.indexOf(c.t) * 10 + c.lvl;
      if (!best || rank < best.rank) best = { i, cost, rank };
    });
    if (best && afford(best.cost, 0.3)) return A.upgradeModule(st, best.i).ok;
    return false;
  }

  function mapActions() {
    if (E.mapLocked(st)) return false;
    // Erkundete Sektoren entscheiden
    for (let i = 0; i < st.map.sectors.length; i++) {
      const s = st.map.sectors[i];
      if (s.state !== 'revealed') continue;
      const pri = { ore: 3, nest: 4, grotto: 2, vent: 1, ruin: 0, wreck: -1 }[s.type];
      if (pri >= 1 && E.outpostsUsed(st) < E.outpostsMax(st)) return A.exploitSector(st, i).ok;
      // besserer Sektor als ein schwacher Außenposten? sonst bergen
      return A.salvageSector(st, i, rng(), rng()).ok;
    }
    if (st.map.subs < E.subCapacity(st) && afford(E.subCost(st), 0.3)) return A.buildSub(st).ok;
    if (E.subsBusy(st) < E.subsTotal(st)) {
      const idx = st.map.sectors.findIndex((s) => s.state === 'unknown' && s.zone <= st.depth);
      if (idx >= 0 && afford(E.scanCost(st, st.map.sectors[idx].zone), 0.4)) return A.scanSector(st, idx).ok;
    }
    return false;
  }

  function lumenBuys() {
    const base = E.lps(st, true) + 1e-9;
    const need = E.descentCost(st, st.depth + 1);
    const allowed = need && E.depthAllowed(st, st.depth + 1);
    const cands = [];
    for (const g of C.GENERATORS) {
      if (st.depth < g.depth) continue;
      const cost = E.genCost(st, g.id, 1);
      if (g.cost2 && st.res[g.cost2.res] * 0.5 < cost[g.cost2.res]) continue;
      if (g.cost2 && allowed && need[g.cost2.res] && st.res[g.cost2.res] - cost[g.cost2.res] < need[g.cost2.res] * 0.8) continue;
      st.gens[g.id]++; E.invalidate();
      const d = E.lps(st, true) - base;
      st.gens[g.id]--; E.invalidate();
      cands.push({ kind: 'gen', id: g.id, cost: cost.lumen, delta: d });
    }
    for (const u of U.availableUpgrades(st)) {
      const cv0 = E.clickValue(st);
      st.upgrades[u.id] = true; E.invalidate();
      let d = E.lps(st, true) - base;
      const cv1 = E.clickValue(st);
      delete st.upgrades[u.id]; E.invalidate();
      if (u.kind === 'click') d = Math.max(d, (cv1 - cv0) * prof.cpsLate);
      if (u.effects.some((e) => /manganMult|dataMult|smelterMult|foundryMult/.test(e.type))) d = Math.max(d, base * 0.05);
      cands.push({ kind: 'upg', id: u.id, cost: u.cost, delta: d });
    }
    // Mangan/Daten: kaufen, wenn sie Engpass sind
    const nr = E.netRates(st);
    for (const m of C.MINERS) {
      if (st.depth < m.depth) continue;
      const cost = E.minerCost(st, m.id, 1).lumen;
      const short = (need && need.mangan && st.res.mangan < need.mangan) || nr.smelterFill < 0.95 || nr.mangan < E.mps(st) * 0.2;
      if (short || st.miners[m.id] < 3 || cost < st.res.lumen * 0.02) cands.push({ kind: 'miner', id: m.id, cost, delta: base * 2 });
    }
    if (st.depth >= 2) {
      const c = E.sonarCost(st, 1);
      const short = (need && need.data && st.res.data < need.data) || nr.foundryFill < 0.95 || st.res.data < 500;
      if (st.res.mangan * 0.3 >= c.mangan && (short || c.lumen < st.res.lumen * 0.03)) cands.push({ kind: 'sonar', cost: c.lumen, delta: base * 2 });
    }
    const list = cands.filter((c) => c.delta > 0).map((c) => Object.assign(c, { score: c.cost / c.delta })).sort((a, b) => a.score - b.score);
    if (!list.length) return false;
    // für Abstieg sparen
    if (allowed) {
      const otherOk = Object.keys(need).every((k) => k === 'lumen' || st.res[k] >= need[k]);
      if (otherOk && need.lumen < base * 300 + st.res.lumen && st.res.lumen < need.lumen) return false;
    }
    const pick = list.find((c) => st.res.lumen >= c.cost && c.score < list[0].score * 1.5);
    if (!pick) return false;
    if (pick.kind === 'gen') return A.buyGen(st, pick.id, 1).ok;
    if (pick.kind === 'upg') return A.buyUpgrade(st, pick.id).ok;
    if (pick.kind === 'miner') return A.buyMiner(st, pick.id, 1).ok;
    if (pick.kind === 'sonar') return A.buySonar(st, 1).ok;
    return false;
  }

  function reinforce() {
    if (st.depth < 1) return false;
    const need = E.descentCost(st, st.depth + 1);
    const reserve = need && need.mangan ? need.mangan : 0;
    let best = null;
    for (const g of C.GENERATORS) {
      if (st.gens[g.id] < 1 || st.reinforce[g.id] >= C.REINFORCE.maxLevel) continue;
      const cost = E.reinforceCost(st, g.id).mangan;
      const gain = E.genTotal(st, g.id, true);
      if (!best || cost / gain < best.sc) best = { id: g.id, cost, sc: cost / gain };
    }
    if (best && st.res.mangan - best.cost >= reserve && best.cost < st.res.mangan * 0.4) return A.reinforce(st, best.id).ok;
    return false;
  }

  function nextNeed() {
    const nd = st.depth + 1;
    return C.DEPTHS[nd] && E.depthAllowed(st, nd) ? E.descentCost(st, nd) : null;
  }

  function shop() {
    let guard = 0;
    while (guard++ < 300) {
      const nd = st.depth + 1;
      if (C.DEPTHS[nd] && E.depthAllowed(st, nd) && E.canAfford(st, E.descentCost(st, nd))) {
        A.descend(st);
        mark('ABSTIEG → ' + C.DEPTHS[st.depth].name + ' (Lauf ' + fmtT(st.run.time) + ', Lumen/s ' + AB.Format.num(E.lps(st, true)) + ')');
        continue;
      }
      manageChains();
      if (research()) continue;
      if (E.agg(st).protocolUnlock && st.protocols.length < E.maxProtocols(st)) {
        const pick = st.protocols.indexOf(prof.protocol) < 0 ? prof.protocol : ['swarm', 'current', 'pulse'].find((p) => st.protocols.indexOf(p) < 0);
        A.setProtocol(st, pick); continue;
      }
      if (station()) continue;
      if (mapActions()) continue;
      if (reinforce()) continue;
      if (st.depth >= 3 && !C.RESEARCH.some((r) => U.researchState(st, r) === 'open') && st.res.data > E.analysisCost(st) * 2 && !dataShort() && !(nextNeed() && nextNeed().data > st.res.data - E.analysisCost(st))) { if (A.analysis(st).ok) continue; }
      if (st.depth >= C.RECORD.depth && afford(E.recordCost(st), 0.5)) { if (A.drill(st).ok) continue; }
      if (st.current && E.agg(st).currentHold && st.current.charge >= C.CURRENTS.holdRecharge && ['warm', 'bloom', 'cold'].indexOf(st.current.type) >= 0) { A.holdCurrent(st); continue; }
      if (lumenBuys()) continue;
      break;
    }
  }

  function spendPerlen() {
    let guard = 0;
    while (guard++ < 100) {
      let bought = false;
      const seen = {};
      for (const id of build) {
        seen[id] = (seen[id] || 0) + 1;
        if ((st.prestige.tree[id] || 0) >= seen[id]) continue;
        const r = A.buyTree(st, id);
        bought = r.ok;
        if (r.ok || !/Perlen/.test(r.reason)) { if (r.ok) break; continue; }
        break; // zu teuer: sparen statt umentscheiden
      }
      if (!bought) {
        // Rest in Gezeitengedächtnis / irgendwas Offenes
        const open = C.TREE.filter((n) => U.treeState(st, n) === 'open').sort((a, b) => E.treeCost(st, a.id) - E.treeCost(st, b.id));
        if (open.length && st.perlen >= E.treeCost(st, open[0].id) * 2) bought = A.buyTree(st, open[0].id).ok;
      }
      if (!bought) break;
    }
  }
  function spendUrlicht() {
    let guard = 0;
    while (guard++ < 100) {
      let bought = false;
      for (const id of ORIGIN_ORDER) if (A.buyOrigin(st, id).ok) { bought = true; break; }
      if (!bought) break;
    }
    if (st.world.origin.o_heritage) A.setArchetype(st, opts.build === 'deep' ? 'hunter' : opts.build === 'pulse' ? 'science' : 'forge');
  }

  function fmtT(s) { const m = Math.floor(s / 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }

  // ---- Prestige-Entscheidungen ---------------------------------------------
  function maybePrestige() {
    if (opts.noPrestige) return;
    if (Core.canWorld(st) && E.worldGain(st) >= Math.max(opts.minUrlicht || 5, st.world.urlichtAll * 0.5)) {
      const g = E.worldGain(st);
      Core.worldTurn(st);
      mark('WELTENWENDE #' + st.world.count + ': +' + g + ' Urlicht');
      spendUrlicht();
      bestRatio = 0;
      return;
    }
    if (!Core.canPrestige(st)) return;
    // Wende, wenn die Perlenrate (Perlen pro Laufminute) abfällt – und nicht, solange eine
    // erreichbare tiefere Zone nah ist.
    const gain = E.prestigeGain(st);
    const ratio = gain / Math.max(60, st.run.time);
    if (ratio > bestRatio) bestRatio = ratio;
    const nd = st.depth + 1;
    const need = C.DEPTHS[nd] && E.depthAllowed(st, nd) ? E.descentCost(st, nd) : null;
    const deeperSoon = need && Object.keys(need).every((k) => k === 'lumen' || st.res[k] >= need[k] * 0.4) && st.run.time < 5 * 3600;
    const enough = gain >= Math.max(opts.minPerlen || 25, st.prestige.perlenEarned * (opts.wendeFactor || 1));
    if (st.depth > lastDepth) { lastDepth = st.depth; depthAt = st.run.time; }
    const atBottom = st.run.time - depthAt;
    if ((enough && !deeperSoon && (ratio < bestRatio * 0.95 || atBottom > 3600)) || st.run.time > 6 * 3600) {
      const r = Core.prestige(st);
      wendeTimes.push(r.runTime);
      mark('GEZEITENWENDE #' + st.prestige.total + ': +' + r.gain + ' Perlen (Lauf ' + fmtT(r.runTime) + ', Zyklus-Perlen ' + st.prestige.perlenEarned + ')');
      spendPerlen();
      bestRatio = 0; lastDepth = 0; depthAt = 0;
    }
  }

  // ---- Hauptschleife --------------------------------------------------------
  while (st.stats.playTime < endT) {
    const t = st.stats.playTime;
    const cps = st.run.time < 1200 ? prof.cpsEarly : prof.cpsLate;
    const clicks = Math.floor(cps * dt + rng());
    for (let i = 0; i < clicks; i++) A.click(st);
    if (U.features(st).events && t >= nextEvent) {
      if (rng() < prof.events) A.catchEvent(st, rng());
      nextEvent = t + E.eventDelay(st, rng());
    }
    if (prof.ability && E.ability(st).unlocked && E.ability(st).readyIn <= 0) A.useAbility(st);
    Core.advance(st, dt);
    U.check(st).forEach((n) => { if (n.type === 'mission' && !seenMissions.has(n.def.id)) { seenMissions.add(n.def.id); if (opts.verbose) mark('Auftrag: ' + n.def.name); } });
    if (t - lastShop >= prof.checkEvery) { shop(); maybePrestige(); lastShop = t; }
    const cpEvery = opts.cpEvery || 1800;
    const cp = Math.floor((t - T0) / cpEvery);
    if (cp !== lastCheckpoint) {
      lastCheckpoint = cp;
      const nr = E.netRates(st);
      checkpoints.push({ t: t - T0, depth: st.depth, lps: E.lps(st, true), alloy: st.res.alloy, aps: nr.alloy, crystal: st.res.crystal, cps: nr.crystal,
        mangan: st.res.mangan, data: st.res.data, dps: nr.data, mods: st.station.cells.filter(Boolean).length, relics: U.count(st.relics),
        wenden: st.prestige.total, perlen: st.perlen, earned: st.prestige.perlenEarned, gain: E.prestigeGain(st), record: st.record, worlds: st.world.count, ur: st.world.urlicht,
        tree: U.count(st.prestige.tree), energy: E.flows(st).eff });
    }
  }
  return { AB, st, log, checkpoints, wendeTimes };
}

function report(res, title) {
  const F = res.AB.Format;
  const fmtT = (s) => { const m = Math.floor(s / 60); return String(Math.floor(m / 60)).padStart(3) + 'h' + String(m % 60).padStart(2, '0'); };
  console.log('\n=== ' + title + ' ===');
  res.log.forEach((l) => console.log(fmtT(l.t) + '  ' + l.msg));
  console.log('\n  Zeit | Zn |   Lumen/s | Legierung  (+/s)  | Kristalle (+/s) |  Daten  (+/s) | Mod | Rel | Wenden | Perlen(Z) | +Wende | Baum | Rek | Welt');
  res.checkpoints.forEach((c) => console.log(
    fmtT(c.t) + ' | ' + String(c.depth).padStart(2) + ' | ' + F.num(c.lps).padStart(9) + ' | ' + F.num(c.alloy).padStart(9) + ' ' + F.rate(c.aps).padStart(7) + ' | ' +
    F.num(c.crystal).padStart(8) + ' ' + F.rate(c.cps).padStart(6) + ' | ' + F.num(c.data).padStart(7) + ' ' + F.rate(c.dps).padStart(5) + ' | ' + String(c.mods).padStart(3) + ' | ' + String(c.relics).padStart(3) + ' | ' +
    String(c.wenden).padStart(6) + ' | ' + F.num(c.earned).padStart(9) + ' | ' + F.num(c.gain).padStart(6) + ' | ' + String(c.tree).padStart(4) + ' | ' +
    String(c.record).padStart(3) + ' | ' + c.worlds + '/' + F.num(c.ur)));
}

if (require.main === module) {
  const hours = Number(process.argv[2] || 3);
  const profile = process.argv[3] || 'active';
  const build = process.argv[4] || 'flow';
  const t0 = Date.now();
  const r = runSim({ hours, profile, build, dt: hours > 6 ? 2 : 1, cpEvery: hours > 12 ? 3600 * 2 : hours > 4 ? 3600 : 900, verbose: process.argv[5] === 'v' });
  report(r, hours + ' h – Profil ' + profile + ', Build ' + build + ' (Rechenzeit ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}

module.exports = { runSim, PROFILES, BUILDS };
