/* Optionale Soundeffekte via WebAudio-Synthese. Wird erst nach einer
   Nutzerinteraktion initialisiert. */
(function (AB) {
  'use strict';
  const Audio = { enabled: true, volume: 0.5 };
  let ctx = null, master = null;
  let lastPlay = {};

  Audio.unlock = function () {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = Audio.volume * 0.35;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  };

  Audio.setVolume = function (v) {
    Audio.volume = v;
    if (master) master.gain.value = v * 0.35;
  };

  function tone(freq, dur, type, gain, delay, slide) {
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    pulse: () => tone(520 + Math.random() * 140, 0.18, 'sine', 0.22, 0, 1.6),
    buy: () => { tone(660, 0.09, 'triangle', 0.18); tone(990, 0.12, 'triangle', 0.14, 0.05); },
    deny: () => tone(180, 0.12, 'square', 0.06, 0, 0.8),
    unlock: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'sine', 0.14, i * 0.07)); },
    event: () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, i * 0.05, 1.05)); },
    descend: () => { tone(220, 1.4, 'sine', 0.3, 0, 0.5); tone(330, 1.2, 'triangle', 0.08, 0.1, 0.5); },
    prestige: () => { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.9, 'sine', 0.13, i * 0.1)); },
  };

  Audio.play = function (name) {
    if (!Audio.enabled || !ctx) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 45) return; // Spam-Schutz
    lastPlay[name] = now;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      SOUNDS[name] && SOUNDS[name]();
    } catch (e) { /* Audio ist optional */ }
  };

  AB.Audio = Audio;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
