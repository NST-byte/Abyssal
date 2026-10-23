/* Spielstart, Hauptschleife, Eingaben, Ereignisse, Speicherzyklus */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format, A = AB.Actions, Core = AB.Core;
  const G = { state: null };
  AB.Game = G;

  let lastSave = 0;
  let activeEvent = null;
  let pendingReports = [];
  let lastFail = { msg: '', t: 0 };
  let prevFeatures = null;

  const ZONE_NEWS = [
    '',
    '<p><b>Mangan:</b> Knollen-Drohnen (Tab <i>Anlagen</i>) fördern Mangan. Damit verstärkst du im neuen Tab <i>Verstärkung</i> gezielt einzelne Anlagen – und du brauchst es für den nächsten Abstieg.</p><p><b>Neue Anlagen:</b> Quallenschwarm und Anglerfisch-Zucht.</p>',
    '<p><b>Daten:</b> Sonarbojen (Tab <i>Anlagen</i>) erzeugen Daten. Im neuen Tab <i>Forschung</i> schaltest du damit starke Boni frei – darunter die <b>Protokolle</b> (deine Spezialisierung) und die aktive Fähigkeit <b>Überladung</b>.</p><p><b>Neue Anlagen:</b> Schlotturbine und Korallen-Resonator.</p>',
    '<p><b>Expeditionen:</b> Schicke Tauchteams zu drei Orten. Jede Rückkehr bringt eine feste Artefakt-Stufe – kein Zufall.</p><p><b>Tiefbohrer</b> fördern Mangan im großen Stil, die <b>Tiefenanalyse</b> ist ein wiederholbares Datenprojekt. Im Tab <i>Gezeiten</i> siehst du schon, was dich am Grund erwartet.</p>',
    '<p><b>Gezeitenwende freigeschaltet!</b> Du kannst jetzt im Tab <i>Gezeiten</i> neu beginnen und dafür dauerhafte <b>Perlen</b> erhalten. Je mehr Lumen du in diesem Lauf sammelst, desto mehr Perlen. Kein Zwang – spiel ruhig weiter, bis es sich lohnt.</p><p><b>Neu:</b> Tiefenherzen, die stärksten Anlagen der Station.</p>',
  ];

  // ---- Start ----------------------------------------------------------------
  G.init = function () {
    const loaded = AB.Save.read(Date.now());
    G.state = loaded.state || AB.State.create(Date.now());
    const isNew = !loaded.state;
    F.mode = G.state.settings.numberFormat;

    AB.UI.init();
    AB.Scene.init(document.getElementById('scene'));
    AB.Tutorial.init();
    G.applySettings();
    bindInput();

    if (!isNew) {
      const rep = Core.applyOffline(G.state, Date.now());
      if (rep) pendingReports.push(rep);
      if (loaded.fromBackup) AB.UI.toast('Backup geladen', 'Der letzte Spielstand war beschädigt – das automatische Backup wurde verwendet.', 'warn');
    } else {
      G.state.lastTick = Date.now();
      try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) G.state.settings.reducedMotion = true; } catch (e) { /* egal */ }
      G.applySettings();
    }
    U.check(G.state);
    prevFeatures = U.features(G.state);
    AB.UI.render();
    showPendingReports();

    setInterval(tick, 100);
    requestAnimationFrame(frame);
    window.__abyssalReady = true;
  };

  G.applySettings = function () {
    const s = G.state.settings;
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    AB.Audio.enabled = s.sound;
    AB.Audio.setVolume(s.volume);
    F.mode = s.numberFormat;
  };

  // ---- Hauptschleife --------------------------------------------------------
  function tick() {
    const st = G.state;
    const now = Date.now();
    const dt = (now - st.lastTick) / 1000;
    let notes = [];
    if (dt < 0) {
      st.lastTick = now; // Systemuhr zurückgestellt: nichts anrechnen
    } else if (dt > C.OFFLINE.minSeconds) {
      // Rechner war im Ruhezustand / Tab eingefroren: wie Offline behandeln (gedeckelt)
      const rep = Core.applyOffline(st, now);
      if (rep) pendingReports.push(rep);
    } else {
      notes = Core.advance(st, dt);
      st.lastTick = now;
    }
    handleNotes(notes);
    handleNotes(U.check(st));
    checkDiscoveries();
    updateEvents();
    if (!document.hidden) {
      showPendingReports();
      AB.UI.render();
      AB.Tutorial.update();
      AB.Scene.setState(st.depth, E.lps(st), st.settings.reducedMotion);
    }
    if (now - lastSave > C.AUTOSAVE_SECONDS * 1000) G.saveNow(false);
  }

  function frame(t) {
    if (!document.hidden) AB.Scene.frame(t);
    requestAnimationFrame(frame);
  }

  function handleNotes(notes) {
    for (const n of notes) {
      if (n.type === 'mission') {
        const r = Object.keys(n.reward).map((k) => '+' + F.num(n.reward[k]) + ' ' + ({ lumen: 'Lumen', mangan: 'Mangan', data: 'Daten' })[k]).join(', ');
        AB.UI.toast('Auftrag erfüllt: ' + n.def.name, r, 'mission');
        AB.Audio.play('unlock');
      } else if (n.type === 'achievement') {
        AB.UI.toast('Logbuch: ' + n.def.name, n.def.desc + ' <b>+1 % Produktion</b>', 'ach');
      } else if (n.type === 'expedition') {
        const x = C.EXPEDITION_BY_ID[n.id];
        AB.UI.toast('Expedition zurück', x.name + ': <b>' + x.artifact + '</b> jetzt Stufe ' + G.state.expedition.levels[n.id] + '.', 'mission');
        AB.Audio.play('unlock');
      }
    }
  }

  // Einmalige Erklärungen, wenn neue Systeme auftauchen
  function checkDiscoveries() {
    const st = G.state;
    const f = U.features(st);
    const seen = st.tutorial.seen;
    if (f.protocols && !seen.protocols) {
      seen.protocols = true;
      AB.UI.modal({ title: 'Protokolle freigeschaltet', icon: 'wave', body:
        '<p>Die Station kann sich jetzt spezialisieren. Im Tab <i>Forschung</i> wählst du <b>ein Protokoll</b>:</p><ul>' +
        C.PROTOCOLS.map((p) => '<li><b>' + p.name + '</b> (' + p.style + '): ' + p.desc + '</li>').join('') +
        '</ul><p>Die erste Wahl ist kostenlos, ein späterer Wechsel kostet Daten.</p>',
        buttons: [{ label: 'Zur Forschung', primary: true, onClick: () => AB.UI.showTab('research') }] });
    }
    if (f.ability && !seen.ability) {
      seen.ability = true;
      AB.UI.toast('Überladung bereit', 'Neuer Knopf unter dem Lumen-Kern: kurzzeitig mehr Produktion. Taste <kbd>Q</kbd>.', 'big');
    }
    if (f.events && !seen.events) {
      seen.events = true;
      st.events.nextAt = Math.min(st.events.nextAt, st.time + 45);
    }
    prevFeatures = f;
  }

  // ---- Irrlichter -----------------------------------------------------------
  function updateEvents() {
    const st = G.state;
    if (activeEvent) {
      if (st.time >= activeEvent.until) { removeEvent(); st.events.nextAt = st.time + E.eventDelay(st, Math.random()); }
      return;
    }
    if (document.hidden || !U.features(st).events || AB.UI.modalOpen()) return;
    if (st.time >= st.events.nextAt) spawnEvent();
  }

  function spawnEvent() {
    const st = G.state;
    const life = E.eventLifetime(st);
    const layer = document.getElementById('event-layer');
    const fromLeft = Math.random() < 0.5;
    const b = AB.UI.h('button', { class: 'wisp ' + (fromLeft ? 'ltr' : 'rtl'), type: 'button', 'aria-label': 'Irrlicht einfangen',
      title: 'Irrlicht – klick es an!', onclick: catchEvent },
      AB.UI.h('span', { class: 'wisp-core' }), AB.UI.h('span', { class: 'wisp-tail' }));
    b.style.top = (15 + Math.random() * 55) + 'vh';
    b.style.animationDuration = life + 's';
    layer.appendChild(b);
    activeEvent = { el: b, until: st.time + life };
    AB.Audio.play('event');
  }

  function removeEvent() {
    if (activeEvent && activeEvent.el) activeEvent.el.remove();
    activeEvent = null;
  }

  function catchEvent(e) {
    const st = G.state;
    if (!activeEvent) return;
    const rect = activeEvent.el.getBoundingClientRect();
    removeEvent();
    const r = A.catchEvent(st, Math.random());
    st.events.nextAt = st.time + E.eventDelay(st, Math.random());
    AB.Audio.play('event');
    if (r.outcome.id === 'burst') {
      const parts = ['+' + F.num(r.gain.lumen) + ' Lumen'];
      if (r.gain.mangan) parts.push('+' + F.num(r.gain.mangan) + ' Mangan');
      AB.UI.toast('Irrlicht: ' + r.outcome.name, parts.join(', '), 'event');
      AB.UI.floater('+' + F.num(r.gain.lumen), rect.left + rect.width / 2, rect.top, 'big');
    } else {
      AB.UI.toast('Irrlicht: ' + r.outcome.name, 'Produktion ×' + r.outcome.mult + ' für ' + r.outcome.duration + ' s!', 'event');
    }
    AB.UI.render();
    if (e) e.stopPropagation();
  }

  // ---- Aktionen -------------------------------------------------------------
  G.act = function (fn, args, opts) {
    AB.Audio.unlock();
    const r = fn.apply(null, [G.state].concat(args || []));
    if (r && r.ok) {
      if (opts && opts.sound) AB.Audio.play(opts.sound);
      if (opts && opts.toastOk) AB.UI.toast(opts.toastOk[0], opts.toastOk[1]);
      handleNotes(U.check(G.state));
      AB.UI.render();
    } else if (r) {
      const now = Date.now();
      if (r.reason !== lastFail.msg || now - lastFail.t > 1500) {
        AB.UI.toast('Geht noch nicht', r.reason, 'warn');
        lastFail = { msg: r.reason, t: now };
      }
      AB.Audio.play('deny');
    }
    return r;
  };

  G.pulse = function (e) {
    AB.Audio.unlock();
    const r = A.click(G.state);
    let x, y;
    if (e && e.clientX) { x = e.clientX; y = e.clientY; }
    else { const o = document.getElementById('orb').getBoundingClientRect(); x = o.left + o.width / 2; y = o.top + o.height * 0.3; }
    AB.UI.floater('+' + F.num(r.value, { small: true }), x + (Math.random() - 0.5) * 30, y - 10);
    if (!G.state.settings.reducedMotion) AB.UI.orbPulse();
    AB.Audio.play('pulse');
  };

  G.descend = function () {
    const r = G.act(A.descend, [], { sound: 'descend' });
    if (r && r.ok) {
      const d = C.DEPTHS[r.depth];
      AB.UI.modal({ title: d.name + ' · ' + d.meters.toLocaleString('de-DE') + ' m', icon: 'down', cls: 'modal-zone',
        body: '<p class="story">' + d.story + '</p>' + (ZONE_NEWS[r.depth] || '') +
          '<p class="muted small">Tiefenbonus jetzt: alle Anlagen ' + F.mult(E.depthMult(G.state)) + '.</p>',
        buttons: [{ label: 'Weiter', primary: true }] });
      G.saveNow(false);
    }
  };

  G.confirmPrestige = function () {
    const st = G.state;
    if (!Core.canPrestige(st)) { G.act(() => Core.prestige(st), []); return; }
    const gain = E.prestigeGain(st);
    const nowBonus = E.perlenMult(st);
    const afterBonus = 1 + (st.perlen + gain) * E.perlenBonusPer(st);
    let confirmBtn;
    const m = AB.UI.modal({ title: 'Gezeitenwende auslösen?', icon: 'wave', cls: 'modal-prestige',
      body: '<p>Du erhältst <b class="pearl">+' + F.num(gain) + ' Perlen</b> (dann ' + F.num(st.perlen + gain) + ').</p>' +
        '<p>Perlen-Bonus auf alle Anlagen: ' + F.mult(nowBonus) + ' → <b>' + F.mult(afterBonus) + '</b> (solange unausgegeben), plus Käufe im Perlen-Erbe.</p>' +
        '<div class="tide-cols"><div><h4>Wird zurückgesetzt</h4><ul><li>' + F.num(st.res.lumen) + ' Lumen, ' + F.num(st.res.mangan) + ' Mangan, ' + F.num(st.res.data) + ' Daten</li><li>' + E.buildings(st) + ' Anlagen, alle Verbesserungen, Verstärkungen, Forschung, Protokolle, Artefakte</li><li>Tiefe → Schelfkante' + (st.prestige.shop.p_knowledge ? ' (dank Vorwissen: Dämmerzone)' : '') + '</li></ul></div>' +
        '<div><h4>Bleibt</h4><ul><li>Perlen &amp; Perlen-Erbe</li><li>Logbuch (' + Object.keys(st.achievements).length + ' Einträge)</li><li>Aufträge, Statistiken, Einstellungen</li></ul></div></div>' +
        '<p class="muted small">Der Spielstand wird direkt danach gespeichert.</p>',
      buttons: [{ label: 'Abbrechen' }, { label: 'Gezeitenwende bestätigen', primary: true, onClick: () => {
        if (confirmBtn && confirmBtn.getAttribute('aria-disabled') === 'true') return false;
        G.doPrestige();
      } }] });
    // Schutz gegen versehentlichen Doppelklick: Bestätigung erst nach kurzer Zeit aktiv
    const btns = document.querySelectorAll('.modal-prestige .modal-foot .btn');
    confirmBtn = btns[btns.length - 1];
    if (confirmBtn) {
      confirmBtn.setAttribute('aria-disabled', 'true');
      setTimeout(() => confirmBtn.setAttribute('aria-disabled', 'false'), 1200);
    }
    return m;
  };

  G.doPrestige = function () {
    const st = G.state;
    removeEvent();
    const r = Core.prestige(st);
    if (!r.ok) { AB.UI.toast('Geht noch nicht', r.reason, 'warn'); return; }
    st.lastTick = Date.now();
    handleNotes(U.check(st));
    G.saveNow(false);
    AB.UI.rebuild();
    AB.UI.showTab('tides');
    AB.Audio.play('prestige');
    AB.UI.modal({ title: 'Die Gezeiten wenden sich', icon: 'perlen', body: '<p>Die Strömung trägt die Station zurück zur Schelfkante. In deinen Händen: <b class="pearl">' + F.num(r.gain) + ' neue Perlen</b>.</p><p>Lauf-Dauer: ' + F.time(r.runTime) + '. Gib Perlen im <i>Perlen-Erbe</i> aus oder behalte sie für den Pauschalbonus.</p>' });
  };

  G.confirmReset = function (after) {
    const input = AB.UI.h('input', { type: 'text', class: 'io', placeholder: 'LÖSCHEN', 'aria-label': 'Zur Bestätigung LÖSCHEN eingeben', autofocus: true });
    AB.UI.modal({ title: 'Spielstand komplett löschen?', icon: 'lock', body: AB.UI.h('div', {},
      AB.UI.h('p', { html: 'Das löscht <b>alles</b> – auch Perlen, Logbuch und Statistiken. Exportiere vorher, wenn du unsicher bist.' }),
      AB.UI.h('p', { text: 'Tippe LÖSCHEN zur Bestätigung:' }), input),
      buttons: [{ label: 'Abbrechen' }, { label: 'Endgültig löschen', danger: true, onClick: () => {
        if (input.value.trim().toUpperCase() !== 'LÖSCHEN') { input.focus(); AB.Audio.play('deny'); return false; }
        AB.Save.clear();
        removeEvent();
        G.state = AB.State.create(Date.now());
        E.invalidate();
        G.applySettings();
        AB.UI.rebuild();
        G.saveNow(false);
        if (after) after();
        AB.UI.toast('Neustart', 'Spielstand gelöscht. Willkommen auf Tethys-7.');
      } }] });
  };

  G.loadState = function (state) {
    removeEvent();
    G.state = state;
    state.lastTick = Date.now(); // Importe bekommen keinen Offline-Bonus
    E.invalidate();
    G.applySettings();
    AB.UI.rebuild();
    G.saveNow(false);
  };

  G.saveNow = function (manual) {
    lastSave = Date.now();
    const r = AB.Save.write(G.state);
    if (manual) AB.UI.toast(r.ok ? 'Gespeichert' : 'Speichern fehlgeschlagen', r.ok ? 'Spielstand im Browser gesichert.' : r.reason, r.ok ? '' : 'warn');
    return r;
  };

  function showPendingReports() {
    if (!pendingReports.length || document.hidden) return;
    // mehrere Berichte zusammenfassen
    const sum = pendingReports.reduce((a, r) => ({ away: a.away + r.away, credited: a.credited + r.credited, capped: a.capped || r.capped, cap: r.cap,
      gain: { lumen: a.gain.lumen + r.gain.lumen, mangan: a.gain.mangan + r.gain.mangan, data: a.gain.data + r.gain.data }, expeditions: a.expeditions.concat(r.expeditions) }),
      { away: 0, credited: 0, capped: false, cap: 0, gain: { lumen: 0, mangan: 0, data: 0 }, expeditions: [] });
    pendingReports = [];
    const rows = [['lumen', 'Lumen'], ['mangan', 'Mangan'], ['data', 'Daten']].filter(([k]) => sum.gain[k] > 0)
      .map(([k, n]) => '<div class="offline-row">' + AB.icon(k) + '<span>' + n + '</span><b>+' + F.num(sum.gain[k]) + '</b></div>').join('');
    AB.UI.modal({ title: 'Willkommen zurück', icon: 'wave', body:
      '<p>Du warst <b>' + F.time(sum.away) + '</b> weg. Angerechnet: <b>' + F.time(sum.credited) + '</b>' +
      (sum.capped ? ' (Offline-Grenze: ' + F.time(sum.cap) + ' – erweiterbar über Forschung, Protokoll und Perlen-Erbe)' : '') + '.</p>' +
      (rows || '<p class="muted">Noch keine Produktion.</p>') +
      (sum.expeditions.length ? '<p>Zurückgekehrte Expeditionen: ' + sum.expeditions.length + '</p>' : '') });
  }

  // ---- Eingaben -------------------------------------------------------------
  function bindInput() {
    const unlock = () => AB.Audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (AB.UI.closeTopModal()) e.preventDefault(); return; }
      if (AB.UI.modalOpen()) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (!e.repeat) G.pulse(null); // gedrückt halten zählt nicht als Dauerfeuer
        return;
      }
      if (e.key === 'q' || e.key === 'Q') { if (U.features(G.state).ability) G.act(A.useAbility, [], { sound: 'unlock' }); return; }
      if (/^[1-8]$/.test(e.key)) {
        const tab = document.querySelector('.tab[data-key="' + e.key + '"]');
        if (tab && !tab.hidden) { tab.click(); tab.focus(); }
      }
    });
    // Enter auf dem Kern: kein Dauerfeuer durch Tastenwiederholung
    document.getElementById('orb').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.code === 'Space') && e.repeat) e.preventDefault();
    });

    // Nach Mausklicks den Fokus lösen, damit die Leertaste wieder pulst.
    // Tastatur-Klicks (detail === 0) behalten den Fokus für die Bedienbarkeit.
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && e.detail > 0 && !b.closest('.modal')) b.blur();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.saveNow(false);
      else { tick(); }
    });
    window.addEventListener('pagehide', () => G.saveNow(false));
    window.addEventListener('beforeunload', () => G.saveNow(false));
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', G.init);
    else G.init();
  }
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
