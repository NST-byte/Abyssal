// End-to-End-Test im echten Chromium (Playwright).
// Aufruf: node tests/e2e.js [screenshot-ordner]
'use strict';
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  for (const t of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(t); } catch (e) { /* weiter */ } }
  console.error('Playwright nicht gefunden. Installieren mit: npm i -D playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const shots = process.argv[2] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = () => page.waitForFunction(() => window.__abyssalReady === true, null, { timeout: 8000 });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const closeModals = async () => {
    for (let i = 0; i < 3; i++) {
      const titles = await S(() => { const t = [...document.querySelectorAll('.modal h2')].map((x) => x.textContent); while (AB.UI.closeTopModal()) { /* schließen */ } return t; });
      if (process.env.E2E_DEBUG && titles.length) console.log('    (Dialog geschlossen: ' + titles.join(', ') + ')');
      await page.waitForTimeout(120);
    }
  };
  const tab = async (id) => { await closeModals(); await page.click('#tab-' + id); await page.waitForTimeout(120); };

  console.log('1. Start & erster Fortschritt');
  await page.goto(URL);
  await ready();
  check('keine JS-Fehler beim Start', errors.length === 0, errors);
  for (let i = 0; i < 16; i++) await page.click('#orb');
  let s = await S(() => ({ l: AB.Game.state.res.lumen, c: AB.Game.state.stats.clicks }));
  check('Puls erzeugt Lumen', s.c === 16 && s.l > 15, s);
  await page.click('.gen-plankton .buy');
  check('Planktonnetz gekauft', await S(() => AB.Game.state.gens.plankton) === 1);
  const l0 = await S(() => AB.Game.state.res.lumen);
  await page.waitForTimeout(2100);
  const l1 = await S(() => AB.Game.state.res.lumen);
  check('Produktion läuft', l1 - l0 > 0.4 && l1 - l0 < 1.5, l1 - l0);
  await page.click('.gen-algae .buy', { force: true });
  check('Kauf ohne Lumen blockiert + Hinweis', await S(() => AB.Game.state.gens.algae) === 0 && await page.locator('.toast.t-warn').count() > 0);

  console.log('2. Speichern, Neuladen, Offline');
  await S(() => AB.Game.saveNow(false));
  await page.reload(); await ready();
  s = await S(() => ({ p: AB.Game.state.gens.plankton, c: AB.Game.state.stats.clicks }));
  check('Stand nach Reload erhalten', s.p === 1 && s.c === 16, s);
  check('keine doppelten Karten nach Reload', await page.locator('.gen-plankton').count() === 1);
  await S(() => {
    const st = AB.Game.state; st.gens.plankton = 10; AB.Economy.invalidate();
    AB.Game.saveNow(false);
    AB.Save.write = () => ({ ok: true }); // verhindert, dass pagehide den manipulierten Stand überschreibt
    const raw = JSON.parse(localStorage.getItem('abyssal_save'));
    raw.lastTick = Date.now() - 2 * 3600 * 1000;
    localStorage.setItem('abyssal_save', JSON.stringify(raw));
  });
  const before = await S(() => AB.Game.state.res.lumen);
  await page.reload(); await ready();
  check('Offline-Bericht angezeigt', await page.locator('.modal:has-text("Willkommen zurück")').count() === 1);
  s = await S(() => ({ l: AB.Game.state.res.lumen, lps: AB.Economy.lps(AB.Game.state, true) }));
  check('Offline-Lumen ≈ 2 h', s.l - before > s.lps * 7000 * 0.9, { gain: s.l - before, exp: s.lps * 7200 });
  await closeModals();

  console.log('3. Station');
  await S(() => {
    const st = AB.State.create(Date.now());
    st.depth = 1; st.res.lumen = 1e7; st.res.mangan = 5000; st.gens.plankton = 30; st.miners.drone = 10;
    st.tutorial.done = true; st.tutorial.seen = { events: true };
    AB.Game.loadState(AB.State.sanitize(JSON.parse(JSON.stringify(st))));
  });
  await tab('station');
  check('Stationsraster sichtbar (3×3 aktiv)', await page.locator('.st-cell.empty').count() === 9);
  await page.click('.st-cell[data-i="0"]');
  await page.locator('.st-opt[data-build="reactor"]').click();
  await page.click('.st-cell[data-i="1"]');
  await page.locator('.st-opt[data-build="smelter"]').click();
  s = await S(() => ({ cells: AB.Game.state.station.cells.filter(Boolean).map((c) => c.t), f: AB.Economy.flows(AB.Game.state) }));
  check('Reaktor + Schmelze per UI gebaut', s.cells.join() === 'reactor,smelter', s.cells);
  check('Energie reicht, Legierung fließt', s.f.eff === 1 && s.f.alloyOut > 0, { eff: s.f.eff, a: s.f.alloyOut });
  // nach dem Bau ist das neue Modul (Feld 1) bereits ausgewählt
  await page.locator('.st-detail button[data-act="move"]').click();
  await page.click('.st-cell[data-i="8"]');
  check('Modul verschoben', await S(() => AB.Game.state.station.cells[8] && AB.Game.state.station.cells[8].t) === 'smelter');
  await page.waitForTimeout(150);
  await page.locator('.st-detail button[data-act="toggle"]').click();
  check('Modul ausgeschaltet', await S(() => AB.Game.state.station.cells[8].on) === false);
  await page.locator('.st-detail button[data-act="toggle"]').click();
  const a0 = await S(() => AB.Game.state.res.alloy);
  await page.waitForTimeout(1500);
  check('Legierung wird produziert', await S(() => AB.Game.state.res.alloy) > a0);
  await page.locator('.st-tools .btn').click();
  check('Verarbeitung pausiert', await S(() => AB.Game.state.station.cells[8].on) === false);
  await page.click('.st-cell[data-i="3"]');
  check('Gesperrtes Feld erklärt', await page.locator('.toast:has-text("Feld gesperrt")').count() > 0);
  await shot('03-station');

  console.log('4. Späte Phase – alle Bereiche');
  await S(() => {
    const st = AB.State.create(Date.now());
    st.depth = 3; st.res.lumen = 5e11; st.res.mangan = 2e5; st.res.data = 2e4; st.res.alloy = 1e5; st.res.crystal = 200;
    Object.assign(st.gens, { plankton: 80, algae: 70, jelly: 60, angler: 50, vent: 40, coral: 30, leviathan: 5 });
    st.miners.drone = 30; st.sonar = 12;
    st.research = { r_calib: true, r_proto: true, r_overcharge: true, r_dronelogic: true, r_hullx: true, r_lure: true, r_neural: true };
    st.station.cells[0] = { t: 'reactor', lvl: 3, on: true }; st.station.cells[1] = { t: 'smelter', lvl: 2, on: true };
    st.station.cells[6] = { t: 'reactor', lvl: 2, on: true }; st.station.cells[7] = { t: 'foundry', lvl: 1, on: true };
    st.stats.lumenAll = 1e12; st.run.lumen = 1e12;
    st.tutorial.done = true; st.tutorial.seen = { protocols: true, ability: true, events: true, tree: true, probes: true };
    AB.Game.loadState(AB.State.sanitize(JSON.parse(JSON.stringify(st))));
  });
  for (const t of ['build', 'upgrades', 'reinforce', 'station', 'research', 'map', 'descent', 'tides', 'goals']) {
    const vis = await page.locator('#tab-' + t).isVisible();
    check('Tab sichtbar: ' + t, vis);
    if (vis) { await tab(t); await shot('04-' + t); }
  }
  check('Ursprung noch verborgen', !(await page.locator('#tab-origin').isVisible()));
  check('keine JS-Fehler in allen Bereichen', errors.length === 0, errors);

  console.log('5. Forschung: Baum, Gabel, Protokoll, Strömung');
  await tab('research');
  await page.locator('.proto:has-text("Strömungs-Protokoll")').click();
  check('Protokoll gewählt', await S(() => AB.Game.state.protocols[0]) === 'current');
  await page.locator('.tn:has(.tn-title:text-is("Kaltschmelze"))').click();
  check('Gabel-Knoten erforscht', await S(() => !!AB.Game.state.research.r_cold));
  await page.locator('.tn:has(.tn-title:text-is("Lichtschmelze"))').click();
  check('Umrüsten fragt nach', await page.locator('.modal:has-text("Gabel umrüsten?")').count() === 1);
  await page.locator('.modal .btn-primary:has-text("Umrüsten")').click();
  s = await S(() => ({ c: !!AB.Game.state.research.r_cold, l: !!AB.Game.state.research.r_light }));
  check('Gabel umgerüstet', !s.c && s.l, s);
  await page.locator('.tn:has(.tn-title:text-is("Strömungslenkung"))').click();
  await S(() => { const st = AB.Game.state; AB.Core.advance(st, 1); st.current.charge = 3; });
  await page.waitForTimeout(200);
  const end0 = await S(() => AB.Game.state.current.endsAt);
  await closeModals();
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('h');
  check('Strömung per Taste H gehalten', await S(() => AB.Game.state.current.endsAt) > end0);

  console.log('6. Tiefseekarte');
  await tab('map');
  await page.locator('.map-row').first().locator('.sec').first().click();
  await page.locator('.map-detail button[data-act="scan"]').click();
  check('U-Boot entsandt', await S(() => AB.Game.state.map.missions.length) === 1);
  await S(() => AB.Core.advance(AB.Game.state, 200));
  await page.waitForTimeout(1100);
  check('Sektor erkundet', await S(() => AB.Game.state.map.sectors[0].state) === 'revealed');
  await page.locator('.map-row').first().locator('.sec').first().click();
  await page.waitForTimeout(150);
  await page.locator('.map-detail button[data-act="exploit"]').click();
  check('Außenposten errichtet', await S(() => AB.Game.state.map.sectors[0].state) === 'exploited');
  await S(() => { const s0 = AB.Game.state.map.sectors[1]; s0.state = 'revealed'; s0.type = 'wreck'; });
  await page.locator('.map-row').first().locator('.sec').nth(1).click();
  await page.waitForTimeout(150);
  await page.locator('.map-detail button[data-act="salvage"]').click();
  s = await S(() => ({ st: AB.Game.state.map.sectors[1].state, rel: AB.Unlocks.count(AB.Game.state.relics) }));
  check('Wrack geborgen → Relikt', s.st === 'depleted' && s.rel === 1, s);
  check('Relikt-Dialog', await page.locator('.modal:has-text("Relikt gefunden")').count() === 1);
  await shot('06-map');

  console.log('7. Abstieg & Gezeitenwende mit Respec');
  await S(() => { const st = AB.Game.state; Object.assign(st.res, { lumen: 1e15, mangan: 1e7, data: 1e6, alloy: 1e7, crystal: 1e5 }); st.perlen = 50; st.prestige.tree.t_memory = 1; AB.Economy.invalidate(); });
  await tab('descent');
  await page.locator('.zone-next ~ .center .btn').click();
  check('Abstieg nach Hadal', await S(() => AB.Game.state.depth) === 4);
  await closeModals();
  await S(() => { AB.Game.state.run.lumen = 1e15; });
  await tab('tides');
  await page.locator('.btn-pearl').first().click();
  const confirm = page.locator('.modal-prestige .modal-foot .btn').last();
  await confirm.click({ force: true });
  check('Bestätigung nicht sofort aktiv', await S(() => AB.Game.state.prestige.total) === 0);
  await page.locator('#respec').check();
  await page.waitForTimeout(1300);
  const relBefore = await S(() => AB.Unlocks.count(AB.Game.state.relics));
  await confirm.click();
  s = await S(() => ({ t: AB.Game.state.prestige.total, p: AB.Game.state.perlen, d: AB.Game.state.depth, m: AB.Game.state.station.cells.filter(Boolean).length,
    tree: AB.Unlocks.count(AB.Game.state.prestige.tree), rel: AB.Unlocks.count(AB.Game.state.relics) }));
  check('Wende ausgeführt, Lauf zurückgesetzt', s.t === 1 && s.d === 0 && s.m === 0, s);
  check('Respec: Baum leer, Perlen erstattet', s.tree === 0 && s.p > 50, s);
  check('Relikte bleiben', s.rel === relBefore, s);
  await closeModals();

  console.log('8. Gezeiten-Baum & Proben');
  await tab('tides');
  await page.locator('.tn:has(.tn-title:text-is("Gezeitengedächtnis"))').click();
  check('Baumknoten per Klick gekauft', await S(() => AB.Game.state.prestige.tree.t_memory) === 1);
  await page.locator('.tn:has(.tn-title:text-is("Großindustrie"))').click();
  check('Gesperrter Knoten erklärt sich', await page.locator('.toast.t-warn:has-text("Benötigt")').count() > 0);
  await shot('08-tree');
  await page.locator('.probe:has-text("Stille Wasser") .btn').click();
  await page.waitForTimeout(1300);
  await page.locator('.modal-prestige .btn-primary:has-text("Probe starten")').click();
  check('Probe gestartet', await S(() => AB.Game.state.probe && AB.Game.state.probe.id) === 'silent');
  check('Probe-Hinweis in der linken Spalte', await page.locator('#probe-box:visible').count() === 1);
  const c0 = await S(() => AB.Game.state.stats.clicks);
  await page.click('#orb');
  check('Puls in „Stille Wasser“ gesperrt', await S(() => AB.Game.state.stats.clicks) === c0);
  await tab('tides');
  await page.locator('.probe:has-text("Stille Wasser") .btn').click();
  await page.locator('.modal .btn-danger:has-text("Abbrechen")').click();
  check('Probe abgebrochen', await S(() => AB.Game.state.probe) === null);

  console.log('9. Herzkammer, Tiefenrekord, Weltenwende, Ursprung');
  await S(() => {
    const st = AB.Game.state;
    st.prestige.total = 4; st.depth = 6; st.prestige.perlenEarned = 1e5; st.relics.skull = 2;
    Object.assign(st.res, { lumen: 1e25, crystal: 1e7 }); AB.Economy.invalidate();
  });
  await tab('descent');
  await page.locator('.record-act .btn').click();
  check('Tiefenrekord gebohrt', await S(() => AB.Game.state.record) === 1);
  check('Ursprung-Tab sichtbar', await page.locator('#tab-origin').isVisible());
  await tab('origin');
  await page.locator('.btn-urlicht').click();
  const wb = page.locator('.modal-prestige .modal-foot .btn').last();
  await page.waitForTimeout(1300);
  await wb.click();
  s = await S(() => ({ w: AB.Game.state.world.count, u: AB.Game.state.world.urlicht, p: AB.Game.state.perlen, rec: AB.Game.state.record, rel: AB.Game.state.relics.skull }));
  check('Weltenwende ausgeführt', s.w === 1 && s.u > 0 && s.p === 0, s);
  check('Rekord und Relikte bleiben', s.rec === 1 && s.rel === 2, s);
  await closeModals();
  await tab('origin');
  await page.locator('.tile-origin:has-text("Ewiges Licht")').click();
  check('Ursprung gekauft', await S(() => AB.Game.state.world.origin.o_light) === 1);
  await shot('09-origin');

  console.log('10. Export / Import / Migration');
  await S(() => AB.Game.saveNow(false));
  await closeModals();
  await page.click('#btn-settings');
  await page.locator('.settings .btn:has-text("Export erzeugen")').click();
  const exported = await page.locator('.settings textarea').first().inputValue();
  check('Export erzeugt', exported.indexOf('ABYSSAL1:') === 0);
  const imp = page.locator('.settings textarea').nth(1);
  await imp.fill('ABYSSAL1:kaputt!!');
  await page.locator('.settings .btn:has-text("Importieren")').click();
  check('Kaputter Import abgelehnt', /abgelehnt/.test(await page.locator('.io-msg').textContent()));
  const v1 = JSON.stringify({ version: 1, res: { lumen: 777, mangan: 1, data: 0 }, gens: { plankton: 12 }, depth: 1, perlen: 3,
    prestige: { count: 1, shop: { p_memory: 2 }, perlenEarned: 10 }, expedition: { levels: { grave: 4 } }, missions: { m1: true } });
  await imp.fill('ABYSSAL1:' + Buffer.from(v1).toString('base64'));
  await page.locator('.settings .btn:has-text("Importieren")').click();
  await page.locator('.modal:has-text("Spielstand importieren?") .btn-primary').click();
  s = await S(() => ({ v: AB.Game.state.version, l: AB.Game.state.res.lumen, p: AB.Game.state.perlen, sk: AB.Game.state.relics.skull, g: AB.Game.state.gens.plankton }));
  check('v1-Spielstand importiert und migriert', s.v === 2 && s.g === 12 && s.p === 3 + 2 + 3 && s.sk === 2, s);
  await closeModals();
  await closeModals();
  await page.click('#btn-settings');
  await page.locator('.settings textarea').nth(1).fill(exported);
  await page.locator('.settings .btn:has-text("Importieren")').click();
  await page.locator('.modal:has-text("Spielstand importieren?") .btn-primary').click();
  check('Eigener Export wieder importiert', await S(() => AB.Game.state.world.count) === 1);
  await closeModals();

  console.log('11. Tastatur, Irrlicht, Einstellungen');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const k0 = await S(() => AB.Game.state.stats.clicks);
  await page.keyboard.press('Space'); await page.keyboard.press('Space');
  check('Leertaste pulst', await S(() => AB.Game.state.stats.clicks) - k0 === 2);
  await page.keyboard.press('0');
  check('Taste 0 öffnet Ziele', await page.locator('#tab-goals.active').count() === 1);
  await page.keyboard.press('1');
  await page.focus('.gen-plankton .buy');
  const p0 = await S(() => { AB.Game.state.res.lumen = 1e9; return AB.Game.state.gens.plankton; });
  await page.keyboard.press('Enter');
  check('Kauf per Enter', await S(() => AB.Game.state.gens.plankton) === p0 + 1);
  await S(() => { while (AB.UI.closeTopModal()) { /* */ } AB.Game.state.events.nextAt = AB.Game.state.time; });
  await page.waitForSelector('.wisp', { timeout: 3000 });
  await page.waitForTimeout(2500);
  const e0 = await S(() => AB.Game.state.stats.events);
  await page.locator('.wisp').click({ force: true });
  check('Irrlicht gefangen', await S(() => AB.Game.state.stats.events) === e0 + 1);
  await closeModals();
  await page.click('#btn-settings');
  await page.locator('.settings .set-row:has-text("Animationen reduzieren") .switch').check();
  check('Reduzierte Animation', await S(() => document.body.classList.contains('reduced-motion')));
  check('Automatik-Schalter sichtbar (Kommandozentrale noch nicht gekauft → nur vorhandene)', await page.locator('.settings h3:has-text("Automatik")').count() <= 1);
  await closeModals();

  console.log('12. Reset');
  await closeModals();
  await page.click('#btn-settings');
  await page.locator('.settings .btn-danger').click();
  await page.locator('.modal .btn-danger:has-text("Endgültig löschen")').click();
  check('Reset ohne Bestätigungswort blockiert', await S(() => AB.Game.state.world.count) === 1);
  await page.locator('.modal:has-text("Tippe LÖSCHEN") input').fill('LÖSCHEN');
  await page.locator('.modal .btn-danger:has-text("Endgültig löschen")').click();
  check('Reset ausgeführt', await S(() => AB.Game.state.world.count === 0 && AB.Game.state.stats.lumenAll === 0));

  console.log('13. Responsive');
  for (const [w, hh] of [[390, 844], [768, 1024], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: hh });
    await page.waitForTimeout(250);
    const ov = await S(() => document.documentElement.scrollWidth - window.innerWidth);
    check('kein horizontaler Überlauf bei ' + w + 'px', ov <= 1, ov);
    await shot('13-viewport-' + w);
  }
  check('keine JS-Fehler im gesamten Test', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
