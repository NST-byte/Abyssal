/* UI-Bereich: Tiefseekarte (U-Boote, Sektoren, Außenposten, Relikte) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, F = AB.Format, UI = AB.UI;
  const { h, setText, setHTML, setHTMLThrottled, setHidden, setClass, setDisabled, costHTML, missingText, panelTop, icon } = UI.lib;
  const st = () => AB.Game.state;
  const act = (...a) => AB.Game.act(...a);
  const SICON = { ore: 'ore', vent: 'vent2', grotto: 'grotto', ruin: 'ruin', nest: 'nest', wreck: 'wreck' };

  function exploitText(s, sec) {
    const ex = C.SECTOR_BY_ID[sec.type].exploit;
    const zf = 1 + 0.5 * (sec.zone - 1);
    const out = [];
    if (ex.manganPct) out.push('Mangan +' + F.pct(ex.manganPct * zf));
    if (ex.lumenPct) out.push('Lumen +' + F.pct(ex.lumenPct * zf));
    if (ex.dataPct) out.push('Daten +' + F.pct(ex.dataPct * zf));
    if (ex.crystalPct) out.push('Kristalle +' + F.pct(ex.crystalPct * zf));
    if (ex.energy) out.push('+' + ex.energy * sec.zone + ' Energie');
    if (ex.subSpeedPct) out.push('U-Boote +' + F.pct(ex.subSpeedPct * zf));
    return out.join(', ');
  }

  UI.BUILDERS.map = function (el) {
    el.appendChild(panelTop('Tiefseekarte', 'Schicke U-Boote in unbekannte Sektoren. Nach der Rückkehr entscheidest du: <b>Ausbeuten</b> belegt einen Außenposten und bringt bis zur nächsten Gezeitenwende einen Dauerbonus – <b>Bergen</b> bringt sofort Ressourcen (und vielleicht ein Relikt), danach ist der Sektor erschöpft.'));
    const head = h('div', { class: 'map-head' });
    const subBtn = h('button', { class: 'btn', type: 'button', onclick: () => act(AB.Actions.buildSub, [], { sound: 'buy', toastOk: ['U-Boot gebaut', 'Ein weiteres Boot ist einsatzbereit.'] }) });
    const lockNote = h('div', { class: 'lock-note' });
    el.append(head, h('div', { class: 'btn-row' }, subBtn), lockNote);
    const mapGrid = h('div', { class: 'map-grid' });
    const detail = h('div', { class: 'map-detail' });
    el.append(h('div', { class: 'map-layout' }, mapGrid, detail));
    const relicTitle = h('h3', { class: 'section-title', html: icon('star') + 'Relikte – dauerhafte Sammlung' });
    const relicGrid = h('div', { class: 'relic-grid' });
    el.append(relicTitle, relicGrid);

    let selected = -1;
    const rows = {};
    const secBtns = [];
    C.MAP.zones.forEach((z) => {
      const row = h('div', { class: 'map-row' }, h('div', { class: 'map-zone' }, h('b', { text: C.DEPTHS[z].name }), h('span', { class: 'muted small', text: C.DEPTHS[z].meters.toLocaleString('de-DE') + ' m' })));
      rows[z] = row;
      mapGrid.appendChild(row);
    });
    st().map.sectors.forEach((sec, i) => {
      const b = h('button', { class: 'sec', type: 'button', onclick: () => { selected = i; update(); } });
      rows[sec.zone].appendChild(b);
      secBtns.push(b);
    });

    detail.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || selected < 0) return;
      const a = b.dataset.act;
      if (a === 'scan') act(AB.Actions.scanSector, [selected], { sound: 'buy' });
      else if (a === 'exploit') act(AB.Actions.exploitSector, [selected], { sound: 'unlock' });
      else if (a === 'salvage') {
        const r = act(AB.Actions.salvageSector, [selected], { sound: 'buy' });
        if (r && r.ok) {
          const parts = Object.keys(r.gain).map((k) => '+' + F.num(r.gain[k]) + ' ' + C.RESOURCES[k].name);
          if (r.relic) { AB.Audio.play('unlock'); UI.modal({ title: 'Relikt gefunden!', icon: 'star', body: '<p><b>' + C.RELIC_BY_ID[r.relic].name + '</b> – jetzt Stufe ' + st().relics[r.relic] + '.</p><p>' + C.RELIC_BY_ID[r.relic].desc + '</p><p class="muted small">Relikte bleiben über alle Wenden erhalten.</p>' }); }
          UI.toast('Geborgen', parts.join(', ') || 'Nichts Verwertbares.', 'mission');
        }
      } else if (a === 'abandon') {
        UI.modal({ title: 'Außenposten aufgeben?', icon: 'map', body: '<p>Der Bonus endet sofort und der Sektor ist danach erschöpft. Der Außenposten wird frei.</p>',
          buttons: [{ label: 'Abbrechen' }, { label: 'Aufgeben', danger: true, onClick: () => act(AB.Actions.abandonSector, [selected], { sound: 'deny' }) }] });
      }
      update();
    });

    function update() {
      const s = st();
      const locked = E.mapLocked(s);
      setHidden(lockNote, !locked);
      if (locked) setHTML(lockNote, icon('lock') + (s.probe && s.probe.id === 'lonely' ? ' Tiefenprobe „Einsiedler“: Die Karte ist in diesem Lauf gesperrt.' : ' Die Karte öffnet sich im Abyssal.'));
      const busy = E.subsBusy(s), total = E.subsTotal(s);
      setHTML(head, '<div class="map-stat">' + icon('sub') + '<span>U-Boote</span><b>' + (total - busy) + ' / ' + total + ' frei</b></div>' +
        '<div class="map-stat">' + icon('map') + '<span>Außenposten</span><b>' + E.outpostsUsed(s) + ' / ' + E.outpostsMax(s) + '</b></div>' +
        '<div class="map-stat">' + icon('compass') + '<span>Tauchgeschwindigkeit</span><b>' + F.mult(E.subSpeed(s)) + '</b></div>' +
        '<div class="map-stat">' + icon('dock') + '<span>Dockplätze</span><b>' + s.map.subs + ' / ' + E.subCapacity(s) + ' belegt</b></div>');
      const cost = E.subCost(s);
      const cap = s.map.subs < E.subCapacity(s);
      setHTML(subBtn, icon('sub') + 'U-Boot bauen ' + costHTML(cost));
      setDisabled(subBtn, locked || !cap || !E.canAfford(s, cost));
      subBtn.title = !cap ? 'Kein freier Dockplatz – baue ein U-Boot-Dock in der Station oder verbessere es.' : '';
      // Sektoren
      s.map.sectors.forEach((sec, i) => {
        const b = secBtns[i];
        const reachable = sec.zone <= s.depth;
        let cls = 'sec s-' + sec.state + (reachable ? '' : ' far') + (i === selected ? ' sel' : '');
        const known = sec.state !== 'unknown' && sec.state !== 'scanning';
        const T = C.SECTOR_BY_ID[sec.type];
        let html;
        if (sec.state === 'scanning') {
          const m = s.map.missions.find((x) => x.sector === i);
          const p = m ? 1 - Math.max(0, m.endsAt - s.time) / m.duration : 0;
          html = icon('sub') + '<span class="sec-name">' + (m ? F.clock(m.endsAt - s.time) : '…') + '</span><span class="sec-bar" style="width:' + (p * 100).toFixed(0) + '%"></span>';
        } else if (!known) html = icon('question') + '<span class="sec-name">' + (reachable ? 'Unbekannt' : 'Zu tief') + '</span>';
        else html = icon(SICON[sec.type]) + '<span class="sec-name">' + T.name + '</span>' + (sec.state === 'exploited' ? '<span class="sec-badge">Außenposten</span>' : sec.state === 'depleted' ? '<span class="sec-badge dim">erschöpft</span>' : '');
        if (sec.state === 'revealed') cls += ' decide';
        if (b.className !== cls) b.className = cls;
        setHTML(b, html);
        b.setAttribute('aria-label', 'Sektor ' + C.DEPTHS[sec.zone].name + ': ' + (known ? T.name + ', ' + sec.state : sec.state === 'scanning' ? 'wird erkundet' : 'unbekannt'));
      });
      renderDetail(s, locked);
      // Relikte
      setHTMLThrottled(relicGrid, C.RELICS.map((r) => {
        const lvl = s.relics[r.id] || 0;
        return '<div class="relic' + (lvl ? ' found' : '') + '" title="' + r.desc + '"><span class="relic-icon">' + icon('star') + '</span><b>' + (lvl ? r.name : '???') + '</b><span class="relic-lvl">' + lvl + ' / ' + r.max + '</span>' +
          '<span class="muted small">' + (lvl ? r.desc : 'Zu finden ab ' + C.DEPTHS[r.minZone].name) + '</span></div>';
      }).join(''), C.RELICS.map((r) => s.relics[r.id] || 0).join());
    }

    function renderDetail(s, locked) {
      const sec = s.map.sectors[selected];
      const key = selected + '|' + (sec ? sec.state : '-') + '|' + locked;
      const set = (html) => setHTMLThrottled(detail, html, key, 1000);
      if (!sec) { set('<p class="muted">Wähle einen Sektor.</p><p class="muted small">Tiefere Zonen dauern länger und kosten mehr, ihre Boni und Bergungen sind aber stärker (+50 % pro Zone). Kristallnester gibt es erst ab dem Abyssal.</p>'); return; }
      const T = C.SECTOR_BY_ID[sec.type];
      const head = '<h3>' + C.DEPTHS[sec.zone].name + ' – Sektor</h3>';
      if (sec.state === 'unknown') {
        const cost = E.scanCost(s, sec.zone);
        const reach = sec.zone <= s.depth;
        const free = E.subsBusy(s) < E.subsTotal(s);
        const ok = !locked && reach && free && E.canAfford(s, cost);
        set(head + '<p>Unerforscht. Dauer: <b>' + F.time(E.scanDuration(s, sec.zone)) + '</b>, Kosten: ' + costHTML(cost) + '</p>' +
          '<button class="btn btn-primary" type="button" data-act="scan" aria-disabled="' + !ok + '">' + icon('sub') + 'U-Boot entsenden</button>' +
          (!reach ? '<p class="card-hint">Erst ' + C.DEPTHS[sec.zone].name + ' erreichen.</p>' : !free ? '<p class="card-hint">Alle U-Boote sind unterwegs.</p>' : !E.canAfford(s, cost) ? '<p class="card-hint">' + missingText(cost) + '</p>' : ''));
      } else if (sec.state === 'scanning') {
        set(head + '<p>Ein U-Boot erkundet diesen Sektor. Läuft auch offline weiter.</p>');
      } else if (sec.state === 'revealed') {
        const rew = E.salvageReward(s, sec);
        const chance = E.relicChance(s, sec);
        const pool = E.availableRelics(s, sec.zone);
        const full = E.outpostsUsed(s) >= E.outpostsMax(s);
        set(head + '<p><b>' + icon(SICON[sec.type]) + T.name + '</b> – entscheide:</p><div class="decide-grid">' +
          '<div class="decide"><b>Ausbeuten</b><span>' + exploitText(s, sec) + '</span><span class="muted small">Dauerhaft bis zur Gezeitenwende. Belegt 1 Außenposten (' + E.outpostsUsed(s) + '/' + E.outpostsMax(s) + ').</span>' +
          '<button class="btn btn-primary" type="button" data-act="exploit" aria-disabled="' + full + '">Außenposten errichten</button>' + (full ? '<span class="card-hint">Alle Außenposten belegt – gib einen anderen auf.</span>' : '') + '</div>' +
          '<div class="decide"><b>Bergen</b><span>' + (Object.keys(rew).map((k) => costHTML({ [k]: rew[k] })).join(' ') || '–') + '</span>' +
          (chance > 0 ? '<span class="small">Relikt-Chance: <b>' + Math.round(chance * 100) + ' %</b>' + (pool.length ? ' (gleich verteilt aus ' + pool.length + ' möglichen)' : ' – alle Relikte dieser Zone voll, stattdessen Kristalle') + '</span>' : '') +
          '<span class="muted small">Sofort. Danach ist der Sektor erschöpft.</span><button class="btn" type="button" data-act="salvage">Bergen</button></div></div>');
      } else if (sec.state === 'exploited') {
        set(head + '<p><b>' + icon(SICON[sec.type]) + T.name + '</b> – Außenposten aktiv: ' + exploitText(s, sec) + '</p><button class="btn btn-danger" type="button" data-act="abandon">Aufgeben</button>');
      } else {
        set(head + '<p class="muted">' + T.name + ' – erschöpft. Mit der nächsten Gezeitenwende entsteht eine neue Karte.</p>');
      }
    }
    return { update };
  };
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
