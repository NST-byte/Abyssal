/* UI-Bereiche: Gezeiten (Wende, Gezeiten-Baum, Tiefenproben) und Ursprung (Weltenwende) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format, UI = AB.UI;
  const { h, setText, setHTML, setHTMLThrottled, setHidden, setClass, setDisabled, costHTML, panelTop, treeView, icon } = UI.lib;
  const st = () => AB.Game.state;
  const act = (...a) => AB.Game.act(...a);

  UI.BUILDERS.tides = function (el) {
    el.appendChild(panelTop('Gezeiten', 'Die Gezeitenwende setzt deinen Lauf zurück und schenkt dir Perlen. Perlen investierst du in den <b>Gezeiten-Baum</b> – vier Zweige, je eine Gabelung, höchstens zwei Capstones. <b>Bei jeder Wende kannst du den Baum kostenlos neu verteilen</b> und so einen ganz anderen Build ausprobieren.'));
    const info = h('div', { class: 'tide-info' });
    const btn = h('button', { class: 'btn btn-pearl btn-big', type: 'button', onclick: () => AB.Game.confirmPrestige() });
    const hint = h('div', { class: 'card-hint center' });
    el.append(info, h('div', { class: 'center' }, btn, hint));

    const treeSec = h('div', {});
    const treeInfo = h('p', { class: 'tree-info' });
    const branchHead = h('div', { class: 'tree-branches' }, ...C.TREE_BRANCHES.map((b) => h('span', {}, h('b', { text: b.name }), h('small', { text: b.style }))));
    const tv = treeView(C.TREE, {
      rowH: 100, minWidth: 720,
      state: (n) => {
        const s = st();
        const ts = U.treeState(s, n);
        const lvl = s.prestige.tree[n.id] || 0;
        if (ts === 'max') return 'done';
        if (ts === 'open') return (lvl > 0 ? 'part ' : '') + 'open' + (s.perlen >= E.treeCost(s, n.id) ? ' ok' : '');
        if (ts === 'alt' || ts === 'cap') return 'alt';
        return 'locked';
      },
      label: (n) => {
        const s = st();
        const lvl = s.prestige.tree[n.id] || 0;
        const ts = U.treeState(s, n);
        const lv = n.max > 1 ? lvl + '/' + n.max + ' · ' : '';
        if (ts === 'max') return { title: n.name, sub: lv + icon('check'), aria: 'vollständig' };
        if (ts === 'req') return { title: n.name, sub: lv + icon('lock'), aria: 'Voraussetzung fehlt' };
        if (ts === 'alt') return { title: n.name, sub: 'andere Seite gewählt', aria: 'andere Seite gewählt' };
        if (ts === 'cap') return { title: n.name, sub: 'Capstone-Limit', aria: 'Capstone-Limit erreicht' };
        return { title: n.name, sub: lv + costHTML({ perlen: E.treeCost(s, n.id) }), aria: F.num(E.treeCost(s, n.id)) + ' Perlen' };
      },
      detail: (n) => {
        const s = st();
        const lvl = s.prestige.tree[n.id] || 0;
        const ts = U.treeState(s, n);
        const br = C.TREE_BRANCHES.find((b) => b.id === n.branch);
        let status = '';
        if (ts === 'max') status = '<span class="tag-ok">Vollständig</span>';
        else if (ts === 'req') status = 'Benötigt: ' + U.reqText(n.req, (x) => C.TREE_BY_ID[x].name, (x) => s.prestige.tree[x] > 0);
        else if (ts === 'alt') status = 'Die andere Seite dieser Gabelung ist gewählt. Neu verteilen bei der nächsten Gezeitenwende.';
        else if (ts === 'cap') status = 'Du hast bereits ' + E.capstonesUsed(s) + ' von ' + E.maxCapstones(s) + ' Capstones.';
        else status = 'Nächste Stufe: ' + costHTML({ perlen: E.treeCost(s, n.id) });
        return '<b>' + n.name + '</b> <span class="muted small">' + br.name + (n.max > 1 ? ' · Stufe ' + lvl + '/' + n.max : '') + '</span>' +
          (n.group ? ' <span class="tag-fork">Gabelung</span>' : '') + (n.capstone ? ' <span class="tag-cap">Capstone</span>' : '') + '<p>' + n.desc + '</p><p>' + status + '</p>';
      },
      onClick: (n) => act(AB.Actions.buyTree, [n.id], { sound: 'unlock' }),
    });
    treeSec.append(h('h3', { class: 'section-title', html: icon('tree') + 'Gezeiten-Baum' }), treeInfo, branchHead, tv.el, tv.detail);
    el.appendChild(treeSec);

    const probeSec = h('div', {});
    const probeGrid = h('div', { class: 'probe-grid' });
    probeSec.append(h('h3', { class: 'section-title', html: icon('probe') + 'Tiefenproben' }),
      h('p', { class: 'muted small', html: 'Eine Probe startet einen neuen Lauf mit einer Sonderregel – <b>ohne Perlen für den aktuellen Lauf</b>. Erreichst du das Ziel, gibt es eine einzigartige, dauerhafte Belohnung, die sogar Weltenwenden überdauert. Abbrechen geht jederzeit: Die Regel fällt weg, der Lauf geht normal weiter.' }), probeGrid);
    el.appendChild(probeSec);
    const probeCards = C.PROBES.list.map((p) => {
      const card = h('div', { class: 'probe' });
      const b = h('button', { class: 'btn', type: 'button' });
      b.addEventListener('click', () => {
        const s = st();
        if (s.probe && s.probe.id === p.id) AB.Game.abandonProbe();
        else AB.Game.confirmProbe(p.id);
      });
      const body = h('div', { class: 'probe-body' });
      card.append(body, b);
      probeGrid.appendChild(card);
      return { p, card, b, body };
    });

    return {
      update() {
        const s = st();
        const gain = E.prestigeGain(s);
        const can = AB.Core.canPrestige(s);
        const reached = s.depth >= C.PRESTIGE.requireDepth;
        const rate = gain / Math.max(60, s.run.time) * 3600;
        setHTMLThrottled(info, '<div class="tide-grid">' +
          '<div class="tide-stat"><span class="muted">Perlen bei Gezeitenwende</span><b class="pearl">+' + F.num(gain) + '</b><span class="muted small">nächste bei ' + F.num(E.prestigeNextAt(s)) + ' Lumen (Lauf: ' + F.num(s.run.lumen) + ')</span></div>' +
          '<div class="tide-stat"><span class="muted">Perlen pro Stunde (dieser Lauf)</span><b>' + F.num(rate) + '</b><span class="muted small">Sinkt diese Rate, lohnt sich die Wende meist.</span></div>' +
          '<div class="tide-stat"><span class="muted">Tiefenfaktor</span><b>' + F.mult(E.perlenFactor(s)) + '</b><span class="muted small">+' + Math.round(C.PRESTIGE.deepBonus * 100) + ' % je Zone jenseits von Hadal, plus Relikte, Ursprung und Tiefenrekord</span></div>' +
          '<div class="tide-stat"><span class="muted">Gezeitenwenden</span><b>' + s.prestige.total + '</b><span class="muted small">' + (s.prestige.bestRunTime ? 'schnellster Lauf: ' + F.time(s.prestige.bestRunTime) : 'Laufzeit: ' + F.time(s.run.time)) + '</span></div>' +
          '</div><div class="tide-cols"><div><h4>Wird zurückgesetzt</h4><ul><li>Lumen, Mangan, Daten, Legierung, Kristalle</li><li>Anlagen, Verbesserungen, Verstärkungen</li><li>Station, Forschung, Protokolle</li><li>Karte und Außenposten</li><li>Tiefe (zurück zur Schelfkante)</li></ul></div>' +
          '<div><h4>Bleibt erhalten</h4><ul><li>Perlen und Gezeiten-Baum</li><li>Relikte, Tiefenproben, Tiefenrekord</li><li>Logbuch (+1 % je Eintrag)</li><li>Aufträge, Statistiken, Einstellungen</li></ul></div></div>', String(can) + reached, 1000);
        setHTML(btn, icon('wave') + ' Gezeitenwende auslösen');
        setDisabled(btn, !can);
        setText(hint, can ? '' : !reached ? 'Erst verfügbar, wenn du den Hadal-Graben (8.000 m) erreichst.' : 'Noch keine volle Perle verdient – sammle mehr Lumen.');

        setHidden(treeSec, !U.features(s).tree);
        setHTML(treeInfo, icon('perlen') + ' <b>' + F.num(s.perlen) + '</b> Perlen verfügbar · Capstones ' + E.capstonesUsed(s) + ' / ' + E.maxCapstones(s) +
          ' · im Baum: ' + F.num(AB.Actions.treeSpent(s)) + ' Perlen');
        tv.update();

        setHidden(probeSec, !U.features(s).probes);
        probeCards.forEach((pc) => {
          const lvl = s.probes[pc.p.id] || 0;
          const active = s.probe && s.probe.id === pc.p.id;
          const why = AB.Core.canStartProbe(s, pc.p.id);
          const goal = lvl < C.PROBES.goals.length ? C.DEPTHS[C.PROBES.goals[lvl]].name : null;
          setClass(pc.card, 'active', !!active);
          setClass(pc.card, 'done', lvl >= C.PROBES.goals.length);
          setHTML(pc.body, '<div class="probe-title"><b>' + pc.p.name + '</b><span class="probe-dots">' + [1, 2, 3].map((i) => '<i class="' + (i <= lvl ? 'on' : '') + '"></i>').join('') + '</span></div>' +
            '<div class="small"><span class="muted">Regel:</span> ' + pc.p.rule + '</div><div class="small"><span class="muted">Belohnung:</span> ' + pc.p.reward + (lvl ? ' <b>(aktuell Stufe ' + lvl + ')</b>' : '') + '</div>' +
            (goal ? '<div class="small"><span class="muted">Nächstes Ziel:</span> ' + goal + '</div>' : '<div class="small tag-ok">Alle Stufen bestanden</div>'));
          setText(pc.b, active ? 'Probe abbrechen' : lvl >= C.PROBES.goals.length ? 'Bestanden' : 'Probe starten (Stufe ' + (lvl + 1) + ')');
          setDisabled(pc.b, !active && !!why);
          pc.b.title = !active && why ? why : '';
        });
      },
    };
  };

  UI.BUILDERS.origin = function (el) {
    el.appendChild(panelTop('Ursprung', 'Die Weltenwende ist die zweite, größere Ebene: Sie setzt auch Perlen und Gezeiten-Baum zurück und gibt dir <b>Urlicht</b>. Urlicht verändert, wie jeder künftige Lauf beginnt – mit Automatik, größerem Raster, Erbstationen und dauerhaften Multiplikatoren.'));
    const info = h('div', { class: 'tide-info' });
    const btn = h('button', { class: 'btn btn-urlicht btn-big', type: 'button', onclick: () => AB.Game.confirmWorld() });
    const hint = h('div', { class: 'card-hint center' });
    el.append(info, h('div', { class: 'center' }, btn, hint));
    const shopInfo = h('p', { class: 'tree-info' });
    const grid = h('div', { class: 'tile-grid' });
    el.append(h('h3', { class: 'section-title', html: icon('urlicht') + 'Ursprung (dauerhaft)' }), shopInfo, grid);
    const tiles = C.ORIGIN.map((o) => {
      const cost = h('span', { class: 'tile-cost' });
      const lvl = h('span', { class: 'tile-level' });
      const b = h('button', { class: 'tile tile-origin', type: 'button', onclick: () => act(AB.Actions.buyOrigin, [o.id], { sound: 'prestige' }) },
        h('span', { class: 'tile-icon', html: icon('urlicht') }), h('span', { class: 'tile-name', text: o.name }), lvl, h('span', { class: 'tile-desc', text: o.desc }), cost);
      grid.appendChild(b);
      return { o, b, cost, lvl };
    });
    const archSec = h('div', {});
    const archGrid = h('div', { class: 'proto-grid' });
    archSec.append(h('h3', { class: 'section-title', html: icon('station') + 'Erbstation für den nächsten Lauf' }),
      h('p', { class: 'muted small', text: 'Gilt ab der nächsten Gezeitenwende, Probe oder Weltenwende.' }), archGrid);
    el.appendChild(archSec);
    const archCards = C.ARCHETYPES.map((a) => {
      const b = h('button', { class: 'proto', type: 'button', onclick: () => act(AB.Actions.setArchetype, [a.id], { sound: 'buy' }) },
        h('span', { class: 'proto-name', text: a.name }), h('span', { class: 'proto-desc', text: a.desc }));
      archGrid.appendChild(b);
      return { a, b };
    });
    return {
      update() {
        const s = st();
        const gain = E.worldGain(s);
        const can = AB.Core.canWorld(s);
        setHTMLThrottled(info, '<div class="tide-grid">' +
          '<div class="tide-stat"><span class="muted">Urlicht bei Weltenwende</span><b class="urlicht">+' + F.num(gain) + '</b><span class="muted small">aus ' + F.num(s.prestige.perlenEarned) + ' Perlen dieses Zyklus (logarithmisch)</span></div>' +
          '<div class="tide-stat"><span class="muted">Weltenwenden</span><b>' + s.world.count + '</b><span class="muted small">Urlicht insgesamt: ' + F.num(s.world.urlichtAll) + '</span></div>' +
          '</div><div class="tide-cols"><div><h4>Wird zurückgesetzt</h4><ul><li>Alles, was die Gezeitenwende zurücksetzt</li><li>Perlen und Gezeiten-Baum</li></ul></div>' +
          '<div><h4>Bleibt erhalten</h4><ul><li>Urlicht und Ursprung</li><li>Relikte, Tiefenproben, Tiefenrekord</li><li>Logbuch, Statistiken, Gezeitenwenden-Zähler für Zonen</li></ul></div></div>', String(can), 1000);
        setHTML(btn, icon('urlicht') + ' Weltenwende auslösen');
        setDisabled(btn, !can);
        setText(hint, can ? '' : s.depth < C.WORLD.requireDepth ? 'Erst verfügbar in der Herzkammer (15.000 m).' : 'Noch nicht genug Perlen in diesem Zyklus (mindestens ' + F.num(Math.ceil(Math.pow(10, C.WORLD.minLog + Math.pow(1 / C.WORLD.scale, 1 / C.WORLD.exponent)))) + ').');
        setHTML(shopInfo, icon('urlicht') + ' <b>' + F.num(s.world.urlicht) + '</b> Urlicht verfügbar');
        tiles.forEach((t) => {
          const lvl = s.world.origin[t.o.id] || 0;
          setText(t.lvl, t.o.max > 1 ? 'Stufe ' + lvl + '/' + t.o.max : lvl ? 'Gekauft' : '');
          setClass(t.b, 'done', lvl >= t.o.max);
          if (lvl >= t.o.max) { setHTML(t.cost, icon('check') + 'Maximal'); setDisabled(t.b, true); setClass(t.b, 'affordable', false); return; }
          const c = E.originCost(s, t.o.id);
          setHTML(t.cost, costHTML({ urlicht: c }));
          setDisabled(t.b, s.world.urlicht < c);
          setClass(t.b, 'affordable', s.world.urlicht >= c);
        });
        setHidden(archSec, !s.world.origin.o_heritage);
        archCards.forEach((x) => { const on = s.prestige.nextArchetype === x.a.id; setClass(x.b, 'active', on); x.b.setAttribute('aria-pressed', String(on)); });
      },
    };
  };
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
