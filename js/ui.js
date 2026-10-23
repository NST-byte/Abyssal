/* Benutzeroberfläche: Aufbau und Aktualisierung aller Panels.
   Liest nur aus dem Spielzustand; Aktionen laufen über AB.Game.act(). */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format;
  const UI = {};
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
  function setHidden(el, hid) { if (el.hidden !== hid) el.hidden = hid; }
  function setClass(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
  function setDisabled(el, dis) { const v = !!dis; if (el.getAttribute('aria-disabled') !== String(v)) el.setAttribute('aria-disabled', String(v)); }

  const RES = {
    lumen: { name: 'Lumen', icon: 'lumen' },
    mangan: { name: 'Mangan', icon: 'mangan' },
    data: { name: 'Daten', icon: 'data' },
    perlen: { name: 'Perlen', icon: 'perlen' },
  };

  function rateOf(s, k) {
    if (k === 'lumen') return E.lps(s);
    if (k === 'mangan') return E.mps(s);
    if (k === 'data') return E.dps(s);
    return 0;
  }

  // Kosten-HTML mit Farbmarkierung (bezahlbar / nicht)
  function costHTML(cost) {
    const s = st();
    return Object.keys(cost).map((k) => {
      const ok = (k === 'perlen' ? s.perlen : s.res[k]) >= cost[k] - 1e-9;
      return '<span class="cost cost-' + k + (ok ? ' ok' : ' no') + '">' + icon(RES[k].icon) + F.num(cost[k]) + '</span>';
    }).join('');
  }

  // Erklärt, warum etwas (noch) nicht bezahlbar ist
  function missingText(cost) {
    const s = st();
    const parts = [];
    let wait = 0;
    for (const k in cost) {
      const have = k === 'perlen' ? s.perlen : s.res[k];
      if (have < cost[k] - 1e-9) {
        const miss = cost[k] - have;
        parts.push(F.num(miss) + ' ' + RES[k].name);
        const r = rateOf(s, k);
        wait = Math.max(wait, r > 0 ? miss / r : Infinity);
      }
    }
    if (!parts.length) return '';
    return 'Fehlen ' + parts.join(', ') + (isFinite(wait) && wait > 0 ? ' · ≈ ' + F.time(wait) : '');
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
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
    const btns = (opts.buttons || [{ label: 'Schließen', primary: true }]).map((b) =>
      h('button', { class: 'btn ' + (b.primary ? 'btn-primary' : '') + (b.danger ? ' btn-danger' : ''), type: 'button',
        onclick: () => { const r = b.onClick ? b.onClick() : undefined; if (r !== false && b.close !== false) close(); } }, b.label));
    const body = typeof opts.body === 'string' ? h('div', { class: 'modal-body', html: opts.body }) : h('div', { class: 'modal-body' }, opts.body);
    const dlg = h('div', { class: 'modal ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
      h('div', { class: 'modal-head' }, opts.icon ? h('span', { class: 'modal-icon', html: icon(opts.icon) }) : null, h('h2', { text: opts.title }),
        opts.dismissible === false ? null : h('button', { class: 'icon-btn modal-x', type: 'button', 'aria-label': 'Schließen', onclick: close, html: '×' })),
      body, h('div', { class: 'modal-foot' }, btns));
    const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap && opts.dismissible !== false) close(); } }, dlg);
    root.appendChild(wrap);
    const entry = { close, dismissible: opts.dismissible !== false };
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

  // ---- Grundgerüst ----------------------------------------------------------
  const refs = {};
  let activeTab = 'build';
  const panels = {};

  const TABS = [
    { id: 'build', label: 'Anlagen', icon: 'plankton', vis: () => true },
    { id: 'upgrades', label: 'Verbesserungen', icon: 'star', vis: (f) => f.upgrades },
    { id: 'reinforce', label: 'Verstärkung', icon: 'shield', vis: (f) => f.reinforce },
    { id: 'research', label: 'Forschung', icon: 'flask', vis: (f) => f.research },
    { id: 'expeditions', label: 'Expeditionen', icon: 'compass', vis: (f) => f.expeditions },
    { id: 'descent', label: 'Abstieg', icon: 'down', vis: (f, s) => s.stats.lumenAll >= 1000 || s.depth > 0 || s.prestige.count > 0 },
    { id: 'tides', label: 'Gezeiten', icon: 'perlen', vis: (f) => f.prestigeTab },
    { id: 'log', label: 'Logbuch', icon: 'book', vis: () => true },
  ];

  UI.init = function () {
    // Ressourcenleiste
    const resBar = document.getElementById('resources');
    refs.res = {};
    Object.keys(RES).forEach((k) => {
      const amount = h('span', { class: 'res-amount' });
      const rate = h('span', { class: 'res-rate' });
      const chip = h('div', { class: 'res res-' + k, title: RES[k].name },
        h('span', { class: 'res-icon', html: icon(RES[k].icon) }),
        h('div', { class: 'res-text' }, h('span', { class: 'res-name', text: RES[k].name }), amount, rate));
      resBar.appendChild(chip);
      refs.res[k] = { chip, amount, rate };
    });

    document.getElementById('btn-settings').innerHTML = icon('gear');
    document.getElementById('btn-save').innerHTML = icon('save');
    document.getElementById('btn-settings').addEventListener('click', () => UI.openSettings());
    document.getElementById('btn-save').addEventListener('click', () => AB.Game.saveNow(true));

    // Lumen-Kern
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

    // Tiefenleiste
    C.DEPTHS.forEach((d, i) => {
      refs.depthBar.appendChild(h('div', { class: 'depth-seg', 'data-i': i, title: d.name + ' – ' + d.meters + ' m' }));
    });

    // Tabs
    const nav = document.getElementById('tabs');
    refs.tabs = {};
    TABS.forEach((t, i) => {
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', id: 'tab-' + t.id, 'aria-controls': 'panel-' + t.id, 'data-key': String(i + 1),
        onclick: () => UI.showTab(t.id) },
        h('span', { class: 'tab-icon', html: icon(t.icon) }), h('span', { class: 'tab-label', text: t.label }), h('span', { class: 'tab-badge' }));
      nav.appendChild(b);
      refs.tabs[t.id] = b;
    });
    const body = document.getElementById('tab-body');
    TABS.forEach((t) => {
      const el = h('div', { class: 'panel-body', id: 'panel-' + t.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.id, hidden: true });
      body.appendChild(el);
      panels[t.id] = { el, built: false, api: null };
    });
    UI.showTab('build');
  };

  UI.showTab = function (id) {
    activeTab = id;
    for (const t of TABS) {
      const on = t.id === id;
      setClass(refs.tabs[t.id], 'active', on);
      refs.tabs[t.id].setAttribute('aria-selected', String(on));
      setHidden(panels[t.id].el, !on);
    }
    const p = panels[id];
    if (!p.built) { p.api = BUILDERS[id](p.el); p.built = true; }
    p.api.update();
    if (AB.Tutorial) AB.Tutorial.onTab(id);
  };
  UI.activeTab = () => activeTab;

  // Panel komplett neu aufbauen (z. B. nach Gezeitenwende oder Import)
  UI.rebuild = function () {
    for (const id in panels) { panels[id].el.innerHTML = ''; panels[id].built = false; }
    refs.missions._key = null;
    UI.showTab(TABS.find((t) => t.id === activeTab && refs.tabs[t.id].hidden === false) ? activeTab : 'build');
  };

  // ---- Laufende Aktualisierung ---------------------------------------------
  UI.render = function () {
    const s = st();
    const f = U.features(s);
    // Ressourcen
    const shown = { lumen: true, mangan: f.mangan, data: f.data, perlen: s.prestige.count > 0 || s.perlen > 0 || f.prestige };
    for (const k in RES) {
      const r = refs.res[k];
      setHidden(r.chip, !shown[k]);
      if (!shown[k]) continue;
      setText(r.amount, F.num(k === 'perlen' ? s.perlen : s.res[k]));
      if (k === 'perlen') setText(r.rate, '+' + F.pct(E.perlenBonusPer(s) * s.perlen) + ' Prod.');
      else setText(r.rate, '+' + F.rate(rateOf(s, k)) + '/s');
    }
    // Kern
    setText(refs.clickVal, '+' + F.num(E.clickValue(s), { small: true }));
    setText(refs.lpsVal, F.rate(E.lps(s)));
    const d = C.DEPTHS[s.depth];
    setText(refs.depthLabel, d.name);
    setText(refs.depthMeters, d.meters.toLocaleString('de-DE') + ' m');
    document.body.setAttribute('data-depth', String(s.depth));
    Array.from(refs.depthBar.children).forEach((seg, i) => { setClass(seg, 'reached', i <= s.depth); setClass(seg, 'current', i === s.depth); });

    renderBuffs(s);
    renderAbility(s, f);
    renderMissions(s);

    // Tabs: Sichtbarkeit + Hinweis-Punkte
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
    if (id === 'descent') { const c = E.descentCost(s, s.depth + 1); return c && E.canAfford(s, c) ? '!' : ''; }
    if (id === 'research') {
      const n = C.RESEARCH.filter((r) => U.researchState(s, r) === 'open' && s.res.data >= r.cost).length;
      const proto = E.agg(s).protocolUnlock && s.protocols.length === 0;
      return proto ? '!' : n ? String(n) : '';
    }
    if (id === 'expeditions') return !s.expedition.active && C.EXPEDITIONS.some((x) => s.expedition.levels[x.id] < x.maxLevel && E.canAfford(s, E.expeditionCost(s, x.id))) ? '!' : '';
    if (id === 'tides') return AB.Core.canPrestige(s) ? '!' : '';
    if (id === 'reinforce') return C.GENERATORS.some((g) => s.gens[g.id] > 0 && s.reinforce[g.id] < C.REINFORCE.maxLevel && s.res.mangan >= E.reinforceCost(s, g.id)) ? '•' : '';
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
    refs.ability.title = 'Produktion ×' + ab.mult + ' für ' + Math.round(ab.duration) + ' s, Abklingzeit ' + F.time(ab.cooldown) + ' (Taste Q)';
  }

  function rewardText(s, m) {
    const r = U.missionReward(s, m);
    return Object.keys(r).map((k) => '<span class="cost cost-' + k + '">' + icon(RES[k].icon) + F.num(r[k]) + '</span>').join(' ');
  }

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
      const parts = U.parts(s, it.m.cond);
      const txt = parts.map((p) => p.bool ? p.label : p.label + ': ' + (p.big ? F.num(Math.min(p.cur, p.need)) + ' / ' + F.num(p.need) : Math.min(p.cur, p.need) + ' / ' + p.need)).join(' · ');
      setText(it.label, txt);
      it.bar.style.width = (U.progress(s, it.m.cond) * 100).toFixed(1) + '%';
      setHTML(it.reward, rewardText(s, it.m));
    }
  }

  // ---- Panel-Builder --------------------------------------------------------
  const BUILDERS = {};

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

  // Generische Kaufkarte
  function buyCard(opts) {
    const count = h('span', { class: 'count' });
    const stats = h('div', { class: 'card-stats' });
    const btnLabel = h('span', { class: 'buy-label' });
    const btnCost = h('span', { class: 'buy-cost' });
    const btnGain = h('span', { class: 'buy-gain' });
    const btn = h('button', { class: 'buy', type: 'button', onclick: opts.onBuy }, btnLabel, btnCost, btnGain);
    const hint = h('div', { class: 'card-hint' });
    const root = h('div', { class: 'card ' + (opts.cls || '') },
      h('div', { class: 'card-icon', html: icon(opts.icon) }),
      h('div', { class: 'card-main' },
        h('div', { class: 'card-head' }, h('span', { class: 'card-name', text: opts.name }), count),
        h('div', { class: 'card-desc', text: opts.desc }), stats),
      h('div', { class: 'card-side' }, btn, hint));
    return { root, count, stats, btn, btnLabel, btnCost, btnGain, hint };
  }

  function updateBuy(c, n, cost, gainText, extraReason) {
    const ok = E.canAfford(st(), cost) && !extraReason;
    setText(c.btnLabel, (st().settings.buyAmount === -1 ? 'Max ' : '') + '×' + n);
    setHTML(c.btnCost, costHTML(cost));
    setText(c.btnGain, gainText || '');
    setDisabled(c.btn, !ok);
    setClass(c.root, 'affordable', ok);
    setText(c.hint, ok ? '' : (extraReason || missingText(cost)));
  }

  BUILDERS.build = function (el) {
    const amount = buyAmountBar();
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Anlagen' }), h('p', { class: 'muted', text: 'Produzieren automatisch – auch wenn du nicht klickst.' })), amount.el));

    const upTip = h('button', { class: 'up-tip', type: 'button', onclick: () => UI.showTab('upgrades') });
    el.appendChild(upTip);
    const genWrap = h('div', { class: 'card-list' });
    el.appendChild(genWrap);
    const genCards = C.GENERATORS.map((g) => {
      const c = buyCard({ icon: g.id, name: g.name, desc: g.desc, cls: 'gen gen-' + g.id,
        onBuy: () => AB.Game.act(AB.Actions.buyGen, [g.id, st().settings.buyAmount], { sound: 'buy' }) });
      c.def = g;
      c.locked = h('div', { class: 'card locked' },
        h('div', { class: 'card-icon', html: icon('lock') }),
        h('div', { class: 'card-main' }, h('div', { class: 'card-head' }, h('span', { class: 'card-name', text: '??? – unbekannte Lebensform' })),
          h('div', { class: 'card-desc', text: 'Erreichbar in der ' + C.DEPTHS[g.depth].name + ' (' + C.DEPTHS[g.depth].meters + ' m). Siehe Abstieg.' })));
      genWrap.appendChild(c.root);
      genWrap.appendChild(c.locked);
      return c;
    });

    const minerTitle = h('h3', { class: 'section-title', html: icon('mangan') + 'Mangan-Förderung' });
    const minerWrap = h('div', { class: 'card-list' });
    el.appendChild(minerTitle); el.appendChild(minerWrap);
    const minerCards = C.MINERS.map((m) => {
      const c = buyCard({ icon: m.id, name: m.name, desc: m.desc, cls: 'miner',
        onBuy: () => AB.Game.act(AB.Actions.buyMiner, [m.id, st().settings.buyAmount], { sound: 'buy' }) });
      c.def = m; minerWrap.appendChild(c.root); return c;
    });

    const dataTitle = h('h3', { class: 'section-title', html: icon('data') + 'Datengewinnung' });
    const sonar = buyCard({ icon: 'sonar', name: C.SONAR.name, desc: C.SONAR.desc, cls: 'sonar',
      onBuy: () => AB.Game.act(AB.Actions.buySonar, [st().settings.buyAmount], { sound: 'buy' }) });
    el.appendChild(dataTitle); el.appendChild(h('div', { class: 'card-list' }, sonar.root));

    return {
      update() {
        const s = st();
        amount.update();
        const nUp = U.availableUpgrades(s).filter((u) => s.res.lumen >= u.cost).length;
        setHidden(upTip, nUp === 0);
        if (nUp) setHTML(upTip, icon('star') + '<span><b>' + nUp + (nUp === 1 ? ' Verbesserung' : ' Verbesserungen') + '</b> bezahlbar – meist der größte Hebel für deine Produktion.</span><span class="up-tip-go">Ansehen →</span>');
        const lps = E.lps(s);
        const lpsNB = E.lps(s, true);
        genCards.forEach((c, i) => {
          const g = c.def;
          const unlocked = s.depth >= g.depth;
          const teaser = !unlocked && g.depth === s.depth + 1 && (i === 0 || s.depth >= C.GENERATORS[i - 1].depth);
          setHidden(c.root, !unlocked);
          setHidden(c.locked, !teaser);
          if (!unlocked) return;
          const n = amountFor(() => E.genMax(s, g.id));
          const cost = { lumen: E.genCost(s, g.id, n) };
          setText(c.count, String(s.gens[g.id]));
          const each = E.genEach(s, g.id);
          const tot = each * s.gens[g.id];
          setHTML(c.stats, 'je <b>' + F.rate(each) + '</b>/s' + (s.gens[g.id] ? ' · gesamt <b>' + F.rate(tot) + '</b>/s · ' + F.pct(lps > 0 ? tot / lps : 0, 1) : '') +
            (s.reinforce[g.id] ? ' · <span class="tag-mangan">Verstärkt ' + s.reinforce[g.id] + '</span>' : ''));
          // erwarteter Zuwachs
          s.gens[g.id] += n; E.invalidate();
          const after = E.lps(s, true);
          s.gens[g.id] -= n; E.invalidate();
          updateBuy(c, n, cost, '+' + F.rate(Math.max(0, after - lpsNB)) + '/s');
        });
        const showM = s.depth >= 1;
        setHidden(minerTitle, !showM); setHidden(minerWrap, !showM);
        if (showM) {
          minerCards.forEach((c) => {
            const m = c.def;
            const un = s.depth >= m.depth;
            setHidden(c.root, !un && m.depth > s.depth + 1);
            setClass(c.root, 'is-locked', !un);
            setText(c.count, String(s.miners[m.id]));
            const per = m.prod * E.agg(s).manganMult;
            setHTML(c.stats, 'je <b>' + F.rate(per) + '</b> Mangan/s' + (s.miners[m.id] ? ' · gesamt <b>' + F.rate(per * s.miners[m.id]) + '</b>/s' : ''));
            const n = amountFor(() => E.minerMax(s, m.id));
            updateBuy(c, n, { lumen: E.minerCost(s, m.id, n) }, '+' + F.rate(per * n) + ' Mn/s', un ? '' : 'Benötigt ' + C.DEPTHS[m.depth].name + '.');
          });
        }
        const showD = s.depth >= 2;
        setHidden(dataTitle, !showD); setHidden(sonar.root.parentNode, !showD);
        if (showD) {
          setText(sonar.count, String(s.sonar));
          const per = C.SONAR.prod * E.agg(s).dataMult;
          setHTML(sonar.stats, 'je <b>' + F.rate(per) + '</b> Daten/s' + (s.sonar ? ' · gesamt <b>' + F.rate(per * s.sonar) + '</b>/s' : ''));
          const n = amountFor(() => E.sonarMax(s));
          updateBuy(sonar, n, E.sonarCost(s, n), '+' + F.rate(per * n) + ' D/s');
        }
      },
    };
  };

  function upgradeIcon(u) {
    if (u.kind === 'gen') return u.req.gen;
    if (u.kind === 'synergy') return 'wave';
    if (u.kind === 'click') return 'lumen';
    if (u.effects.some((e) => e.type === 'manganMult')) return 'mangan';
    if (u.effects.some((e) => e.type === 'dataMult')) return 'data';
    return 'star';
  }

  BUILDERS.upgrades = function (el) {
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Verbesserungen' }),
      h('p', { class: 'muted', text: 'Einmalige Käufe mit dauerhafter Wirkung in diesem Lauf. Neue erscheinen, wenn du mehr Anlagen besitzt.' }))));
    const grid = h('div', { class: 'tile-grid' });
    const upcoming = h('div', { class: 'upcoming' });
    const ownedInfo = h('p', { class: 'muted small' });
    el.appendChild(grid);
    el.appendChild(h('h3', { class: 'section-title', html: icon('lock') + 'Demnächst' }));
    el.appendChild(upcoming);
    el.appendChild(ownedInfo);
    const tiles = {};
    let lastKey = '';

    function tile(u) {
      const cost = h('span', { class: 'tile-cost' });
      const hint = h('span', { class: 'tile-hint' });
      const b = h('button', { class: 'tile tile-' + u.kind, type: 'button', onclick: () => AB.Game.act(AB.Actions.buyUpgrade, [u.id], { sound: 'buy' }) },
        h('span', { class: 'tile-icon', html: icon(upgradeIcon(u)) }),
        h('span', { class: 'tile-name', text: u.name }),
        h('span', { class: 'tile-desc', text: u.desc }), cost, hint);
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
        // nächste gesperrte Anlagen-Upgrades als Ausblick
        const next = [];
        C.GENERATORS.forEach((g) => {
          if (s.depth < g.depth || s.gens[g.id] < 1) return;
          const u = C.UPGRADES.find((x) => x.kind === 'gen' && x.req.gen === g.id && !s.upgrades[x.id] && s.gens[g.id] < x.req.n);
          if (u) next.push({ u, prog: s.gens[g.id] / u.req.n });
        });
        next.sort((a, b) => b.prog - a.prog);
        const html = next.slice(0, 4).map((x) => '<div class="up-row"><span>' + x.u.name + '</span><span class="muted">ab ' + x.u.req.n + '× (' +
          s.gens[x.u.req.gen] + '/' + x.u.req.n + ')</span><div class="bar small"><div class="bar-fill" style="width:' + (x.prog * 100).toFixed(0) + '%"></div></div></div>').join('');
        setHTML(upcoming, html || '<p class="muted">–</p>');
        const owned = Object.keys(s.upgrades).length;
        setText(ownedInfo, owned + ' von ' + C.UPGRADES.length + ' Verbesserungen in diesem Lauf gekauft.');
      },
    };
  };

  BUILDERS.reinforce = function (el) {
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Verstärkung' }),
      h('p', { class: 'muted', html: 'Investiere Mangan gezielt in einzelne Anlagen. Jede Stufe multipliziert deren Produktion. Kosten steigen pro Stufe – verteilen lohnt sich.' }))));
    const list = h('div', { class: 'card-list' });
    el.appendChild(list);
    const cards = C.GENERATORS.map((g) => {
      const c = buyCard({ icon: g.id, name: g.name, desc: '', cls: 'reinforce',
        onBuy: () => AB.Game.act(AB.Actions.reinforce, [g.id], { sound: 'buy' }) });
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
          if (lvl >= C.REINFORCE.maxLevel) {
            setText(c.btnLabel, 'Maximal'); setHTML(c.btnCost, ''); setText(c.btnGain, ''); setDisabled(c.btn, true); setText(c.hint, '');
            return;
          }
          const gain = E.genTotal(s, g.id, true) * (per - 1) * (E.lps(s) / (lps || 1));
          const cost = { mangan: E.reinforceCost(s, g.id) };
          const ok = E.canAfford(s, cost);
          setText(c.btnLabel, 'Stufe ' + (lvl + 1));
          setHTML(c.btnCost, costHTML(cost));
          setText(c.btnGain, '+' + F.rate(gain) + '/s');
          setDisabled(c.btn, !ok);
          setClass(c.root, 'affordable', ok);
          setText(c.hint, ok ? '' : missingText(cost));
        });
      },
    };
  };

  BUILDERS.research = function (el) {
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Forschung' }),
      h('p', { class: 'muted', text: 'Daten aus den Sonarbojen schalten neue Systeme und starke Boni frei.' }))));
    // Protokolle
    const protoSec = h('div', { class: 'proto-section' });
    const protoInfo = h('p', { class: 'muted small' });
    const protoGrid = h('div', { class: 'proto-grid' });
    protoSec.appendChild(h('h3', { class: 'section-title', html: icon('wave') + 'Protokoll – deine Spezialisierung' }));
    protoSec.appendChild(protoInfo);
    protoSec.appendChild(protoGrid);
    el.appendChild(protoSec);
    const protoCards = C.PROTOCOLS.map((p) => {
      const state = h('span', { class: 'proto-state' });
      const b = h('button', { class: 'proto', type: 'button', onclick: () => {
        const s = st();
        const switching = s.protocols.length >= E.maxProtocols(s) && s.protocols.indexOf(p.id) < 0;
        if (switching) {
          UI.modal({ title: 'Protokoll wechseln?', icon: 'wave',
            body: '<p>Aktiv: <b>' + s.protocols.map((x) => C.PROTOCOL_BY_ID[x].name).join(', ') + '</b>.</p><p>Wechsel zu <b>' + p.name + '</b> kostet <b>' + F.num(E.protocolSwitchCost(s)) + ' Daten</b> (verdoppelt sich mit jedem Wechsel, setzt sich bei der Gezeitenwende zurück).</p>',
            buttons: [{ label: 'Abbrechen' }, { label: 'Wechseln', primary: true, onClick: () => AB.Game.act(AB.Actions.setProtocol, [p.id], { sound: 'unlock' }) }] });
        } else AB.Game.act(AB.Actions.setProtocol, [p.id], { sound: 'unlock' });
      } },
      h('span', { class: 'proto-style', text: p.style }), h('span', { class: 'proto-name', text: p.name }), h('span', { class: 'proto-desc', text: p.desc }), state);
      protoGrid.appendChild(b);
      return { p, b, state };
    });

    const grid = h('div', { class: 'tile-grid research-grid' });
    el.appendChild(h('h3', { class: 'section-title', html: icon('flask') + 'Forschungsprojekte' }));
    el.appendChild(grid);
    const tiles = C.RESEARCH.map((r) => {
      const cost = h('span', { class: 'tile-cost' });
      const hint = h('span', { class: 'tile-hint' });
      const b = h('button', { class: 'tile tile-research', type: 'button', onclick: () => AB.Game.act(AB.Actions.research, [r.id], { sound: 'unlock' }) },
        h('span', { class: 'tile-icon', html: icon('flask') }), h('span', { class: 'tile-name', text: r.name }), h('span', { class: 'tile-desc', text: r.desc }), cost, hint);
      grid.appendChild(b);
      return { r, b, cost, hint };
    });

    const anaSec = h('div', {});
    const ana = buyCard({ icon: 'data', name: C.ANALYSIS.name, desc: C.ANALYSIS.desc, cls: 'analysis', onBuy: () => AB.Game.act(AB.Actions.analysis, [], { sound: 'buy' }) });
    anaSec.appendChild(h('h3', { class: 'section-title', html: icon('data') + 'Dauerprojekt' }));
    anaSec.appendChild(h('div', { class: 'card-list' }, ana.root));
    el.appendChild(anaSec);

    return {
      update() {
        const s = st();
        const unlocked = E.agg(s).protocolUnlock;
        setHidden(protoSec, !unlocked);
        if (unlocked) {
          const max = E.maxProtocols(s);
          setText(protoInfo, (s.protocols.length < max ? 'Wähle ' + (max === 2 ? 'bis zu zwei Protokolle' : 'ein Protokoll') + '. Die erste Wahl ist kostenlos.' :
            'Wechsel kostet ' + F.num(E.protocolSwitchCost(s)) + ' Daten.') + ' Jedes Protokoll belohnt einen anderen Spielstil.');
          protoCards.forEach((pc) => {
            const on = s.protocols.indexOf(pc.p.id) >= 0;
            setClass(pc.b, 'active', on);
            pc.b.setAttribute('aria-pressed', String(on));
            setText(pc.state, on ? 'Aktiv' : s.protocols.length < max ? 'Wählen' : 'Wechseln');
          });
        }
        tiles.forEach((t) => {
          const rs = U.researchState(s, t.r);
          setHidden(t.b, rs === 'depth' && t.r.depth > s.depth + 1);
          setClass(t.b, 'done', rs === 'done');
          setClass(t.b, 'is-locked', rs === 'depth' || rs === 'req');
          if (rs === 'done') { setHTML(t.cost, icon('check') + 'Erforscht'); setText(t.hint, ''); setDisabled(t.b, true); setClass(t.b, 'affordable', false); return; }
          setHTML(t.cost, costHTML({ data: t.r.cost }));
          let reason = '';
          if (rs === 'depth') reason = 'Benötigt ' + C.DEPTHS[t.r.depth].name;
          else if (rs === 'req') reason = 'Benötigt: ' + t.r.req.filter((x) => !s.research[x]).map((x) => C.RESEARCH_BY_ID[x].name).join(', ');
          else if (s.res.data < t.r.cost) reason = missingText({ data: t.r.cost });
          setText(t.hint, reason);
          setDisabled(t.b, !!reason);
          setClass(t.b, 'affordable', !reason);
        });
        const showAna = s.depth >= C.ANALYSIS.depth;
        setHidden(anaSec, !showAna);
        if (showAna) {
          setText(ana.count, 'Stufe ' + s.analysis);
          setHTML(ana.stats, 'Aktuell <b>' + F.mult(Math.pow(C.ANALYSIS.mult, s.analysis)) + '</b> auf alle Anlagen');
          if (s.analysis >= C.ANALYSIS.maxLevel) { setText(ana.btnLabel, 'Maximal'); setHTML(ana.btnCost, ''); setDisabled(ana.btn, true); setText(ana.hint, ''); }
          else {
            const cost = { data: E.analysisCost(s) };
            setText(ana.btnLabel, 'Stufe ' + (s.analysis + 1)); setHTML(ana.btnCost, costHTML(cost)); setText(ana.btnGain, '+10 %');
            const ok = E.canAfford(s, cost); setDisabled(ana.btn, !ok); setClass(ana.root, 'affordable', ok); setText(ana.hint, ok ? '' : missingText(cost));
          }
        }
      },
    };
  };

  const ART_ICON = { wreck: 'compass', smoker: 'crystal', grave: 'skull' };

  BUILDERS.expeditions = function (el) {
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Expeditionen' }),
      h('p', { class: 'muted', text: 'Schicke ein Tauchteam los. Jede Rückkehr bringt eine Artefakt-Stufe mit festem Bonus – kein Zufall. Läuft auch offline weiter.' }))));
    const active = h('div', { class: 'exp-active' });
    el.appendChild(active);
    const list = h('div', { class: 'card-list' });
    el.appendChild(list);
    const cards = C.EXPEDITIONS.map((x) => {
      const c = buyCard({ icon: ART_ICON[x.id], name: x.name, desc: x.desc, cls: 'expedition', onBuy: () => AB.Game.act(AB.Actions.startExpedition, [x.id], { sound: 'buy' }) });
      c.def = x; list.appendChild(c.root); return c;
    });
    return {
      update() {
        const s = st();
        const a = s.expedition.active;
        if (a) {
          const x = C.EXPEDITION_BY_ID[a.id];
          const left = Math.max(0, a.endsAt - s.time);
          const p = 1 - left / a.duration;
          setHTML(active, '<div class="exp-run">' + icon(ART_ICON[a.id]) + '<div><b>' + x.name + '</b><span class="muted"> – Rückkehr in ' + F.clock(left) + '</span>' +
            '<div class="bar"><div class="bar-fill" style="width:' + (p * 100).toFixed(1) + '%"></div></div></div></div>');
        } else setHTML(active, '<p class="muted small">Kein Team unterwegs.</p>');
        cards.forEach((c) => {
          const x = c.def;
          const lvl = s.expedition.levels[x.id];
          setText(c.count, x.artifact + ' ' + lvl + '/' + x.maxLevel);
          setHTML(c.stats, x.effectText + ' · Dauer <b>' + F.time(E.expeditionDuration(s, x.id)) + '</b>');
          if (lvl >= x.maxLevel) { setText(c.btnLabel, 'Vollständig'); setHTML(c.btnCost, ''); setText(c.btnGain, ''); setDisabled(c.btn, true); setText(c.hint, ''); return; }
          const cost = E.expeditionCost(s, x.id);
          const busy = a ? 'Ein Team ist bereits unterwegs.' : '';
          setText(c.btnLabel, 'Entsenden');
          setHTML(c.btnCost, costHTML(cost));
          setText(c.btnGain, 'Stufe ' + (lvl + 1));
          const ok = !busy && E.canAfford(s, cost);
          setDisabled(c.btn, !ok);
          setClass(c.root, 'affordable', ok);
          setText(c.hint, ok ? '' : busy || missingText(cost));
        });
      },
    };
  };

  BUILDERS.descent = function (el) {
    const hero = h('div', { class: 'zone-hero' });
    const next = h('div', { class: 'zone-next' });
    const btn = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => AB.Game.descend() });
    const hint = h('div', { class: 'card-hint center' });
    const past = h('div', { class: 'zone-past' });
    el.appendChild(hero); el.appendChild(next); el.appendChild(h('div', { class: 'center' }, btn, hint)); el.appendChild(past);
    return {
      update() {
        const s = st();
        const d = C.DEPTHS[s.depth];
        setHTML(hero, '<div class="zone-meters">' + d.meters.toLocaleString('de-DE') + ' m</div><h2>' + d.name + '</h2><p>' + d.story + '</p>' +
          '<p class="muted small">Tiefenbonus: alle Anlagen ' + F.mult(E.depthMult(s)) + ' (' + F.mult(E.depthPer(s)) + ' pro Zone)</p>');
        const nd = C.DEPTHS[s.depth + 1];
        if (!nd) {
          setHTML(next, '<p class="muted center">Tiefer geht es nicht. Das Tiefenherz schlägt unter dir. Die nächste Grenze sind die Gezeiten.</p>');
          setHidden(btn, true); setText(hint, '');
        } else {
          const cost = E.descentCost(s, s.depth + 1);
          const bars = Object.keys(cost).map((k) => {
            const p = Math.min(1, s.res[k] / cost[k]);
            return '<div class="cost-bar"><div class="cost-bar-head">' + icon(RES[k].icon) + '<span>' + RES[k].name + '</span><span class="muted">' + F.num(Math.min(s.res[k], cost[k])) + ' / ' + F.num(cost[k]) + '</span></div>' +
              '<div class="bar"><div class="bar-fill fill-' + k + '" style="width:' + (p * 100).toFixed(1) + '%"></div></div></div>';
          }).join('');
          setHTML(next, '<div class="zone-next-head"><span class="muted">Nächste Zone</span><h3>' + nd.name + ' · ' + nd.meters.toLocaleString('de-DE') + ' m</h3></div>' + bars +
            '<div class="unlock-list"><span class="muted">Schaltet frei:</span>' + nd.unlocks.map((u) => '<span class="unlock-chip">' + u + '</span>').join('') +
            '<span class="unlock-chip">Tiefenbonus ' + F.mult(E.depthPer(s)) + '</span></div>');
          setHidden(btn, false);
          const ok = E.canAfford(s, cost);
          setHTML(btn, icon('down') + ' Abtauchen ' + nd.into);
          setDisabled(btn, !ok);
          setText(hint, ok ? 'Deine Anlagen und Verbesserungen bleiben erhalten. Die Kosten werden abgezogen.' : missingText(cost));
        }
        setHTML(past, C.DEPTHS.map((z, i) => '<div class="zone-chip ' + (i < s.depth ? 'done' : i === s.depth ? 'current' : '') + '"><b>' + z.meters.toLocaleString('de-DE') + ' m</b>' + (i <= s.depth + 1 ? z.name : '???') + '</div>').join(''));
      },
    };
  };

  BUILDERS.tides = function (el) {
    const info = h('div', { class: 'tide-info' });
    const btn = h('button', { class: 'btn btn-pearl btn-big', type: 'button', onclick: () => AB.Game.confirmPrestige() });
    const hint = h('div', { class: 'card-hint center' });
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Gezeitenwende' }),
      h('p', { class: 'muted', text: 'Lass die Station von der Strömung zurücksetzen – und behalte die Perlen, die das Tiefenherz dir schenkt.' }))));
    el.appendChild(info);
    el.appendChild(h('div', { class: 'center' }, btn, hint));
    const shopTitle = h('h3', { class: 'section-title', html: icon('perlen') + 'Perlen-Erbe (dauerhaft)' });
    const shopNote = h('p', { class: 'muted small' });
    const grid = h('div', { class: 'tile-grid' });
    el.appendChild(shopTitle); el.appendChild(shopNote); el.appendChild(grid);
    const autoToggle = h('label', { class: 'toggle-row' }, h('input', { type: 'checkbox', onchange: (e) => { st().settings.autobuy = e.target.checked; } }), h('span', { text: 'Automaton aktiv (kauft jede Sekunde die günstigste Anlage)' }));
    el.appendChild(autoToggle);
    const tiles = C.PRESTIGE_SHOP.map((x) => {
      const cost = h('span', { class: 'tile-cost' });
      const lvl = h('span', { class: 'tile-level' });
      const b = h('button', { class: 'tile tile-shop', type: 'button', onclick: () => AB.Game.act(AB.Actions.buyShop, [x.id], { sound: 'unlock' }) },
        h('span', { class: 'tile-icon', html: icon('perlen') }), h('span', { class: 'tile-name', text: x.name }), lvl, h('span', { class: 'tile-desc', text: x.desc }), cost);
      grid.appendChild(b);
      return { x, b, cost, lvl };
    });
    return {
      update() {
        const s = st();
        const gain = E.prestigeGain(s);
        const can = AB.Core.canPrestige(s);
        const reached = s.depth >= C.PRESTIGE.requireDepth;
        setHTML(info, '<div class="tide-grid">' +
          '<div class="tide-stat"><span class="muted">Perlen bei Gezeitenwende</span><b class="pearl">+' + F.num(gain) + '</b><span class="muted small">nächste bei ' + F.num(E.prestigeNextAt(s)) + ' Lumen (Lauf: ' + F.num(s.run.lumen) + ')</span></div>' +
          '<div class="tide-stat"><span class="muted">Perlen-Bonus</span><b>+' + F.pct(E.perlenBonusPer(s), 0) + ' / Perle</b><span class="muted small">auf alle Anlagen, solange die Perle nicht ausgegeben ist</span></div>' +
          '<div class="tide-stat"><span class="muted">Gezeitenwenden</span><b>' + s.prestige.count + '</b><span class="muted small">' + (s.prestige.bestRunTime ? 'schnellster Lauf: ' + F.time(s.prestige.bestRunTime) : 'Laufzeit: ' + F.time(s.run.time)) + '</span></div>' +
          '</div><div class="tide-cols"><div><h4>Wird zurückgesetzt</h4><ul><li>Lumen, Mangan, Daten</li><li>Anlagen, Drohnen, Bojen</li><li>Verbesserungen, Verstärkungen</li><li>Forschung, Protokolle, Artefakte</li><li>Tiefe (zurück zur Schelfkante)</li></ul></div>' +
          '<div><h4>Bleibt erhalten</h4><ul><li>Perlen und Perlen-Erbe</li><li>Logbuch-Einträge (+1 % je Eintrag)</li><li>Aufträge und Statistiken</li><li>Einstellungen</li></ul></div></div>' +
          '<p class="muted small">Faustregel: Die Wende lohnt sich, sobald die Perlen deine Produktion deutlich vervielfachen würden – z. B. wenn du sie nur noch langsam mehr werden siehst. Perlen wachsen mit der Kubikwurzel der gesammelten Lumen.</p>');
        setHTML(btn, icon('wave') + ' Gezeitenwende auslösen');
        setDisabled(btn, !can);
        setText(hint, can ? '' : !reached ? 'Erst verfügbar, wenn du die Hadalzone (8.000 m) erreichst.' : 'Noch keine volle Perle verdient – sammle mehr Lumen.');
        setText(shopNote, 'Du hast ' + F.num(s.perlen) + ' Perlen. Ausgegebene Perlen geben keinen Pauschalbonus mehr – wäge ab.');
        tiles.forEach((t) => {
          const lvl = s.prestige.shop[t.x.id];
          setText(t.lvl, t.x.maxLevel > 1 ? 'Stufe ' + lvl + '/' + t.x.maxLevel : lvl ? 'Gekauft' : '');
          setClass(t.b, 'done', lvl >= t.x.maxLevel);
          if (lvl >= t.x.maxLevel) { setHTML(t.cost, icon('check') + 'Maximal'); setDisabled(t.b, true); setClass(t.b, 'affordable', false); return; }
          const c = E.shopCost(s, t.x.id);
          setHTML(t.cost, costHTML({ perlen: c }));
          setDisabled(t.b, s.perlen < c);
          setClass(t.b, 'affordable', s.perlen >= c);
        });
        const hasAuto = E.agg(s).autobuy;
        setHidden(autoToggle, !hasAuto);
        if (hasAuto) autoToggle.querySelector('input').checked = s.settings.autobuy;
      },
    };
  };

  BUILDERS.log = function (el) {
    el.appendChild(h('div', { class: 'panel-top' }, h('div', { class: 'panel-title' }, h('h2', { text: 'Logbuch' }),
      h('p', { class: 'muted', text: 'Jeder Eintrag erhöht die gesamte Produktion dauerhaft um 1 % – auch über Gezeitenwenden hinweg.' }))));
    const sum = h('p', { class: 'log-sum' });
    const grid = h('div', { class: 'ach-grid' });
    const stats = h('div', { class: 'stats' });
    const odds = h('div', { class: 'odds' });
    el.appendChild(sum); el.appendChild(grid);
    el.appendChild(h('h3', { class: 'section-title', html: icon('book') + 'Statistik' })); el.appendChild(stats);
    el.appendChild(h('h3', { class: 'section-title', html: icon('star') + 'Irrlichter – Wahrscheinlichkeiten' })); el.appendChild(odds);
    const tiles = C.ACHIEVEMENTS.map((a) => {
      const t = h('div', { class: 'ach', title: a.desc }, h('span', { class: 'ach-icon', html: icon('star') }), h('span', { class: 'ach-name', text: a.name }), h('span', { class: 'ach-desc', text: a.desc }));
      grid.appendChild(t); return { a, t };
    });
    return {
      update() {
        const s = st();
        const n = Object.keys(s.achievements).length;
        setText(sum, n + ' / ' + C.ACHIEVEMENTS.length + ' Einträge · Bonus +' + n + ' %');
        tiles.forEach((x) => setClass(x.t, 'earned', !!s.achievements[x.a.id]));
        const g = E.globalMult(s, true);
        const rows = [
          ['Lumen/s (ohne Boosts)', F.rate(E.lps(s, true))],
          ['Puls-Ertrag', F.num(E.clickValue(s), { small: true })],
          ['Globaler Multiplikator', F.mult(g)],
          ['· davon Tiefe', F.mult(E.depthMult(s))],
          ['· davon Logbuch', F.mult(E.achievementMult(s))],
          ['· davon Perlen', F.mult(E.perlenMult(s))],
          ['· davon Schwarm-Protokoll', F.mult(E.swarmMult(s))],
          ['· davon Upgrades/Forschung/Artefakte', F.mult(E.agg(s).all)],
          ['Lumen in diesem Lauf', F.num(s.run.lumen)],
          ['Lumen insgesamt', F.num(s.stats.lumenAll)],
          ['Mangan insgesamt', F.num(s.stats.manganAll)],
          ['Daten insgesamt', F.num(s.stats.dataAll)],
          ['Pulse', F.num(s.stats.clicks)],
          ['Irrlichter gefangen', F.num(s.stats.events)],
          ['Überladungen', F.num(s.stats.abilityUses)],
          ['Expeditionen', F.num(s.stats.expeditions)],
          ['Anlagen', F.num(E.buildings(s))],
          ['Laufzeit (dieser Lauf)', F.time(s.run.time)],
          ['Spielzeit gesamt', F.time(s.stats.playTime)],
          ['Offline-Grenze', F.time(E.offlineCapSeconds(s))],
        ];
        setHTML(stats, rows.map((r) => '<div class="stat-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join(''));
        const tot = C.EVENTS.outcomes.reduce((a, o) => a + o.weight, 0);
        setHTML(odds, '<p class="muted small">Irrlichter treiben gelegentlich durchs Bild (alle ' + F.time(C.EVENTS.minDelay * E.agg(s).eventFreq) + ' – ' + F.time(C.EVENTS.maxDelay * E.agg(s).eventFreq) +
          ', sichtbar für ' + Math.round(E.eventLifetime(s)) + ' s). Klick drauf:</p>' +
          C.EVENTS.outcomes.map((o) => '<div class="stat-row"><span>' + o.name + ' – ' + o.desc + '</span><b>' + Math.round(o.weight / tot * 100) + ' %</b></div>').join(''));
      },
    };
  };

  // ---- Einstellungen --------------------------------------------------------
  UI.openSettings = function () {
    const s = st();
    const G = AB.Game;
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

    const body = h('div', { class: 'settings' },
      h('h3', { text: 'Darstellung' }),
      row('Animationen reduzieren', toggle(s.settings.reducedMotion, (v) => { s.settings.reducedMotion = v; G.applySettings(); }), 'Stoppt Hintergrund-Bewegung, Partikel und Pulse-Effekte.'),
      row('Zahlenformat', fmt),
      h('h3', { text: 'Sound' }),
      row('Soundeffekte', toggle(s.settings.sound, (v) => { s.settings.sound = v; G.applySettings(); })),
      row('Lautstärke', vol),
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
          const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: 'abyssal-spielstand-' + new Date().toISOString().slice(0, 10) + '.txt' });
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          msg.textContent = 'Datei wird heruntergeladen.';
        } }, 'Als Datei speichern')),
      exportArea,
      importArea,
      h('div', { class: 'btn-row' },
        h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Datei wählen…'), fileIn,
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
          const r = AB.Save.importString(importArea.value, Date.now());
          if (!r.ok) { msg.textContent = 'Import abgelehnt: ' + r.reason; msg.className = 'io-msg err'; AB.Audio.play('deny'); return; }
          UI.modal({ title: 'Spielstand importieren?', icon: 'save', body: '<p>Der aktuelle Fortschritt wird durch den importierten Stand ersetzt (Lumen gesamt: <b>' + F.num(r.state.stats.lumenAll) + '</b>, Gezeitenwenden: <b>' + r.state.prestige.count + '</b>).</p>',
            buttons: [{ label: 'Abbrechen' }, { label: 'Importieren', primary: true, onClick: () => { G.loadState(r.state); closeAll(); UI.toast('Import erfolgreich', 'Spielstand geladen.'); } }] });
        } }, 'Importieren')),
      msg,
      h('h3', { text: 'Gefahrenzone' }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => G.confirmReset(closeAll) }, 'Spielstand komplett löschen…'),
        AB.Tutorial ? h('button', { class: 'btn', type: 'button', onclick: () => { AB.Tutorial.restart(); closeAll(); } }, 'Tutorial neu starten') : null),
      h('p', { class: 'muted small', html: 'Tastatur: <kbd>Leertaste</kbd> Puls · <kbd>Q</kbd> Überladung · <kbd>1</kbd>–<kbd>8</kbd> Tabs · <kbd>Esc</kbd> Fenster schließen' }));
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
