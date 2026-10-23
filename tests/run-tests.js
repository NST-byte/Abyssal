// Unit-Tests für Spiellogik (ohne Browser). Aufruf: node tests/run-tests.js
'use strict';
const { load } = require('./harness');
const { runSim } = require('./simulate');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n     ' + (e && e.message)); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a)); }
function ok(c, msg) { if (!c) throw new Error(msg || 'Bedingung nicht erfüllt'); }
function near(a, b, rel, msg) { if (Math.abs(a - b) > Math.abs(b) * (rel || 1e-9) + 1e-9) throw new Error((msg || '') + ' erwartet ≈' + b + ', erhalten ' + a); }

const fresh = () => { const AB = load(); return { AB, st: AB.State.create(0) }; };

console.log('Formatierung');
test('kleine und große Zahlen', () => {
  const { AB } = fresh(); const F = AB.Format;
  eq(F.num(0), '0'); eq(F.num(999), '999'); eq(F.num(1234), '1.234');
  eq(F.num(1.5e6), '1,50 M'); eq(F.num(2.5e9), '2,50 B'); eq(F.num(1e300).slice(-4), 'e300');
  eq(F.num(Infinity), '∞'); eq(F.num(NaN), '∞');
  F.mode = 'sci'; eq(F.num(1.5e6), '1,50e6'); F.mode = 'short';
  eq(F.time(59), '59 s'); eq(F.time(3700), '1 h 1 min');
});

console.log('Kosten');
test('geometrische Kostenreihe stimmt mit Einzelkäufen überein', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  const c10 = E.genCost(st, 'plankton', 10);
  let sum = 0;
  for (let i = 0; i < 10; i++) { sum += 15 * Math.pow(1.15, i); }
  near(c10, sum, 1e-9);
});
test('Max-Kauf: maxAffordable ist bezahlbar, +1 nicht', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.res.lumen = 12345;
  const n = E.genMax(st, 'plankton');
  ok(E.genCost(st, 'plankton', n) <= 12345 && E.genCost(st, 'plankton', n + 1) > 12345, 'n=' + n);
});

console.log('Käufe');
test('Kauf mit genug Lumen klappt und zieht Kosten ab', () => {
  const { AB, st } = fresh();
  st.res.lumen = 100;
  const r = AB.Actions.buyGen(st, 'plankton', 1);
  ok(r.ok); eq(st.gens.plankton, 1); near(st.res.lumen, 85);
});
test('Kauf ohne genug Lumen wird blockiert, nichts ändert sich', () => {
  const { AB, st } = fresh();
  st.res.lumen = 10;
  const r = AB.Actions.buyGen(st, 'plankton', 1);
  ok(!r.ok && /Lumen/.test(r.reason)); eq(st.gens.plankton, 0); eq(st.res.lumen, 10);
});
test('Anlage aus tieferer Zone ist gesperrt', () => {
  const { AB, st } = fresh();
  st.res.lumen = 1e12;
  ok(!AB.Actions.buyGen(st, 'jelly', 1).ok);
  st.depth = 1;
  ok(AB.Actions.buyGen(st, 'jelly', 1).ok);
});
test('Upgrade nur mit erfüllter Bedingung, nicht doppelt kaufbar', () => {
  const { AB, st } = fresh();
  st.res.lumen = 1e6;
  ok(!AB.Actions.buyUpgrade(st, 'u_plankton_1').ok, 'braucht 5 Netze');
  st.gens.plankton = 5;
  ok(AB.Actions.buyUpgrade(st, 'u_plankton_1').ok);
  ok(!AB.Actions.buyUpgrade(st, 'u_plankton_1').ok, 'zweiter Kauf');
});
test('Upgrade verdoppelt Produktion der Anlage', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.gens.plankton = 5; st.res.lumen = 1e6;
  const before = E.genTotal(st, 'plankton');
  AB.Actions.buyUpgrade(st, 'u_plankton_0');
  near(E.genTotal(st, 'plankton'), before * 2, 1e-9);
});
test('Verstärkung kostet Mangan und multipliziert', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.depth = 1; st.gens.plankton = 3; st.res.mangan = 1000;
  const before = E.genTotal(st, 'plankton');
  const cost = E.reinforceCost(st, 'plankton');
  ok(AB.Actions.reinforce(st, 'plankton').ok);
  near(st.res.mangan, 1000 - cost);
  // Tiefenbonus bleibt gleich, nur Verstärkung wirkt
  near(E.genTotal(st, 'plankton'), before * AB.CONFIG.REINFORCE.mult, 1e-9);
});
test('Forschung: Voraussetzungen und Tiefe werden geprüft', () => {
  const { AB, st } = fresh();
  st.res.data = 1e6;
  ok(!AB.Actions.research(st, 'r_calib').ok, 'braucht Mitternacht');
  st.depth = 2;
  ok(!AB.Actions.research(st, 'r_catalyst').ok, 'braucht Kalibrierung');
  ok(AB.Actions.research(st, 'r_calib').ok);
  ok(AB.Actions.research(st, 'r_catalyst').ok);
});
test('Protokoll: erst nach Forschung, Wechsel kostet Daten', () => {
  const { AB, st } = fresh();
  st.depth = 2; st.res.data = 1000;
  ok(!AB.Actions.setProtocol(st, 'swarm').ok);
  st.research.r_proto = true; AB.Economy.invalidate();
  ok(AB.Actions.setProtocol(st, 'swarm').ok);
  eq(st.res.data, 1000);
  ok(AB.Actions.setProtocol(st, 'pulse').ok);
  eq(st.protocols.join(), 'pulse');
  eq(st.res.data, 1000 - AB.CONFIG.PROTOCOL_SWITCH_COST);
});
test('Abstieg zieht Kosten ab und erhöht Tiefe', () => {
  const { AB, st } = fresh();
  st.res.lumen = AB.CONFIG.DEPTHS[1].cost.lumen - 1;
  ok(!AB.Actions.descend(st).ok);
  st.res.lumen += 1;
  ok(AB.Actions.descend(st).ok);
  eq(st.depth, 1); near(st.res.lumen, 0);
});

console.log('Zeit & Produktion');
test('Produktion entspricht Rate × Zeit', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10; AB.Economy.invalidate();
  const lps = AB.Economy.lps(st);
  AB.Core.advance(st, 100);
  near(st.res.lumen, lps * 100, 1e-9);
});
test('Ein großer Schritt = viele kleine Schritte (keine Timer-Abhängigkeit)', () => {
  const a = fresh(), b = fresh();
  for (const x of [a, b]) { x.st.gens.plankton = 7; x.st.gens.algae = 3; x.st.depth = 1; x.st.miners.drone = 4; x.AB.Economy.invalidate(); }
  a.AB.Core.advance(a.st, 600);
  for (let i = 0; i < 6000; i++) b.AB.Core.advance(b.st, 0.1);
  near(a.st.res.lumen, b.st.res.lumen, 1e-6, 'Lumen');
  near(a.st.res.mangan, b.st.res.mangan, 1e-6, 'Mangan');
});
test('Buff wirkt exakt bis zu seinem Ende (Schritt wird geteilt)', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10; AB.Economy.invalidate();
  const lps = AB.Economy.lps(st);
  st.buffs.push({ id: 'frenzy', name: 'x', mult: 3, until: st.time + 20 });
  AB.Core.advance(st, 60);
  near(st.res.lumen, lps * 3 * 20 + lps * 40, 1e-9);
  eq(st.buffs.length, 0);
});
test('Expedition endet während Simulation und gibt Artefakt-Stufe', () => {
  const { AB, st } = fresh();
  st.depth = 3; st.res.mangan = 1e9; st.res.data = 1e9;
  ok(AB.Actions.startExpedition(st, 'wreck').ok);
  ok(!AB.Actions.startExpedition(st, 'smoker').ok, 'nur eine gleichzeitig');
  const notes = AB.Core.advance(st, 500);
  eq(st.expedition.levels.wreck, 1); eq(st.expedition.active, null);
  ok(notes.some((n) => n.type === 'expedition'));
});
test('Negative / ungültige Zeit wird ignoriert', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10;
  AB.Core.advance(st, -50); AB.Core.advance(st, NaN); AB.Core.advance(st, Infinity);
  eq(st.res.lumen, 0);
});
test('Offline wird auf die Grenze gedeckelt', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 10; AB.Economy.invalidate();
  const lps = AB.Economy.lps(st);
  st.lastTick = 0;
  const rep = AB.Core.applyOffline(st, 24 * 3600 * 1000);
  ok(rep.capped); eq(rep.credited, 4 * 3600);
  near(st.res.lumen, lps * 4 * 3600, 1e-6);
});
test('Kurze Abwesenheit erzeugt keinen Offline-Bericht', () => {
  const { AB, st } = fresh();
  st.lastTick = 0;
  eq(AB.Core.applyOffline(st, 30 * 1000), null);
});

console.log('Freischaltungen & Aufträge');
test('Aufträge werden der Reihe nach erfüllt und belohnt', () => {
  const { AB, st } = fresh();
  st.stats.clicks = 15;
  const notes = AB.Unlocks.check(st);
  ok(st.missions.m1); ok(notes.some((n) => n.type === 'mission' && n.def.id === 'm1'));
  eq(st.res.lumen, 25);
});
test('Logbuch-Eintrag erhöht Produktion um 1 %', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.gens.plankton = 1;
  const before = E.lps(st);
  AB.Unlocks.check(st); // a_plankton_1
  ok(st.achievements.a_plankton_1);
  near(E.lps(st), before * 1.01, 1e-9);
});

console.log('Gezeitenwende');
test('Prestige nur ab Hadal', () => {
  const { AB, st } = fresh();
  st.run.lumen = 1e16;
  ok(!AB.Core.prestige(st).ok);
  st.depth = 4;
  ok(AB.Core.prestige(st).ok);
});
test('Prestige setzt nur Lauf-Werte zurück', () => {
  const { AB, st } = fresh();
  Object.assign(st, { depth: 4 });
  st.run.lumen = 1e15; st.res.lumen = 1e14; st.res.mangan = 5; st.gens.plankton = 50; st.upgrades.u_plankton_0 = true;
  st.research.r_calib = true; st.achievements.a_plankton_1 = true; st.missions.m1 = true; st.stats.clicks = 99;
  st.prestige.shop.p_memory = 2; st.settings.sound = false;
  const gain = AB.Economy.prestigeGain(st);
  const r = AB.Core.prestige(st);
  ok(r.ok); eq(r.gain, gain); eq(st.perlen, gain);
  eq(st.depth, 0); eq(st.res.lumen, 0); eq(st.res.mangan, 0); eq(st.gens.plankton, 0);
  eq(Object.keys(st.upgrades).length, 0); eq(Object.keys(st.research).length, 0);
  ok(st.achievements.a_plankton_1); ok(st.missions.m1); eq(st.stats.clicks, 99);
  eq(st.prestige.shop.p_memory, 2); eq(st.settings.sound, false); eq(st.prestige.count, 1);
});
test('Perlen-Erbe: Vorwissen, Treibgut, Archiv wirken beim Reset', () => {
  const { AB, st } = fresh();
  st.depth = 4; st.run.lumen = 1e15;
  st.prestige.shop.p_knowledge = 1; st.prestige.shop.p_flotsam = 2; st.prestige.shop.p_archive = 1;
  st.research.r_calib = true; st.research.r_proto = true; st.research.r_catalyst = true;
  AB.Core.prestige(st);
  eq(st.depth, 1); eq(st.miners.drone, 5); eq(st.res.lumen, AB.CONFIG.FLOTSAM_START[2]);
  ok(st.research.r_calib && st.research.r_proto && !st.research.r_catalyst);
});
test('Perlen erhöhen Produktion; ausgeben reduziert Pauschalbonus', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  st.gens.plankton = 10;
  const base = E.lps(st);
  st.perlen = 10; E.invalidate();
  near(E.lps(st), base * 1.2, 1e-9);
  ok(AB.Actions.buyShop(st, 'p_memory').ok);
  eq(st.perlen, 8);
  near(E.lps(st), base * 1.16 * 1.25, 1e-9);
});
test('Perlenformel steigt monoton und flacht ab', () => {
  const { AB, st } = fresh(); const E = AB.Economy;
  let prev = -1;
  for (const l of [1e13, 5e13, 1e14, 1e15, 1e16]) { st.run.lumen = l; const g = E.prestigeGain(st); ok(g >= prev); prev = g; }
  st.run.lumen = 5e13; const a = E.prestigeGain(st); st.run.lumen = 5e14; const b = E.prestigeGain(st);
  ok(b < a * 3, '10× Lumen soll deutlich weniger als 3× Perlen geben');
});

console.log('Speichern & Laden');
test('Serialisieren → Sanitize liefert identischen Zustand', () => {
  const { AB, st } = fresh();
  st.gens.plankton = 12; st.res.lumen = 1234.5; st.upgrades.u_plankton_0 = true; st.protocols = ['swarm'];
  st.expedition.active = { id: 'wreck', endsAt: 99, duration: 120 };
  const back = AB.State.sanitize(JSON.parse(AB.Save.serialize(st)), 0);
  eq(JSON.stringify(back), JSON.stringify(st));
});
test('Export/Import-Roundtrip', () => {
  const { AB, st } = fresh();
  st.res.lumen = 42; st.prestige.count = 3; st.tutorial.seen.protocols = true;
  const txt = AB.Save.exportString(st);
  const r = AB.Save.importString(txt, 0);
  ok(r.ok); eq(r.state.res.lumen, 42); eq(r.state.prestige.count, 3); ok(r.state.tutorial.seen.protocols);
});
test('Beschädigte Importe werden abgelehnt', () => {
  const { AB } = fresh();
  for (const bad of ['', 'hallo', 'ABYSSAL1:%%%%', 'ABYSSAL1:' + Buffer.from('{kaputt').toString('base64'), '[]', '{"version":1}', '{"version":99,"res":{},"gens":{}}', '{"res":{},"gens":{}}']) {
    const r = AB.Save.importString(bad, 0);
    ok(!r.ok, 'sollte abgelehnt werden: ' + bad.slice(0, 30));
  }
});
test('Ungültige Einzelwerte werden repariert statt übernommen', () => {
  const { AB } = fresh();
  const raw = { version: 1, res: { lumen: -5, mangan: 'viel', data: 1e999 }, gens: { plankton: 3.7, hack: 5, algae: -2 },
    upgrades: { u_plankton_0: true, evil: true }, protocols: ['swarm', 'swarm', 'nope', 'pulse', 'current'], depth: 99,
    buffs: [{ id: 'frenzy', mult: 1e9, until: 5 }, { id: 'ok', mult: 2, until: 10, name: 'x' }], settings: { numberFormat: '<script>', volume: 7 },
    prestige: { shop: { p_luster: 50 } }, missions: { m1: 'yes', m2: true } };
  const st = AB.State.sanitize(raw, 0);
  eq(st.res.lumen, 0); eq(st.res.mangan, 0); eq(st.res.data, 0);
  eq(st.gens.plankton, 3); eq(st.gens.algae, 0); ok(!('hack' in st.gens));
  ok(st.upgrades.u_plankton_0 && !st.upgrades.evil);
  eq(st.protocols.join(), 'swarm,pulse');
  eq(st.depth, 4); eq(st.buffs.length, 1);
  eq(st.settings.numberFormat, 'short'); eq(st.settings.volume, 1);
  eq(st.prestige.shop.p_luster, 1);
  ok(!st.missions.m1 && st.missions.m2);
});

console.log('Langzeit-Simulation (Bot, echte Spiellogik)');
test('Meilensteine in plausiblen Zeiträumen (optimal spielender Bot)', () => {
  const r = runSim({ minutes: 130, protocol: 'swarm', cps: 1.5 });
  const t = (re) => { const x = r.log.find((l) => re.test(l.msg)); return x ? x.t / 60 : Infinity; };
  const d1 = t(/Dämmerzone/), d2 = t(/Mitternachtszone/), d3 = t(/→ Abyssal/), d4 = t(/→ Hadal/);
  console.log('     Dämmerzone ' + d1.toFixed(1) + ' min · Mitternacht ' + d2.toFixed(1) + ' · Abyssal ' + d3.toFixed(1) + ' · Hadal ' + d4.toFixed(1));
  ok(d1 > 3 && d1 < 15, 'Dämmerzone'); ok(d2 > 15 && d2 < 40, 'Mitternacht'); ok(d3 > 35 && d3 < 75, 'Abyssal'); ok(d4 > 65 && d4 < 115, 'Hadal');
  ok(isFinite(r.st.res.lumen) && r.st.res.lumen >= 0, 'Zahlen endlich');
  ok(r.AB.Core.canPrestige(r.st), 'Prestige erreichbar');
});
test('Alle Protokolle erreichen Hadal (kein Weg ist eine Sackgasse)', () => {
  for (const p of ['swarm', 'pulse', 'current']) {
    const r = runSim({ minutes: 130, protocol: p, cps: 1.5 });
    ok(r.st.depth === 4, p + ' erreicht Hadal nicht');
  }
});
test('Zweiter Lauf nach Gezeitenwende ist schneller', () => {
  const r1 = runSim({ minutes: 110, protocol: 'swarm', cps: 1.5 });
  const t1 = r1.log.find((l) => /→ Hadal/.test(l.msg)).t;
  const { Core, Actions } = r1.AB;
  ok(Core.prestige(r1.st).ok);
  ['p_knowledge', 'p_memory', 'p_memory', 'p_compass'].forEach((id) => Actions.buyShop(r1.st, id));
  const r2 = runSim({ minutes: 110, protocol: 'swarm', cps: 1.5, state: r1.st });
  const h = r2.log.find((l) => /→ Hadal/.test(l.msg));
  ok(h && h.t < t1 * 0.9, 'Lauf 2: ' + (h ? (h.t / 60).toFixed(1) : '∞') + ' min vs. Lauf 1: ' + (t1 / 60).toFixed(1));
});

console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
process.exit(failed ? 1 : 0);
