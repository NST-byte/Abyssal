/* Kurzes, kontextbezogenes Tutorial. Blendet sich nach den ersten
   Schritten aus und kann jederzeit übersprungen werden. */
(function (AB) {
  'use strict';
  const U = AB.Unlocks;
  const T = {};
  let bubble, textEl, nextBtn, lastStepShown = -1, manualSince = 0;

  const STEPS = [
    { target: '#orb', text: 'Tippe auf den Lumen-Kern (oder drück die Leertaste), um Licht zu sammeln.',
      done: (s) => s.stats.clicks >= 5 },
    { target: '.gen-plankton .buy', tab: 'build', text: 'Kauf dein erstes Planktonnetz. Es sammelt ab jetzt automatisch Lumen – auch wenn du nicht klickst.',
      done: (s) => s.gens.plankton >= 1 },
    { target: '#missions-panel', side: 'right', text: 'Aufträge zeigen dir die nächsten Ziele und geben Belohnungen. Ein guter Kompass, wenn du nicht weißt, was als Nächstes kommt.',
      manual: true, done: (s) => s.gens.plankton >= 3 && Date.now() - manualSince > 6000 },
    { target: '#tab-upgrades', text: 'Neu: Verbesserungen. Sie verdoppeln z. B. die Leistung einer Anlage. Gelbe Zahl = so viele kannst du dir gerade leisten.',
      when: (s) => U.availableUpgrades(s).length > 0, done: (s) => Object.keys(s.upgrades).length >= 1 },
    { target: '#tab-descent', text: 'Unter dir liegt mehr. Im Tab Abstieg siehst du, was die nächste Zone kostet und welche neuen Mechaniken dort warten.',
      when: (s) => s.stats.lumenAll >= 1000, manual: true, done: (s) => s.depth >= 1 },
  ];

  T.init = function () {
    bubble = document.getElementById('tutorial');
    textEl = bubble.querySelector('.tut-text');
    nextBtn = bubble.querySelector('.tut-next');
    nextBtn.addEventListener('click', () => advance(true));
    bubble.querySelector('.tut-skip').addEventListener('click', () => {
      const s = AB.Game.state;
      s.tutorial.done = true;
      bubble.hidden = true;
    });
  };

  function advance(manual) {
    const s = AB.Game.state;
    if (manual && STEPS[s.tutorial.step] && !STEPS[s.tutorial.step].manual) return;
    s.tutorial.step++;
    if (s.tutorial.step >= STEPS.length) s.tutorial.done = true;
    lastStepShown = -1;
    T.update();
  }

  T.restart = function () {
    const s = AB.Game.state;
    s.tutorial.step = 0;
    s.tutorial.done = false;
    lastStepShown = -1;
    T.update();
  };

  T.onTab = function () { /* Platzhalter für tab-spezifische Hinweise – Steps prüfen Ziele selbst */ };

  T.update = function () {
    const s = AB.Game.state;
    if (!bubble) return;
    if (s.tutorial.done || s.tutorial.step >= STEPS.length || AB.UI.modalOpen()) { bubble.hidden = true; return; }
    const step = STEPS[s.tutorial.step];
    if (step.done(s)) { advance(false); return; }
    if (step.when && !step.when(s)) { bubble.hidden = true; return; }
    const target = document.querySelector(step.target);
    if (!target || target.offsetParent === null) { bubble.hidden = true; return; }
    if (lastStepShown !== s.tutorial.step) {
      lastStepShown = s.tutorial.step;
      textEl.textContent = step.text;
      nextBtn.hidden = !step.manual;
      manualSince = Date.now();
    }
    bubble.hidden = false;
    // Positionieren: rechts daneben (wenn gewünscht und Platz), sonst unter/über dem Ziel
    const r = target.getBoundingClientRect();
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    bubble.classList.remove('right');
    if (step.side === 'right' && r.right + bw + 24 < window.innerWidth) {
      const yy = Math.max(10, Math.min(window.innerHeight - bh - 10, r.top + 16));
      bubble.style.transform = 'translate(' + Math.round(r.right + 14) + 'px,' + Math.round(yy) + 'px)';
      bubble.classList.add('right');
      bubble.classList.remove('above');
      return;
    }
    let x = r.left + r.width / 2 - bw / 2;
    x = Math.max(10, Math.min(window.innerWidth - bw - 10, x));
    let y = r.bottom + 12;
    let below = true;
    if (y + bh > window.innerHeight - 10) { y = r.top - bh - 12; below = false; }
    bubble.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(Math.max(10, y)) + 'px)';
    bubble.classList.toggle('above', !below);
    const arrowX = Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - x));
    bubble.style.setProperty('--arrow-x', arrowX + 'px');
  };

  AB.Tutorial = T;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
