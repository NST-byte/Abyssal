/* Spielzustand: Erzeugung, Lauf-Reset und Validierung */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const S = {};

  function zeroMap(list) {
    const o = {};
    list.forEach((x) => { o[x.id] = 0; });
    return o;
  }

  function runFields() {
    return {
      res: { lumen: 0, mangan: 0, data: 0 },
      gens: zeroMap(C.GENERATORS),
      miners: zeroMap(C.MINERS),
      sonar: 0,
      analysis: 0,
      upgrades: {},
      research: {},
      reinforce: zeroMap(C.GENERATORS),
      protocols: [],
      protocolSwitches: 0,
      depth: 0,
      buffs: [],
      ability: { readyAt: 0 },
      expedition: { active: null, levels: zeroMap(C.EXPEDITIONS) },
      run: { lumen: 0, mangan: 0, data: 0, clicks: 0, time: 0, abilityUses: 0, expeditions: 0, maxLps: 0 },
    };
  }

  S.create = function (nowMs) {
    const now = nowMs || Date.now();
    const st = runFields();
    Object.assign(st, {
      version: C.SAVE_VERSION,
      created: now,
      lastTick: now,
      time: 0,
      perlen: 0,
      missions: {},
      achievements: {},
      prestige: { count: 0, shop: zeroMap(C.PRESTIGE_SHOP), perlenEarned: 0, bestRunTime: 0 },
      stats: { lumenAll: 0, manganAll: 0, dataAll: 0, clicks: 0, events: 0, abilityUses: 0, expeditions: 0, playTime: 0, maxDepth: 0 },
      events: { nextAt: C.EVENTS.firstDelay },
      settings: { reducedMotion: false, numberFormat: 'short', sound: true, volume: 0.5, autobuy: true, buyAmount: 1 },
      tutorial: { step: 0, done: false, seen: {} },
    });
    return st;
  };

  // Gezeitenwende: nur Lauf-Felder zurücksetzen
  S.resetRun = function (st) {
    const keepResearch = (st.prestige.shop.p_archive || 0) > 0;
    const fresh = runFields();
    const keptResearch = {};
    if (keepResearch) {
      ['r_calib', 'r_proto'].forEach((id) => { if (st.research[id]) keptResearch[id] = true; });
    }
    Object.assign(st, fresh);
    st.research = keptResearch;
    const flot = st.prestige.shop.p_flotsam || 0;
    st.res.lumen = C.FLOTSAM_START[Math.min(flot, C.FLOTSAM_START.length - 1)];
    if ((st.prestige.shop.p_knowledge || 0) > 0) {
      st.depth = 1;
      st.miners.drone = 5;
    }
    st.events.nextAt = st.time + C.EVENTS.minDelay;
    return st;
  };

  // ---- Validierung ----------------------------------------------------------
  function num(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  }
  function int(v, def, min, max) {
    return Math.floor(num(v, def, min, max));
  }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function flagMap(v, validIds) {
    const out = {};
    const src = obj(v);
    validIds.forEach((id) => { if (src[id] === true) out[id] = true; });
    return out;
  }
  function countMap(v, list, max) {
    const out = {};
    const src = obj(v);
    list.forEach((x) => { out[x.id] = int(src[x.id], 0, 0, max === undefined ? 1e6 : (typeof max === 'function' ? max(x) : max)); });
    return out;
  }

  // Wirft einen Fehler, wenn die Daten grundsätzlich unbrauchbar sind;
  // repariert einzelne kaputte Felder auf Standardwerte.
  S.sanitize = function (raw, nowMs) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Kein gültiges Spielstand-Objekt.');
    if (typeof raw.version !== 'number') throw new Error('Versionskennung fehlt.');
    if (raw.version > C.SAVE_VERSION) throw new Error('Spielstand stammt aus einer neueren Version (' + raw.version + ').');
    raw = S.migrate(raw);
    if (!raw.res || typeof raw.res !== 'object' || !raw.gens || typeof raw.gens !== 'object') throw new Error('Pflichtfelder fehlen.');

    const d = S.create(nowMs);
    const M = C.MAX_VALUE;
    const st = d;
    st.created = num(raw.created, d.created, 0);
    st.lastTick = num(raw.lastTick, d.lastTick, 0);
    st.time = num(raw.time, 0, 0, M);
    st.perlen = num(raw.perlen, 0, 0, M);

    const r = obj(raw.res);
    st.res = { lumen: num(r.lumen, 0, 0, M), mangan: num(r.mangan, 0, 0, M), data: num(r.data, 0, 0, M) };
    st.gens = countMap(raw.gens, C.GENERATORS);
    st.miners = countMap(raw.miners, C.MINERS);
    st.sonar = int(raw.sonar, 0, 0, 1e6);
    st.analysis = int(raw.analysis, 0, 0, C.ANALYSIS.maxLevel);
    st.upgrades = flagMap(raw.upgrades, C.UPGRADES.map((u) => u.id));
    st.research = flagMap(raw.research, C.RESEARCH.map((x) => x.id));
    st.reinforce = countMap(raw.reinforce, C.GENERATORS, C.REINFORCE.maxLevel);
    const protos = Array.isArray(raw.protocols) ? raw.protocols.filter((p) => C.PROTOCOL_BY_ID[p]) : [];
    st.protocols = protos.filter((p, i) => protos.indexOf(p) === i).slice(0, 2);
    st.protocolSwitches = int(raw.protocolSwitches, 0, 0, 1000);
    st.depth = int(raw.depth, 0, 0, C.DEPTHS.length - 1);

    st.buffs = (Array.isArray(raw.buffs) ? raw.buffs : [])
      .filter((b) => b && typeof b.id === 'string' && isFinite(b.mult) && isFinite(b.until) && b.mult > 0 && b.mult <= 100)
      .slice(0, 8)
      .map((b) => ({ id: b.id, mult: b.mult, until: b.until, name: typeof b.name === 'string' ? b.name.slice(0, 40) : b.id }));
    st.ability = { readyAt: num(obj(raw.ability).readyAt, 0, 0, M) };

    const ex = obj(raw.expedition);
    st.expedition = { active: null, levels: countMap(ex.levels, C.EXPEDITIONS, (x) => x.maxLevel) };
    const act = obj(ex.active);
    if (C.EXPEDITION_BY_ID[act.id] && isFinite(act.endsAt) && isFinite(act.duration)) {
      st.expedition.active = { id: act.id, endsAt: act.endsAt, duration: num(act.duration, 1, 1, 1e6) };
    }

    const run = obj(raw.run);
    Object.keys(d.run).forEach((k) => { st.run[k] = num(run[k], 0, 0, M); });

    st.missions = flagMap(raw.missions, C.MISSIONS.map((m) => m.id));
    st.achievements = flagMap(raw.achievements, C.ACHIEVEMENTS.map((a) => a.id));

    const p = obj(raw.prestige);
    st.prestige = {
      count: int(p.count, 0, 0, 1e6),
      shop: countMap(p.shop, C.PRESTIGE_SHOP, (x) => x.maxLevel),
      perlenEarned: num(p.perlenEarned, 0, 0, M),
      bestRunTime: num(p.bestRunTime, 0, 0, M),
    };

    const stats = obj(raw.stats);
    Object.keys(d.stats).forEach((k) => { st.stats[k] = num(stats[k], 0, 0, M); });

    st.events = { nextAt: num(obj(raw.events).nextAt, st.time + C.EVENTS.minDelay, 0, M) };

    const s = obj(raw.settings);
    st.settings = {
      reducedMotion: bool(s.reducedMotion, false),
      numberFormat: ['short', 'sci', 'eng'].indexOf(s.numberFormat) >= 0 ? s.numberFormat : 'short',
      sound: bool(s.sound, true),
      volume: num(s.volume, 0.5, 0, 1),
      autobuy: bool(s.autobuy, true),
      buyAmount: [1, 10, 25, -1].indexOf(s.buyAmount) >= 0 ? s.buyAmount : 1,
    };

    const t = obj(raw.tutorial);
    const seen = {};
    Object.keys(obj(t.seen)).slice(0, 50).forEach((k) => { if (t.seen[k] === true && /^[a-z_0-9]{1,30}$/.test(k)) seen[k] = true; });
    st.tutorial = { step: int(t.step, 0, 0, 100), done: bool(t.done, false), seen };
    return st;
  };

  // Platz für spätere Formatänderungen
  S.migrate = function (raw) {
    // v1 ist aktuell – hier würden z. B. Umbenennungen von Feldern passieren.
    return raw;
  };

  AB.State = S;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
