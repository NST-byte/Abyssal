// End-to-End-Test im echten Chromium (Playwright).
// Aufruf: node tests/e2e.js [screenshot-ordner]
// Benötigt Playwright (npm i -D playwright oder global installiert).
'use strict';
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) { /* weiter */ } }
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
  const launchOpts = {};
  if (fs.existsSync('/opt/pw-browsers/chromium')) { /* Playwright findet den Browser selbst */ }
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = () => page.waitForFunction(() => window.__abyssalReady === true, null, { timeout: 8000 });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };

  console.log('1. Start & erster Fortschritt');
  await page.goto(URL);
  await ready();
  check('keine JS-Fehler beim Start', errors.length === 0, errors);
  for (let i = 0; i < 16; i++) await page.click('#orb');
  let s = await S(() => ({ l: AB.Game.state.res.lumen, c: AB.Game.state.stats.clicks }));
  check('Puls erzeugt Lumen', s.c === 16 && s.l > 15, s);
  await page.click('.gen-plankton .buy');
  s = await S(() => AB.Game.state.gens.plankton);
  check('Planktonnetz gekauft', s === 1, s);
  const l0 = await S(() => AB.Game.state.res.lumen);
  await page.waitForTimeout(2100);
  const l1 = await S(() => AB.Game.state.res.lumen);
  check('Produktion läuft (≈0,3/s)', l1 - l0 > 0.4 && l1 - l0 < 1.5, l1 - l0);

  console.log('2. Kauf ohne genug Ressourcen');
  await page.click('.gen-algae .buy', { force: true });
  s = await S(() => AB.Game.state.gens.algae);
  check('Leuchtalgen NICHT gekauft', s === 0, s);
  const warn = await page.locator('.toast.t-warn').count();
  check('Hinweis-Toast erscheint', warn > 0);

  console.log('3. Speichern & Neuladen');
  await S(() => AB.Game.saveNow(false));
  await page.reload();
  await ready();
  s = await S(() => ({ p: AB.Game.state.gens.plankton, c: AB.Game.state.stats.clicks }));
  check('Stand nach Reload erhalten', s.p === 1 && s.c === 16, s);
  const gensCount = await page.locator('.gen-plankton').count();
  check('keine doppelten Anlagen-Karten nach Reload', gensCount === 1, gensCount);

  console.log('4. Offline-Fortschritt');
  await S(() => {
    const st = AB.Game.state; st.gens.plankton = 10; AB.Economy.invalidate();
    AB.Game.saveNow(false);
    AB.Save.write = () => ({ ok: true }); // verhindert, dass pagehide den manipulierten Stand überschreibt
    const raw = JSON.parse(localStorage.getItem('abyssal_save'));
    raw.lastTick = Date.now() - 2 * 3600 * 1000; // 2 h weg
    localStorage.setItem('abyssal_save', JSON.stringify(raw));
  });
  const before = await S(() => AB.Game.state.res.lumen);
  await page.reload();
  await ready();
  const offModal = await page.locator('.modal:has-text("Willkommen zurück")').count();
  check('Offline-Bericht angezeigt', offModal === 1);
  s = await S(() => ({ l: AB.Game.state.res.lumen, lps: AB.Economy.lps(AB.Game.state, true) }));
  check('Offline-Lumen ≈ 2 h Produktion', s.l - before > s.lps * 7000 * 0.9, { gain: s.l - before, exp: s.lps * 7200 });
  await shot('01-offline');
  await page.keyboard.press('Escape');

  console.log('5. Spätere Phase (Abyssal) – alle Tabs');
  await S(() => {
    const st = AB.State.create(Date.now());
    st.depth = 3; st.res.lumen = 5e11; st.res.mangan = 2e5; st.res.data = 5000;
    Object.assign(st.gens, { plankton: 80, algae: 70, jelly: 60, angler: 50, vent: 40, coral: 30, leviathan: 5 });
    st.miners.drone = 30; st.sonar = 12;
    st.research = { r_calib: true, r_proto: true, r_overcharge: true };
    st.stats.lumenAll = 1e12; st.run.lumen = 1e12;
    st.tutorial.done = true;
    st.tutorial.seen = { protocols: true, ability: true, events: true };
    AB.Game.loadState(AB.State.sanitize(JSON.parse(JSON.stringify(st))));
  });
  await page.waitForTimeout(300);
  for (const t of ['build', 'upgrades', 'reinforce', 'research', 'expeditions', 'descent', 'tides', 'log']) {
    const vis = await page.locator('#tab-' + t).isVisible();
    check('Tab sichtbar: ' + t, vis);
    if (vis) { await page.click('#tab-' + t); await page.waitForTimeout(150); await shot('02-tab-' + t); }
  }
  check('keine JS-Fehler in Tabs', errors.length === 0, errors);

  console.log('6. Forschung, Protokoll, Expedition, Verstärkung, Fähigkeit');
  await page.click('#tab-research');
  await page.locator('.proto:has-text("Schwarm-Protokoll")').click();
  s = await S(() => AB.Game.state.protocols.slice());
  check('Protokoll gewählt', s[0] === 'swarm', s);
  await page.locator('.tile-research:has(.tile-name:text-is("Biokatalyse"))').click();
  s = await S(() => !!AB.Game.state.research.r_catalyst);
  check('Forschung gekauft', s);
  await page.click('#tab-expeditions');
  await page.locator('.card.expedition').first().locator('.buy').click();
  s = await S(() => AB.Game.state.expedition.active && AB.Game.state.expedition.active.id);
  check('Expedition gestartet', s === 'wreck', s);
  await page.click('#tab-reinforce');
  await page.locator('.card.reinforce').first().locator('.buy').click();
  s = await S(() => AB.Game.state.reinforce.plankton);
  check('Verstärkung gekauft', s === 1, s);
  await page.click('#ability-btn');
  s = await S(() => AB.Game.state.buffs.some((b) => b.id === 'overcharge'));
  check('Überladung aktiv', s);

  console.log('7. Abstieg');
  await S(() => { const st = AB.Game.state; st.res.lumen = 1e14; st.res.mangan = 1e7; st.res.data = 1e6; });
  await page.click('#tab-descent');
  await page.locator('.zone-next ~ .center .btn').click();
  s = await S(() => AB.Game.state.depth);
  check('Abstieg nach Hadal', s === 4, s);
  await shot('03-hadal');
  await page.locator('.modal-foot .btn').last().click();

  console.log('8. Gezeitenwende');
  await S(() => { AB.Game.state.run.lumen = 1e15; });
  await page.click('#tab-tides');
  await page.locator('.btn-pearl').click();
  const confirm = page.locator('.modal-prestige .modal-foot .btn').last();
  await confirm.click({ force: true }); // zu früh → darf nicht auslösen
  s = await S(() => AB.Game.state.prestige.count);
  check('Bestätigung reagiert nicht sofort (Doppelklick-Schutz)', s === 0, s);
  await page.waitForTimeout(1300);
  const achBefore = await S(() => Object.keys(AB.Game.state.achievements).length);
  await confirm.click();
  s = await S(() => ({ c: AB.Game.state.prestige.count, p: AB.Game.state.perlen, d: AB.Game.state.depth, g: AB.Game.state.gens.plankton,
    u: Object.keys(AB.Game.state.upgrades).length, a: Object.keys(AB.Game.state.achievements).length, r: Object.keys(AB.Game.state.research).length }));
  check('Prestige ausgeführt', s.c === 1 && s.p > 0, s);
  check('Lauf zurückgesetzt', s.d === 0 && s.g === 0 && s.u === 0 && s.r === 0, s);
  check('Logbuch bleibt erhalten', s.a >= achBefore, { before: achBefore, after: s.a });
  await shot('04-after-prestige');
  await page.locator('.modal-foot .btn').last().click();
  await page.click('#tab-tides');
  await page.locator('.tile-shop:has-text("Gezeitengedächtnis")').click();
  s = await S(() => AB.Game.state.prestige.shop.p_memory);
  check('Perlen-Erbe gekauft', s === 1, s);
  await S(() => AB.Game.saveNow(false));
  await page.reload(); await ready();
  s = await S(() => ({ shop: AB.Game.state.prestige.shop.p_memory, c: AB.Game.state.prestige.count }));
  check('Prestige-Boni nach Reload erhalten', s.shop === 1 && s.c === 1, s);
  if (await page.locator('.modal-wrap').count()) await page.keyboard.press('Escape');

  console.log('9. Export / Import / beschädigter Import');
  await page.click('#btn-settings');
  await page.locator('.settings .btn:has-text("Export erzeugen")').click();
  const exported = await page.locator('.settings textarea').first().inputValue();
  check('Export-Text erzeugt', exported.indexOf('ABYSSAL1:') === 0);
  const imp = page.locator('.settings textarea').nth(1);
  await imp.fill('ABYSSAL1:das-ist-kaputt!!!');
  await page.locator('.settings .btn:has-text("Importieren")').click();
  let msg = await page.locator('.io-msg').textContent();
  check('Kaputter Import abgelehnt', /abgelehnt/.test(msg), msg);
  await imp.fill('{"version":1,"res":"nope"}');
  await page.locator('.settings .btn:has-text("Importieren")').click();
  msg = await page.locator('.io-msg').textContent();
  check('Ungültiges JSON-Objekt abgelehnt', /abgelehnt/.test(msg), msg);
  s = await S(() => AB.Game.state.prestige.count);
  check('Zustand unverändert nach kaputtem Import', s === 1, s);
  await S(() => { AB.Game.state.res.lumen = 12345; });
  await imp.fill(exported);
  await page.locator('.settings .btn:has-text("Importieren")').click();
  await page.locator('.modal:has-text("Spielstand importieren?") .btn-primary').click();
  s = await S(() => ({ l: AB.Game.state.res.lumen, c: AB.Game.state.prestige.count }));
  check('Gültiger Import übernommen', s.c === 1 && s.l !== 12345, s);

  console.log('10. Tastatur');
  while (await page.locator('.modal-wrap').count()) await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const c0 = await S(() => AB.Game.state.stats.clicks);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  const c1 = await S(() => AB.Game.state.stats.clicks);
  check('Leertaste löst Puls aus', c1 - c0 === 2, c1 - c0);
  await page.keyboard.press('8');
  check('Taste 8 öffnet Logbuch', await page.locator('#tab-log.active').count() === 1);
  await page.keyboard.press('1');
  await page.focus('.gen-plankton .buy');
  const p0 = await S(() => { AB.Game.state.res.lumen = 1e6; return AB.Game.state.gens.plankton; });
  await page.keyboard.press('Enter');
  const p1 = await S(() => AB.Game.state.gens.plankton);
  check('Kauf per Tastatur (Enter)', p1 === p0 + 1, { p0, p1 });

  console.log('11. Irrlicht');
  await S(() => { while (AB.UI.closeTopModal()) { /* Ereignisse erscheinen nicht hinter offenen Fenstern */ } AB.Game.state.events.nextAt = AB.Game.state.time; });
  await page.waitForSelector('.wisp', { timeout: 3000 });
  await page.waitForTimeout(2500); // Irrlicht schwebt von außerhalb ins Bild
  const ev0 = await S(() => AB.Game.state.stats.events);
  await page.locator('.wisp').click({ force: true });
  const ev1 = await S(() => AB.Game.state.stats.events);
  check('Irrlicht gefangen', ev1 === ev0 + 1, { ev0, ev1 });

  console.log('12. Einstellungen');
  await page.click('#btn-settings');
  await page.locator('.settings .set-row:has-text("Animationen reduzieren") .switch').check();
  check('Reduzierte Animationen aktiv', await S(() => document.body.classList.contains('reduced-motion')));
  await page.locator('.settings select').selectOption('sci');
  check('Zahlenformat umgestellt', await S(() => AB.Format.mode === 'sci'));
  await page.keyboard.press('Escape');

  console.log('13. Reset');
  await page.click('#btn-settings');
  await page.locator('.settings .btn-danger').click();
  await page.locator('.modal .btn-danger:has-text("Endgültig löschen")').click(); // ohne Eingabe
  s = await S(() => AB.Game.state.prestige.count);
  check('Reset ohne Bestätigungswort blockiert', s === 1, s);
  await page.locator('.modal:has-text("Tippe LÖSCHEN") input').fill('LÖSCHEN');
  await page.locator('.modal .btn-danger:has-text("Endgültig löschen")').click();
  s = await S(() => ({ c: AB.Game.state.prestige.count, l: AB.Game.state.stats.lumenAll }));
  check('Reset ausgeführt', s.c === 0 && s.l === 0, s);

  console.log('14. Responsive');
  for (const [w, hgt] of [[390, 844], [768, 1024], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.waitForTimeout(250);
    const ov = await S(() => document.documentElement.scrollWidth - window.innerWidth);
    check('kein horizontaler Überlauf bei ' + w + 'px', ov <= 1, ov);
    await shot('05-viewport-' + w);
  }
  check('keine JS-Fehler im gesamten Test', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
