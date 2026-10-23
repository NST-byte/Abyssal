/* UI-Bereich: Station (Modulraster, Energie, Verarbeitungsketten) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, F = AB.Format, UI = AB.UI;
  const { h, setText, setHTML, setHTMLThrottled, setHidden, setClass, setDisabled, costHTML, missingText, panelTop, icon, rates } = UI.lib;
  const st = () => AB.Game.state;
  const act = (...a) => AB.Game.act(...a);
  const MAXC = C.GRID.maxCols;

  function moduleStatus(s, c, it, f) {
    if (!c.on) return 'aus';
    if (!it) return '';
    switch (c.t) {
      case 'reactor': return '+' + F.rate(it.energy) + ' ⚡';
      case 'smelter': return F.rate(it.rate || 0) + ' Leg./s';
      case 'foundry': return F.rate(it.rate || 0) + ' Kris./s';
      case 'lab': return F.rate(it.rate || 0) + ' Daten/s';
      case 'prism': return '+' + F.pct(it.rate || 0, 0) + ' Lumen';
      case 'dock': return '+' + c.lvl + ' U-Boot';
      case 'cooler': return 'kühlt Nachbarn';
      case 'relay': return 'spart Energie';
      case 'resonator': return '×' + (1.5 + 0.1 * (c.lvl - 1)).toFixed(1).replace('.', ',') + ' Nachbarn';
      default: return '';
    }
  }

  UI.BUILDERS.station = function (el) {
    el.appendChild(panelTop('Station', 'Baue Module ins Raster. <b>Reaktoren</b> liefern Energie, <b>Schmelzen</b> machen aus Mangan + Lumen Legierung, <b>Fertigungen</b> aus Legierung + Daten Kristalle. Nachbarschaft zählt: Kühltürme, Relais und Resonatoren wirken nur auf direkt angrenzende Felder. Verschieben ist kostenlos.'));
    const summary = h('div', { class: 'st-summary' });
    const energy = h('div', { class: 'st-energy' });
    const flows = h('div', { class: 'st-flows' });
    const warn = h('div', { class: 'st-warn' });
    const tools = h('div', { class: 'st-tools' });
    const pauseBtn = h('button', { class: 'btn', type: 'button' });
    pauseBtn.addEventListener('click', () => {
      const s = st();
      const anyOn = s.station.cells.some((c) => c && (c.t === 'smelter' || c.t === 'foundry') && c.on);
      act(AB.Actions.setProcessing, [!anyOn], { sound: 'buy' });
    });
    tools.appendChild(pauseBtn);
    summary.append(energy, flows, warn, tools);
    el.appendChild(summary);

    const layout = h('div', { class: 'st-layout' });
    const grid = h('div', { class: 'st-grid', role: 'grid', 'aria-label': 'Stationsraster' });
    grid.style.gridTemplateColumns = 'repeat(' + MAXC + ', 1fr)';
    const detail = h('div', { class: 'st-detail' });
    layout.append(grid, detail);
    el.appendChild(layout);

    let selected = -1;
    let moveFrom = -1;
    const cells = [];
    for (let i = 0; i < C.GRID.maxCols * C.GRID.maxRows; i++) {
      const b = h('button', { class: 'st-cell', type: 'button', 'data-i': i });
      b.addEventListener('click', () => onCell(i));
      grid.appendChild(b);
      cells.push(b);
    }
    function onCell(i) {
      const s = st();
      if (moveFrom >= 0) {
        if (i !== moveFrom) act(AB.Actions.moveModule, [moveFrom, i], { sound: 'buy' });
        moveFrom = -1; selected = i; update(); return;
      }
      if (!E.cellActive(s, i)) {
        AB.UI.toast('Feld gesperrt', 'Mehr Raster gibt es über den Tech-Baum (Erweiterter Rumpf), das Erreichen des Abyssals, den Gezeiten-Baum (Großindustrie) und den Ursprung (Weites Raster).', 'warn');
        return;
      }
      selected = selected === i ? -1 : i;
      update();
    }

    // Detailbereich
    function renderDetail(s, f) {
      const c0 = selected >= 0 ? s.station.cells[selected] : null;
      const key = selected + '|' + moveFrom + '|' + (c0 ? c0.t + c0.lvl + c0.on : '-') + '|' + s.depth;
      const setD = (html) => setHTMLThrottled(detail, html, key, 1000);
      if (moveFrom >= 0) {
        setD('<h3>' + icon('station') + ' Verschieben</h3><p>Wähle das Zielfeld. Ist es belegt, werden die Module getauscht. Kostenlos.</p><button class="btn" type="button" data-act="cancelmove">Abbrechen</button>');
        return;
      }
      if (selected < 0 || !E.cellActive(s, selected)) {
        const g = E.gridSize(s);
        setD('<h3>' + icon('station') + ' Raster ' + g.cols + '×' + g.rows + '</h3><p class="muted">Wähle ein leeres Feld zum Bauen oder ein Modul für Details.</p>' +
          '<ul class="muted small"><li>Energie knapp? Mehr Reaktoren oder Kühltürme daneben.</li><li>Schmelzen laufen nicht voll? Mangan fehlt – mehr Drohnen oder Kaltschmelze/Lichtschmelze im Tech-Baum.</li>' +
          '<li>Eine Ressource wird für den Abstieg gebraucht? Verarbeitung kurz pausieren.</li></ul>');
        return;
      }
      const c = s.station.cells[selected];
      const nbs = E.neighbors(s, selected).map((j) => s.station.cells[j]).filter(Boolean);
      const nbText = nbs.length ? nbs.map((x) => C.MODULE_BY_ID[x.t].name + (x.on ? '' : ' (aus)')).join(', ') : 'keine';
      if (!c) {
        const opts = C.MODULES.map((m) => {
          const locked = s.depth < m.depth;
          const cost = E.moduleBuildCost(s, m.id);
          const ok = !locked && E.canAfford(s, cost);
          return '<button class="st-opt' + (ok ? ' affordable' : '') + (locked ? ' is-locked' : '') + '" type="button" data-build="' + m.id + '" aria-disabled="' + !ok + '">' +
            '<span class="st-opt-icon">' + icon(m.id) + '</span><span class="st-opt-main"><b>' + m.name + '</b>' + (m.energy ? '<span class="tag-energy">' + (m.energy > 0 ? '+' : '') + m.energy + ' ⚡</span>' : '') +
            '<span class="muted small">' + m.desc + '</span>' +
            (locked ? '<span class="tile-hint">Ab ' + C.DEPTHS[m.depth].name + '</span>' : '<span class="tile-cost">' + costHTML(cost) + '</span>' + (ok ? '' : '<span class="tile-hint">' + missingText(cost) + '</span>')) +
            '</span></button>';
        }).join('');
        setD('<h3>Leeres Feld</h3><p class="muted small">Nachbarn: ' + nbText + '</p><div class="st-opts">' + opts + '</div>');
        return;
      }
      const def = C.MODULE_BY_ID[c.t];
      const it = f.info[selected] || {};
      const up = E.moduleUpgradeCost(s, c);
      const lines = [];
      if (def.energy > 0) lines.push('Liefert <b>' + F.rate(it.energy || 0) + '</b> Energie' + (it.boost > 1 ? ' (Kühlung ' + F.mult(it.boost) + ')' : ''));
      if (def.energy < 0 && c.on) lines.push('Verbraucht <b>' + F.rate(-(it.energy || 0)) + '</b> Energie' + (it.save ? ' (Relais −' + F.pct(it.save) + ')' : ''));
      if (def.out || def.prismPct) {
        lines.push('Leistung: <b>' + moduleStatus(s, c, it, f) + '</b>');
        if (it.boost > 1) lines.push('Kühlturm-Bonus ' + F.mult(it.boost));
        if (it.mult > 1) lines.push('Resonator-Bonus ' + F.mult(it.mult));
        if (f.eff < 0.999) lines.push('<span class="tag-warn">Energie nur ' + F.pct(f.eff) + '</span>');
      }
      if (c.t === 'smelter') lines.push('Rezept: <b>' + f.smelterRecipe.name + '</b> – pro Legierung ' + Object.keys(f.smelterIn).map((k) => F.num(f.smelterIn[k], { small: true }) + ' ' + C.RESOURCES[k].name).join(' + '));
      if (c.t === 'foundry') lines.push('Rezept: <b>' + f.foundryRecipe.name + '</b> – pro Kristall ' + Object.keys(f.foundryIn).map((k) => F.num(f.foundryIn[k], { small: true }) + ' ' + C.RESOURCES[k].name).join(' + '));
      const nextLvl = c.lvl < C.GRID.maxLevel ? E.levelPow(c.lvl + 1) / E.levelPow(c.lvl) : 0;
      setD('<h3>' + icon(c.t) + ' ' + def.name + ' · Stufe ' + c.lvl + '</h3><p class="muted small">' + def.desc + '</p>' +
        '<ul class="st-lines">' + lines.map((x) => '<li>' + x + '</li>').join('') + '</ul><p class="muted small">Nachbarn: ' + nbText + '</p>' +
        '<div class="btn-row">' +
        (c.lvl < C.GRID.maxLevel ? '<button class="btn btn-primary" type="button" data-act="upgrade" aria-disabled="' + !E.canAfford(s, up) + '">Stufe ' + (c.lvl + 1) + ' (' + F.mult(nextLvl) + ') ' + costHTML(up) + '</button>' : '<span class="muted">Maximalstufe</span>') +
        '<button class="btn" type="button" data-act="toggle">' + (c.on ? 'Ausschalten' : 'Einschalten') + '</button>' +
        '<button class="btn" type="button" data-act="move">Verschieben</button>' +
        '<button class="btn btn-danger" type="button" data-act="demolish">Abreißen</button></div>' +
        (c.lvl < C.GRID.maxLevel && !E.canAfford(s, up) ? '<p class="card-hint">' + missingText(up) + '</p>' : ''));
    }

    detail.addEventListener('click', (e) => {
      const s = st();
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.build) { act(AB.Actions.buildModule, [selected, b.dataset.build], { sound: 'buy' }); update(); return; }
      const a = b.dataset.act;
      if (a === 'cancelmove') { moveFrom = -1; update(); }
      else if (a === 'upgrade') act(AB.Actions.upgradeModule, [selected], { sound: 'buy' });
      else if (a === 'toggle') act(AB.Actions.toggleModule, [selected], { sound: 'buy' });
      else if (a === 'move') { moveFrom = selected; update(); }
      else if (a === 'demolish') {
        const c = s.station.cells[selected];
        if (!c) return;
        const refund = E.moduleBuildCost(s, c.t);
        for (const k in refund) refund[k] = refund[k] * C.GRID.demolishRefund;
        UI.modal({ title: C.MODULE_BY_ID[c.t].name + ' abreißen?', icon: 'station',
          body: '<p>Du bekommst ' + costHTML(refund) + ' zurück (50 % der Baukosten, Stufen-Investitionen sind verloren).</p>',
          buttons: [{ label: 'Abbrechen' }, { label: 'Abreißen', danger: true, onClick: () => { act(AB.Actions.demolishModule, [selected], { sound: 'deny' }); update(); } }] });
      }
    });

    function update() {
      const s = st();
      const f = E.flows(s);
      const r = rates();
      // Energie
      const pct = f.demand > 0 ? Math.min(1, f.supply / f.demand) : 1;
      setHTML(energy, '<div class="st-e-head">' + icon('bolt') + '<b>Energie</b><span class="' + (f.eff < 0.999 ? 'tag-warn' : 'muted') + '">' + F.rate(f.supply) + ' / ' + F.rate(f.demand) + (f.eff < 0.999 ? ' · Module laufen mit ' + F.pct(f.eff) : ' · ausreichend') + '</span></div>' +
        '<div class="bar"><div class="bar-fill ' + (f.eff < 0.999 ? 'fill-warn' : 'fill-energy') + '" style="width:' + (f.demand > 0 ? Math.min(100, f.demand / Math.max(f.supply, 1e-9) * 100) : 0).toFixed(0) + '%"></div></div>');
      // Flüsse
      const row = (k, prod, use) => {
        const net = prod - use;
        return '<div class="flow-row"><span class="flow-res">' + icon(C.RESOURCES[k].icon) + C.RESOURCES[k].name + '</span><span class="flow-p">+' + F.rate(prod) + '</span><span class="flow-u">−' + F.rate(use) + '</span><b class="' + (net < -1e-9 ? 'neg' : '') + '">' + (net < 0 ? '−' : '+') + F.rate(Math.abs(net)) + '/s</b></div>';
      };
      const ch = E.chainStep(s, 1, r.grossLumen, r.grossMangan, r.grossData, f);
      let fl = '<div class="flow-row flow-head"><span>Ressource</span><span>Zufluss</span><span>Verbrauch</span><span>Netto</span></div>';
      fl += row('mangan', r.grossMangan, ch.useMangan);
      if (ch.useLumen > 0) fl += row('lumen', r.grossLumen, ch.useLumen);
      fl += row('alloy', ch.alloy, ch.useAlloy);
      if (s.depth >= 2) fl += row('data', r.grossData, ch.useData);
      if (s.depth >= 3 || f.crystalOut > 0) fl += row('crystal', ch.crystal, 0);
      setHTML(flows, fl);
      // Warnungen
      const w = [];
      if (f.eff < 0.999) w.push('Zu wenig Energie: alle Verbraucher laufen nur mit ' + F.pct(f.eff) + '.');
      if (r.grossLumen > 0 && ch.useLumen > r.grossLumen * 0.4) w.push('Deine Schmelzen verbrauchen ' + F.pct(ch.useLumen / r.grossLumen) + ' deiner Lumen-Produktion. Das bremst Anlagenkäufe und Abstiege – Schmelzen drosseln oder Kaltschmelze erforschen.');
      if (f.alloyOut > 0 && r.smelterFill < 0.98) w.push('Schmelzen laufen nur zu ' + F.pct(r.smelterFill) + ' – ' + (f.smelterIn.mangan && s.res.mangan < 1 ? 'Mangan' : 'Lumen') + ' reicht nicht.');
      if (f.crystalOut > 0 && r.foundryFill < 0.98) w.push('Fertigungen laufen nur zu ' + F.pct(r.foundryFill) + ' – ' + (s.res.alloy < 1 ? 'Legierung' : 'Daten') + ' reicht nicht.');
      const nd = s.depth + 1;
      if (C.DEPTHS[nd] && E.depthAllowed(s, nd)) {
        const need = E.descentCost(s, nd);
        const use = { mangan: ch.useMangan, data: ch.useData, alloy: ch.useAlloy };
        ['mangan', 'data', 'alloy'].forEach((k) => {
          if (!need[k] || s.res[k] >= need[k]) return;
          if (use[k] > 0 && (r[k] || 0) <= 0) w.push('Der Abstieg braucht ' + F.num(need[k]) + ' ' + C.RESOURCES[k].name + ', aber die Station verbraucht alles. Verarbeitung pausieren oder Zufluss erhöhen.');
          else if (k === 'alloy' && f.alloyOut <= 0) w.push('Der Abstieg braucht ' + F.num(need[k]) + ' Legierung – baue einen Reaktor und eine Schmelze.');
        });
        const full = !s.station.cells.some((c, i) => !c && E.cellActive(s, i));
        const roomHint = full ? ' Das Raster ist voll – reiß ein Modul ab, um Platz zu schaffen (50 % Erstattung).' : '';
        if (need.crystal && s.res.crystal < need.crystal && f.crystalOut <= 0) {
          w.push(s.depth >= 3 ? 'Der Abstieg braucht ' + F.num(need.crystal) + ' Kristalle – dafür brauchst du eine Fertigung.' + roomHint : 'Für spätere Abstiege brauchst du Kristalle (Fertigung ab dem Abyssal).');
        }
        if (need.data && s.res.data < need.data && (r.data || 0) <= 0 && s.depth >= 2) w.push('Der Abstieg braucht ' + F.num(need.data) + ' Daten – baue Sonarbojen oder ein Sonarlabor.' + roomHint);
      }
      setHTML(warn, w.map((x) => '<div class="warn-line">' + icon('bolt') + x + '</div>').join(''));
      const anyOn = s.station.cells.some((c) => c && (c.t === 'smelter' || c.t === 'foundry') && c.on);
      const anyProc = s.station.cells.some((c) => c && (c.t === 'smelter' || c.t === 'foundry'));
      setHidden(pauseBtn, !anyProc);
      setHTML(pauseBtn, icon(anyOn ? 'hold' : 'bolt') + (anyOn ? 'Verarbeitung pausieren' : 'Verarbeitung fortsetzen'));

      // Raster
      const g = E.gridSize(s);
      const visC = Math.min(MAXC, g.cols + 1), visR = Math.min(C.GRID.maxRows, g.rows + 1);
      const tpl = 'repeat(' + visC + ', minmax(0, 116px))';
      if (grid.style.gridTemplateColumns !== tpl) grid.style.gridTemplateColumns = tpl;
      const selNb = selected >= 0 ? E.neighbors(s, selected) : [];
      cells.forEach((b, i) => {
        const active = E.cellActive(s, i);
        const inRange = (i % MAXC) < visC && Math.floor(i / MAXC) < visR;
        setHidden(b, !inRange);
        const c = s.station.cells[i];
        let cls = 'st-cell';
        if (!active) cls += ' locked';
        else if (!c) cls += ' empty';
        else cls += ' mod mod-' + c.t + (c.on ? '' : ' off');
        if (i === selected) cls += ' sel';
        if (selNb.indexOf(i) >= 0) cls += ' nb';
        if (moveFrom >= 0) cls += ' movetarget';
        if (b.className !== cls) b.className = cls;
        let html;
        if (!active) html = icon('lock');
        else if (!c) html = '<span class="st-plus">+</span>';
        else html = '<span class="st-ic">' + icon(c.t) + '</span><span class="st-name">' + C.MODULE_BY_ID[c.t].name + '</span><span class="st-lvl">St. ' + c.lvl + '</span><span class="st-stat">' + moduleStatus(s, c, f.info[i], f) + '</span>';
        setHTML(b, html);
        b.setAttribute('aria-label', !active ? 'Gesperrtes Feld' : !c ? 'Leeres Feld – bauen' : C.MODULE_BY_ID[c.t].name + ' Stufe ' + c.lvl + (c.on ? '' : ', ausgeschaltet'));
      });
      renderDetail(s, f);
    }
    return { update };
  };
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
