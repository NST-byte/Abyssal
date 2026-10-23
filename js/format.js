/* Zahlen- und Zeitformatierung */
(function (AB) {
  'use strict';

  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
  const F = { mode: 'short' };

  function fixed(n, digits) {
    return n.toFixed(digits).replace('.', ',');
  }

  // Grundformat: kleine Zahlen mit Tausenderpunkt, große mit Suffix / wiss. Notation
  F.num = function (n, opts) {
    if (typeof n !== 'number' || !isFinite(n)) return '∞';
    const small = opts && opts.small;
    const neg = n < 0;
    if (neg) n = -n;
    let out;
    if (n < 1000) {
      if (small && n < 10 && n !== Math.floor(n)) out = fixed(n, n < 1 ? 2 : 1);
      else if (small && n < 100 && n !== Math.floor(n)) out = fixed(n, 1);
      else out = String(Math.floor(n));
    } else if (n < 1e6 && F.mode !== 'sci') {
      out = Math.floor(n).toLocaleString('de-DE');
    } else {
      const exp = Math.floor(Math.log10(n));
      if (F.mode === 'sci') {
        out = fixed(n / Math.pow(10, exp), 2) + 'e' + exp;
      } else if (F.mode === 'eng') {
        const e3 = Math.floor(exp / 3) * 3;
        out = fixed(n / Math.pow(10, e3), 2) + 'e' + e3;
      } else {
        const idx = Math.floor(exp / 3);
        if (idx >= SUFFIXES.length) {
          out = fixed(n / Math.pow(10, exp), 2) + 'e' + exp;
        } else {
          const v = n / Math.pow(10, idx * 3);
          out = fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' ' + SUFFIXES[idx];
        }
      }
    }
    return (neg ? '-' : '') + out;
  };

  F.rate = (n) => F.num(n, { small: true });

  F.pct = function (x, digits) {
    return fixed(x * 100, digits === undefined ? 0 : digits) + ' %';
  };

  F.mult = function (x) {
    if (x >= 1000) return '×' + F.num(x);
    return '×' + fixed(x, x < 10 ? 2 : 1);
  };

  F.time = function (sec) {
    if (!isFinite(sec)) return '∞';
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + ' s';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + ' min' + (s ? ' ' + s + ' s' : '');
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 48) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
    const d = Math.floor(h / 24);
    return d + ' d ' + (h % 24) + ' h';
  };

  F.clock = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  };

  AB.Format = F;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
