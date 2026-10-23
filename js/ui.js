/* Benutzeroberfläche – Kern: gemeinsame Bausteine, Layout, Navigation,
   Ressourcenleiste, linke Spalte (Kern, Strömung, Aufträge), Modals, Toasts,
   Einstellungen. Die einzelnen Bereiche liegen in ui-*.js und registrieren
   sich über UI.BUILDERS. Liest nur aus dem Spielzustand; Aktionen laufen
   über AB.Game.act(). */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format;
  const UI = { BUILDERS: {} };
  const st = () => AB.Game.state;
  const icon = AB.icon;

  // ---- DOM-Helfer -----------------------------------------------------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function setText(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  function setHTML(el, t) { if (el._h !== t) { el._h = t; el.innerHTML = t; } }
  // Für HTML mit Buttons: sofort bei Strukturänderung (key), sonst höchstens alle ms neu zeichnen,
  // damit Klicks nicht verloren gehen, während Zahlen sich ändern.
  function setHTMLThrottled(el, html, key, ms) {
    const now = Date.now();
    if (el._key === key && el._h === html) return;
    if (el._key === key && now - (el._ht || 0) < (ms || 1000)) return;
    el._key = key; el._ht = now; el._h = html; el.innerHTML = html;
  }
  function setHidden(el, hid) { if (el.hidden !== hid) el.hidden = hid; }
  function setClass(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
  function setDisabled(el, dis) { const v = String(!!dis); if (el.getAttribute('aria-disabled') !== v) el.setAttribute('aria-disabled', v); }

  const RES = C.RESOURCES;
  const have = (s, k) => (k === 'perlen' ? s.perlen : k === 'urlicht' ? s.world.urlicht : s.res[k] || 0);

  // Netto-Raten werden einmal pro Render berechnet
  let rateCache = { t: -1, r: null };
  function rates() {
    const s = st();
    if (rateCache.t !== s.time || rateCache.s !== s) rateCache = { t: s.time, s, r: E.netRates(s) };
    return rateCache.r;
  }

  function costHTML(cost) {
    const s = st();
    return Object.keys(cost).map((k) => {
      const ok = have(s, k) >= cost[k] - 1e-9;
      return '<span class="cost cost-' + k + (ok ? ' ok' : ' no') + '">' + icon(RES[k].icon) + F.num(cost[k]) + '</span>';
    }).join('');
  }

  // Erklärt, warum etwas (noch) nicht bezahlbar ist – inkl. Wartezeit
  function missingText(cost) {
    const s = st();
    const r = rates();
    const parts = [];
    let wait = 0;
    for (const k in cost) {
      const hv = have(s, k);
      if (hv < cost[k] - 1e-9) {
        const miss = cost[k] - hv;
        parts.push(F.num(miss) + ' ' + RES[k].name);
        const rate = r[k] || 0;
        wait = Math.max(wait, rate > 0 ? miss / rate : Infinity);
      }
    }
    if (!parts.length) return '';
    return 'Fehlen ' + parts.join(', ') + (isFinite(wait) && wait > 0 ? ' · ≈ ' + F.time(wait) : wait === Infinity ? ' · keine Produktion' : '');
  }

  // ---- Toasts ---------------------------------------------------------------
  UI.toast = function (title, text, kind) {
    const root = document.getElementById('toasts');
    const t = h('div', { class: 'toast' + (kind ? ' t-' + kind : ''), role: 'status' },
      h('div', { class: 'toast-title', text: title }), text ? h('div', { class: 'toast-text', html: text }) : null);
    root.appendChild(t);
    while (root.children.length > 5) root.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'big' ? 6000 : 4200);
  };

  // ---- Modals ---------------------------------------------------------------
  let modalStack = [];
  UI.modal = function (opts) {
    const root = document.getElementById('modal-root');
    const prevFocus = document.activeElement;
    const close = () => {
      wrap.remove();
      modalStack = modalStack.filter((m) => m !== entry);
      if (opts.onClose) opts.onClose();
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
    };
    const btns = (opts.buttons || [{ label: 'Schließen', primary: true }]).map((b) =>
      h('button', { class: 'btn ' + (b.primary ? 'btn-primary' : '') + (b.danger ? ' btn-danger' : '') + (b.pearl ? ' btn-pearl' : ''), type: 'button',
        onclick: () => { const r = b.onClick ? b.onClick() : undefined; if (r !== false && b.close !== false) close(); } }, b.label));
    const body = typeof opts.body === 'string' ? h('div', { class: 'modal-body', html: opts.body }) : h('div', { class: 'modal-body' }, opts.body);
    const dlg = h('div', { class: 'modal ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
      h('div', { class: 'modal-head' }, opts.icon ? h('span', { class: 'modal-icon', html: icon(opts.icon) }) : null, h('h2', { text: opts.title }),
        opts.dismissible === false ? null : h('button', { class: 'icon-btn modal-x', type: 'button', 'aria-label': 'Schließen', onclick: close, html: '×' })),
      body, h('div', { class: 'modal-foot' }, btns));
    const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap && opts.dismissible !== false) close(); } }, dlg);
    root.appendChild(wrap);
    const entry = { close, dismissible: opts.dismissible !== false, el: dlg, buttons: btns };
    modalStack.push(entry);
    setTimeout(() => { const f = dlg.querySelector('[autofocus]') || btns[btns.length - 1]; f && f.focus(); }, 30);
    return entry;
  };
  UI.closeTopModal = function () {
    const m = modalStack[modalStack.length - 1];
    if (m && m.dismissible) { m.close(); return true; }
    return false;
  };
  UI.modalOpen = () => modalStack.length > 0;

  // ---- Navigation -----------------------------------------------------------
  const refs = {};
  let activeTab = 'build';
  const panels = {};

  const TABS = [
    { id: 'build', label: 'Produktion', icon: 'plankton', vis: () => true },
    { id: 'upgrades', label: 'Verbesserungen', icon: 'star', vis: (f) => f.upgrades },
    { id: 'reinforce', label: 'Verstärkung', icon: 'shield', vis: (f) => f.reinforce },
    { id: 'station', label: 'Station', icon: 'station', vis: (f) => f.station },
    { id: 'research', label: 'Forschung', icon: 'flask', vis: (f) => f.research },
    { id: 'map', label: 'Karte', icon: 'map', vis: (f) => f.map },
    { id: 'descent', label: 'Abstieg', icon: 'down', vis: (f, s) => s.stats.lumenAll >= 1000 || s.depth > 0 || s.prestige.total > 0 },
    { id: 'tides', label: 'Gezeiten', icon: 'perlen', vis: (f) => f.prestigeTab },
    { id: 'origin', label: 'Ursprung', icon: 'urlicht', vis: (f) => f.origin },
    { id: 'goals', label: 'Ziele', icon: 'target', vis: () => true },
  ];
  UI.TABS = TABS;

  UI.init = function () {
    const resBar = document.getElementById('resources');
    refs.res = {};
    Object.keys(RES).forEach((k) => {
      const amount = h('span', { class: 'res-amount' });
      const rate = h('span', { class: 'res-rate' });
      const chip = h('div', { class: 'res res-' + k },
        h('span', { class: 'res-icon', html: icon(RES[k].icon) }),
        h('div', { class: 'res-text' }, h('span', { class: 'res-name', text: RES[k].name }), amount, rate));
      resBar.appendChild(chip);
      refs.res[k] = { chip, amount, rate };
    });

    document.getElementById('btn-settings').innerHTML = icon('gear');
    document.getElementById('btn-save').innerHTML = icon('save');
    document.getElementById('btn-settings').addEventListener('click', () => UI.openSettings());
    document.getElementById('btn-save').addEventListener('click', () => AB.Game.saveNow(true));

    refs.orb = document.getElementById('orb');
    refs.orb.addEventListener('click', (e) => AB.Game.pulse(e));
    refs.clickVal = document.getElementById('click-value');
    refs.lpsVal = document.getElementById('lps-value');
    refs.depthLabel = document.getElementById('depth-label');
    refs.depthMeters = document.getElementById('depth-meters');
    refs.depthBar = document.getElementById('depth-bar');
    refs.buffs = document.getElementById('buffs');
    refs.ability = document.getElementById('ability-btn');
    refs.ability.addEventListener('click', () => AB.Game.act(AB.Actions.useAbility, [], { sound: 'unlock', toastOk: ['Überladung aktiv', 'Produktion erhöht.'] }));
    refs.missions = document.getElementById('missions');
    refs.probeBox = document.getElementById('probe-box');

    // Strömungs-Anzeige
    refs.current = document.getElementById('current-box');
    refs.curName = h('div', { class: 'cur-name' });
    refs.curDesc = h('div', { class: 'cur-desc' });
    refs.curTime = h('span', { class: 'cur-time' });
    refs.curNext = h('div', { class: 'cur-next' });
    refs.curHold = h('button', { class: 'btn cur-hold', type: 'button', onclick: () => AB.Game.act(AB.Actions.holdCurrent, [], { sound: 'unlock', toastOk: ['Strömung gehalten', 'Sie läuft eine Periode länger.'] }) });
    refs.current.appendChild(h('div', { class: 'cur-head' }, h('span', { class: 'cur-icon', html: icon('wave') }), h('span', { class: 'cur-label', text: 'Strömung' }), refs.curTime));
    refs.current.append(refs.curName, refs.curDesc, refs.curNext, refs.curHold);

    C.DEPTHS.forEach((d) => refs.depthBar.appendChild(h('div', { class: 'depth-seg', title: d.name + ' – ' + d.meters.toLocaleString('de-DE') + ' m' })));
    refs.depthBar.style.gridTemplateColumns = 'repeat(' + C.DEPTHS.length + ', 1fr)';

    const nav = document.getElementById('tabs');
    refs.tabs = {};
    TABS.forEach((t, i) => {
      const key = String((i + 1) % 10);
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', id: 'tab-' + t.id, 'aria-controls': 'panel-' + t.id, 'data-key': key,
        title: t.label + ' (Taste ' + key + ')', onclick: () => UI.showTab(t.id) },
        h('span', { class: 'tab-icon', html: icon(t.icon) }), h('span', { class: 'tab-label', text: t.label }), h('span', { class: 'tab-badge' }));
      nav.appendChild(b);
      refs.tabs[t.id] = b;
    });
    const body = document.getElementById('tab-body');
    TABS.forEach((t) => {
      const el = h('div', { class: 'panel-body panel-' + t.id, id: 'panel-' + t.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.id, hidden: true });
      body.appendChild(el);
      panels[t.id] = { el, built: false, api: null };
    });
    UI.showTab('build');
  };

  UI.showTab = function (id) {
    if (!panels[id]) return;
    activeTab = id;
    for (const t of TABS) {
      const on = t.id === id;
      setClass(refs.tabs[t.id], 'active', on);
      refs.tabs[t.id].setAttribute('aria-selected', String(on));
      setHidden(panels[t.id].el, !on);
    }
    const p = panels[id];
    if (!p.built) { p.api = UI.BUILDERS[id](p.el); p.built = true; }
    p.api.update();
  };
  UI.activeTab = () => activeTab;

  // Panels neu aufbauen (nach Gezeitenwende, Import, Weltenwende)
  UI.rebuild = function () {
    for (const id in panels) { panels[id].el.innerHTML = ''; panels[id].built = false; }
    refs.missions._key = null;
    const f = U.features(st());
    const t = TABS.find((x) => x.id === activeTab);
    UI.showTab(t && t.vis(f, st()) ? activeTab : 'build');
  };

  // ---- Laufende Aktualisierung ---------------------------------------------
  UI.render = function () {
    const s = st();
    const f = U.features(s);
    const r = rates();
    const shown = { lumen: true, mangan: f.mangan, data: f.data, alloy: f.alloy, crystal: f.crystal, perlen: f.perlen, urlicht: f.origin };
    for (const k in RES) {
      const x = refs.res[k];
      setHidden(x.chip, !shown[k]);
      if (!shown[k]) continue;
      setText(x.amount, F.num(have(s, k)));
      if (k === 'perlen') { setText(x.rate, F.mult(E.perlenMult(s)) + ' Prod.'); x.chip.title = 'Perlen: Währung des Gezeiten-Baums. Jede in diesem Zyklus verdiente Perle erhöht die Produktion (logarithmisch).'; }
      else if (k === 'urlicht') { setText(x.rate, s.world.count + ' Weltenwenden'); x.chip.title = 'Urlicht: Währung des Ursprungs (2. Prestige-Ebene).'; }
      else {
        const v = r[k] || 0;
        setText(x.rate, (v >= 0 ? '+' : '−') + F.rate(Math.abs(v)) + '/s');
        setClass(x.rate, 'neg', v < -1e-9);
        x.chip.title = RES[k].name + ': netto ' + (v >= 0 ? '+' : '−') + F.rate(Math.abs(v)) + '/s (Produktion minus Verbrauch der Station)';
      }
    }
    const cv = E.clickValue(s);
    setText(refs.clickVal, s.probe && s.probe.id === 'silent' ? 'gesperrt' : '+' + F.num(cv, { small: true }));
    setText(refs.lpsVal, F.rate(E.lps(s)));
    const d = C.DEPTHS[s.depth];
    setText(refs.depthLabel, d.name);
    setText(refs.depthMeters, (d.meters + (s.depth >= C.RECORD.depth ? s.record * C.RECORD.metersPer : 0)).toLocaleString('de-DE') + ' m');
    document.body.setAttribute('data-depth', String(s.depth));
    document.body.setAttribute('data-zone', String(s.depth));
    Array.from(refs.depthBar.children).forEach((seg, i) => { setClass(seg, 'reached', i <= s.depth); setClass(seg, 'current', i === s.depth); });

    renderBuffs(s);
    renderAbility(s, f);
    renderCurrent(s, f);
    renderProbe(s);
    renderMissions(s);

    for (const t of TABS) {
      const vis = t.vis(f, s);
      setHidden(refs.tabs[t.id], !vis);
      const badge = vis && t.id !== activeTab ? tabBadge(t.id, s) : '';
      const bEl = refs.tabs[t.id].querySelector('.tab-badge');
      setText(bEl, badge);
      setClass(refs.tabs[t.id], 'has-badge', !!badge);
    }
    if (refs.tabs[activeTab].hidden) UI.showTab('build');
    const p = panels[activeTab];
    if (p.built) p.api.update();
  };

  function tabBadge(id, s) {
    if (id === 'upgrades') { const n = U.availableUpgrades(s).filter((u) => s.res.lumen >= u.cost).length; return n ? String(n) : ''; }
    if (id === 'descent') {
      const c = E.descentCost(s, s.depth + 1);
      if (c && E.depthAllowed(s, s.depth + 1) && E.canAfford(s, c)) return '!';
      return s.depth >= C.RECORD.depth && E.canAfford(s, E.recordCost(s)) ? '•' : '';
    }
    if (id === 'research') {
      const n = C.RESEARCH.filter((r) => U.researchState(s, r) === 'open' && s.res.data >= E.techCost(s, r)).length;
      return E.agg(s).protocolUnlock && s.protocols.length === 0 ? '!' : n ? String(n) : '';
    }
    if (id === 'station') {
      const nr = rates();
      if (s.depth >= 1 && !s.station.cells.some(Boolean)) return '!';
      const f = E.flows(s);
      if (f.eff < 0.999 || (f.alloyOut > 0 && nr.smelterFill < 0.95) || (f.crystalOut > 0 && nr.foundryFill < 0.95)) return '⚠';
      return '';
    }
    if (id === 'map') {
      if (E.mapLocked(s)) return '';
      if (s.map.sectors.some((x) => x.state === 'revealed')) return '!';
      return E.subsBusy(s) < E.subsTotal(s) && s.map.sectors.some((x) => x.state === 'unknown' && x.zone <= s.depth) ? '•' : '';
    }
    if (id === 'tides') {
      if (AB.Core.canPrestige(s)) return '!';
      return C.TREE.some((n) => U.treeState(s, n) === 'open' && s.perlen >= E.treeCost(s, n.id)) ? '•' : '';
    }
    if (id === 'origin') return AB.Core.canWorld(s) ? '!' : C.ORIGIN.some((o) => (s.world.origin[o.id] || 0) < o.max && s.world.urlicht >= E.originCost(s, o.id)) ? '•' : '';
    if (id === 'reinforce') return C.GENERATORS.some((g) => s.gens[g.id] > 0 && s.reinforce[g.id] < C.REINFORCE.maxLevel && E.canAfford(s, E.reinforceCost(s, g.id))) ? '•' : '';
    return '';
  }

  function renderBuffs(s) {
    const html = s.buffs.filter((b) => b.until > s.time).map((b) =>
      '<div class="buff buff-' + b.id + '">' + icon(b.id === 'overcharge' ? 'bolt' : 'star') + '<span>' + b.name + ' ×' + F.num(b.mult) + '</span><b>' + F.clock(b.until - s.time) + '</b></div>').join('');
    setHTML(refs.buffs, html);
  }

  function renderAbility(s, f) {
    setHidden(refs.ability, !f.ability);
    if (!f.ability) return;
    const ab = E.ability(s);
    const active = s.buffs.some((b) => b.id === 'overcharge' && b.until > s.time);
    setClass(refs.ability, 'ready', ab.readyIn <= 0);
    setDisabled(refs.ability, ab.readyIn > 0);
    const label = ab.readyIn > 0 ? (active ? 'Aktiv' : 'Lädt ' + F.clock(ab.readyIn)) : 'Bereit';
    setHTML(refs.ability, icon('bolt') + '<span class="ab-name">Überladung ×' + ab.mult + '</span><span class="ab-state">' + label + '</span>' +
      '<span class="ab-fill" style="width:' + (ab.readyIn > 0 ? (100 - ab.readyIn / ab.cooldown * 100).toFixed(1) : 100) + '%"></span>');
    refs.ability.title = 'Produktion ×' + ab.mult + ' für ' + Math.round(ab.duration) + ' s, Abklingzeit ' + F.time(ab.cooldown) + ' (Taste Q)' +
      (E.agg(s).abilityChains ? '. Beschleunigt auch Schmelzen und Fertigungen.' : '');
  }

  function renderCurrent(s, f) {
    const cur = s.current;
    setHidden(refs.current, !f.currents || !cur);
    if (!f.currents || !cur) return;
    const def = C.CURRENT_BY_ID[cur.type];
    setText(refs.curName, def.name);
    setText(refs.curDesc, def.desc + (E.agg(s).currentPower > 1.001 ? ' (Stärke ' + F.pct(E.agg(s).currentPower) + ')' : ''));
    setText(refs.curTime, F.clock(cur.endsAt - s.time));
    setHTML(refs.curNext, '<span class="muted">Danach:</span> ' + cur.queue.map((q) => '<span class="cur-chip" title="' + C.CURRENT_BY_ID[q].desc + '">' + C.CURRENT_BY_ID[q].name + '</span>').join('<span class="muted"> → </span>'));
    const canHold = E.agg(s).currentHold;
    setHidden(refs.curHold, !canHold);
    if (canHold) {
      const ready = cur.charge >= C.CURRENTS.holdRecharge;
      setHTML(refs.curHold, icon('hold') + (ready ? 'Halten (H)' : 'Lenkung lädt ' + cur.charge + '/' + C.CURRENTS.holdRecharge));
      setDisabled(refs.curHold, !ready);
    }
    refs.current.className = 'current-box panel cur-' + cur.type;
  }

  function renderProbe(s) {
    setHidden(refs.probeBox, !s.probe);
    if (!s.probe) return;
    const p = C.PROBE_BY_ID[s.probe.id];
    const goal = C.PROBES.goals[s.probe.level - 1];
    setHTML(refs.probeBox, '<div class="probe-head">' + icon('probe') + '<b>Tiefenprobe: ' + p.name + ' ' + s.probe.level + '/3</b></div><div class="muted small">' + p.rule +
      ' Ziel: ' + C.DEPTHS[goal].name + ' erreichen.</div><div class="bar"><div class="bar-fill" style="width:' + Math.min(100, s.depth / goal * 100).toFixed(0) + '%"></div></div>');
  }

  function rewardText(s, m) {
    const r = U.missionReward(s, m);
    return Object.keys(r).map((k) => '<span class="cost cost-' + k + '">' + icon(RES[k].icon) + F.num(r[k]) + '</span>').join(' ');
  }
  UI.partsText = function (s, cond) {
    return U.parts(s, cond).map((p) => p.bool ? p.label : p.label + ': ' + (p.big ? F.num(Math.min(p.cur, p.need)) + ' / ' + F.num(p.need) : Math.min(p.cur, p.need) + ' / ' + p.need)).join(' · ');
  };

  function renderMissions(s) {
    const list = U.activeMissions(s);
    const key = list.map((m) => m.id).join(',');
    if (refs.missions._key !== key) {
      refs.missions._key = key;
      refs.missions.innerHTML = '';
      refs.missionItems = list.map((m) => {
        const label = h('div', { class: 'mission-label' });
        const bar = h('div', { class: 'bar-fill' });
        const reward = h('div', { class: 'mission-reward' });
        const el = h('div', { class: 'mission' },
          h('div', { class: 'mission-head' }, h('span', { class: 'mission-name', text: m.name }), reward),
          label, h('div', { class: 'bar' }, bar));
        refs.missions.appendChild(el);
        return { m, label, bar, reward };
      });
      if (!list.length) refs.missions.appendChild(h('div', { class: 'muted', text: 'Alle Aufträge erledigt. Respekt.' }));
    }
    for (const it of refs.missionItems) {
      setText(it.label, UI.partsText(s, it.m.cond));
      it.bar.style.width = (U.progress(s, it.m.cond) * 100).toFixed(1) + '%';
      setHTML(it.reward, rewardText(s, it.m));
    }
  }

  // ---- Gemeinsame Bausteine für Panels --------------------------------------
  function buyAmountBar() {
    const wrap = h('div', { class: 'amount-bar', role: 'group', 'aria-label': 'Kaufmenge' });
    const btns = [[1, '×1'], [10, '×10'], [25, '×25'], [-1, 'Max']].map(([v, l]) => {
      const b = h('button', { class: 'chip', type: 'button', onclick: () => { st().settings.buyAmount = v; } }, l);
      b._v = v; wrap.appendChild(b); return b;
    });
    return { el: wrap, update: () => btns.forEach((b) => { const on = st().settings.buyAmount === b._v; setClass(b, 'active', on); b.setAttribute('aria-pressed', String(on)); }) };
  }
  function amountFor(maxFn) {
    const a = st().settings.buyAmount;
    if (a === -1) return Math.max(1, maxFn());
    return a;
  }
  function buyCard(opts) {
    const count = h('span', { class: 'count' });
    const stats = h('div', { class: 'card-stats' });
    const btnLabel = h('span', { class: 'buy-label' });
    const btnCost = h('span', { class: 'buy-cost' });
    const btnGain = h('span', { class: 'buy-gain' });
    const btn = h('button', { class: 'buy', type: 'button', onclick: opts.onBuy }, btnLabel, btnCost, btnGain);
    const hint = h('div', { class: 'card-hint' });
    const desc = h('div', { class: 'card-desc', text: opts.desc || '' });
    const root = h('div', { class: 'card ' + (opts.cls || '') },
      h('div', { class: 'card-icon', html: icon(opts.icon) }),
      h('div', { class: 'card-main' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-name', text: opts.name }), count),
        desc, stats),
      h('div', { class: 'card-side' }, btn, hint));
    return { root, count, stats, btn, btnLabel, btnCost, btnGain, hint, desc };
  }
  function updateBuy(c, label, cost, gainText, extraReason) {
    const ok = E.canAfford(st(), cost) && !extraReason;
    setText(c.btnLabel, label);
    setHTML(c.btnCost, costHTML(cost));
    setText(c.btnGain, gainText || '');
    setDisabled(c.btn, !ok);
    setClass(c.root, 'affordable', ok);
    setText(c.hint, ok ? '' : (extraReason || missingText(cost)));
  }
  function panelTop(title, text, right) {
    return h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: title }), text ? h('p', { class: 'muted', html: text }) : null), right || null);
  }

  // ---- Baum-Darstellung (Tech-Baum & Gezeiten-Baum) -------------------------
  // nodes: [{id, x, y, req, group, capstone}], opts.state(n) -> Klasse,
  // opts.label(n) -> {title, sub}, opts.onClick(n), opts.detail(n) -> HTML
  function treeView(nodes, opts) {
    const maxX = Math.max(...nodes.map((n) => n.x)) + 1;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 1;
    const rowH = opts.rowH || 104;
    const H = maxY * rowH;
    const wrap = h('div', { class: 'tree-wrap' });
    const canvas = h('div', { class: 'tree', style: 'height:' + H + 'px;min-width:' + (opts.minWidth || 640) + 'px' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'tree-lines');
    svg.setAttribute('viewBox', '0 0 100 ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    canvas.appendChild(svg);
    const pos = {};
    nodes.forEach((n) => { pos[n.id] = { x: (n.x + 0.5) / maxX * 100, y: n.y * rowH + rowH / 2 }; });
    const lines = [];
    nodes.forEach((n) => {
      (n.req || []).forEach((r) => {
        (Array.isArray(r) ? r : [r]).forEach((pid) => {
          if (!pos[pid]) return;
          const l = document.createElementNS(svgNS, 'path');
          const a = pos[pid], b = pos[n.id];
          const my = (a.y + b.y) / 2;
          l.setAttribute('d', 'M' + a.x + ' ' + (a.y + 26) + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + (b.y - 26));
          l.setAttribute('class', 'tree-line' + (Array.isArray(r) ? ' any' : ''));
          l.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(l);
          lines.push({ el: l, from: pid, to: n.id });
        });
      });
    });
    const detail = h('div', { class: 'tree-detail', 'aria-live': 'polite' });
    let selected = null;
    const btns = nodes.map((n) => {
      const title = h('span', { class: 'tn-title' });
      const sub = h('span', { class: 'tn-sub' });
      const b = h('button', { class: 'tn' + (n.group ? ' fork' : '') + (n.capstone ? ' capstone' : ''), type: 'button',
        style: 'left:' + pos[n.id].x + '%;top:' + pos[n.id].y + 'px;width:calc(' + (100 / maxX).toFixed(3) + '% - 10px)',
        onclick: () => { selected = n; opts.onClick(n); update(); },
        onmouseenter: () => { selected = n; update(); }, onfocus: () => { selected = n; update(); } }, title, sub);
      if (n.group) b.appendChild(h('span', { class: 'tn-fork', title: 'Gabelung: nur eine Seite aktiv', text: '⑂' }));
      canvas.appendChild(b);
      return { n, b, title, sub };
    });
    wrap.appendChild(canvas);
    function update() {
      const stateOf = {};
      btns.forEach((x) => {
        const s = opts.state(x.n);
        stateOf[x.n.id] = s;
        x.b.className = 'tn tn-' + s + (x.n.group ? ' fork' : '') + (x.n.capstone ? ' capstone' : '') + (selected === x.n ? ' sel' : '');
        const lab = opts.label(x.n);
        setText(x.title, lab.title);
        setHTML(x.sub, lab.sub);
        x.b.setAttribute('aria-label', lab.title + ' – ' + lab.aria);
      });
      lines.forEach((l) => setClass(l.el, 'on', /done|max|part/.test(stateOf[l.from] || '')));
      setHTML(detail, selected ? opts.detail(selected) : '<span class="muted">Fahre über einen Knoten oder tippe ihn an, um Details zu sehen.</span>');
    }
    return { el: wrap, detail, update };
  }

  UI.lib = { h, setText, setHTML, setHTMLThrottled, setHidden, setClass, setDisabled, costHTML, missingText, buyCard, updateBuy, amountFor, buyAmountBar, panelTop, treeView, rates, have, icon };

  // ---- Einstellungen --------------------------------------------------------
  UI.openSettings = function () {
    const s = st();
    const G = AB.Game;
    const a = E.agg(s);
    const exportArea = h('textarea', { class: 'io', readonly: true, rows: 3, 'aria-label': 'Export-Text' });
    const importArea = h('textarea', { class: 'io', rows: 3, placeholder: 'Spielstand-Text hier einfügen (ABYSSAL1:…)', 'aria-label': 'Import-Text' });
    const msg = h('div', { class: 'io-msg', role: 'status' });
    const fileIn = h('input', { type: 'file', accept: '.txt,.json,text/plain', class: 'visually-hidden', id: 'import-file' });
    fileIn.addEventListener('change', () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      if (f.size > 2e6) { msg.textContent = 'Datei ist zu groß.'; return; }
      const r = new FileReader();
      r.onload = () => { importArea.value = String(r.result || ''); msg.textContent = 'Datei geladen – jetzt „Importieren“ klicken.'; };
      r.readAsText(f);
    });
    const row = (label, control, note) => h('div', { class: 'set-row' }, h('div', {}, h('div', { class: 'set-label', text: label }), note ? h('div', { class: 'muted small', text: note }) : null), control);
    const toggle = (val, fn) => { const i = h('input', { type: 'checkbox', class: 'switch' }); i.checked = val; i.addEventListener('change', () => fn(i.checked)); return i; };
    const fmt = h('select', { 'aria-label': 'Zahlenformat' },
      ...[['short', 'Kurz (1,23 M)'], ['sci', 'Wissenschaftlich (1,23e6)'], ['eng', 'Ingenieur (1,23e6, Dreierschritte)']].map(([v, l]) => { const o = h('option', { value: v, text: l }); if (s.settings.numberFormat === v) o.selected = true; return o; }));
    fmt.addEventListener('change', () => { s.settings.numberFormat = fmt.value; F.mode = fmt.value; });
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.settings.volume, 'aria-label': 'Lautstärke' });
    vol.addEventListener('input', () => { s.settings.volume = Number(vol.value); AB.Audio.setVolume(s.settings.volume); });
    const autos = [
      ['autobuy', a.autobuy, 'Anlagen automatisch kaufen', 'Kauft jede Sekunde die günstigste bezahlbare Anlage.'],
      ['autoUpgrades', a.autoUpgrades, 'Verbesserungen automatisch kaufen', ''],
      ['autoReinforce', a.autoReinforce, 'Verstärkungen automatisch kaufen', 'Nutzt nur Mangan-Überschuss (max. 25 % des Bestands pro Kauf).'],
      ['autoResearch', a.autoResearch, 'Automatisch forschen', 'Forscht den günstigsten offenen Knoten. Gabelungen werden nie umgeworfen.'],
      ['autoDescend', a.autoDescend, 'Automatisch abtauchen', 'Taucht ab, sobald der nächste Abstieg bezahlbar ist.'],
    ].filter((x) => x[1]);

    const body = h('div', { class: 'settings' },
      h('h3', { text: 'Darstellung' }),
      row('Animationen reduzieren', toggle(s.settings.reducedMotion, (v) => { s.settings.reducedMotion = v; G.applySettings(); }), 'Stoppt Hintergrund-Bewegung, Partikel und Pulse-Effekte.'),
      row('Zahlenformat', fmt),
      h('h3', { text: 'Sound' }),
      row('Soundeffekte', toggle(s.settings.sound, (v) => { s.settings.sound = v; G.applySettings(); })),
      row('Lautstärke', vol),
      autos.length ? h('h3', { text: 'Automatik' }) : null,
      ...autos.map((x) => row(x[2], toggle(s.settings[x[0]], (v) => { s.settings[x[0]] = v; }), x[3])),
      h('h3', { text: 'Spielstand' }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => G.saveNow(true) }, 'Jetzt speichern'),
        h('button', { class: 'btn', type: 'button', onclick: () => { exportArea.value = AB.Save.exportString(st()); exportArea.select(); msg.textContent = 'Export erzeugt. Text kopieren oder als Datei laden.'; } }, 'Export erzeugen'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const txt = exportArea.value || AB.Save.exportString(st());
          exportArea.value = txt;
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { msg.textContent = 'In die Zwischenablage kopiert.'; }, () => { exportArea.select(); msg.textContent = 'Kopieren blockiert – Text ist markiert, Strg+C drücken.'; });
          else { exportArea.select(); msg.textContent = 'Text ist markiert – Strg+C drücken.'; }
        } }, 'Kopieren'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const txt = AB.Save.exportString(st());
          const el = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: 'abyssal-spielstand-' + new Date().toISOString().slice(0, 10) + '.txt' });
          document.body.appendChild(el); el.click(); setTimeout(() => { URL.revokeObjectURL(el.href); el.remove(); }, 500);
          msg.textContent = 'Datei wird heruntergeladen.';
        } }, 'Als Datei speichern')),
      exportArea,
      importArea,
      h('div', { class: 'btn-row' },
        h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Datei wählen…'), fileIn,
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
          const r = AB.Save.importString(importArea.value, Date.now());
          if (!r.ok) { msg.textContent = 'Import abgelehnt: ' + r.reason; msg.className = 'io-msg err'; AB.Audio.play('deny'); return; }
          UI.modal({ title: 'Spielstand importieren?', icon: 'save', body: '<p>Der aktuelle Fortschritt wird durch den importierten Stand ersetzt (Lumen gesamt: <b>' + F.num(r.state.stats.lumenAll) + '</b>, Gezeitenwenden: <b>' + r.state.prestige.total + '</b>' +
            (r.state.migratedFrom ? ', aus Version ' + r.state.migratedFrom + ' übernommen' : '') + ').</p>',
            buttons: [{ label: 'Abbrechen' }, { label: 'Importieren', primary: true, onClick: () => { G.loadState(r.state); closeAll(); UI.toast('Import erfolgreich', 'Spielstand geladen.'); } }] });
        } }, 'Importieren')),
      msg,
      h('h3', { text: 'Gefahrenzone' }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => G.confirmReset(closeAll) }, 'Spielstand komplett löschen…'),
        AB.Tutorial ? h('button', { class: 'btn', type: 'button', onclick: () => { AB.Tutorial.restart(); closeAll(); } }, 'Tutorial neu starten') : null),
      h('p', { class: 'muted small', html: 'Tastatur: <kbd>Leertaste</kbd> Puls · <kbd>Q</kbd> Überladung · <kbd>H</kbd> Strömung halten · <kbd>1</kbd>–<kbd>0</kbd> Bereiche · <kbd>Esc</kbd> Fenster schließen' }));
    const m = UI.modal({ title: 'Einstellungen', icon: 'gear', body, cls: 'modal-wide', buttons: [{ label: 'Fertig', primary: true }] });
    function closeAll() { while (UI.closeTopModal()) { /* alle schließen */ } }
    return m;
  };

  // ---- Puls-Feedback ---------------------------------------------------------
  UI.floater = function (text, x, y, cls) {
    const layer = document.getElementById('floaters');
    if (!layer || layer.children.length > 24) return;
    const f = h('span', { class: 'floater ' + (cls || ''), text });
    const r = layer.getBoundingClientRect();
    f.style.left = (x - r.left) + 'px';
    f.style.top = (y - r.top) + 'px';
    layer.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  };

  UI.orbPulse = function () {
    const o = refs.orb;
    o.classList.remove('pulse');
    void o.offsetWidth;
    o.classList.add('pulse');
  };

  UI.h = h;
  AB.UI = UI;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
