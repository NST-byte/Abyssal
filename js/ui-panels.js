/* UI-Bereiche: Produktion, Verbesserungen, Verstärkung, Abstieg (+Tiefenrekord), Ziele & Logbuch */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format, UI = AB.UI;
  const L = UI.lib;
  const { h, setText, setHTML, setHTMLThrottled, setHidden, setClass, setDisabled, costHTML, missingText, buyCard, updateBuy, amountFor, buyAmountBar, panelTop, icon } = L;
  const st = () => AB.Game.state;
  const act = (...a) => AB.Game.act(...a);

  // ---- Produktion -----------------------------------------------------------
  UI.BUILDERS.build = function (el) {
    const amount = buyAmountBar();
    el.appendChild(panelTop('Produktion', 'Anlagen erzeugen Lumen automatisch. Tiefe Anlagen brauchen zusätzlich Legierung oder Kristalle aus deiner Station.', amount.el));
    const upTip = h('button', { class: 'up-tip', type: 'button', onclick: () => UI.showTab('upgrades') });
    el.appendChild(upTip);
    const genWrap = h('div', { class: 'card-list' });
    el.appendChild(genWrap);
    const genCards = C.GENERATORS.map((g) => {
      const c = buyCard({ icon: g.id, name: g.name, desc: g.desc, cls: 'gen gen-' + g.id,
        onBuy: () => act(AB.Actions.buyGen, [g.id, st().settings.buyAmount], { sound: 'buy' }) });
      c.def = g;
      c.locked = h('div', { class: 'card locked' },
        h('div', { class: 'card-icon', html: icon('lock') }),
        h('div', { class: 'card-main' }, h('div', { class: 'card-head' }, h('span', { class: 'card-name', text: '??? – unbekannte Lebensform' })),
          h('div', { class: 'card-desc', text: 'Erreichbar ' + C.DEPTHS[g.depth].into + ' (' + C.DEPTHS[g.depth].meters.toLocaleString('de-DE') + ' m). Siehe Abstieg.' })));
      genWrap.appendChild(c.root);
      genWrap.appendChild(c.locked);
      return c;
    });

    const minerTitle = h('h3', { class: 'section-title', html: icon('mangan') + 'Mangan-Förderung' });
    const minerWrap = h('div', { class: 'card-list' });
    el.append(minerTitle, minerWrap);
    const minerCards = C.MINERS.map((m) => {
      const c = buyCard({ icon: m.id === 'drill' ? 'drill2' : m.id, name: m.name, desc: m.desc, cls: 'miner',
        onBuy: () => act(AB.Actions.buyMiner, [m.id, st().settings.buyAmount], { sound: 'buy' }) });
      c.def = m; minerWrap.appendChild(c.root); return c;
    });

    const dataTitle = h('h3', { class: 'section-title', html: icon('data') + 'Datengewinnung' });
    const sonar = buyCard({ icon: 'sonar', name: C.SONAR.name, desc: C.SONAR.desc + ' Alternative: Sonarlabor in der Station.', cls: 'sonar',
      onBuy: () => act(AB.Actions.buySonar, [st().settings.buyAmount], { sound: 'buy' }) });
    const sonarWrap = h('div', { class: 'card-list' }, sonar.root);
    el.append(dataTitle, sonarWrap);

    return {
      update() {
        const s = st();
        amount.update();
        const nUp = U.availableUpgrades(s).filter((u) => s.res.lumen >= u.cost).length;
        setHidden(upTip, nUp === 0);
        if (nUp) setHTML(upTip, icon('star') + '<span><b>' + nUp + (nUp === 1 ? ' Verbesserung' : ' Verbesserungen') + '</b> bezahlbar – meist der größte Hebel für deine Produktion.</span><span class="up-tip-go">Ansehen →</span>');
        const lps = E.lps(s);
        const lpsNB = E.lps(s, true);
        const lbl = (n) => (s.settings.buyAmount === -1 ? 'Max ' : '') + '×' + n;
        genCards.forEach((c, i) => {
          const g = c.def;
          const unlocked = s.depth >= g.depth;
          const teaser = !unlocked && g.depth === s.depth + 1 && (i === 0 || s.depth >= C.GENERATORS[i - 1].depth) && E.depthAllowed(s, g.depth);
          setHidden(c.root, !unlocked);
          setHidden(c.locked, !teaser);
          if (!unlocked) return;
          const n = amountFor(() => E.genMax(s, g.id));
          const cost = E.genCost(s, g.id, n);
          setText(c.count, String(s.gens[g.id]));
          const each = E.genEach(s, g.id);
          const tot = each * s.gens[g.id];
          const tm = E.tierMult(s, g.tier);
          setHTML(c.stats, 'je <b>' + F.rate(each) + '</b>/s' + (s.gens[g.id] ? ' · gesamt <b>' + F.rate(tot) + '</b>/s · ' + F.pct(lps > 0 ? tot / lps : 0, 1) : '') +
            (s.reinforce[g.id] ? ' · <span class="tag-mangan">Verstärkt ' + s.reinforce[g.id] + '</span>' : '') +
            (tm > 1.001 ? ' · <span class="tag-tier" title="Bonus durch Forschung/Strömung">' + F.mult(tm) + '</span>' : ''));
          s.gens[g.id] += n; E.invalidate();
          const after = E.lps(s, true);
          s.gens[g.id] -= n; E.invalidate();
          updateBuy(c, lbl(n), cost, '+' + F.rate(Math.max(0, after - lpsNB)) + '/s');
        });
        const showM = s.depth >= 1;
        setHidden(minerTitle, !showM); setHidden(minerWrap, !showM);
        if (showM) {
          const mm = E.mps(s) / Math.max(1e-9, C.MINERS.reduce((a, m) => a + s.miners[m.id] * m.prod, 0));
          minerCards.forEach((c) => {
            const m = c.def;
            const un = s.depth >= m.depth;
            setHidden(c.root, !un && m.depth > s.depth + 1);
            setClass(c.root, 'is-locked', !un);
            setText(c.count, String(s.miners[m.id]));
            const per = m.prod * (isFinite(mm) && mm > 0 ? mm : E.mod(s, 'manganMult'));
            setHTML(c.stats, 'je <b>' + F.rate(per) + '</b> Mangan/s' + (s.miners[m.id] ? ' · gesamt <b>' + F.rate(per * s.miners[m.id]) + '</b>/s' : ''));
            const n = amountFor(() => E.minerMax(s, m.id));
            updateBuy(c, lbl(n), E.minerCost(s, m.id, n), '+' + F.rate(per * n) + ' Mn/s', un ? '' : 'Benötigt ' + C.DEPTHS[m.depth].name + '.');
          });
        }
        const showD = s.depth >= 2;
        setHidden(dataTitle, !showD); setHidden(sonarWrap, !showD);
        if (showD) {
          setText(sonar.count, String(s.sonar));
          const per = s.sonar ? E.sonarDps(s) / s.sonar : C.SONAR.prod * E.mod(s, 'dataMult');
          setHTML(sonar.stats, 'je <b>' + F.rate(per) + '</b> Daten/s' + (s.sonar ? ' · gesamt <b>' + F.rate(per * s.sonar) + '</b>/s' : '') +
            (s.probe && s.probe.id === 'blind' ? ' · <span class="tag-warn">Probe: Bojen stumm</span>' : ''));
          const n = amountFor(() => E.sonarMax(s));
          updateBuy(sonar, lbl(n), E.sonarCost(s, n), '+' + F.rate(per * n) + ' D/s');
        }
      },
    };
  };

  // ---- Verbesserungen -------------------------------------------------------
  function upgradeIcon(u) {
    if (u.kind === 'gen') return u.req.gen;
    if (u.kind === 'synergy') return 'wave';
    if (u.kind === 'click') return 'lumen';
    if (u.effects.some((e) => e.type === 'manganMult')) return 'mangan';
    if (u.effects.some((e) => e.type === 'dataMult')) return 'data';
    if (u.effects.some((e) => e.type === 'smelterMult')) return 'smelter';
    if (u.effects.some((e) => e.type === 'foundryMult')) return 'foundry';
    return 'star';
  }

  UI.BUILDERS.upgrades = function (el) {
    el.appendChild(panelTop('Verbesserungen', 'Einmalige Käufe mit Wirkung bis zur nächsten Gezeitenwende. Neue erscheinen, wenn du mehr Anlagen besitzt.'));
    const grid = h('div', { class: 'tile-grid' });
    const upcoming = h('div', { class: 'upcoming' });
    const ownedInfo = h('p', { class: 'muted small' });
    el.append(grid, h('h3', { class: 'section-title', html: icon('lock') + 'Demnächst' }), upcoming, ownedInfo);
    const tiles = {};
    let lastKey = '';
    function tile(u) {
      const cost = h('span', { class: 'tile-cost' });
      const hint = h('span', { class: 'tile-hint' });
      const b = h('button', { class: 'tile tile-' + u.kind, type: 'button', onclick: () => act(AB.Actions.buyUpgrade, [u.id], { sound: 'buy' }) },
        h('span', { class: 'tile-icon', html: icon(upgradeIcon(u)) }), h('span', { class: 'tile-name', text: u.name }), h('span', { class: 'tile-desc', text: u.desc }), cost, hint);
      return { b, cost, hint, u };
    }
    return {
      update() {
        const s = st();
        const list = U.availableUpgrades(s);
        const key = list.map((u) => u.id).join(',');
        if (key !== lastKey) {
          lastKey = key;
          grid.innerHTML = '';
          list.forEach((u) => { if (!tiles[u.id]) tiles[u.id] = tile(u); grid.appendChild(tiles[u.id].b); });
          if (!list.length) grid.appendChild(h('p', { class: 'muted', text: 'Gerade nichts verfügbar. Baue mehr Anlagen, um neue Verbesserungen freizuschalten.' }));
        }
        list.forEach((u) => {
          const t = tiles[u.id];
          const ok = s.res.lumen >= u.cost;
          setHTML(t.cost, costHTML({ lumen: u.cost }));
          setText(t.hint, ok ? '' : missingText({ lumen: u.cost }));
          setDisabled(t.b, !ok);
          setClass(t.b, 'affordable', ok);
        });
        const next = [];
        C.GENERATORS.forEach((g) => {
          if (s.depth < g.depth || s.gens[g.id] < 1) return;
          const u = C.UPGRADES.find((x) => x.kind === 'gen' && x.req.gen === g.id && !s.upgrades[x.id] && s.gens[g.id] < x.req.n);
          if (u) next.push({ u, prog: s.gens[g.id] / u.req.n });
        });
        next.sort((a, b) => b.prog - a.prog);
        setHTML(upcoming, next.slice(0, 4).map((x) => '<div class="up-row"><span>' + x.u.name + '</span><span class="muted">ab ' + x.u.req.n + '× (' +
          s.gens[x.u.req.gen] + '/' + x.u.req.n + ')</span><div class="bar small"><div class="bar-fill" style="width:' + (x.prog * 100).toFixed(0) + '%"></div></div></div>').join('') || '<p class="muted">–</p>');
        setText(ownedInfo, Object.keys(s.upgrades).length + ' von ' + C.UPGRADES.length + ' Verbesserungen in diesem Lauf gekauft.');
      },
    };
  };

  // ---- Verstärkung ----------------------------------------------------------
  UI.BUILDERS.reinforce = function (el) {
    el.appendChild(panelTop('Verstärkung', 'Investiere Mangan gezielt in einzelne Anlagen. Jede Stufe multipliziert deren Produktion, die Kosten steigen pro Stufe ×3 – verteilen lohnt sich. Mangan brauchen aber auch Schmelzen und Abstiege: <b>Wofür gibst du es aus?</b>'));
    const list = h('div', { class: 'card-list' });
    el.appendChild(list);
    const cards = C.GENERATORS.map((g) => {
      const c = buyCard({ icon: g.id, name: g.name, cls: 'reinforce', onBuy: () => act(AB.Actions.reinforce, [g.id], { sound: 'buy' }) });
      c.def = g; list.appendChild(c.root); return c;
    });
    return {
      update() {
        const s = st();
        const per = E.reinforcePer(s);
        const lps = E.lps(s, true);
        cards.forEach((c) => {
          const g = c.def;
          const vis = s.gens[g.id] > 0;
          setHidden(c.root, !vis);
          if (!vis) return;
          const lvl = s.reinforce[g.id];
          setText(c.count, 'Stufe ' + lvl + '/' + C.REINFORCE.maxLevel);
          const now = Math.pow(per, lvl);
          const share = lps > 0 ? E.genTotal(s, g.id, true) / lps : 0;
          setHTML(c.stats, 'Aktuell <b>' + F.mult(now) + '</b> → nächste Stufe <b>' + F.mult(now * per) + '</b> · Anteil an Lumen/s: ' + F.pct(share, 1));
          if (lvl >= C.REINFORCE.maxLevel) { setText(c.btnLabel, 'Maximal'); setHTML(c.btnCost, ''); setText(c.btnGain, ''); setDisabled(c.btn, true); setText(c.hint, ''); return; }
          const gain = E.genTotal(s, g.id) * (per - 1);
          updateBuy(c, 'Stufe ' + (lvl + 1), E.reinforceCost(s, g.id), '+' + F.rate(gain) + '/s');
        });
      },
    };
  };

  // ---- Abstieg & Tiefenrekord -----------------------------------------------
  UI.BUILDERS.descent = function (el) {
    const hero = h('div', { class: 'zone-hero' });
    const next = h('div', { class: 'zone-next' });
    const btn = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => AB.Game.descend() });
    const hint = h('div', { class: 'card-hint center' });
    const record = h('div', { class: 'record-box' });
    const recBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => act(AB.Actions.drill, [], { sound: 'descend', toastOk: ['Bohrung erfolgreich', 'Neuer Tiefenrekord.'] }) });
    const recHint = h('div', { class: 'card-hint' });
    const past = h('div', { class: 'zone-past' });
    el.append(hero, next, h('div', { class: 'center' }, btn, hint), record, past);
    record.append(h('div', { class: 'record-info' }), h('div', { class: 'record-act' }, recBtn, recHint));
    const recInfo = record.firstChild;
    return {
      update() {
        const s = st();
        const d = C.DEPTHS[s.depth];
        setHTML(hero, '<div class="zone-meters">' + d.meters.toLocaleString('de-DE') + ' m</div><h2>' + d.name + '</h2><p>' + d.story + '</p>' +
          '<p class="muted small">Tiefenbonus: alle Anlagen ' + F.mult(E.depthMult(s)) + ' (' + F.mult(E.depthPer(s)) + ' pro Zone)' + (s.probe && s.probe.id === 'flat' ? ' – in dieser Probe deaktiviert' : '') + '</p>');
        const ndI = s.depth + 1;
        const nd = C.DEPTHS[ndI];
        if (!nd) {
          setHTML(next, '<p class="muted center">Tiefer geht es nicht. Das Herz schlägt unter dir. Jetzt zählen Tiefenrekord und Weltenwende.</p>');
          setHidden(btn, true); setText(hint, '');
        } else {
          const allowed = E.depthAllowed(s, ndI);
          const cost = E.descentCost(s, ndI);
          const bars = Object.keys(cost).map((k) => {
            const p = Math.min(1, (s.res[k] || 0) / cost[k]);
            return '<div class="cost-bar"><div class="cost-bar-head">' + icon(C.RESOURCES[k].icon) + '<span>' + C.RESOURCES[k].name + '</span><span class="muted">' + F.num(Math.min(s.res[k], cost[k])) + ' / ' + F.num(cost[k]) + '</span></div>' +
              '<div class="bar"><div class="bar-fill fill-' + k + '" style="width:' + (p * 100).toFixed(1) + '%"></div></div></div>';
          }).join('');
          setHTML(next, '<div class="zone-next-head"><span class="muted">Nächste Zone</span><h3>' + nd.name + ' · ' + nd.meters.toLocaleString('de-DE') + ' m</h3></div>' +
            (allowed ? bars : '<p class="lock-note">' + icon('lock') + ' Erst nach ' + nd.reqPrestige + ' Gezeitenwende' + (nd.reqPrestige > 1 ? 'n' : '') + ' erreichbar (bisher ' + s.prestige.total + ').</p>') +
            '<div class="unlock-list"><span class="muted">Schaltet frei:</span>' + nd.unlocks.map((u) => '<span class="unlock-chip">' + u + '</span>').join('') +
            '<span class="unlock-chip">Tiefenbonus ' + F.mult(E.depthPer(s)) + '</span></div>');
          setHidden(btn, false);
          const ok = allowed && E.canAfford(s, cost);
          setHTML(btn, icon('down') + ' Abtauchen ' + nd.into);
          setDisabled(btn, !ok);
          setText(hint, !allowed ? 'Gesperrt.' : ok ? 'Anlagen, Station und Verbesserungen bleiben erhalten. Die Kosten werden abgezogen.' : missingText(cost));
        }
        const showRec = s.depth >= C.RECORD.depth;
        setHidden(record, !showRec);
        if (showRec) {
          const cost = E.recordCost(s);
          setHTML(recInfo, '<h3>' + icon('drill2') + ' Tiefenrekord: Stufe ' + s.record + '</h3><p class="muted small">Jede Bohrung: alle Anlagen ×' + String(C.RECORD.mult).replace('.', ',') +
            ', Perlen +' + Math.round(C.RECORD.perlenPer * 100) + ' %, +' + C.RECORD.metersPer + ' m. Der Rekord bleibt über alle Wenden erhalten – bohren kannst du aber nur aus der Herzkammer.</p>' +
            '<p>Aktuell: ' + F.mult(Math.pow(C.RECORD.mult, s.record)) + ' Produktion · ' + (C.DEPTHS[6].meters + s.record * C.RECORD.metersPer).toLocaleString('de-DE') + ' m</p>');
          setHTML(recBtn, 'Bohren ' + costHTML(cost));
          const ok = E.canAfford(s, cost);
          setDisabled(recBtn, !ok);
          setText(recHint, ok ? '' : missingText(cost));
        }
        setHTML(past, C.DEPTHS.map((z, i) => '<div class="zone-chip ' + (i < s.depth ? 'done' : i === s.depth ? 'current' : '') + (E.depthAllowed(s, i) ? '' : ' locked') + '"><b>' + z.meters.toLocaleString('de-DE') + ' m</b>' + (i <= s.depth + 1 || s.stats.maxDepth >= i ? z.name : '???') + '</div>').join(''));
        past.style.gridTemplateColumns = 'repeat(' + C.DEPTHS.length + ', 1fr)';
      },
    };
  };

  // ---- Ziele & Logbuch ------------------------------------------------------
  UI.BUILDERS.goals = function (el) {
    el.appendChild(panelTop('Ziele & Logbuch', 'Kurzfristige Aufträge, die nächsten großen Schritte und langfristige Projekte auf einen Blick. Jeder Logbuch-Eintrag gibt dauerhaft +1 % Produktion.'));
    const cols = h('div', { class: 'goal-cols' });
    const colS = h('div', { class: 'goal-col' }), colM = h('div', { class: 'goal-col' }), colL = h('div', { class: 'goal-col' });
    cols.append(colS, colM, colL);
    el.appendChild(cols);
    const sum = h('p', { class: 'log-sum' });
    const grid = h('div', { class: 'ach-grid' });
    const stats = h('div', { class: 'stats' });
    const odds = h('div', { class: 'odds' });
    el.append(h('h3', { class: 'section-title', html: icon('book') + 'Logbuch' }), sum, grid,
      h('h3', { class: 'section-title', html: icon('book') + 'Statistik' }), stats,
      h('h3', { class: 'section-title', html: icon('star') + 'Irrlichter & Relikte – Wahrscheinlichkeiten' }), odds);
    const tiles = C.ACHIEVEMENTS.map((a) => {
      const t = h('div', { class: 'ach', title: a.desc }, h('span', { class: 'ach-icon', html: icon('star') }), h('span', { class: 'ach-name', text: a.name }), h('span', { class: 'ach-desc', text: a.desc }));
      grid.appendChild(t); return { a, t };
    });
    function goalHTML(g) {
      return '<button class="goal" type="button" data-tab="' + (g.tab || '') + '"><span class="goal-name">' + g.name + '</span><span class="goal-text">' + g.text + '</span>' +
        '<span class="bar small"><span class="bar-fill" style="width:' + (Math.max(0, Math.min(1, g.progress)) * 100).toFixed(0) + '%"></span></span></button>';
    }
    cols.addEventListener('click', (e) => { const b = e.target.closest('.goal'); if (b && b.dataset.tab) UI.showTab(b.dataset.tab); });
    return {
      update() {
        const s = st();
        const g = U.goals(s);
        setHTMLThrottled(colS, '<h4>Jetzt</h4>' + (g.short.map((m) => goalHTML({ name: m.name, text: UI.partsText(s, m.cond), progress: U.progress(s, m.cond) })).join('') || '<p class="muted">Alle Aufträge erledigt.</p>'), g.short.map((m) => m.id).join());
        setHTMLThrottled(colM, '<h4>Diese Sitzung</h4>' + (g.mid.map(goalHTML).join('') || '<p class="muted">–</p>'), g.mid.map((x) => x.id).join());
        setHTMLThrottled(colL, '<h4>Langfristig</h4>' + (g.long.map(goalHTML).join('') || '<p class="muted">–</p>'), g.long.map((x) => x.id).join());
        const n = Object.keys(s.achievements).length;
        setText(sum, n + ' / ' + C.ACHIEVEMENTS.length + ' Einträge · Bonus +' + n + ' %');
        tiles.forEach((x) => setClass(x.t, 'earned', !!s.achievements[x.a.id]));
        const a = E.agg(s);
        const f = E.flows(s);
        const rows = [
          ['Lumen/s (ohne Boosts)', F.rate(E.lps(s, true))],
          ['Puls-Ertrag', F.num(E.clickValue(s), { small: true })],
          ['Globaler Multiplikator', F.mult(E.globalMult(s, true))],
          ['· Tiefe', F.mult(E.depthMult(s))],
          ['· Logbuch', F.mult(E.achievementMult(s))],
          ['· Perlen (Zyklus)', F.mult(E.perlenMult(s))],
          ['· Anlagen-Bonus (Schwarm/Kolonie)', F.mult(E.swarmMult(s))],
          ['· Prismen', F.mult(1 + f.prismPct)],
          ['· Leuchtgrotten', F.mult(E.exploitLumenMult(s))],
          ['· Upgrades, Forschung, Relikte, Baum, Ursprung', F.mult(a.all)],
          ['Energie', F.num(f.supply) + ' / ' + F.num(f.demand)],
          ['Lumen in diesem Lauf', F.num(s.run.lumen)],
          ['Lumen insgesamt', F.num(s.stats.lumenAll)],
          ['Legierung insgesamt', F.num(s.stats.alloyAll)],
          ['Kristalle insgesamt', F.num(s.stats.crystalAll)],
          ['Sektoren erkundet', F.num(s.stats.scans)],
          ['Gezeitenwenden (gesamt / Zyklus)', s.prestige.total + ' / ' + s.prestige.count],
          ['Perlen verdient (gesamt)', F.num(s.prestige.perlenAll)],
          ['Weltenwenden', String(s.world.count)],
          ['Pulse', F.num(s.stats.clicks)],
          ['Irrlichter gefangen', F.num(s.stats.events)],
          ['Laufzeit (dieser Lauf)', F.time(s.run.time)],
          ['Spielzeit gesamt', F.time(s.stats.playTime)],
          ['Offline-Grenze', F.time(E.offlineCapSeconds(s)) + (a.offlineMult > 1 ? ' (Produktion ' + F.mult(a.offlineMult) + ')' : '')],
        ];
        setHTML(stats, rows.map((r) => '<div class="stat-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join(''));
        const tot = C.EVENTS.outcomes.reduce((x, o) => x + o.weight, 0);
        const sumW = C.MAP.types.reduce((x, t) => x + t.weight, 0);
        setHTML(odds, '<p class="muted small">Irrlichter erscheinen alle ' + F.time(C.EVENTS.minDelay * E.mod(s, 'eventFreq')) + ' – ' + F.time(C.EVENTS.maxDelay * E.mod(s, 'eventFreq')) +
          ' und bleiben ' + Math.round(E.eventLifetime(s)) + ' s. Ergebnis:</p>' +
          C.EVENTS.outcomes.map((o) => '<div class="stat-row"><span>' + o.name + ' – ' + o.desc + '</span><b>' + Math.round(o.weight / tot * 100) + ' %</b></div>').join('') +
          '<p class="muted small">Sektortypen auf der Karte (Kristallnester erst ab Zone 3):</p>' +
          C.MAP.types.map((t) => '<div class="stat-row"><span>' + t.name + '</span><b>≈ ' + Math.round(t.weight / sumW * 100) + ' %</b></div>').join('') +
          '<div class="stat-row"><span>Relikt aus Ruine (Bergen)</span><b>' + Math.round(Math.min(1, C.MAP.relicChanceRuin + a.relicChance) * 100) + ' %</b></div>' +
          '<div class="stat-row"><span>Relikt aus Wrack (Bergen)</span><b>100 %</b></div>' +
          '<p class="muted small">Welches Relikt: gleich verteilt unter allen noch nicht vollen Relikten, die in der Zone des Sektors vorkommen können.</p>');
      },
    };
  };
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
