/* Spielstart, Hauptschleife, Eingaben, Ereignisse, Bestätigungsdialoge, Speicherzyklus */
(function (AB) {
  'use strict';
  const C = AB.CONFIG, E = AB.Economy, U = AB.Unlocks, F = AB.Format, A = AB.Actions, Core = AB.Core;
  const G = { state: null };
  AB.Game = G;

  let lastSave = 0;
  let activeEvent = null;
  let pendingReports = [];
  let lastFail = { msg: '', t: 0 };

  const ZONE_NEWS = [
    '',
    '<p><b>Mangan:</b> Knollen-Drohnen (Tab <i>Produktion</i>) fördern Mangan – für Verstärkungen, Module und den nächsten Abstieg.</p><p><b>Station:</b> Im neuen Tab <i>Station</i> baust du einen <b>Reaktor</b> (Energie) und eine <b>Schmelze</b>, die Mangan und Lumen zu <b>Legierung</b> verarbeitet. Legierung brauchst du für tiefere Anlagen und den nächsten Abstieg.</p>',
    '<p><b>Daten:</b> Sonarbojen oder Sonarlabore erzeugen Daten. Der <b>Tech-Baum</b> (Tab <i>Forschung</i>) hat Gabelungen, die ändern, wie deine Station arbeitet – zum Beispiel ob Schmelzen Lumen oder Mangan verbrauchen.</p><p><b>Strömungen:</b> Alle 10 Minuten wechselt die Strömung und verstärkt einen Bereich deiner Wirtschaft. Links siehst du, was als Nächstes kommt.</p><p><b>Neue Module:</b> Kühlturm, Relais, Sonarlabor, Prisma – Nachbarschaft zählt.</p>',
    '<p><b>Tiefseekarte:</b> U-Boote erkunden Sektoren. Danach entscheidest du: Außenposten (dauerhafter Bonus, begrenzt) oder Bergung (sofortiger Ertrag, manchmal ein Relikt).</p><p><b>Fertigung:</b> Neues Modul für <b>Resonanzkristalle</b> aus Legierung und Daten. Kristalle brauchen die tiefsten Anlagen und Abstiege.</p><p><b>Raster:</b> Die Station bekommt eine zusätzliche Zeile.</p>',
    '<p><b>Gezeitenwende freigeschaltet!</b> Du kannst im Tab <i>Gezeiten</i> neu beginnen und dafür <b>Perlen</b> erhalten – Währung für den Gezeiten-Baum mit vier Spezialisierungen. Kein Zwang: Spiel weiter, solange deine Perlen pro Stunde steigen.</p>',
    '<p><b>Der Schlund:</b> Schlundgärten, der <b>Druckresonator</b> (verstärkt Nachbarmodule massiv) und neue Kartensektoren mit seltenen Relikten. Jede Zone jenseits von Hadal erhöht deine Perlen um 25 %.</p>',
    '<p><b>Die Herzkammer:</b> Hier endet die Tiefe. Der <b>Tiefenrekord</b> (Tab <i>Abstieg</i>) ist endlos und bleibt über alle Wenden erhalten. Und: Die <b>Weltenwende</b> (Tab <i>Ursprung</i>) ist jetzt möglich – die zweite, große Prestige-Ebene.</p>',
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
    AB.UI.render();
    if (G.state.migratedFrom && !G.state.tutorial.seen.v2) showMigrationNote();
    showPendingReports();

    setInterval(tick, 100);
    requestAnimationFrame(frame);
    window.__abyssalReady = true;
  };

  function showMigrationNote() {
    G.state.tutorial.seen.v2 = true;
    AB.UI.modal({ title: 'ABYSSAL 2.0', icon: 'star', cls: 'modal-wide', body:
      '<p>Dein Spielstand wurde übernommen. Neu in dieser Version:</p><ul>' +
      '<li><b>Station</b> mit Modulraster, Energie und echten Verarbeitungsketten (Legierung, Kristalle)</li>' +
      '<li><b>Tech-Baum</b> mit Gabelungen, <b>Strömungen</b> und eine <b>Tiefseekarte</b> mit Relikten</li>' +
      '<li><b>Gezeiten-Baum</b> statt Perlen-Shop – deine ausgegebenen Perlen wurden vollständig erstattet</li>' +
      '<li><b>Tiefenproben</b>, zwei neue Zonen, <b>Weltenwende</b> und endloser <b>Tiefenrekord</b></li></ul>' +
      '<p class="muted small">Artefakte aus Expeditionen wurden zu Relikten (Messingkompass, Schmiedeherz, Echoschädel).</p>' });
  }

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

  function resText(res) {
    return Object.keys(res).filter((k) => res[k] > 0).map((k) => '+' + F.num(res[k]) + ' ' + C.RESOURCES[k].name).join(', ');
  }

  function handleNotes(notes) {
    const st = G.state;
    const achs = notes.filter((n) => n.type === 'achievement');
    if (achs.length >= 3) {
      AB.UI.toast(achs.length + ' neue Logbuch-Einträge', achs.map((n) => n.def.name).join(', ') + ' <b>+' + achs.length + ' % Produktion</b>', 'ach');
      notes = notes.filter((n) => n.type !== 'achievement');
    }
    for (const n of notes) {
      if (n.type === 'mission') {
        AB.UI.toast('Auftrag erfüllt: ' + n.def.name, resText(n.reward), 'mission');
        AB.Audio.play('unlock');
      } else if (n.type === 'achievement') {
        AB.UI.toast('Logbuch: ' + n.def.name, n.def.desc + ' <b>+1 % Produktion</b>', 'ach');
      } else if (n.type === 'scan') {
        const sec = st.map.sectors[n.sector];
        if (sec) AB.UI.toast('U-Boot zurück', C.DEPTHS[sec.zone].name + ': <b>' + C.SECTOR_BY_ID[sec.type].name + '</b> entdeckt. Ausbeuten oder bergen?', 'mission');
      } else if (n.type === 'current') {
        if (st.current) AB.UI.toast('Strömung: ' + C.CURRENT_BY_ID[st.current.type].name, C.CURRENT_BY_ID[st.current.type].desc, 'event');
      } else if (n.type === 'probe') {
        const p = C.PROBE_BY_ID[n.id];
        AB.Audio.play('prestige');
        AB.UI.modal({ title: 'Tiefenprobe bestanden!', icon: 'probe', body: '<p><b>' + p.name + '</b> Stufe ' + n.level + ' geschafft.</p><p>Dauerhafte Belohnung: ' + p.reward + '</p><p class="muted small">Die Sonderregel ist aufgehoben – dein Lauf geht normal weiter.</p>' });
      }
    }
  }

  // Einmalige Erklärungen, wenn neue Systeme auftauchen
  function checkDiscoveries() {
    const st = G.state;
    const f = U.features(st);
    const seen = st.tutorial.seen;
    const once = (key, cond, fn) => { if (cond && !seen[key]) { seen[key] = true; fn(); } };
    once('protocols', f.protocols, () => AB.UI.modal({ title: 'Protokolle freigeschaltet', icon: 'wave', body:
      '<p>Die Station kann sich spezialisieren. Im Tab <i>Forschung</i> wählst du <b>ein Protokoll</b> für diesen Lauf:</p><ul>' +
      C.PROTOCOLS.map((p) => '<li><b>' + p.name + '</b> (' + p.style + '): ' + p.desc + '</li>').join('') +
      '</ul><p>Die erste Wahl ist kostenlos, ein späterer Wechsel kostet Daten.</p>',
      buttons: [{ label: 'Zur Forschung', primary: true, onClick: () => AB.UI.showTab('research') }] }));
    once('ability', f.ability, () => AB.UI.toast('Überladung bereit', 'Neuer Knopf unter dem Lumen-Kern: kurzzeitig mehr Produktion. Taste <kbd>Q</kbd>.', 'big'));
    once('events', f.events, () => { st.events.nextAt = Math.min(st.events.nextAt, st.time + 45); });
    once('tree', f.tree && st.perlen > 0, () => AB.UI.modal({ title: 'Der Gezeiten-Baum', icon: 'tree', body:
      '<p>Investiere deine Perlen im Tab <i>Gezeiten</i>. Vier Zweige – <b>Strömung</b> (Wirtschaft), <b>Puls</b> (aktiv), <b>Schwarm</b> (passiv &amp; Automatik), <b>Tiefe</b> (Erkundung).</p>' +
      '<ul><li>Jeder Zweig hat eine <b>Gabelung</b>: nur eine Seite.</li><li>Höchstens <b>zwei Capstones</b> gleichzeitig.</li><li>Bei jeder Gezeitenwende kannst du kostenlos <b>neu verteilen</b>.</li></ul>',
      buttons: [{ label: 'Zum Baum', primary: true, onClick: () => AB.UI.showTab('tides') }] }));
    once('probes', f.probes, () => AB.UI.toast('Tiefenproben verfügbar', 'Herausforderungs-Läufe mit Sonderregeln und einzigartigen Dauerbelohnungen – im Tab <i>Gezeiten</i>.', 'big'));
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
      AB.UI.toast('Irrlicht: ' + r.outcome.name, resText(r.gain), 'event');
      AB.UI.floater('+' + F.num(r.gain.lumen), rect.left + rect.width / 2, rect.top, 'big');
    } else {
      AB.UI.toast('Irrlicht: ' + r.outcome.name, 'Produktion ×' + r.outcome.mult + ' für ' + r.outcome.duration + ' s!' + (r.gain ? ' ' + resText(r.gain) : ''), 'event');
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
    if (!r.ok) { G.act(() => r, []); return; }
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
      if (!r.probe) {
        AB.UI.modal({ title: d.name + ' · ' + d.meters.toLocaleString('de-DE') + ' m', icon: 'down', cls: 'modal-zone',
          body: '<p class="story">' + d.story + '</p>' + (G.state.stats.maxDepth > r.depth || G.state.prestige.total > 0 && r.depth <= 4 ? '' : (ZONE_NEWS[r.depth] || '')) +
            '<p class="muted small">Tiefenbonus jetzt: alle Anlagen ' + F.mult(E.depthMult(G.state)) + '.</p>',
          buttons: [{ label: 'Weiter', primary: true }] });
      } else handleNotes([r.probe]);
      G.saveNow(false);
    }
  };

  // Bestätigungsbutton erst nach kurzer Zeit aktiv (Schutz gegen Doppelklick)
  function armDelayed(entry) {
    const b = entry.buttons[entry.buttons.length - 1];
    b.setAttribute('aria-disabled', 'true');
    setTimeout(() => b.setAttribute('aria-disabled', 'false'), 1200);
    return b;
  }
  const armed = (b) => b.getAttribute('aria-disabled') !== 'true';

  function archetypePicker(st) {
    if (!st.world.origin.o_heritage) return null;
    const sel = AB.UI.h('select', { 'aria-label': 'Erbstation' }, ...C.ARCHETYPES.map((a) => { const o = AB.UI.h('option', { value: a.id, text: a.name + ' – ' + a.desc }); if (st.prestige.nextArchetype === a.id) o.selected = true; return o; }));
    sel.addEventListener('change', () => { st.prestige.nextArchetype = sel.value; });
    return AB.UI.h('div', { class: 'set-row' }, AB.UI.h('div', { class: 'set-label', text: 'Erbstation' }), sel);
  }

  G.confirmPrestige = function () {
    const st = G.state;
    if (!Core.canPrestige(st)) { G.act(() => Core.prestige(st), []); return; }
    const gain = E.prestigeGain(st);
    const spent = A.treeSpent(st);
    const respec = AB.UI.h('input', { type: 'checkbox', id: 'respec' });
    const body = AB.UI.h('div', {},
      AB.UI.h('p', { html: 'Du erhältst <b class="pearl">+' + F.num(gain) + ' Perlen</b> (dann ' + F.num(st.perlen + gain) + ' verfügbar).' + (st.probe ? ' <b>Die laufende Tiefenprobe endet ohne Belohnung.</b>' : '') }),
      AB.UI.h('p', { html: 'Perlen-Bonus auf die Produktion: ' + F.mult(E.perlenMult(st)) + ' → <b>' + F.mult(1 + Math.pow(Math.log10(1 + st.prestige.perlenEarned + gain), 2) * C.PRESTIGE.earnedBonus) + '</b>' }),
      AB.UI.h('div', { class: 'tide-cols', html: '<div><h4>Wird zurückgesetzt</h4><ul><li>Alle Ressourcen dieses Laufs</li><li>' + E.buildings(st) + ' Anlagen, Verbesserungen, Verstärkungen</li><li>Station (' + st.station.cells.filter(Boolean).length + ' Module), Forschung, Protokolle</li><li>Karte und Außenposten</li></ul></div>' +
        '<div><h4>Bleibt</h4><ul><li>Perlen &amp; Gezeiten-Baum</li><li>Relikte, Proben, Tiefenrekord</li><li>Logbuch, Aufträge, Statistiken</li></ul></div>' }),
      spent > 0 ? AB.UI.h('label', { class: 'toggle-row', for: 'respec' }, respec, AB.UI.h('span', { html: 'Gezeiten-Baum <b>neu verteilen</b> – ' + F.num(spent) + ' Perlen zurück' })) : null,
      archetypePicker(st),
      AB.UI.h('p', { class: 'muted small', text: 'Der Spielstand wird direkt danach gespeichert.' }));
    let btn;
    const m = AB.UI.modal({ title: 'Gezeitenwende auslösen?', icon: 'wave', cls: 'modal-prestige', body,
      buttons: [{ label: 'Abbrechen' }, { label: 'Gezeitenwende bestätigen', pearl: true, onClick: () => { if (!armed(btn)) return false; G.doPrestige({ respec: respec.checked }); } }] });
    btn = armDelayed(m);
    return m;
  };

  function afterReset(title, html) {
    const st = G.state;
    removeEvent();
    st.lastTick = Date.now();
    handleNotes(U.check(st));
    G.saveNow(false);
    AB.UI.rebuild();
    AB.UI.render();
    AB.Audio.play('prestige');
    if (title) AB.UI.modal({ title, icon: 'perlen', body: html });
  }

  G.doPrestige = function (opts) {
    const st = G.state;
    const r = Core.prestige(st, opts);
    if (!r.ok) { AB.UI.toast('Geht noch nicht', r.reason, 'warn'); return; }
    afterReset('Die Gezeiten wenden sich', '<p>Die Strömung trägt die Station zurück. In deinen Händen: <b class="pearl">' + F.num(r.gain) + ' neue Perlen</b>' +
      (r.refunded ? ' und ' + F.num(r.refunded) + ' erstattete Perlen aus dem Baum' : '') + '.</p><p>Lauf-Dauer: ' + F.time(r.runTime) + '. Verteile deine Perlen im Gezeiten-Baum.</p>');
    AB.UI.showTab('tides');
  };

  G.confirmProbe = function (id) {
    const st = G.state;
    const why = Core.canStartProbe(st, id);
    if (why) { AB.UI.toast('Geht noch nicht', why, 'warn'); return; }
    const p = C.PROBE_BY_ID[id];
    const lvl = (st.probes[id] || 0) + 1;
    const gain = Core.canPrestige(st) ? E.prestigeGain(st) : 0;
    let btn;
    const m = AB.UI.modal({ title: 'Tiefenprobe: ' + p.name + ' (Stufe ' + lvl + ')', icon: 'probe', cls: 'modal-prestige',
      body: '<p><b>Regel:</b> ' + p.rule + '</p><p><b>Ziel:</b> ' + C.DEPTHS[C.PROBES.goals[lvl - 1]].name + ' erreichen.</p><p><b>Belohnung (dauerhaft):</b> ' + p.reward + '</p>' +
        '<p>Die Probe startet einen <b>neuen Lauf</b>, wie eine Gezeitenwende – aber <b>ohne Perlen</b> für den aktuellen Lauf.' +
        (gain > 0 ? ' <b class="tag-warn">Du würdest ' + F.num(gain) + ' Perlen verschenken – vielleicht erst die Gezeitenwende auslösen?</b>' : '') + '</p>',
      buttons: [{ label: 'Abbrechen' }, { label: 'Probe starten', primary: true, onClick: () => {
        if (!armed(btn)) return false;
        const r = Core.startProbe(G.state, id);
        if (!r.ok) { AB.UI.toast('Geht noch nicht', r.reason, 'warn'); return; }
        afterReset(null);
        AB.UI.toast('Probe gestartet', p.name + ' – ' + p.rule, 'big');
      } }] });
    btn = armDelayed(m);
  };

  G.abandonProbe = function () {
    AB.UI.modal({ title: 'Probe abbrechen?', icon: 'probe', body: '<p>Die Sonderregel fällt weg, dein Lauf geht ganz normal weiter. Die Belohnung dieser Stufe bekommst du nicht.</p>',
      buttons: [{ label: 'Weitermachen' }, { label: 'Abbrechen', danger: true, onClick: () => G.act(Core.abandonProbe, []) }] });
  };

  G.confirmWorld = function () {
    const st = G.state;
    if (!Core.canWorld(st)) { G.act(() => Core.worldTurn(st), []); return; }
    const gain = E.worldGain(st);
    let btn;
    const body = AB.UI.h('div', {},
      AB.UI.h('p', { html: 'Du erhältst <b class="urlicht">+' + F.num(gain) + ' Urlicht</b>.' }),
      AB.UI.h('p', { html: '<b>Zusätzlich zur Gezeitenwende</b> werden zurückgesetzt: ' + F.num(st.perlen) + ' Perlen, der gesamte Gezeiten-Baum (' + F.num(A.treeSpent(st)) + ' Perlen) und die Wenden dieses Zyklus.' }),
      AB.UI.h('p', { html: 'Erhalten bleiben: Urlicht &amp; Ursprung, Relikte, Tiefenproben, Tiefenrekord, Logbuch und die Freischaltung von Schlund und Herzkammer.' }),
      archetypePicker(st));
    const m = AB.UI.modal({ title: 'Weltenwende auslösen?', icon: 'urlicht', cls: 'modal-prestige', body,
      buttons: [{ label: 'Abbrechen' }, { label: 'Weltenwende bestätigen', primary: true, onClick: () => {
        if (!armed(btn)) return false;
        const r = Core.worldTurn(G.state);
        if (!r.ok) { AB.UI.toast('Geht noch nicht', r.reason, 'warn'); return; }
        afterReset('Eine neue Welt', '<p>Alles beginnt von vorn – nur du nicht. <b class="urlicht">' + F.num(r.gain) + ' Urlicht</b> warten im Ursprung.</p>');
        AB.UI.showTab('origin');
      } }] });
    btn = armDelayed(m);
  };

  G.confirmReset = function (after) {
    const input = AB.UI.h('input', { type: 'text', class: 'io', placeholder: 'LÖSCHEN', 'aria-label': 'Zur Bestätigung LÖSCHEN eingeben', autofocus: true });
    AB.UI.modal({ title: 'Spielstand komplett löschen?', icon: 'lock', body: AB.UI.h('div', {},
      AB.UI.h('p', { html: 'Das löscht <b>alles</b> – auch Perlen, Urlicht, Relikte und Statistiken. Exportiere vorher, wenn du unsicher bist.' }),
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
    const sum = { away: 0, credited: 0, capped: false, cap: 0, gain: {}, scans: 0, currents: 0, mult: 1 };
    pendingReports.forEach((r) => {
      sum.away += r.away; sum.credited += r.credited; sum.capped = sum.capped || r.capped; sum.cap = r.cap; sum.mult = r.mult;
      for (const k in r.gain) sum.gain[k] = (sum.gain[k] || 0) + r.gain[k];
      sum.scans += r.scans.length; sum.currents += r.currents;
      r.probes.forEach((p) => handleNotes([p]));
    });
    pendingReports = [];
    const rows = Object.keys(C.RESOURCES).filter((k) => sum.gain[k] && Math.abs(sum.gain[k]) > 1e-9)
      .map((k) => '<div class="offline-row">' + AB.icon(C.RESOURCES[k].icon) + '<span>' + C.RESOURCES[k].name + '</span><b class="' + (sum.gain[k] < 0 ? 'neg' : '') + '">' + (sum.gain[k] < 0 ? '−' : '+') + F.num(Math.abs(sum.gain[k])) + '</b></div>').join('');
    AB.UI.modal({ title: 'Willkommen zurück', icon: 'wave', body:
      '<p>Du warst <b>' + F.time(sum.away) + '</b> weg. Angerechnet: <b>' + F.time(sum.credited) + '</b>' +
      (sum.capped ? ' (Offline-Grenze: ' + F.time(sum.cap) + ' – erweiterbar über Forschung, Protokoll, Relikte und Gezeiten-Baum)' : '') +
      (sum.mult > 1 ? '. Tiefschlaf-Bonus: Produktion ' + F.mult(sum.mult) : '') + '.</p>' +
      (rows || '<p class="muted">Noch keine Produktion.</p>') +
      (sum.scans ? '<p>Zurückgekehrte U-Boote: ' + sum.scans + ' – auf der Karte wartet eine Entscheidung.</p>' : '') +
      (sum.currents ? '<p class="muted small">Strömungswechsel während deiner Abwesenheit: ' + sum.currents + '</p>' : '') });
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
      if (e.key === 'h' || e.key === 'H') { if (E.agg(G.state).currentHold) G.act(A.holdCurrent, [], { sound: 'unlock', toastOk: ['Strömung gehalten', 'Sie läuft eine Periode länger.'] }); return; }
      if (/^[0-9]$/.test(e.key)) {
        const tab = document.querySelector('.tab[data-key="' + e.key + '"]');
        if (tab && !tab.hidden) { tab.click(); tab.focus(); }
      }
    });
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
