// Unit-Tests für die Spiellogik (ohne Browser). Aufruf: node tests/run-tests.js [--quick]
'use strict';
const { load } = require('./harness');
const { runSim } = require('./simulate');
const QUICK = process.argv.includes('--quick');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a)); }
function ok(c, msg) { if (!c) throw new Error(msg || 'Bedingung nicht erfüllt'); }
function near(a, b, rel, msg) { if (Math.abs(a - b) > Math.abs(b) * (rel || 1e-9) + 1e-9) throw new Error((msg || '') + ' erwartet ≈' + b + ', erhalten ' + a); }

const fresh = () => { const AB = load(); return { AB, st: AB.State.create(0) }; };
// Station mit Modulen bestücken (Zellindex = Zeile * 6 + Spalte)
const put = (st, i, t, lvl) => { st.station.cells[i] = { t, lvl: lvl || 1, on: true }; };

console.log('Formatierung & Kosten');
test('Zahlen und Zeiten', () => {
  const { AB } = fresh(); const F = AB.Format;
  eq(F.num(1234), '1.234'); eq(F.num(1.5e6), '1,50 M'); eq(F.num(Infinity), '∞');
  F.mode = 'sci'; eq(F.num(1.5e6), '1,50e6'); F.mode = 'short';
  eq(F.time(3700), '1 h 1 min');
});
test('Geometrische Kostenreihe = Einzelkäufe, Max-Kauf korrekt', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  let sum = 0; for (let i = 0; i < 10; i++) sum += 15 * Math.pow(1.15, i);
  near(E.genCost(st, 'plankton', 10).lumen, sum);
  st.res.lumen = 12345;
  const n = E.genMax(st, 'plankton');
  ok(E.genCost(st, 'plankton', n).lumen <= 12345 && E.genCost(st, 'plankton', n + 1).lumen > 12345);
});
test('Tiefe Anlagen kosten zusätzlich Legierung/Kristalle', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.depth = 2; st.res.lumen = 1e9;
  const c = AB.Economy.genCost(st, 'vent', 1);
  ok(c.alloy > 0, 'Legierungskosten');
  ok(!A.buyGen(st, 'vent', 1).ok, 'ohne Legierung blockiert');
  st.res.alloy = 100;
  ok(A.buyGen(st, 'vent', 1).ok);
  near(st.res.alloy, 100 - c.alloy);
});

console.log('Käufe');
test('Kauf mit/ohne genug Lumen', () => {
  const { AB, st } = fresh();
  st.res.lumen = 10;
  const r = AB.Actions.buyGen(st, 'plankton', 1);
  ok(!r.ok && /Lumen/.test(r.reason)); eq(st.gens.plankton, 0);
  st.res.lumen = 100;
  ok(AB.Actions.buyGen(st, 'plankton', 1).ok); near(st.res.lumen, 85);
});
test('Upgrades: Bedingung, kein Doppelkauf, verdoppelt Produktion', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.res.lumen = 1e6;
  ok(!AB.Actions.buyUpgrade(st, 'u_plankton_1').ok);
  st.gens.plankton = 5;
  const before = E.genTotal(st, 'plankton');
  ok(AB.Actions.buyUpgrade(st, 'u_plankton_0').ok);
  ok(!AB.Actions.buyUpgrade(st, 'u_plankton_0').ok);
  near(E.genTotal(st, 'plankton'), before * 2);
});
test('Verstärkung kostet Mangan und multipliziert', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 1; st.gens.plankton = 3; st.res.mangan = 1000;
  const before = E.genTotal(st, 'plankton');
  const cost = E.reinforceCost(st, 'plankton').mangan;
  ok(AB.Actions.reinforce(st, 'plankton').ok);
  near(st.res.mangan, 1000 - cost);
  near(E.genTotal(st, 'plankton'), before * AB.CONFIG.REINFORCE.mult);
});

console.log('Station & Verarbeitungsketten');
test('Reaktor + Schmelze: Energie, Verbrauch, Legierung', () => {
  const { AB, st } = fresh(); const E = AB.Economy; const C = AB.CONFIG;
  st.depth = 1; st.res.mangan = 1000; st.res.lumen = 1e6;
  put(st, 0, 'reactor'); put(st, 1, 'smelter');
  const f = E.flows(st);
  eq(f.supply, 8); eq(f.demand, 3); eq(f.eff, 1);
  near(f.alloyOut, C.MODULE_BY_ID.smelter.out.alloy * E.pressureMult(st));
  AB.Core.advance(st, 100);
  near(st.res.alloy, f.alloyOut * 100, 1e-6, 'Legierung');
  near(st.res.mangan, 1000 - f.alloyOut * 100 * C.RECIPES.smelter.base.in.mangan, 1e-6, 'Mangan verbraucht');
});
test('Ohne Energie steht die Schmelze, mit halber Energie halbe Leistung', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 1;
  put(st, 1, 'smelter');
  eq(E.flows(st).alloyOut, 0);
  put(st, 0, 'reactor'); put(st, 2, 'smelter'); put(st, 6, 'smelter'); put(st, 7, 'smelter'); E.invalidate();
  const f = E.flows(st);
  near(f.eff, 8 / 12);
  near(f.alloyOut, 4 * 0.3 * 8 / 12 * 1.15);
});
test('Mangelnder Input begrenzt die Kette (keine negativen Bestände)', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 1; st.res.lumen = 1e9; st.res.mangan = 1;
  put(st, 0, 'reactor', 5); put(st, 1, 'smelter', 5);
  AB.Core.advance(st, 600);
  ok(st.res.mangan >= 0 && st.res.mangan < 1e-6, 'Mangan aufgebraucht');
  ok(st.res.alloy > 0 && st.res.alloy < 1, 'nur so viel Legierung wie Mangan da war: ' + st.res.alloy);
  ok(E.netRates(st).smelterFill === 0, 'Füllstand 0 ohne Mangan-Zufluss');
});
test('Kühlturm boostet Nachbar-Schmelze, Relais spart Energie, Nachbarschaft ist orthogonal', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 2;
  put(st, 0, 'reactor', 3); put(st, 1, 'smelter'); put(st, 2, 'cooler');
  near(E.flows(st).alloyOut, 0.3 * 1.35 * 1.3);
  put(st, 7, 'relay'); E.invalidate(); // 7 = Zeile 1, Spalte 1 – unter der Schmelze (1)
  near(-E.flows(st).info[1].energy, 3 * 0.6);
  st.station.cells[2] = null; put(st, 8, 'cooler'); E.invalidate(); // diagonal: kein Effekt
  near(E.flows(st).alloyOut, 0.3 * 1.3);
});
test('Gesperrte Felder, Verschieben, Abreißen', () => {
  const { AB, st } = fresh(); const A = AB.Actions; const E = AB.Economy;
  st.depth = 1; st.res.lumen = 1e7; st.res.mangan = 1e5;
  ok(!A.buildModule(st, 3, 'reactor').ok, 'Spalte 4 ist anfangs gesperrt');
  ok(A.buildModule(st, 0, 'reactor').ok);
  ok(!A.buildModule(st, 0, 'smelter').ok, 'belegt');
  ok(A.moveModule(st, 0, 8).ok); eq(st.station.cells[8].t, 'reactor'); eq(st.station.cells[0], null);
  const l0 = st.res.lumen;
  ok(A.demolishModule(st, 8).ok); eq(st.station.cells[8], null);
  ok(st.res.lumen > l0, 'Teilerstattung');
  st.research.r_hullx = true; E.invalidate();
  ok(A.buildModule(st, 3, 'reactor').ok, 'nach Erweiterter Rumpf frei');
});
test('Fertigung: Legierung + Daten → Kristalle', () => {
  const { AB, st } = fresh(); const E = AB.Economy; const C = AB.CONFIG;
  st.depth = 3; st.res.alloy = 1000; st.res.data = 1000;
  st.current = { type: 'clear', endsAt: 1e9, queue: ['clear'], charge: 0 }; // Strömung ohne Einfluss auf Fertigungen
  put(st, 0, 'reactor', 2); put(st, 1, 'foundry');
  const k = E.flows(st).crystalOut;
  AB.Core.advance(st, 100);
  near(st.res.crystal, k * 100, 1e-6);
  near(st.res.alloy, 1000 - k * 100 * C.RECIPES.foundry.base.in.alloy, 1e-6);
});
test('Gabel: Kaltschmelze entfernt Lumenverbrauch, Umrüsten ersetzt die andere Seite', () => {
  const { AB, st } = fresh(); const E = AB.Economy; const A = AB.Actions;
  st.depth = 2; st.res.data = 1e5;
  st.research.r_dronelogic = true; st.research.r_hullx = true;
  ok(A.research(st, 'r_cold').ok);
  eq(E.recipe(st, 'smelter').id, 'cold');
  ok(!('lumen' in E.flows(st).smelterIn));
  const r = A.research(st, 'r_light');
  ok(r.ok && r.switched);
  ok(!st.research.r_cold && st.research.r_light);
  ok(!('mangan' in E.flows(st).smelterIn));
});
test('Verarbeitung pausieren/fortsetzen', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.depth = 3; put(st, 0, 'reactor'); put(st, 1, 'smelter'); put(st, 2, 'foundry');
  ok(A.setProcessing(st, false).ok);
  ok(!st.station.cells[1].on && !st.station.cells[2].on && st.station.cells[0].on);
  ok(A.setProcessing(st, true).ok);
});

console.log('Strömungen');
test('Strömung startet ab Mitternacht, wechselt pro Periode, Vorschau vorhanden', () => {
  const { AB, st } = fresh(); const C = AB.CONFIG;
  st.depth = 2;
  AB.Core.advance(st, 1);
  ok(st.current && C.CURRENT_BY_ID[st.current.type]);
  ok(st.current.queue.length >= 1);
  const next = st.current.queue[0];
  AB.Core.advance(st, C.CURRENTS.period);
  eq(st.current.type, next);
});
test('Warme Strömung verdoppelt Schmelzen; Halten verlängert', () => {
  const { AB, st } = fresh(); const E = AB.Economy; const C = AB.CONFIG;
  st.depth = 2; put(st, 0, 'reactor'); put(st, 1, 'smelter');
  st.current = { type: 'warm', endsAt: 600, queue: ['cold'], charge: 3 };
  near(E.flows(st).alloyOut, 0.6 * 1.3);
  ok(!AB.Actions.holdCurrent(st).ok, 'ohne Forschung');
  st.research.r_hold = true; E.invalidate();
  ok(AB.Actions.holdCurrent(st).ok);
  eq(st.current.endsAt, 600 + C.CURRENTS.period);
  ok(!AB.Actions.holdCurrent(st).ok, 'Aufladung leer');
});

console.log('Tiefseekarte & Relikte');
test('Erkunden braucht U-Boot und Legierung, endet nach Dauer', () => {
  const { AB, st } = fresh(); const A = AB.Actions; const E = AB.Economy;
  st.depth = 3;
  ok(!A.scanSector(st, 0).ok, 'keine Legierung');
  st.res.alloy = 1e5;
  ok(A.scanSector(st, 0).ok);
  ok(!A.scanSector(st, 1).ok, 'nur ein U-Boot');
  const dur = E.scanDuration(st, 1);
  AB.Core.advance(st, dur + 1);
  eq(st.map.sectors[0].state, 'revealed');
  ok(A.scanSector(st, 1).ok, 'U-Boot wieder frei');
  ok(!A.scanSector(st, 20).ok, 'zu tief (Zone 5)');
});
test('Außenposten begrenzt, Bonus wirkt, Aufgeben gibt Platz frei', () => {
  const { AB, st } = fresh(); const A = AB.Actions; const E = AB.Economy;
  st.depth = 3; st.miners.drone = 10;
  st.map.sectors.forEach((s) => { s.state = 'revealed'; s.type = 'ore'; });
  const m0 = E.mps(st);
  ok(A.exploitSector(st, 0).ok); ok(A.exploitSector(st, 1).ok);
  ok(!A.exploitSector(st, 2).ok, 'nur 2 Außenposten');
  near(E.mps(st), m0 * (1 + 0.4 + 0.4));
  ok(A.abandonSector(st, 0).ok);
  ok(A.exploitSector(st, 2).ok);
});
test('Bergen: Wrack gibt garantiert Relikt, Relikt überlebt Gezeitenwende', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.depth = 4; st.run.lumen = 1e16;
  st.map.sectors[0].type = 'wreck'; st.map.sectors[0].state = 'revealed';
  const r = A.salvageSector(st, 0, 0.5, 0);
  ok(r.ok && r.relic, 'Relikt erhalten');
  eq(st.map.sectors[0].state, 'depleted');
  const id = r.relic;
  ok(AB.Core.prestige(st).ok);
  eq(st.relics[id], 1);
  eq(st.map.sectors[0].state, 'unknown', 'neue Karte');
});
test('Ruine: Relikt nur bei Chance', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.depth = 3;
  st.map.sectors[0].type = 'ruin'; st.map.sectors[0].state = 'revealed';
  st.map.sectors[1].type = 'ruin'; st.map.sectors[1].state = 'revealed';
  ok(!A.salvageSector(st, 0, 0.99, 0).relic, 'Wurf zu hoch');
  ok(A.salvageSector(st, 1, 0.01, 0).relic, 'Wurf niedrig');
});
test('U-Boot bauen braucht Dockplatz', () => {
  const { AB, st } = fresh(); const A = AB.Actions; const E = AB.Economy;
  st.depth = 3; st.res.alloy = 1e5;
  ok(!A.buildSub(st).ok);
  put(st, 0, 'reactor'); put(st, 1, 'dock'); E.invalidate();
  ok(A.buildSub(st).ok); eq(E.subsTotal(st), 2);
  ok(!A.buildSub(st).ok, 'Dock Stufe 1 = 1 Platz');
});

console.log('Gezeitenwende & Gezeiten-Baum');
test('Prestige nur ab Hadal; setzt nur Lauf-Werte zurück', () => {
  const { AB, st } = fresh();
  st.run.lumen = 1e16;
  ok(!AB.Core.prestige(st).ok);
  st.depth = 4; st.res.alloy = 50; st.gens.plankton = 50; st.upgrades.u_plankton_0 = true; put(st, 0, 'reactor');
  st.research.r_calib = true; st.achievements.a_plankton_1 = true; st.missions.m1 = true; st.relics.skull = 1; st.record = 3;
  const gain = AB.Economy.prestigeGain(st);
  const r = AB.Core.prestige(st);
  ok(r.ok); eq(st.perlen, gain); eq(st.prestige.total, 1);
  eq(st.depth, 0); eq(st.res.alloy, 0); eq(st.gens.plankton, 0); eq(st.station.cells.filter(Boolean).length, 0);
  eq(Object.keys(st.upgrades).length, 0); eq(Object.keys(st.research).length, 0);
  ok(st.achievements.a_plankton_1 && st.missions.m1); eq(st.relics.skull, 1); eq(st.record, 3);
});
test('Baum: Voraussetzung, Gabel exklusiv, Capstone-Limit', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.perlen = 1e6;
  ok(!A.buyTree(st, 't_known').ok, 'braucht Gezeitengedächtnis');
  ok(A.buyTree(st, 't_memory').ok && A.buyTree(st, 't_known').ok);
  ok(A.buyTree(st, 't_forge').ok);
  ok(!A.buyTree(st, 't_lean').ok, 'andere Seite der Gabel');
  ok(A.buyTree(st, 't_cap_flow').ok);
  ['t_pulse', 't_start', 't_resopulse', 't_cap_pulse'].forEach((id) => ok(A.buyTree(st, id).ok, id));
  ['t_compass', 't_charts', 't_fleet'].forEach((id) => ok(A.buyTree(st, id).ok, id));
  const r = A.buyTree(st, 't_cap_deep');
  ok(!r.ok && /Capstones/.test(r.reason), 'drittes Capstone gesperrt');
});
test('Respec bei Wende erstattet alle Perlen', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.perlen = 100;
  A.buyTree(st, 't_memory'); A.buyTree(st, 't_memory'); A.buyTree(st, 't_rest');
  const spent = A.treeSpent(st);
  ok(spent > 0); near(st.perlen, 100 - spent);
  st.depth = 4; st.run.lumen = 1e15;
  const gain = AB.Economy.prestigeGain(st);
  const r = AB.Core.prestige(st, { respec: true });
  eq(r.refunded, spent); near(st.perlen, 100 + gain);
  eq(AB.Unlocks.count(st.prestige.tree), 0);
});
test('Baumknoten wirken beim Lauf-Start (Vorwissen, Treibgut, Archiv, Seekarten)', () => {
  const { AB, st } = fresh();
  Object.assign(st.prestige.tree, { t_memory: 1, t_known: 1, t_flotsam: 2, t_compass: 1, t_archive: 1, t_charts: 1 });
  st.depth = 4; st.run.lumen = 1e15;
  AB.Core.prestige(st);
  eq(st.depth, 1); eq(st.miners.drone, 5); eq(st.res.lumen, AB.CONFIG.FLOTSAM_START[2]);
  eq(st.station.cells.filter(Boolean).length, 2);
  ok(st.research.r_calib && st.research.r_proto && st.research.r_dronelogic);
  ok(st.map.sectors.filter((s) => s.zone <= 2).every((s) => s.state === 'revealed'));
});
test('Perlenformel: monoton, flach; Tiefe erhöht Perlen', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  let prev = -1;
  for (const l of [1e13, 1e14, 1e15, 1e17]) { st.run.lumen = l; const g = E.prestigeGain(st); ok(g >= prev); prev = g; }
  st.run.lumen = 1e15; st.run.maxDepth = 4; const a = E.prestigeGain(st);
  st.run.maxDepth = 6; const b = E.prestigeGain(st);
  ok(b > a * 1.4, 'zwei Zonen tiefer: +50 %');
});
test('Schlund erst nach Gezeitenwende erreichbar', () => {
  const { AB, st } = fresh();
  st.depth = 4; Object.assign(st.res, { lumen: 1e30, alloy: 1e30, crystal: 1e30, data: 1e30 });
  ok(!AB.Actions.descend(st).ok);
  st.prestige.total = 1;
  ok(AB.Actions.descend(st).ok); eq(st.depth, 5);
});

console.log('Tiefenproben');
test('Probe: Reset ohne Perlen, Regel aktiv, Abschluss gibt Dauerbelohnung', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.prestige.total = 1; st.depth = 4; st.run.lumen = 1e15; st.perlen = 7;
  ok(AB.Core.startProbe(st, 'silent').ok);
  eq(st.perlen, 7, 'keine Perlen für abgebrochenen Lauf');
  eq(st.depth, 0); eq(st.probe.id, 'silent');
  ok(!AB.Actions.click(st).ok, 'Puls gesperrt');
  const base = E.agg(st).all;
  st.res.lumen = 1e30; Object.assign(st.res, { mangan: 1e30, alloy: 1e30, data: 1e30, crystal: 1e30 });
  AB.Actions.descend(st); AB.Actions.descend(st);
  const r = AB.Actions.descend(st);
  ok(r.ok && r.probe && r.probe.level === 1, 'Abschluss beim Erreichen des Abyssals');
  eq(st.probe, null); eq(st.probes.silent, 1);
  near(E.agg(st).all, base * 1.3);
  ok(AB.Actions.click(st).ok, 'Puls wieder frei');
});
test('Probe abbrechen hebt nur die Regel auf', () => {
  const { AB, st } = fresh();
  st.prestige.total = 1;
  AB.Core.startProbe(st, 'ore');
  st.miners.drone = 10; st.depth = 1;
  const low = AB.Economy.mps(st);
  ok(AB.Core.abandonProbe(st).ok);
  near(AB.Economy.mps(st), low * 10);
  eq(st.probes.ore, 0);
});

console.log('Weltenwende, Ursprung, Tiefenrekord');
test('Weltenwende: Urlicht logarithmisch, setzt Zyklus zurück, behält Dauerhaftes', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 6; st.prestige.total = 5; st.prestige.count = 5; st.prestige.perlenEarned = 1e5; st.perlen = 500;
  st.prestige.tree.t_memory = 3; st.relics.skull = 2; st.probes.silent = 2; st.record = 4;
  const g = E.worldGain(st);
  eq(g, Math.floor(4 * Math.pow(3, 1.5)));
  const r = AB.Core.worldTurn(st);
  ok(r.ok); eq(st.world.urlicht, g); eq(st.world.count, 1);
  eq(st.perlen, 0); eq(st.prestige.count, 0); eq(st.prestige.tree.t_memory, 0); eq(st.depth, 0);
  eq(st.prestige.total, 5, 'Gesamtzahl bleibt (Zonen bleiben frei)');
  eq(st.relics.skull, 2); eq(st.probes.silent, 2); eq(st.record, 4);
  st.prestige.perlenEarned = 1e9; const big = E.worldGain(st);
  ok(big < g * 5, 'auch 10.000× mehr Perlen geben nur wenige × mehr Urlicht');
});
test('Ursprung kaufen und Erbstation-Start', () => {
  const { AB, st } = fresh(); const A = AB.Actions;
  st.world.urlicht = 100;
  ok(A.buyOrigin(st, 'o_heritage').ok);
  ok(A.setArchetype(st, 'forge').ok);
  st.depth = 4; st.run.lumen = 1e15;
  AB.Core.prestige(st);
  eq(st.archetype, 'forge'); ok(st.res.alloy >= 500); eq(st.station.cells.filter(Boolean).length, 4);
  ok(A.buyOrigin(st, 'o_grid').ok);
  eq(AB.Economy.gridSize(st).rows, 4);
});
test('Tiefenrekord nur aus der Herzkammer, bleibt über Wenden', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.res.lumen = 1e30; st.res.crystal = 1e9;
  ok(!AB.Actions.drill(st).ok);
  st.depth = 6;
  const before = E.agg(st).all;
  ok(AB.Actions.drill(st).ok); eq(st.record, 1);
  near(E.agg(st).all, before * AB.CONFIG.RECORD.mult);
});

console.log('Zeit, Offline, große Zahlen');
test('Ein großer Schritt ≈ viele kleine (inkl. Kette)', () => {
  const a = fresh(), b = fresh();
  for (const x of [a, b]) {
    Object.assign(x.st.gens, { plankton: 20, algae: 10 }); x.st.depth = 1; x.st.miners.drone = 20; x.st.res.mangan = 50;
    put(x.st, 0, 'reactor'); put(x.st, 1, 'smelter'); x.AB.Economy.invalidate();
  }
  a.AB.Core.advance(a.st, 600);
  for (let i = 0; i < 6000; i++) b.AB.Core.advance(b.st, 0.1);
  near(a.st.res.lumen, b.st.res.lumen, 1e-6, 'Lumen');
  near(a.st.res.alloy, b.st.res.alloy, 1e-6, 'Legierung');
  near(a.st.res.mangan, b.st.res.mangan, 1e-4, 'Mangan');
});
test('Buff wirkt exakt bis zum Ende', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10; AB.Economy.invalidate();
  const lps = AB.Economy.lps(st);
  st.buffs.push({ id: 'frenzy', name: 'x', mult: 3, until: st.time + 20 });
  AB.Core.advance(st, 60);
  near(st.res.lumen, lps * 3 * 20 + lps * 40);
});
test('Offline: Deckel, Tiefschlaf-Bonus, Scans laufen weiter', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10; st.depth = 3; st.res.alloy = 1e4; AB.Economy.invalidate();
  AB.Actions.scanSector(st, 0);
  const lps = AB.Economy.lps(st);
  st.lastTick = 0;
  const rep = AB.Core.applyOffline(st, 24 * 3600 * 1000);
  ok(rep.capped); eq(rep.credited, 4 * 3600);
  ok(rep.scans.length === 1 && st.map.sectors[0].state === 'revealed');
  ok(rep.gain.lumen > lps * 4 * 3600 * 0.99);
  const b = fresh();
  b.st.gens.plankton = 10; b.st.prestige.tree.t_sleep = 1; b.AB.Economy.invalidate();
  const l2 = b.AB.Economy.lps(b.st);
  b.st.lastTick = 0;
  const r2 = b.AB.Core.applyOffline(b.st, 3600 * 1000);
  near(r2.gain.lumen, l2 * 3600 * 2, 1e-6);
});
test('Ungültige Zeit wird ignoriert', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10;
  AB.Core.advance(st, -5); AB.Core.advance(st, NaN); AB.Core.advance(st, Infinity);
  eq(st.res.lumen, 0);
});
test('Sehr große Werte bleiben endlich (Deckel 1e300)', () => {
  const { AB, st } = fresh();
  st.res.lumen = 9e299; st.gens.core = 1e6; st.depth = 6; st.record = 900; AB.Economy.invalidate();
  AB.Core.advance(st, 3600);
  ok(isFinite(st.res.lumen) && st.res.lumen <= 1e300, String(st.res.lumen));
  ok(isFinite(AB.Economy.prestigeGain(st)));
  ok(AB.Format.num(st.res.lumen).length < 12);
});

console.log('Speichern, Laden, Migration');
test('Roundtrip aller neuen Systeme', () => {
  const { AB, st } = fresh();
  st.depth = 3; put(st, 0, 'reactor', 4); st.station.cells[1] = { t: 'smelter', lvl: 2, on: false };
  st.current = { type: 'storm', endsAt: 99, queue: ['glow', 'warm'], charge: 1 };
  st.map.sectors[0].state = 'exploited'; st.map.missions.push({ sector: 1, endsAt: 50, duration: 60 }); st.map.sectors[1].state = 'scanning';
  st.relics.lens = 2; st.probes.blind = 1; st.probe = { id: 'flat', level: 2 }; st.record = 5;
  st.prestige.tree.t_memory = 4; st.world.origin.o_light = 2; st.world.urlicht = 3; st.archetype = 'hunter';
  const back = AB.State.sanitize(JSON.parse(AB.Save.serialize(st)), 0);
  eq(JSON.stringify(back), JSON.stringify(st));
  const r = AB.Save.importString(AB.Save.exportString(st), 0);
  ok(r.ok); eq(JSON.stringify(r.state), JSON.stringify(st));
});
test('Beschädigte Importe werden abgelehnt', () => {
  const { AB } = fresh();
  for (const bad of ['', 'hallo', 'ABYSSAL1:%%%%', 'ABYSSAL1:' + Buffer.from('{kaputt').toString('base64'), '[]', '{"version":2}', '{"version":99,"res":{},"gens":{}}', '{"res":{},"gens":{}}']) {
    ok(!AB.Save.importString(bad, 0).ok, 'sollte abgelehnt werden: ' + bad.slice(0, 30));
  }
});
test('Ungültige Einzelwerte werden repariert', () => {
  const { AB } = fresh();
  const raw = { version: 2, res: { lumen: -5, alloy: 'viel', crystal: 1e999 }, gens: { plankton: 3.7, hack: 5 },
    research: { r_cold: true, r_light: true }, station: { cells: [{ t: 'reactor', lvl: 99 }, { t: 'evil' }, null] },
    map: { sectors: 'x', missions: [{ sector: 999, endsAt: 1, duration: 1 }] }, relics: { skull: 50, fake: 1 },
    prestige: { tree: { t_forge: 1, t_lean: 1, t_memory: 1e9 } }, probe: { id: 'nope' }, current: { type: 'warm', endsAt: 'bald' } };
  const st = AB.State.sanitize(raw, 0);
  eq(st.res.lumen, 0); eq(st.res.alloy, 0); eq(st.res.crystal, 0);
  eq(st.gens.plankton, 3); ok(!('hack' in st.gens));
  ok(!(st.research.r_cold && st.research.r_light), 'Gabel bereinigt');
  eq(st.station.cells[0].lvl, AB.CONFIG.GRID.maxLevel); eq(st.station.cells[1], null);
  eq(st.map.missions.length, 0); eq(st.relics.skull, 3); ok(!('fake' in st.relics));
  ok(!(st.prestige.tree.t_forge && st.prestige.tree.t_lean)); eq(st.prestige.tree.t_memory, AB.CONFIG.TREE_BY_ID.t_memory.max);
  eq(st.probe, null); eq(st.current, null);
});
test('Migration v1 → v2: Shop erstattet, Expeditionen werden Relikte, Fortschritt bleibt', () => {
  const { AB } = fresh();
  const v1 = { version: 1, res: { lumen: 5e9, mangan: 100, data: 20 }, gens: { plankton: 30, vent: 4 }, depth: 2, perlen: 7,
    prestige: { count: 2, shop: { p_memory: 3, p_dual: 1 }, perlenEarned: 40, bestRunTime: 5000 },
    expedition: { levels: { wreck: 5, grave: 1 } }, research: { r_calib: true, r_heart: true, r_old_gone: true },
    upgrades: { u_plankton_0: true }, missions: { m1: true }, achievements: { a_plankton_1: true }, settings: { sound: false } };
  const st = AB.State.sanitize(v1, 0);
  eq(st.version, 2); eq(st.migratedFrom, 1);
  eq(st.perlen, 7 + 2 + 3 + 5 + 18);
  eq(st.prestige.total, 2); eq(st.prestige.count, 2);
  eq(st.relics.compass, 2); eq(st.relics.skull, 1);
  ok(st.research.r_calib && st.research.r_heart && !st.research.r_old_gone);
  eq(st.gens.vent, 4); eq(st.depth, 2); ok(st.upgrades.u_plankton_0 && st.missions.m1); eq(st.settings.sound, false);
  eq(st.res.alloy, 0); eq(st.map.sectors.length, 30);
});

if (!QUICK) {
  console.log('Langzeit-Simulation (Bot, echte Spiellogik)');
  test('Aktiv: erste Wende, Schlund und Herzkammer in plausiblen Zeiträumen', () => {
    const r = runSim({ hours: 14, profile: 'active', build: 'flow', dt: 2 });
    const t = (re) => { const x = r.log.find((l) => re.test(l.msg)); return x ? x.t / 3600 : Infinity; };
    const d1 = t(/Dämmerzone/), d4 = t(/→ Hadal/), w1 = t(/GEZEITENWENDE #1/), d5 = t(/→ Schlund/), d6 = t(/→ Herzkammer/);
    console.log('     Dämmerzone ' + (d1 * 60).toFixed(0) + ' min · Hadal ' + d4.toFixed(1) + ' h · 1. Wende ' + w1.toFixed(1) + ' h · Schlund ' + d5.toFixed(1) + ' h · Herzkammer ' + d6.toFixed(1) + ' h');
    ok(d1 < 0.25, 'Dämmerzone'); ok(d4 > 1.2 && d4 < 4, 'Hadal'); ok(w1 < 6, 'Wende'); ok(d5 < 9, 'Schlund'); ok(d6 < 14, 'Herzkammer');
    ok(isFinite(r.st.res.lumen));
  });
  test('Passiv und idle kommen ohne Sackgasse bis zur Gezeitenwende', () => {
    for (const p of ['passive', 'idle']) {
      const r = runSim({ hours: 7, profile: p, build: 'swarm', dt: 2 });
      ok(r.st.prestige.total >= 1, p + ' ohne Wende nach 7 h');
    }
  });
  test('Alle Protokolle und Builds erreichen Hadal im ersten Lauf', () => {
    for (const p of ['swarm', 'pulse', 'current']) {
      const r = runSim({ hours: 4, profile: 'active', override: { protocol: p }, dt: 2, noPrestige: true });
      ok(r.st.depth >= 4, p + ' erreicht Hadal nicht');
    }
  });
}

console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
process.exit(failed ? 1 : 0);
