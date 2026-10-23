// Wirtschafts-Simulation: ein Bot spielt mit der echten Spiellogik und
// protokolliert, wann Meilensteine erreicht werden.
// Aufruf: node tests/simulate.js [minuten] [protokoll] [klicks/s] [läufe]
'use strict';
const { load } = require('./harness');

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function runSim(opts) {
  const AB = load();
  const { Economy: E, Actions: A, Core, Unlocks: U, CONFIG: C, State } = AB;
  const minutes = opts.minutes || 150;
  const protocol = opts.protocol || 'swarm';
  const cps = opts.cps === undefined ? 1.5 : opts.cps;
  const rng = makeRng(opts.seed || 42);
  const st = opts.state || State.create(0);
  const log = [];
  const t0 = st.run.time;
  const mark = (msg) => log.push({ t: st.run.time - t0, msg });
  const seenMissions = new Set(Object.keys(st.missions));
  let nextEvent = 200 + rng() * 120;
  let lastPrint = -1;
  const checkpoints = [];

  function nextDescentNeeds() {
    const nd = st.depth + 1;
    if (nd >= C.DEPTHS.length) return null;
    return E.descentCost(st, nd);
  }

  function valueRates() {
    const d = C.DEPTHS[Math.min(st.depth + 1, C.DEPTHS.length - 1)].cost;
    const ref = C.DEPTHS[Math.min(Math.max(st.depth + 1, 2), C.DEPTHS.length - 1)].cost;
    const mRate = d.mangan ? d.lumen / d.mangan : (ref.lumen / ref.mangan);
    const dRef = C.DEPTHS[Math.max(3, Math.min(st.depth + 1, C.DEPTHS.length - 1))].cost;
    const dRate = dRef.lumen / dRef.data;
    return { mRate, dRate };
  }

  function lumenCandidates() {
    const out = [];
    const base = E.lps(st, true) + 1e-9;
    for (const g of C.GENERATORS) {
      if (st.depth < g.depth) continue;
      st.gens[g.id]++; E.invalidate();
      const d = E.lps(st, true) - base;
      st.gens[g.id]--; E.invalidate();
      out.push({ kind: 'gen', id: g.id, cost: E.genCost(st, g.id, 1), delta: d });
    }
    for (const u of U.availableUpgrades(st)) {
      const cv0 = E.clickValue(st);
      st.upgrades[u.id] = true; E.invalidate();
      let d = E.lps(st, true) - base;
      const cv1 = E.clickValue(st);
      delete st.upgrades[u.id]; E.invalidate();
      if (u.kind === 'click') d = Math.max(d, (cv1 - cv0) * cps * 0.4);
      if (u.effects.some((e) => e.type === 'manganMult' || e.type === 'dataMult')) d = Math.max(d, base * 0.05);
      out.push({ kind: 'upg', id: u.id, cost: u.cost, delta: d });
    }
    // Mangan/Daten nur kaufen, wenn sie für den nächsten Abstieg der Engpass sind
    const need = nextDescentNeeds() || {};
    const lps = E.lps(st, true) + 1e-9;
    const tL = Math.max(0, ((need.lumen || 0) - st.res.lumen) / lps);
    for (const m of C.MINERS) {
      if (st.depth < m.depth) continue;
      const mps = E.mps(st) + 1e-9;
      const tM = Math.max(0, ((need.mangan || 0) - st.res.mangan) / mps);
      const cost = E.minerCost(st, m.id, 1);
      const surplusWanted = st.depth >= 1 && st.res.mangan < E.reinforceCost(st, C.GENERATORS[Math.max(0, st.depth * 2 - 1)].id);
      if ((tM > tL * 0.7 && tM > 30) || (surplusWanted && cost < lps * 60) || st.miners[m.id] < 3 || cost < st.res.lumen * 0.03) {
        out.push({ kind: 'miner', id: m.id, cost, delta: lps * 2 });
      }
    }
    if (st.depth >= 2) {
      const c = E.sonarCost(st, 1);
      const dps = E.dps(st) + 1e-9;
      const openRes = C.RESEARCH.filter((r) => U.researchState(st, r) !== 'done' && st.depth >= r.depth).reduce((s, r) => s + r.cost, 0);
      const tD = Math.max(0, ((need.data || 0) + openRes * 0.5 - st.res.data) / dps);
      if (st.res.mangan >= c.mangan && (tD > tL * 0.7 && tD > 30 || st.sonar < 3 || (c.lumen < st.res.lumen * 0.05 && c.mangan < st.res.mangan * 0.2))) {
        out.push({ kind: 'sonar', cost: c.lumen, delta: lps * 2 });
      }
    }
    return out.filter((c) => c.delta > 0).map((c) => Object.assign(c, { score: c.cost / c.delta }));
  }

  function buy(c) {
    if (c.kind === 'gen') return A.buyGen(st, c.id, 1).ok;
    if (c.kind === 'upg') return A.buyUpgrade(st, c.id).ok;
    if (c.kind === 'miner') return A.buyMiner(st, c.id, 1).ok;
    if (c.kind === 'sonar') return A.buySonar(st, 1).ok;
    return false;
  }

  function shop() {
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 400) {
      changed = false;
      // Abstieg
      const need = nextDescentNeeds();
      if (need && E.canAfford(st, need)) {
        A.descend(st);
        mark('ABSTIEG → ' + C.DEPTHS[st.depth].name + '  (Lumen/s ' + AB.Format.num(E.lps(st, true)) + ')');
        changed = true; continue;
      }
      // Forschung
      const open = C.RESEARCH.filter((r) => U.researchState(st, r) === 'open').sort((a, b) => a.cost - b.cost);
      if (open.length && st.res.data >= open[0].cost) {
        A.research(st, open[0].id); changed = true; continue;
      }
      if (st.depth >= 3 && !open.length && st.res.data >= E.analysisCost(st) && (!need || st.res.data - E.analysisCost(st) >= (need.data || 0))) {
        if (A.analysis(st).ok) { changed = true; continue; }
      }
      if (E.agg(st).protocolUnlock && st.protocols.length < E.maxProtocols(st)) {
        const pick = st.protocols.indexOf(protocol) < 0 ? protocol : ['swarm', 'current', 'pulse'].find((p) => st.protocols.indexOf(p) < 0);
        A.setProtocol(st, pick); changed = true; continue;
      }
      // Expeditionen
      if (st.depth >= 3 && !st.expedition.active) {
        const ex = C.EXPEDITIONS.filter((x) => st.expedition.levels[x.id] < x.maxLevel)
          .map((x) => ({ x, c: E.expeditionCost(st, x.id) }))
          .filter((o) => E.canAfford(st, o.c) && (!need || st.res.mangan - o.c.mangan > (need.mangan || 0) * 0.3 || st.depth >= 4))
          .sort((a, b) => a.c.mangan - b.c.mangan);
        if (ex.length) { A.startExpedition(st, ex[0].x.id); changed = true; continue; }
      }
      // Verstärkung
      if (st.depth >= 1) {
        const reserve = need && need.mangan ? need.mangan : 0;
        let best = null;
        const base = E.lps(st, true);
        for (const g of C.GENERATORS) {
          if (st.gens[g.id] < 1 || st.reinforce[g.id] >= C.REINFORCE.maxLevel) continue;
          const cost = E.reinforceCost(st, g.id);
          const gain = E.genTotal(st, g.id, true) * (E.reinforcePer(st) - 1);
          const sc = cost / (gain / (base + 1e-9));
          if (!best || sc < best.sc) best = { id: g.id, cost, sc };
        }
        if (best && (st.res.mangan - best.cost >= reserve || best.cost < reserve * 0.05 || st.depth >= 4) && st.res.mangan >= best.cost) {
          A.reinforce(st, best.id); changed = true; continue;
        }
      }
      // Für Abstieg sparen?
      if (need) {
        const otherOk = Object.keys(need).every((k) => k === 'lumen' || st.res[k] >= need[k]);
        if (otherOk && need.lumen < E.lps(st, true) * 300 + st.res.lumen) {
          if (st.res.lumen < need.lumen) return;
        }
      }
      const cands = lumenCandidates();
      if (opts.debug) console.log(cands.slice().sort((a, b) => a.score - b.score).slice(0, 5));
      if (!cands.length) return;
      cands.sort((a, b) => a.score - b.score);
      const bestC = cands[0];
      if (st.res.lumen >= bestC.cost) { if (buy(bestC)) { changed = true; continue; } }
      const alt = cands.find((c) => st.res.lumen >= c.cost && c.score < bestC.score * 1.4);
      if (alt && buy(alt)) { changed = true; continue; }
    }
  }

  const end = t0 + minutes * 60;
  while (st.run.time < end) {
    const t = st.run.time - t0;
    // Klicken: aktive Phase am Anfang, danach gelegentlich
    const clicks = t < 900 ? cps : cps * 0.4;
    let whole = Math.floor(clicks + rng());
    for (let i = 0; i < whole; i++) A.click(st);
    if (U.features(st).events && t >= nextEvent) {
      const r = A.catchEvent(st, rng());
      nextEvent = t + E.eventDelay(st, rng());
      if (log.length < 2000 && st.stats.events <= 2) mark('Irrlicht: ' + r.outcome.name);
    }
    if (E.ability(st).unlocked && E.ability(st).readyIn <= 0) A.useAbility(st);
    const notes = Core.advance(st, 1);
    notes.forEach((n) => { if (n.type === 'expedition') mark('Expedition fertig: ' + n.id); });
    U.check(st).forEach((n) => { if (n.type === 'mission' && !seenMissions.has(n.def.id)) { seenMissions.add(n.def.id); mark('Auftrag: ' + n.def.name); } });
    if (!opts.checkEvery || Math.floor(t) % opts.checkEvery === 0) shop();
    const minute = Math.floor(t / 60);
    if (minute % 10 === 0 && minute !== lastPrint) {
      lastPrint = minute;
      checkpoints.push({ min: minute, lps: E.lps(st, true), lumen: st.res.lumen, mangan: st.res.mangan, mps: E.mps(st), data: st.res.data, dps: E.dps(st),
        bld: E.buildings(st), upg: Object.keys(st.upgrades).length, res: Object.keys(st.research).length, depth: st.depth, perl: E.prestigeGain(st), ach: Object.keys(st.achievements).length });
    }
    if (opts.stopAtPrestige && Core.canPrestige(st) && st.depth >= 4 && E.prestigeGain(st) >= (opts.minPerlen || 1) && st.run.time - t0 > (opts.minRun || 0)) break;
  }
  return { AB, st, log, checkpoints };
}

function report(res, title) {
  const F = res.AB.Format;
  console.log('\n=== ' + title + ' ===');
  res.log.forEach((l) => console.log(String(Math.floor(l.t / 60)).padStart(4) + ':' + String(Math.floor(l.t % 60)).padStart(2, '0') + '  ' + l.msg));
  console.log('\n min |   Lumen/s |   Mangan  |  Mn/s  |  Daten |  D/s | Bau | Upg | For | Zone | Perlen | Log');
  res.checkpoints.forEach((c) => console.log(
    String(c.min).padStart(4) + ' | ' + F.num(c.lps).padStart(9) + ' | ' + F.num(c.mangan).padStart(9) + ' | ' + F.rate(c.mps).padStart(6) + ' | ' +
    F.num(c.data).padStart(6) + ' | ' + F.rate(c.dps).padStart(4) + ' | ' + String(c.bld).padStart(3) + ' | ' + String(c.upg).padStart(3) + ' | ' +
    String(c.res).padStart(3) + ' | ' + String(c.depth).padStart(4) + ' | ' + String(c.perl).padStart(6) + ' | ' + c.ach));
}

if (require.main === module) {
  const minutes = Number(process.argv[2] || 150);
  const protocol = process.argv[3] || 'swarm';
  const cps = Number(process.argv[4] || 1.5);
  const r = runSim({ minutes, protocol, cps, checkEvery: Number(process.argv[6] || 0) });
  report(r, 'Lauf 1 – Protokoll ' + protocol + ', ' + cps + ' Klicks/s');
  if (process.argv[5] === '2') {
    // (Lauf 1 wird nach argv[2] Minuten beendet)
    // Zweiter Lauf nach Gezeitenwende mit typischen Perlen-Käufen
    const { Core, Actions: A, Economy: E } = r.AB;
    const g = E.prestigeGain(r.st);
    const p = Core.prestige(r.st);
    console.log('\nGezeitenwende: +' + g + ' Perlen (ok=' + p.ok + ')');
    const order = ['p_knowledge', 'p_memory', 'p_flotsam', 'p_memory', 'p_compass', 'p_memory', 'p_archive', 'p_memory', 'p_flotsam'];
    for (const id of order) { const x = A.buyShop(r.st, id); if (x.ok) console.log('  gekauft: ' + id); }
    const r2 = runSim({ minutes, protocol, cps, state: r.st, seed: 7 });
    report(r2, 'Lauf 2');
  }
}

module.exports = { runSim };
