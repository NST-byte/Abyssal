/* UI-Bereich: Forschung (Tech-Baum mit Gabelungen, Protokolle, Tiefenanalyse) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format, UI = AB.UI;
  const { h, setText, setHTML, setHidden, setClass, setDisabled, costHTML, missingText, buyCard, updateBuy, panelTop, treeView, icon } = UI.lib;
  const st = () => AB.Game.state;
  const act = (...a) => AB.Game.act(...a);

  function forkPartner(r) { return C.RESEARCH.filter((x) => x.group === r.group && x.id !== r.id); }

  UI.BUILDERS.research = function (el) {
    el.appendChild(panelTop('Forschung', 'Daten schalten Systeme frei und verändern, <b>wie</b> deine Station arbeitet. Mit ⑂ markierte Knoten sind <b>Gabelungen</b>: Nur eine Seite kann aktiv sein. Umrüsten ist jederzeit möglich, kostet aber den vollen Preis – die beste Wahl ändert sich mit deinem Spielstand.'));

    // Protokolle
    const protoSec = h('div', { class: 'proto-section' });
    const protoInfo = h('p', { class: 'muted small' });
    const protoGrid = h('div', { class: 'proto-grid' });
    protoSec.append(h('h3', { class: 'section-title', html: icon('wave') + 'Protokoll – Spielstil dieses Laufs' }), protoInfo, protoGrid);
    const protoCards = C.PROTOCOLS.map((p) => {
      const state = h('span', { class: 'proto-state' });
      const b = h('button', { class: 'proto', type: 'button', onclick: () => {
        const s = st();
        const switching = s.protocols.length >= E.maxProtocols(s) && s.protocols.indexOf(p.id) < 0;
        if (switching) {
          UI.modal({ title: 'Protokoll wechseln?', icon: 'wave',
            body: '<p>Aktiv: <b>' + s.protocols.map((x) => C.PROTOCOL_BY_ID[x].name).join(', ') + '</b>.</p><p>Wechsel zu <b>' + p.name + '</b> kostet <b>' + F.num(E.protocolSwitchCost(s)) + ' Daten</b> (verdoppelt sich mit jedem Wechsel, setzt sich bei der Gezeitenwende zurück).</p>',
            buttons: [{ label: 'Abbrechen' }, { label: 'Wechseln', primary: true, onClick: () => act(AB.Actions.setProtocol, [p.id], { sound: 'unlock' }) }] });
        } else act(AB.Actions.setProtocol, [p.id], { sound: 'unlock' });
      } },
      h('span', { class: 'proto-style', text: p.style }), h('span', { class: 'proto-name', text: p.name }), h('span', { class: 'proto-desc', text: p.desc }), state);
      protoGrid.appendChild(b);
      return { p, b, state };
    });

    // Tech-Baum
    const branchHead = h('div', { class: 'tree-branches tech' }, ...C.TECH_BRANCHES.map((b) => h('span', { text: b.name })));
    const tv = treeView(C.RESEARCH, {
      rowH: 96, minWidth: 620,
      state: (r) => {
        const s = st();
        const rs = U.researchState(s, r);
        if (rs === 'done') return 'done';
        if (rs === 'open') return s.res.data >= E.techCost(s, r) ? 'open ok' : 'open';
        if (rs === 'alt') return 'alt';
        return 'locked';
      },
      label: (r) => {
        const s = st();
        const rs = U.researchState(s, r);
        if (rs === 'done') return { title: r.name, sub: icon('check') + 'aktiv', aria: 'erforscht' };
        if (rs === 'depth') return { title: r.name, sub: icon('lock') + C.DEPTHS[r.depth].name, aria: 'benötigt ' + C.DEPTHS[r.depth].name };
        if (rs === 'req') return { title: r.name, sub: icon('lock') + 'Voraussetzung', aria: 'Voraussetzung fehlt' };
        const cost = E.techCost(s, r);
        return { title: r.name, sub: (rs === 'alt' ? 'umrüsten ' : '') + costHTML({ data: cost }), aria: (rs === 'alt' ? 'umrüsten, ' : '') + F.num(cost) + ' Daten' };
      },
      detail: (r) => {
        const s = st();
        const rs = U.researchState(s, r);
        const cost = E.techCost(s, r);
        let status = '';
        if (rs === 'done') status = '<span class="tag-ok">Erforscht</span>';
        else if (rs === 'depth') status = 'Benötigt ' + C.DEPTHS[r.depth].name + '.';
        else if (rs === 'req') status = 'Benötigt: ' + U.reqText(r.req, (x) => C.RESEARCH_BY_ID[x].name, (x) => s.research[x]) + '.';
        else status = (rs === 'alt' ? 'Umrüsten ersetzt <b>' + forkPartner(r).filter((x) => s.research[x.id]).map((x) => x.name).join(', ') + '</b>. ' : '') + 'Kosten: ' + costHTML({ data: cost }) +
          (s.res.data < cost ? ' <span class="muted">(' + missingText({ data: cost }) + ')</span>' : '');
        return '<b>' + r.name + '</b>' + (r.group ? ' <span class="tag-fork">Gabelung</span>' : '') + '<p>' + r.desc + '</p>' +
          (r.group ? '<p class="muted small">Alternative: ' + forkPartner(r).map((x) => '<b>' + x.name + '</b> – ' + x.desc).join(' ') + '</p>' : '') + '<p>' + status + '</p>';
      },
      onClick: (r) => {
        const s = st();
        const rs = U.researchState(s, r);
        if (rs === 'alt') {
          const cost = E.techCost(s, r);
          UI.modal({ title: 'Gabel umrüsten?', icon: 'flask', body: '<p><b>' + r.name + '</b> ersetzt <b>' + forkPartner(r).filter((x) => s.research[x.id]).map((x) => x.name).join(', ') + '</b>.</p><p>' + r.desc + '</p><p>Kosten: ' + costHTML({ data: cost }) + ' – die bisherige Seite wird nicht erstattet.</p>',
            buttons: [{ label: 'Abbrechen' }, { label: 'Umrüsten', primary: true, onClick: () => act(AB.Actions.research, [r.id], { sound: 'unlock' }) }] });
        } else if (rs !== 'done') act(AB.Actions.research, [r.id], { sound: 'unlock' });
      },
    });
    el.append(protoSec, h('h3', { class: 'section-title', html: icon('tree') + 'Tech-Baum' }), branchHead, tv.el, tv.detail);

    // Tiefenanalyse
    const anaSec = h('div', {});
    const ana = buyCard({ icon: 'data', name: C.ANALYSIS.name, desc: C.ANALYSIS.desc, cls: 'analysis', onBuy: () => act(AB.Actions.analysis, [], { sound: 'buy' }) });
    anaSec.append(h('h3', { class: 'section-title', html: icon('data') + 'Dauerprojekt' }), h('div', { class: 'card-list' }, ana.root));
    el.appendChild(anaSec);

    return {
      update() {
        const s = st();
        const unlocked = E.agg(s).protocolUnlock;
        setHidden(protoSec, !unlocked);
        if (unlocked) {
          const max = E.maxProtocols(s);
          setText(protoInfo, (s.protocols.length < max ? 'Wähle ' + (max === 2 ? 'bis zu zwei Protokolle' : 'ein Protokoll') + '. Die erste Wahl ist kostenlos.' : 'Wechsel kostet ' + F.num(E.protocolSwitchCost(s)) + ' Daten.') +
            ' Jedes Protokoll belohnt einen anderen Spielstil.');
          protoCards.forEach((pc) => {
            const on = s.protocols.indexOf(pc.p.id) >= 0;
            setClass(pc.b, 'active', on);
            pc.b.setAttribute('aria-pressed', String(on));
            setText(pc.state, on ? 'Aktiv' : s.protocols.length < max ? 'Wählen' : 'Wechseln');
          });
        }
        tv.update();
        const showAna = s.depth >= C.ANALYSIS.depth;
        setHidden(anaSec, !showAna);
        if (showAna) {
          setText(ana.count, 'Stufe ' + s.analysis);
          setHTML(ana.stats, 'Aktuell <b>' + F.mult(Math.pow(C.ANALYSIS.mult, s.analysis)) + '</b> auf alle Anlagen');
          if (s.analysis >= C.ANALYSIS.maxLevel) { setText(ana.btnLabel, 'Maximal'); setHTML(ana.btnCost, ''); setDisabled(ana.btn, true); setText(ana.hint, ''); }
          else updateBuy(ana, 'Stufe ' + (s.analysis + 1), { data: E.analysisCost(s) }, '+10 %');
        }
      },
    };
  };
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
