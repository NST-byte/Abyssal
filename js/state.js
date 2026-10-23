/* Spielzustand: Erzeugung, Lauf-Reset, Ebenen-Reset, Migration und Validierung */
(function (AB) {
  'use strict';
  const C = AB.CONFIG;
  const S = {};
  const CELLS = C.GRID.maxCols * C.GRID.maxRows;

  function zeroMap(list) {
    const o = {};
    list.forEach((x) => { o[x.id] = 0; });
    return o;
  }

  // Deterministischer Zufall (Mulberry32), Zustand liegt im Spielstand
  S.rand = function (st) {
    let t = (st.rng = (st.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  S.pickWeighted = function (st, list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = S.rand(st) * total;
    for (const x of list) { if (r < x.weight) return x; r -= x.weight; }
    return list[list.length - 1];
  };

  // Sektoren eines Laufs auswürfeln (Typ ist bis zur Erkundung verborgen)
  S.makeSectors = function (st) {
    const out = [];
    for (const z of C.MAP.zones) {
      const pool = C.MAP.types.filter((t) => !t.minZone || z >= t.minZone);
      for (let i = 0; i < C.MAP.sectorsPerZone; i++) {
        out.push({ zone: z, type: S.pickWeighted(st, pool).id, state: 'unknown' });
      }
    }
    return out;
  };

  function runFields() {
    return {
      res: { lumen: 0, mangan: 0, data: 0, alloy: 0, crystal: 0 },
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
      station: { cells: new Array(CELLS).fill(null) },
      current: null,
      map: { sectors: [], missions: [], subs: 0 },
      archetype: 'none',
      probe: null,
      run: { lumen: 0, mangan: 0, data: 0, alloy: 0, crystal: 0, clicks: 0, time: 0, abilityUses: 0, maxDepth: 0 },
    };
  }

  S.create = function (nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const st = runFields();
    Object.assign(st, {
      version: C.SAVE_VERSION,
      created: now,
      lastTick: now,
      time: 0,
      rng: (now ^ 0x9E3779B9) >>> 0,
      perlen: 0,
      record: 0,
      relics: zeroMap(C.RELICS),
      probes: zeroMap(C.PROBES.list),
      missions: {},
      achievements: {},
      prestige: { count: 0, total: 0, perlenEarned: 0, perlenAll: 0, tree: zeroMap(C.TREE), bestRunTime: 0, nextArchetype: 'none' },
      world: { count: 0, urlicht: 0, urlichtAll: 0, origin: zeroMap(C.ORIGIN) },
      stats: { lumenAll: 0, manganAll: 0, dataAll: 0, alloyAll: 0, crystalAll: 0, clicks: 0, events: 0, abilityUses: 0,
        scans: 0, holds: 0, playTime: 0, maxDepth: 0 },
      events: { nextAt: C.EVENTS.firstDelay },
      settings: { reducedMotion: false, numberFormat: 'short', sound: true, volume: 0.5, autobuy: true, autoUpgrades: true,
        autoReinforce: true, autoResearch: true, autoDescend: true, buyAmount: 1 },
      tutorial: { step: 0, done: false, seen: {} },
    });
    st.map.sectors = S.makeSectors(st);
    return st;
  };

  // Zelle bauen (Hilfsfunktion für Startboni)
  function placeStart(st, types) {
    let i = 0;
    for (const t of types) {
      while (i < CELLS && (st.station.cells[i] || (i % C.GRID.maxCols) >= C.GRID.baseCols || Math.floor(i / C.GRID.maxCols) >= C.GRID.baseRows)) i++;
      if (i < CELLS) st.station.cells[i] = { t, lvl: 1, on: true };
    }
  }

  // Neuer Lauf (nach Gezeitenwende / Probe / Weltenwende). Persistentes bleibt.
  S.resetRun = function (st, opts) {
    opts = opts || {};
    const tree = st.prestige.tree;
    const fresh = runFields();
    Object.assign(st, fresh);
    if (tree.t_archive) ['r_calib', 'r_dronelogic', 'r_proto'].forEach((id) => { st.research[id] = true; });
    st.res.lumen = C.FLOTSAM_START[Math.min(tree.t_flotsam || 0, C.FLOTSAM_START.length - 1)];
    if (tree.t_known) {
      st.depth = 1;
      st.miners.drone = 5;
      placeStart(st, ['reactor', 'smelter']);
    }
    st.archetype = opts.archetype && C.ARCHETYPE_BY_ID[opts.archetype] ? opts.archetype : 'none';
    if (st.archetype === 'forge') {
      st.depth = Math.max(st.depth, 1);
      placeStart(st, ['reactor', 'smelter', 'reactor', 'smelter'].slice(tree.t_known ? 2 : 0));
      st.res.alloy += 500;
    }
    st.probe = opts.probe || null;
    st.map.sectors = S.makeSectors(st);
    if (tree.t_charts) st.map.sectors.forEach((s) => { if (s.zone <= 2) s.state = 'revealed'; });
    st.events.nextAt = st.time + C.EVENTS.minDelay;
    st.run.maxDepth = st.depth;
    return st;
  };

  // Weltenwende: auch die Gezeiten-Ebene zurücksetzen
  S.resetCycle = function (st) {
    st.perlen = 0;
    st.prestige.count = 0;
    st.prestige.perlenEarned = 0;
    st.prestige.tree = zeroMap(C.TREE);
    return st;
  };

  // ---- Validierung ----------------------------------------------------------
  function num(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  }
  function int(v, def, min, max) { return Math.floor(num(v, def, min, max)); }
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
  function oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

  // Wirft einen Fehler, wenn die Daten grundsätzlich unbrauchbar sind;
  // repariert einzelne kaputte Felder auf Standardwerte.
  S.sanitize = function (raw, nowMs) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Kein gültiges Spielstand-Objekt.');
    if (typeof raw.version !== 'number') throw new Error('Versionskennung fehlt.');
    if (raw.version > C.SAVE_VERSION) throw new Error('Spielstand stammt aus einer neueren Version (' + raw.version + ').');
    if (!raw.res || typeof raw.res !== 'object' || !raw.gens || typeof raw.gens !== 'object') throw new Error('Pflichtfelder fehlen.');
    raw = S.migrate(JSON.parse(JSON.stringify(raw)));

    const d = S.create(nowMs);
    const M = C.MAX_VALUE;
    const st = d;
    st.created = num(raw.created, d.created, 0);
    st.lastTick = num(raw.lastTick, d.lastTick, 0);
    st.time = num(raw.time, 0, 0, M);
    st.rng = int(raw.rng, d.rng, 0, 4294967295) >>> 0;
    st.perlen = num(raw.perlen, 0, 0, M);
    st.record = int(raw.record, 0, 0, 1e6);

    const r = obj(raw.res);
    const resKeys = Object.keys(d.res);
    st.res = {};
    resKeys.forEach((k) => { st.res[k] = num(r[k], 0, 0, M); });
    st.gens = countMap(raw.gens, C.GENERATORS);
    st.miners = countMap(raw.miners, C.MINERS);
    st.sonar = int(raw.sonar, 0, 0, 1e6);
    st.analysis = int(raw.analysis, 0, 0, C.ANALYSIS.maxLevel);
    st.upgrades = flagMap(raw.upgrades, C.UPGRADES.map((u) => u.id));
    st.research = flagMap(raw.research, C.RESEARCH.map((x) => x.id));
    // pro Gabel nur ein Knoten
    const seenGroup = {};
    C.RESEARCH.forEach((x) => { if (x.group && st.research[x.id]) { if (seenGroup[x.group]) delete st.research[x.id]; else seenGroup[x.group] = true; } });
    st.reinforce = countMap(raw.reinforce, C.GENERATORS, C.REINFORCE.maxLevel);
    const protos = Array.isArray(raw.protocols) ? raw.protocols.filter((p) => C.PROTOCOL_BY_ID[p]) : [];
    st.protocols = protos.filter((p, i) => protos.indexOf(p) === i).slice(0, 2);
    st.protocolSwitches = int(raw.protocolSwitches, 0, 0, 1000);
    st.depth = int(raw.depth, 0, 0, C.DEPTHS.length - 1);

    st.buffs = (Array.isArray(raw.buffs) ? raw.buffs : [])
      .filter((b) => b && typeof b.id === 'string' && isFinite(b.mult) && isFinite(b.until) && b.mult > 0 && b.mult <= 100)
      .slice(0, 8)
      .map((b) => ({ id: b.id.slice(0, 20), mult: b.mult, until: b.until, name: typeof b.name === 'string' ? b.name.slice(0, 40) : b.id }));
    st.ability = { readyAt: num(obj(raw.ability).readyAt, 0, 0, M) };

    // Station
    const cells = Array.isArray(obj(raw.station).cells) ? raw.station.cells : [];
    st.station = { cells: new Array(CELLS).fill(null) };
    for (let i = 0; i < CELLS; i++) {
      const c = obj(cells[i]);
      if (C.MODULE_BY_ID[c.t]) st.station.cells[i] = { t: c.t, lvl: int(c.lvl, 1, 1, C.GRID.maxLevel), on: bool(c.on, true) };
    }

    // Strömung
    const cur = obj(raw.current);
    if (C.CURRENT_BY_ID[cur.type] && isFinite(cur.endsAt)) {
      st.current = {
        type: cur.type, endsAt: num(cur.endsAt, st.time, 0, M),
        queue: (Array.isArray(cur.queue) ? cur.queue : []).filter((q) => C.CURRENT_BY_ID[q]).slice(0, 6),
        charge: int(cur.charge, 0, 0, C.CURRENTS.holdRecharge),
      };
    }

    // Karte
    const mp = obj(raw.map);
    const secs = Array.isArray(mp.sectors) ? mp.sectors : [];
    if (secs.length === st.map.sectors.length) {
      st.map.sectors = st.map.sectors.map((def, i) => {
        const s = obj(secs[i]);
        const type = C.SECTOR_BY_ID[s.type] && (!C.SECTOR_BY_ID[s.type].minZone || def.zone >= C.SECTOR_BY_ID[s.type].minZone) ? s.type : def.type;
        return { zone: def.zone, type, state: oneOf(s.state, ['unknown', 'scanning', 'revealed', 'exploited', 'depleted'], 'unknown') };
      });
    }
    st.map.subs = int(mp.subs, 0, 0, 50);
    st.map.missions = (Array.isArray(mp.missions) ? mp.missions : []).slice(0, 20).map(obj)
      .filter((m) => Number.isInteger(m.sector) && m.sector >= 0 && m.sector < st.map.sectors.length && isFinite(m.endsAt) && isFinite(m.duration))
      .map((m) => ({ sector: m.sector, endsAt: m.endsAt, duration: num(m.duration, 1, 1, 1e7) }));
    st.map.missions.forEach((m) => { if (st.map.sectors[m.sector].state === 'unknown') st.map.sectors[m.sector].state = 'scanning'; });
    st.map.sectors.forEach((s, i) => { if (s.state === 'scanning' && !st.map.missions.some((m) => m.sector === i)) s.state = 'unknown'; });

    st.archetype = C.ARCHETYPE_BY_ID[raw.archetype] ? raw.archetype : 'none';
    const pr = obj(raw.probe);
    st.probe = C.PROBE_BY_ID[pr.id] ? { id: pr.id, level: int(pr.level, 1, 1, C.PROBES.goals.length) } : null;

    const run = obj(raw.run);
    Object.keys(d.run).forEach((k) => { st.run[k] = num(run[k], 0, 0, M); });

    st.relics = countMap(raw.relics, C.RELICS, (x) => x.max);
    st.probes = countMap(raw.probes, C.PROBES.list, C.PROBES.goals.length);
    st.missions = flagMap(raw.missions, C.MISSIONS.map((m) => m.id));
    st.achievements = flagMap(raw.achievements, C.ACHIEVEMENTS.map((a) => a.id));

    const p = obj(raw.prestige);
    st.prestige = {
      count: int(p.count, 0, 0, 1e6),
      total: int(p.total, 0, 0, 1e6),
      perlenEarned: num(p.perlenEarned, 0, 0, M),
      perlenAll: num(p.perlenAll, 0, 0, M),
      tree: countMap(p.tree, C.TREE, (x) => x.max),
      bestRunTime: num(p.bestRunTime, 0, 0, M),
      nextArchetype: C.ARCHETYPE_BY_ID[p.nextArchetype] ? p.nextArchetype : 'none',
    };
    if (st.prestige.total < st.prestige.count) st.prestige.total = st.prestige.count;
    const seenT = {};
    C.TREE.forEach((x) => { if (x.group && st.prestige.tree[x.id]) { if (seenT[x.group]) st.prestige.tree[x.id] = 0; else seenT[x.group] = true; } });

    const w = obj(raw.world);
    st.world = { count: int(w.count, 0, 0, 1e6), urlicht: num(w.urlicht, 0, 0, M), urlichtAll: num(w.urlichtAll, 0, 0, M), origin: countMap(w.origin, C.ORIGIN, (x) => x.max) };

    const stats = obj(raw.stats);
    Object.keys(d.stats).forEach((k) => { st.stats[k] = num(stats[k], 0, 0, M); });

    st.events = { nextAt: num(obj(raw.events).nextAt, st.time + C.EVENTS.minDelay, 0, M) };

    const s = obj(raw.settings);
    st.settings = {
      reducedMotion: bool(s.reducedMotion, false),
      numberFormat: oneOf(s.numberFormat, ['short', 'sci', 'eng'], 'short'),
      sound: bool(s.sound, true),
      volume: num(s.volume, 0.5, 0, 1),
      autobuy: bool(s.autobuy, true),
      autoUpgrades: bool(s.autoUpgrades, true),
      autoReinforce: bool(s.autoReinforce, true),
      autoResearch: bool(s.autoResearch, true),
      autoDescend: bool(s.autoDescend, true),
      buyAmount: [1, 10, 25, -1].indexOf(s.buyAmount) >= 0 ? s.buyAmount : 1,
    };

    const t = obj(raw.tutorial);
    const seen = {};
    Object.keys(obj(t.seen)).slice(0, 60).forEach((k) => { if (t.seen[k] === true && /^[a-z_0-9]{1,30}$/.test(k)) seen[k] = true; });
    st.tutorial = { step: int(t.step, 0, 0, 100), done: bool(t.done, false), seen };
    if (typeof raw.migratedFrom === 'number') st.migratedFrom = int(raw.migratedFrom, 1, 1, 100);
    st.version = C.SAVE_VERSION;
    return st;
  };

  // ---- Migration ------------------------------------------------------------
  // v1 → v2: Expeditionen werden zu Relikten, der Perlen-Shop wird erstattet.
  const V1_SHOP = { p_memory: [2, 1.45], p_flotsam: [1, 2], p_knowledge: [4, 1], p_compass: [3, 2], p_archive: [5, 1],
    p_tide: [2, 1.8], p_automaton: [6, 1], p_luster: [10, 1], p_dual: [18, 1] };
  const V1_EXP_TO_RELIC = { wreck: 'compass', smoker: 'forgeheart', grave: 'skull' };

  S.migrate = function (raw) {
    if (raw.version === 1) {
      const p = obj(raw.prestige);
      let refund = 0;
      const shop = obj(p.shop);
      for (const id in V1_SHOP) {
        const lvl = Math.max(0, Math.min(60, Math.floor(Number(shop[id]) || 0)));
        for (let i = 0; i < lvl; i++) refund += Math.ceil(V1_SHOP[id][0] * Math.pow(V1_SHOP[id][1], i));
      }
      raw.perlen = (Number(raw.perlen) || 0) + refund;
      const count = Math.max(0, Math.floor(Number(p.count) || 0));
      raw.prestige = { count, total: count, perlenEarned: Number(p.perlenEarned) || 0, perlenAll: Number(p.perlenEarned) || 0,
        tree: {}, bestRunTime: Number(p.bestRunTime) || 0 };
      const ex = obj(obj(raw.expedition).levels);
      raw.relics = {};
      for (const k in V1_EXP_TO_RELIC) {
        const lvl = Math.floor(Number(ex[k]) || 0);
        if (lvl > 0) raw.relics[V1_EXP_TO_RELIC[k]] = Math.min(3, 1 + Math.floor(lvl / 4));
      }
      delete raw.expedition;
      raw.migratedFrom = 1;
      raw.version = 2;
    }
    return raw;
  };

  S.CELLS = CELLS;
  AB.State = S;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
