/* Speichern, Laden, Export/Import (localStorage) */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const Save = {};

  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  Save.serialize = function (st) {
    return JSON.stringify(st, (k, v) => (k.charAt(0) === '_' ? undefined : v));
  };

  Save.write = function (st) {
    const ls = storage();
    if (!ls) return { ok: false, reason: 'Speicher nicht verfügbar.' };
    try {
      const json = Save.serialize(st);
      ls.setItem(C.SAVE_KEY + '_backup', ls.getItem(C.SAVE_KEY) || '');
      ls.setItem(C.SAVE_KEY, json);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e) };
    }
  };

  // Lädt den Spielstand; fällt bei Fehlern auf das Backup zurück.
  Save.read = function (nowMs) {
    const ls = storage();
    if (!ls) return { state: null };
    for (const key of [C.SAVE_KEY, C.SAVE_KEY + '_backup']) {
      const raw = ls.getItem(key);
      if (!raw) continue;
      try {
        return { state: AB.State.sanitize(JSON.parse(raw), nowMs), fromBackup: key !== C.SAVE_KEY };
      } catch (e) {
        if (key === C.SAVE_KEY) console.warn('Spielstand beschädigt, versuche Backup:', e);
      }
    }
    return { state: null };
  };

  Save.clear = function () {
    const ls = storage();
    if (!ls) return;
    ls.removeItem(C.SAVE_KEY);
    ls.removeItem(C.SAVE_KEY + '_backup');
  };

  function b64encode(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function b64decode(str) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(str)));
    return Buffer.from(str, 'base64').toString('utf8');
  }

  Save.exportString = (st) => C.EXPORT_PREFIX + b64encode(Save.serialize(st));

  // Gibt {ok, state} oder {ok:false, reason} zurück. Übernimmt nichts ungeprüft.
  Save.importString = function (text, nowMs) {
    if (typeof text !== 'string') return { ok: false, reason: 'Kein Text.' };
    text = text.trim();
    if (!text) return { ok: false, reason: 'Das Feld ist leer.' };
    if (text.length > 2e6) return { ok: false, reason: 'Text ist viel zu lang.' };
    let json;
    try {
      if (text.indexOf(C.EXPORT_PREFIX) === 0) json = b64decode(text.slice(C.EXPORT_PREFIX.length));
      else if (text.charAt(0) === '{') json = text;
      else return { ok: false, reason: 'Unbekanntes Format (erwartet "' + C.EXPORT_PREFIX + '…").' };
    } catch (e) {
      return { ok: false, reason: 'Text ist beschädigt (Base64 ungültig).' };
    }
    let raw;
    try { raw = JSON.parse(json); } catch (e) { return { ok: false, reason: 'Text ist beschädigt (JSON ungültig).' }; }
    try {
      return { ok: true, state: AB.State.sanitize(raw, nowMs) };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  };

  AB.Save = Save;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
