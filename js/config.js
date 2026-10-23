/* ==========================================================================
   ABYSSAL – zentrale Balance-Konfiguration (Version 2)
   Alle Preise, Raten, Skalierungen, Rezepte und Freischaltungen stehen hier.
   Wer balancen will, muss nur diese Datei anfassen.
   ========================================================================== */
(function (AB) {
  'use strict';

  const C = {};

  // --- Technik ---------------------------------------------------------------
  C.SAVE_KEY = 'abyssal_save';
  C.SAVE_VERSION = 2;
  C.EXPORT_PREFIX = 'ABYSSAL1:';
  C.AUTOSAVE_SECONDS = 15;
  C.MAX_STEP = 30;               // max. Sekunden pro Simulationsschritt
  C.OFFLINE = { baseCapHours: 4, minSeconds: 60 };
  C.MAX_VALUE = 1e300;           // Sicherheitsdeckel gegen Infinity

  // --- Ressourcen ------------------------------------------------------------
  C.RESOURCES = {
    lumen: { name: 'Lumen', icon: 'lumen' },
    mangan: { name: 'Mangan', icon: 'mangan' },
    data: { name: 'Daten', icon: 'data' },
    alloy: { name: 'Legierung', icon: 'alloy' },
    crystal: { name: 'Kristalle', icon: 'crystal' },
    perlen: { name: 'Perlen', icon: 'perlen' },
    urlicht: { name: 'Urlicht', icon: 'urlicht' },
  };

  // --- Aktiver Puls ----------------------------------------------------------
  C.CLICK = { base: 1 };

  // --- Tiefenzonen -----------------------------------------------------------
  // Jede Zone: globaler Produktionsbonus (DEPTH_MULT^Zone) + neue Mechaniken.
  // reqPrestige: Zone erst nach so vielen Gezeitenwenden (insgesamt) zugänglich.
  C.DEPTH_MULT = 1.25;
  C.DEPTHS = [
    { name: 'Schelfkante', meters: 0, cost: {},
      story: 'Die Station Tethys-7 erwacht. Restlicht, Plankton, Stille.',
      unlocks: ['Planktonnetze', 'Leuchtalgen-Beete'] },
    { name: 'Dämmerzone', into: 'in die Dämmerzone', meters: 200, cost: { lumen: 30000 },
      story: 'Das Sonnenlicht verblasst. Quallen ziehen in Schwärmen vorbei, und am Grund liegen Manganknollen.',
      unlocks: ['Mangan & Knollen-Drohnen', 'Verstärkungen', 'Station: Reaktor & Schmelze', 'Legierung', 'Quallen & Anglerfische'] },
    { name: 'Mitternachtszone', into: 'in die Mitternachtszone', meters: 1000, cost: { lumen: 1.2e7, mangan: 1200, alloy: 80 },
      story: 'Absolute Dunkelheit. Nur noch das, was selbst leuchtet. Die alten Sonarbojen der Station reagieren wieder.',
      unlocks: ['Daten & Sonarbojen', 'Tech-Baum mit Gabelungen', 'Protokolle', 'Strömungen', 'Neue Module', 'Schlotturbinen & Korallen'] },
    { name: 'Abyssal', into: 'ins Abyssal', meters: 4000, cost: { lumen: 1.5e10, mangan: 4e4, data: 1000, alloy: 3000 },
      story: 'Eiskaltes Wasser, enormer Druck. Irgendetwas Großes antwortet auf deine Sonarpulse.',
      unlocks: ['Tiefseekarte & U-Boote', 'Relikte', 'Fertigung & Resonanzkristalle', 'Tiefbohrer', 'Leviathan-Echos'] },
    { name: 'Hadal', into: 'in den Hadal-Graben', meters: 8000, cost: { lumen: 2e13, alloy: 2e5, data: 2e4, crystal: 1500 },
      story: 'Der Graben. Ganz unten pulsiert etwas Uraltes – ein Herz aus Licht. Die Gezeiten gehorchen ihm.',
      unlocks: ['Tiefenherzen', 'Gezeitenwende (Prestige)'] },
    { name: 'Schlund', into: 'in den Schlund', meters: 11000, cost: { lumen: 2e16, alloy: 6e5, crystal: 2e4 }, reqPrestige: 1,
      story: 'Jenseits des Grabens öffnet sich ein Riss. Das Wasser ist warm – und es atmet.',
      unlocks: ['Schlundgärten', 'Druckresonator', 'Kartenzone Schlund'] },
    { name: 'Herzkammer', into: 'in die Herzkammer', meters: 15000, cost: { lumen: 5e20, crystal: 2e5, alloy: 5e7, data: 4e5 }, reqPrestige: 3,
      story: 'Du bist im Herzen angekommen. Jeder Schlag verändert die Welt über dir. Hier endet die Tiefe – und beginnt etwas anderes.',
      unlocks: ['Kernresonanz', 'Tiefenrekord (endlos)', 'Weltenwende (2. Prestige-Ebene)'] },
  ];

  // --- Lumen-Anlagen ---------------------------------------------------------
  // cost(n) = baseCost * growth^n ; cost2 = zweite Ressource (Ketten-Pflicht)
  C.GENERATORS = [
    { id: 'plankton', name: 'Planktonnetz', depth: 0, baseCost: 15, baseProd: 0.3, growth: 1.15,
      desc: 'Feinmaschige Netze fangen leuchtendes Plankton aus der Strömung.' },
    { id: 'algae', name: 'Leuchtalgen-Beet', depth: 0, baseCost: 120, baseProd: 1.6, growth: 1.15,
      desc: 'Kultivierte Algenteppiche, die bei Berührung aufglühen.' },
    { id: 'jelly', name: 'Quallenschwarm', depth: 1, baseCost: 1500, baseProd: 9, growth: 1.15,
      desc: 'Gezähmte Kammquallen pulsieren im Takt der Station.' },
    { id: 'angler', name: 'Anglerfisch-Zucht', depth: 1, baseCost: 1.8e4, baseProd: 52, growth: 1.15,
      desc: 'Ihre Köder-Laternen brennen heller als jede Lampe.' },
    { id: 'vent', name: 'Schlotturbine', depth: 2, baseCost: 3e5, baseProd: 330, growth: 1.15,
      cost2: { res: 'alloy', base: 6, growth: 1.07 },
      desc: 'Hydrothermale Quellen treiben chemolumineszente Turbinen an. Braucht Legierung.' },
    { id: 'coral', name: 'Korallen-Resonator', depth: 2, baseCost: 5e6, baseProd: 2100, growth: 1.15,
      cost2: { res: 'alloy', base: 40, growth: 1.07 },
      desc: 'Tiefseekorallen, die Licht speichern und gebündelt abgeben. Braucht Legierung.' },
    { id: 'leviathan', name: 'Leviathan-Echo', depth: 3, baseCost: 9e7, baseProd: 14000, growth: 1.15,
      cost2: { res: 'crystal', base: 1, growth: 1.07 },
      desc: 'Die Gesänge riesiger Wesen bringen das Wasser selbst zum Leuchten. Braucht Kristalle.' },
    { id: 'heart', name: 'Tiefenherz', depth: 4, baseCost: 2.5e9, baseProd: 110000, growth: 1.15,
      cost2: { res: 'crystal', base: 8, growth: 1.07 },
      desc: 'Ein Splitter des uralten Herzens im Graben. Er schlägt in Licht. Braucht Kristalle.' },
    { id: 'maw', name: 'Schlundgarten', depth: 5, baseCost: 2e13, baseProd: 4e6, growth: 1.15,
      cost2: { res: 'crystal', base: 150, growth: 1.07 },
      desc: 'Lebende Riffe am Rand des Risses. Sie fressen Wärme und speien Licht.' },
    { id: 'core', name: 'Kernresonanz', depth: 6, baseCost: 5e17, baseProd: 9e7, growth: 1.15,
      cost2: { res: 'crystal', base: 4000, growth: 1.07 },
      desc: 'Die Station schwingt im Takt des Herzens. Jeder Schlag ein Lichtblitz.' },
  ];

  // Anlagen-Upgrades: werden ab bestimmter Anzahl verfügbar, je x2
  C.GEN_UPGRADE_TIERS = [
    { at: 1, costMult: 10, name: 'Feinjustierung' },
    { at: 5, costMult: 50, name: 'Strömungsform' },
    { at: 25, costMult: 500, name: 'Symbiontenkultur' },
    { at: 50, costMult: 5e4, name: 'Druckhärtung' },
    { at: 100, costMult: 5e6, name: 'Resonanzgitter' },
    { at: 150, costMult: 5e8, name: 'Kaltlicht-Kern' },
    { at: 200, costMult: 5e10, name: 'Abyssale Reife' },
  ];

  // Synergien: Anlage i profitiert von Anlage i-1
  C.SYNERGY = { needSrc: 25, needDst: 10, costMult: 300, perUnit: 0.01 };

  C.CLICK_UPGRADES = [
    { id: 'c1', name: 'Gebündelter Puls', cost: 80, req: { gen: 'plankton', n: 1 }, effects: [{ type: 'clickMult', mult: 2 }], desc: 'Puls-Ertrag x2.' },
    { id: 'c2', name: 'Lichtleiter', cost: 1500, req: { lumenRun: 800 }, effects: [{ type: 'clickPct', pct: 0.01 }], desc: 'Jeder Puls bringt zusätzlich 1 % deiner Lumen/s.' },
    { id: 'c3', name: 'Kohärente Emission', cost: 6e4, req: { lumenRun: 3e4 }, effects: [{ type: 'clickPct', pct: 0.02 }], desc: 'Puls +2 % deiner Lumen/s.' },
    { id: 'c4', name: 'Fokuslinse', cost: 2e6, req: { depth: 1 }, effects: [{ type: 'clickMult', mult: 3 }], desc: 'Puls-Grundertrag x3.' },
    { id: 'c5', name: 'Photonenkaskade', cost: 2e9, req: { depth: 2 }, effects: [{ type: 'clickPct', pct: 0.03 }], desc: 'Puls +3 % deiner Lumen/s.' },
    { id: 'c6', name: 'Herzschlag-Synchron', cost: 5e13, req: { depth: 3 }, effects: [{ type: 'clickPct', pct: 0.04 }], desc: 'Puls +4 % deiner Lumen/s.' },
  ];

  C.GLOBAL_UPGRADES = [
    { id: 'g1', name: 'Phototaxis', cost: 6000, req: { lumenRun: 3000 }, effects: [{ type: 'allMult', mult: 1.25 }], desc: 'Alle Anlagen +25 %.' },
    { id: 'g2', name: 'Biolumineszenz-Netz', cost: 4e5, req: { lumenRun: 1.5e5 }, effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'g3', name: 'Druckausgleich', cost: 2e8, req: { depth: 2 }, effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'g4', name: 'Kaltlicht-Doktrin', cost: 1e11, req: { depth: 3 }, effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
    { id: 'g5', name: 'Grabenchor', cost: 2e14, req: { depth: 4 }, effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
    { id: 'g6', name: 'Drohnen-Scheinwerfer', cost: 5e4, req: { depth: 1 }, effects: [{ type: 'manganMult', mult: 1.5 }], desc: 'Mangan-Förderung +50 %.' },
    { id: 'g7', name: 'Sonar-Verstärker', cost: 5e8, req: { depth: 2 }, effects: [{ type: 'dataMult', mult: 1.5 }], desc: 'Datengewinnung +50 %.' },
    { id: 'g8', name: 'Hitzetauscher', cost: 3e7, req: { depth: 2 }, effects: [{ type: 'smelterMult', mult: 1.5 }], desc: 'Schmelzen +50 % Durchsatz.' },
    { id: 'g9', name: 'Gitterzucht', cost: 5e12, req: { depth: 3 }, effects: [{ type: 'foundryMult', mult: 1.5 }], desc: 'Fertigungen +50 % Durchsatz.' },
    { id: 'g10', name: 'Riss-Symphonie', cost: 1e18, req: { depth: 5 }, effects: [{ type: 'allMult', mult: 3 }], desc: 'Alle Anlagen x3.' },
  ];

  // --- Mangan --------------------------------------------------------------
  C.MINERS = [
    { id: 'drone', name: 'Knollen-Drohne', depth: 1, baseCost: 1500, growth: 1.17, prod: 0.35,
      desc: 'Kleine Sammler, die Manganknollen vom Meeresboden picken.' },
    { id: 'drill', name: 'Tiefbohrer', depth: 3, baseCost: 5e9, growth: 1.2, prod: 15,
      desc: 'Schwere Bohrköpfe fressen sich in die Krustenplatten.' },
  ];

  // Verstärkung: Mangan in einzelne Anlagen investieren
  C.REINFORCE = { baseCost: 15, tierScale: 3.2, growth: 3, mult: 1.25, maxLevel: 15 };

  // --- Daten -----------------------------------------------------------------
  C.SONAR = { id: 'sonar', name: 'Sonarboje', depth: 2, baseCost: { lumen: 4e6, mangan: 120 }, growth: 1.22, prod: 0.12,
    desc: 'Lauscht in die Tiefe und wertet Echos aus. Erzeugt Daten.' };

  // --- Station: Modulraster --------------------------------------------------
  // Module kosten mehr, je mehr du vom selben Typ hast (countGrowth) und
  // werden pro Stufe teurer (levelGrowth). Leistung pro Stufe: Stufe * levelPower^(Stufe-1).
  // Energie: + liefert, - verbraucht.
  C.GRID = { baseCols: 3, baseRows: 3, maxCols: 6, maxRows: 6, maxLevel: 20, levelGrowth: 2.3, levelPower: 1.25, demolishRefund: 0.5 };
  C.MODULE_DEPTH_BONUS = 0.15; // Tiefendruck: Schmelzen, Fertigungen und Labore +15 % pro erreichter Zone
  C.MODULES = [
    { id: 'reactor', name: 'Reaktor', short: 'RE', depth: 1, cost: { lumen: 2500, mangan: 40 }, countGrowth: 1.9,
      energy: 8, desc: 'Liefert 8 Energie pro Stufe. Ohne Energie stehen alle anderen Module.' },
    { id: 'smelter', name: 'Schmelze', short: 'SM', depth: 1, cost: { lumen: 6000, mangan: 80 }, countGrowth: 1.9,
      energy: -3, out: { alloy: 0.3 }, desc: 'Schmilzt Mangan (und Lumen) zu Legierung. Rezept über den Tech-Baum änderbar.' },
    { id: 'cooler', name: 'Kühlturm', short: 'KT', depth: 2, cost: { alloy: 40, mangan: 600 }, countGrowth: 2,
      energy: 0, adj: { boostProd: 0.35, boostReactor: 0.25 }, desc: 'Benachbarte Schmelzen/Fertigungen +35 % Durchsatz, benachbarte Reaktoren +25 % Energie (pro Stufe +10 % extra).' },
    { id: 'relay', name: 'Relais', short: 'RL', depth: 2, cost: { alloy: 60, data: 40 }, countGrowth: 2,
      energy: 0, adj: { energySave: 0.4 }, desc: 'Benachbarte Module verbrauchen 40 % weniger Energie (mehrere Relais stapeln bis -80 %).' },
    { id: 'lab', name: 'Sonarlabor', short: 'LB', depth: 2, cost: { alloy: 80, lumen: 2e6 }, countGrowth: 1.9,
      energy: -4, out: { data: 1 }, desc: 'Wertet Echos direkt in der Station aus: Daten pro Sekunde – braucht Energie statt Bojen.' },
    { id: 'prism', name: 'Prisma', short: 'PR', depth: 2, cost: { alloy: 120, lumen: 5e6 }, countGrowth: 2.2,
      energy: -2, prismPct: 0.05, desc: 'Bündelt Licht: alle Lumen-Anlagen +5 % pro Stufe (alle Prismen addieren sich).' },
    { id: 'foundry', name: 'Fertigung', short: 'FE', depth: 3, cost: { alloy: 500, data: 150 }, countGrowth: 1.9,
      energy: -6, out: { crystal: 0.1 }, desc: 'Züchtet Resonanzkristalle aus Legierung und Daten.' },
    { id: 'dock', name: 'U-Boot-Dock', short: 'DK', depth: 3, cost: { alloy: 800, lumen: 1e10 }, countGrowth: 2.5,
      energy: -3, dockSubs: 1, dockSpeed: 0.1, desc: 'Pro Stufe +1 U-Boot-Platz und +10 % Tauchgeschwindigkeit.' },
    { id: 'resonator', name: 'Druckresonator', short: 'DR', depth: 5, cost: { crystal: 3000, alloy: 1e5 }, countGrowth: 3,
      energy: -10, adj: { mult: 1.5 }, desc: 'Benachbarte produzierende Module ×1,5 (pro Stufe +0,1). Teuer, aber stark – Platzierung ist alles.' },
  ];

  // Rezepte: Input pro produzierter Einheit
  C.RECIPES = {
    smelter: {
      base: { name: 'Standard', in: { mangan: 1.5, lumen: 60 } },
      cold: { name: 'Kaltschmelze', in: { mangan: 2.4 }, desc: 'Kein Lumen, dafür 60 % mehr Mangan.' },
      light: { name: 'Lichtschmelze', in: { lumen: 6000 }, desc: 'Kein Mangan, dafür 100× so viel Lumen.' },
    },
    foundry: {
      base: { name: 'Standard', in: { alloy: 4, data: 2 } },
      grow: { name: 'Kristallzucht', in: { alloy: 5 }, speed: 0.75, desc: 'Keine Daten, aber 25 % langsamer und mehr Legierung.' },
      compress: { name: 'Datenkompression', in: { alloy: 4, data: 5 }, speed: 1.8, desc: '80 % schneller, aber 2,5× Daten.' },
    },
  };

  // --- Tech-Baum (Daten, pro Lauf) ------------------------------------------
  // group = exklusive Gabelung: nur ein Knoten der Gruppe kann aktiv sein.
  // req: Liste; ein Eintrag kann ein Array sein (= einer davon genügt).
  C.TECH_BRANCHES = [
    { id: 'bio', name: 'Biologie' }, { id: 'ind', name: 'Industrie' }, { id: 'nav', name: 'Navigation' },
  ];
  C.RESEARCH = [
    // Biologie
    { id: 'r_calib', branch: 'bio', x: 0.5, y: 0, name: 'Sonar-Kalibrierung', cost: 15, depth: 2, effects: [{ type: 'dataMult', mult: 2 }], desc: 'Datengewinnung x2.' },
    { id: 'r_catalyst', branch: 'bio', x: 0.5, y: 1, name: 'Biokatalyse', cost: 70, depth: 2, req: ['r_calib'], effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'r_chain', branch: 'bio', x: 0.5, y: 2, name: 'Nahrungskette', cost: 260, depth: 2, req: ['r_catalyst'], effects: [{ type: 'synergyBoost', mult: 2 }], desc: 'Alle Synergie-Boni werden verdoppelt.' },
    { id: 'r_shallow', branch: 'bio', x: 0, y: 3, group: 'breed', name: 'Flachwasserzucht', cost: 700, depth: 2, req: ['r_chain'], effects: [{ type: 'tierMult', min: 0, max: 3, mult: 4 }], desc: 'Die vier frühen Anlagen x4. Stark, solange sie den Großteil deiner Produktion stellen.' },
    { id: 'r_deep', branch: 'bio', x: 1, y: 3, group: 'breed', name: 'Tiefenzucht', cost: 700, depth: 2, req: ['r_chain'], effects: [{ type: 'tierMult', min: 4, max: 9, mult: 2.5 }], desc: 'Alle Anlagen ab der Schlotturbine x2,5. Lohnt sich, sobald die tiefen Anlagen dominieren.' },
    { id: 'r_song', branch: 'bio', x: 0, y: 4, name: 'Leviathan-Gesang', cost: 3500, depth: 3, req: [['r_shallow', 'r_deep']], effects: [{ type: 'genMult', gen: 'leviathan', mult: 3 }], desc: 'Leviathan-Echos x3.' },
    { id: 'r_heart', branch: 'bio', x: 1, y: 4, name: 'Herzstimmung', cost: 9000, depth: 4, req: [['r_shallow', 'r_deep']], effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
    // Industrie
    { id: 'r_dronelogic', branch: 'ind', x: 2.5, y: 0, name: 'Schwarmlogik der Drohnen', cost: 40, depth: 2, effects: [{ type: 'manganMult', mult: 2 }], desc: 'Mangan-Förderung x2.' },
    { id: 'r_hullx', branch: 'ind', x: 2.5, y: 1, name: 'Erweiterter Rumpf', cost: 120, depth: 2, req: ['r_dronelogic'], effects: [{ type: 'gridCols', add: 1 }], desc: 'Stationsraster +1 Spalte.' },
    { id: 'r_cold', branch: 'ind', x: 2, y: 2, group: 'smelt', name: 'Kaltschmelze', cost: 300, depth: 2, req: ['r_hullx'], effects: [{ type: 'recipe', machine: 'smelter', recipe: 'cold' }, { type: 'smelterMult', mult: 1.2 }], desc: 'Schmelzen brauchen kein Lumen mehr, aber 60 % mehr Mangan. +20 % Durchsatz.' },
    { id: 'r_light', branch: 'ind', x: 3, y: 2, group: 'smelt', name: 'Lichtschmelze', cost: 300, depth: 2, req: ['r_hullx'], effects: [{ type: 'recipe', machine: 'smelter', recipe: 'light' }, { type: 'smelterMult', mult: 1.2 }], desc: 'Schmelzen brauchen kein Mangan mehr, aber sehr viel Lumen (6.000 pro Legierung). Wird mit wachsender Lumen-Produktion immer besser.' },
    { id: 'r_hull', branch: 'ind', x: 2.5, y: 3, name: 'Druckrumpf', cost: 400, depth: 2, req: [['r_cold', 'r_light']], effects: [{ type: 'depthAdd', add: 0.15 }], desc: 'Tiefenbonus pro Zone von x1,25 auf x1,40.' },
    { id: 'r_alloy', branch: 'ind', x: 2.5, y: 4, name: 'Abyssal-Legierung', cost: 1500, depth: 3, req: ['r_hull'], effects: [{ type: 'reinforceEff', add: 0.1 }], desc: 'Jede Verstärkungsstufe wirkt x1,35 statt x1,25.' },
    { id: 'r_grow', branch: 'ind', x: 2, y: 5, group: 'forge', name: 'Kristallzucht', cost: 2000, depth: 3, req: ['r_alloy'], effects: [{ type: 'recipe', machine: 'foundry', recipe: 'grow' }], desc: 'Fertigungen brauchen keine Daten mehr, sind aber 25 % langsamer.' },
    { id: 'r_compress', branch: 'ind', x: 3, y: 5, group: 'forge', name: 'Datenkompression', cost: 2000, depth: 3, req: ['r_alloy'], effects: [{ type: 'recipe', machine: 'foundry', recipe: 'compress' }], desc: 'Fertigungen 80 % schneller, verbrauchen aber 2,5× Daten.' },
    // Navigation
    { id: 'r_proto', branch: 'nav', x: 4.5, y: 0, name: 'Protokoll-Kern', cost: 30, depth: 2, effects: [{ type: 'protocolUnlock' }], desc: 'Schaltet die Protokoll-Spezialisierung frei.' },
    { id: 'r_lure', branch: 'nav', x: 5.5, y: 0, name: 'Lockstoffe', cost: 60, depth: 2, effects: [{ type: 'eventFreq', mult: 0.7 }, { type: 'eventDur', mult: 1.4 }], desc: 'Irrlichter erscheinen 30 % häufiger und bleiben länger.' },
    { id: 'r_overcharge', branch: 'nav', x: 4.5, y: 1, name: 'Überladung', cost: 150, depth: 2, req: ['r_proto'], effects: [{ type: 'abilityUnlock' }], desc: 'Aktive Fähigkeit: 30 s doppelte Produktion, 5 min Abklingzeit.' },
    { id: 'r_neural', branch: 'nav', x: 5.5, y: 1, name: 'Neuronale Pulse', cost: 120, depth: 2, req: ['r_lure'], effects: [{ type: 'clickPct', pct: 0.02 }], desc: 'Puls +2 % deiner Lumen/s.' },
    { id: 'r_hold', branch: 'nav', x: 5, y: 2, name: 'Strömungslenkung', cost: 250, depth: 2, req: [['r_overcharge', 'r_neural']], effects: [{ type: 'currentHold' }], desc: 'Du kannst eine Strömung halten: Sie läuft eine volle Periode länger (Aufladung: 3 Perioden).' },
    { id: 'r_memory', branch: 'nav', x: 4, y: 3, name: 'Echospeicher', cost: 350, depth: 2, req: ['r_hold'], effects: [{ type: 'offlineHours', add: 4 }], desc: 'Offline-Fortschritt bis zu 4 h länger.' },
    { id: 'r_cascade', branch: 'nav', x: 5, y: 3, name: 'Kaskaden-Überladung', cost: 2200, depth: 3, req: ['r_hold'], effects: [{ type: 'abilityDur', mult: 1.5 }, { type: 'abilityCd', mult: 0.7 }], desc: 'Überladung hält 50 % länger, Abklingzeit -30 %.' },
    { id: 'r_broad', branch: 'nav', x: 4, y: 4, group: 'sonar', name: 'Breitband-Sonar', cost: 1200, depth: 3, req: ['r_memory'], effects: [{ type: 'dataMult', mult: 2 }], desc: 'Datengewinnung x2.' },
    { id: 'r_deepsonar', branch: 'nav', x: 5, y: 4, group: 'sonar', name: 'Tiefensonar', cost: 1200, depth: 3, req: ['r_memory'], effects: [{ type: 'subSpeed', mult: 1.6 }, { type: 'salvageMult', mult: 1.5 }], desc: 'U-Boote 60 % schneller, Bergungen +50 % ergiebiger.' },
    { id: 'r_deepdata', branch: 'nav', x: 4.5, y: 5, name: 'Tiefen-Telemetrie', cost: 2800, depth: 3, req: [['r_broad', 'r_deepsonar']], effects: [{ type: 'dataMult', mult: 2 }, { type: 'manganMult', mult: 2 }], desc: 'Daten und Mangan x2.' },
  ];
  C.RESEARCH_SWITCH_FACTOR = 1; // Gabel umrüsten kostet den vollen Knotenpreis

  // Wiederholbare Forschung als dauerhafte Datensenke (ab Abyssal)
  C.ANALYSIS = { name: 'Tiefenanalyse', depth: 3, baseCost: 1500, growth: 2.2, mult: 1.1, maxLevel: 60,
    desc: 'Wiederholbar: alle Anlagen +10 % pro Stufe (multiplikativ).' };

  // --- Protokolle (Spezialisierung, exklusiv) --------------------------------
  C.PROTOCOLS = [
    { id: 'swarm', name: 'Schwarm-Protokoll', style: 'Passiv',
      desc: 'Jede gebaute Anlage (alle Typen) erhöht die gesamte Lumen-Produktion um 0,15 %.',
      effects: [{ type: 'perBuildingPct', pct: 0.0015 }] },
    { id: 'pulse', name: 'Puls-Protokoll', style: 'Aktiv',
      desc: 'Puls-Grundertrag x5 und +12 % deiner Lumen/s, Überladung x3 statt x2, Irrlichter doppelt so häufig.',
      effects: [{ type: 'clickMult', mult: 5 }, { type: 'clickPct', pct: 0.12 }, { type: 'abilityPowerAdd', add: 1 }, { type: 'eventFreq', mult: 0.5 }] },
    { id: 'current', name: 'Strömungs-Protokoll', style: 'Wirtschaft',
      desc: 'Mangan x2, Schmelzen & Fertigungen +40 %, U-Boote 40 % schneller, Offline-Grenze +4 h.',
      effects: [{ type: 'manganMult', mult: 2 }, { type: 'smelterMult', mult: 1.4 }, { type: 'foundryMult', mult: 1.4 }, { type: 'subSpeed', mult: 1.4 }, { type: 'offlineHours', add: 4 }] },
  ];
  C.PROTOCOL_SWITCH_COST = 50; // Daten, verdoppelt sich je Wechsel

  // --- Aktive Fähigkeit ------------------------------------------------------
  C.ABILITY = { name: 'Überladung', duration: 30, cooldown: 300, mult: 2 };

  // --- Strömungen (rotierende Weltzustände, nur positiv) ---------------------
  C.CURRENTS = {
    depth: 2, period: 600, holdRecharge: 3,
    types: [
      { id: 'warm', name: 'Warme Strömung', desc: 'Schmelzen x2.', effects: [{ type: 'smelterMult', mult: 2 }] },
      { id: 'cold', name: 'Kalte Tiefenströmung', desc: 'Mangan x2,5.', effects: [{ type: 'manganMult', mult: 2.5 }] },
      { id: 'bloom', name: 'Nährstoffblüte', desc: 'Die vier frühen Anlagen x5.', effects: [{ type: 'tierMult', min: 0, max: 3, mult: 5 }] },
      { id: 'storm', name: 'Magnetsturm', desc: 'Daten x2, Fertigungen x1,5.', effects: [{ type: 'dataMult', mult: 2 }, { type: 'foundryMult', mult: 1.5 }] },
      { id: 'clear', name: 'Klare Sicht', desc: 'U-Boote doppelt so schnell, Bergungen +50 %.', effects: [{ type: 'subSpeed', mult: 2 }, { type: 'salvageMult', mult: 1.5 }] },
      { id: 'glow', name: 'Leuchtflut', desc: 'Puls x5, Irrlichter doppelt so häufig.', effects: [{ type: 'clickMult', mult: 5 }, { type: 'eventFreq', mult: 0.5 }] },
    ],
  };

  // --- Irrlichter (seltene Ereignisse) ---------------------------------------
  C.EVENTS = {
    firstDelay: 240, minDelay: 120, maxDelay: 300, lifetime: 12,
    outcomes: [
      { id: 'burst', weight: 55, seconds: 90, manganSeconds: 60, name: 'Lichtflut', desc: 'Sofort 90 s Lumen-Produktion (+60 s Mangan/Legierung ab der Dämmerzone).' },
      { id: 'frenzy', weight: 45, mult: 3, duration: 25, name: 'Lichtrausch', desc: 'Produktion x3 für 25 s.' },
    ],
  };

  // --- Tiefseekarte ----------------------------------------------------------
  // Pro Zone 5 Sektoren. Erkunden kostet Legierung (ab Zone 4 auch Kristalle).
  C.MAP = {
    depth: 3, sectorsPerZone: 5, zones: [1, 2, 3, 4, 5, 6],
    scanTime: 60, scanGrowth: 1.7,          // Sekunden * growth^(Zone-1)
    scanCost: { alloy: 40, growth: 2.6 },    // Legierung * growth^(Zone-1)
    scanCrystalFrom: 4, scanCrystal: 20,     // ab Zone 4: Kristalle * growth^(Zone-4)
    baseSubs: 1, subCost: { alloy: 300, growth: 2.2 }, baseOutposts: 2,
    relicChanceRuin: 0.35,
    types: [
      { id: 'ore', name: 'Erzfeld', weight: 3, exploit: { manganPct: 0.4 }, salvage: { mangan: 300 },
        desc: 'Ausbeuten: Mangan +40 % (skaliert mit Zone). Bergen: 300 s Mangan-Förderung.' },
      { id: 'vent', name: 'Schlotfeld', weight: 2, exploit: { energy: 8 }, salvage: { alloy: 200 },
        desc: 'Ausbeuten: +8 Energie je Zonenstufe. Bergen: Legierung.' },
      { id: 'grotto', name: 'Leuchtgrotte', weight: 3, exploit: { lumenPct: 0.25 }, salvage: { lumen: 600 },
        desc: 'Ausbeuten: Lumen +25 % (skaliert mit Zone). Bergen: 600 s Lumen-Produktion.' },
      { id: 'ruin', name: 'Ruine', weight: 2, exploit: { dataPct: 0.5 }, salvage: { data: 400, relic: 0.35 },
        desc: 'Ausbeuten: Daten +50 %. Bergen: Daten und 35 % Chance auf ein Relikt.' },
      { id: 'nest', name: 'Kristallnest', weight: 2, minZone: 3, exploit: { crystalPct: 0.4 }, salvage: { crystal: 300 },
        desc: 'Ausbeuten: Kristalle +40 %. Bergen: Kristalle.' },
      { id: 'wreck', name: 'Wrack', weight: 1, exploit: { subSpeedPct: 0.2 }, salvage: { relic: 1 },
        desc: 'Ausbeuten: U-Boote +20 % schneller. Bergen: garantiert ein Relikt.' },
    ],
  };

  // --- Relikte (dauerhafte Sammlung, Stufe 1–3) -------------------------------
  C.RELICS = [
    { id: 'compass', name: 'Messingkompass', minZone: 1, max: 3, effects: [{ type: 'subSpeed', mult: 1.25 }], desc: 'U-Boote +25 % schneller pro Stufe.' },
    { id: 'tidestone', name: 'Gezeitenstein', minZone: 1, max: 3, effects: [{ type: 'currentPower', mult: 1.2 }, { type: 'currentForecast', add: 1 }], desc: 'Strömungen wirken 20 % stärker, +1 Vorschau pro Stufe.' },
    { id: 'fang', name: 'Glühender Zahn', minZone: 1, max: 3, effects: [{ type: 'eventReward', mult: 1.5 }, { type: 'eventCrystals' }], desc: 'Irrlichter +50 % ergiebiger pro Stufe und geben Kristalle.' },
    { id: 'forgeheart', name: 'Schmiedeherz', minZone: 2, max: 3, effects: [{ type: 'smelterMult', mult: 1.25 }], desc: 'Schmelzen +25 % pro Stufe.' },
    { id: 'skull', name: 'Echoschädel', minZone: 2, max: 3, effects: [{ type: 'allMult', mult: 1.2 }], desc: 'Alle Lumen-Anlagen +20 % pro Stufe.' },
    { id: 'lens', name: 'Kristalllinse', minZone: 3, max: 3, effects: [{ type: 'foundryMult', mult: 1.25 }], desc: 'Fertigungen +25 % pro Stufe.' },
    { id: 'scale', name: 'Leviathan-Schuppe', minZone: 3, max: 3, effects: [{ type: 'offlineHours', add: 2 }], desc: 'Offline-Grenze +2 h pro Stufe.' },
    { id: 'crown', name: 'Perlmuttkrone', minZone: 4, max: 3, effects: [{ type: 'perlenMult', mult: 1.1 }], desc: 'Perlen +10 % pro Stufe.' },
    { id: 'anchor', name: 'Ankerkette', minZone: 3, max: 2, effects: [{ type: 'outposts', add: 1 }], desc: '+1 Außenposten pro Stufe.' },
    { id: 'gauge', name: 'Druckmesser', minZone: 4, max: 3, effects: [{ type: 'descentDiscount', add: 0.08 }], desc: 'Abstiegskosten -8 % pro Stufe.' },
    { id: 'clockwork', name: 'Uhrwerk der Meridian', minZone: 2, max: 3, effects: [{ type: 'abilityCd', mult: 0.85 }], desc: 'Überladung lädt 15 % schneller pro Stufe.' },
    { id: 'shell', name: 'Urmuschel', minZone: 5, max: 3, effects: [{ type: 'techCost', mult: 0.9 }], desc: 'Tech-Baum 10 % günstiger pro Stufe.' },
  ];

  // --- Prestige 1: Gezeitenwende ---------------------------------------------
  // Perlen = floor(scale * (LumenDiesenLauf / base) ^ exponent * Tiefenfaktor * Boni)
  // Tiefenfaktor: +25 % pro Zone jenseits von Hadal in diesem Lauf.
  // earnedBonus: Produktion x(1 + earnedBonus * log10(1 + verdiente Perlen im Zyklus)^2) – wächst bewusst langsam.
  C.PRESTIGE = { requireDepth: 4, base: 5e13, exponent: 0.3, scale: 10, deepBonus: 0.25, earnedBonus: 0.25 };
  C.FLOTSAM_START = [0, 5000, 5e5, 5e7];

  // Gezeiten-Baum: 4 Zweige, je eine exklusive Gabel (group), max. 2 Capstones.
  // x/y = Position im Baum. cost: base * growth^Stufe (Perlen).
  C.TREE_BRANCHES = [
    { id: 'flow', name: 'Strömung', style: 'Wirtschaft & Ketten' },
    { id: 'pulse', name: 'Puls', style: 'Aktives Spiel' },
    { id: 'swarm', name: 'Schwarm', style: 'Passiv & Automatik' },
    { id: 'deep', name: 'Tiefe', style: 'Erkundung' },
  ];
  C.MAX_CAPSTONES = 2;
  C.TREE = [
    // Strömung
    { id: 't_memory', branch: 'flow', x: 0.5, y: 0, name: 'Gezeitengedächtnis', max: 40, cost: { base: 2, growth: 1.45 }, effects: [{ type: 'allMult', mult: 1.25 }], desc: 'Alle Lumen-Anlagen +25 % pro Stufe.' },
    { id: 't_flotsam', branch: 'flow', x: 0, y: 1, name: 'Treibgut', max: 3, req: ['t_memory'], cost: { base: 2, growth: 2 }, effects: [], desc: 'Startkapital: 5 Tsd. / 500 Tsd. / 50 Mio. Lumen.' },
    { id: 't_known', branch: 'flow', x: 1, y: 1, name: 'Vorwissen', max: 1, req: ['t_memory'], cost: { base: 4, growth: 1 }, effects: [], desc: 'Start in der Dämmerzone mit 5 Drohnen, 1 Reaktor und 1 Schmelze.' },
    { id: 't_forge', branch: 'flow', x: 0, y: 2, group: 'flow', name: 'Ewige Schmiede', max: 1, req: [['t_flotsam', 't_known']], cost: { base: 8, growth: 1 }, effects: [{ type: 'smelterMult', mult: 1.75 }, { type: 'foundryMult', mult: 1.75 }], desc: 'Schmelzen und Fertigungen +75 %.' },
    { id: 't_lean', branch: 'flow', x: 1, y: 2, group: 'flow', name: 'Schlanke Ketten', max: 1, req: [['t_flotsam', 't_known']], cost: { base: 8, growth: 1 }, effects: [{ type: 'chainInput', mult: 0.6 }], desc: 'Alle Verarbeitungsrezepte brauchen 40 % weniger Input.' },
    { id: 't_cap_flow', branch: 'flow', x: 0.5, y: 3, capstone: true, name: 'Großindustrie', max: 1, req: [['t_forge', 't_lean']], cost: { base: 25, growth: 1 }, effects: [{ type: 'gridCols', add: 1 }, { type: 'moduleCost', mult: 0.5 }], desc: 'Stationsraster +1 Spalte, alle Module 50 % günstiger.' },
    // Puls
    { id: 't_pulse', branch: 'pulse', x: 2.5, y: 0, name: 'Pulsverstärker', max: 10, cost: { base: 2, growth: 1.8 }, effects: [{ type: 'clickMult', mult: 3 }, { type: 'clickPct', pct: 0.02 }], desc: 'Puls x3 und +2 % der Lumen/s pro Stufe.' },
    { id: 't_lure', branch: 'pulse', x: 2, y: 1, name: 'Irrlichtlocke', max: 3, req: ['t_pulse'], cost: { base: 3, growth: 2.5 }, effects: [{ type: 'eventFreq', mult: 0.8 }, { type: 'eventReward', mult: 1.5 }], desc: 'Irrlichter 20 % häufiger und 50 % ergiebiger pro Stufe.' },
    { id: 't_start', branch: 'pulse', x: 3, y: 1, name: 'Startprotokoll', max: 1, req: ['t_pulse'], cost: { base: 4, growth: 1 }, effects: [{ type: 'abilityUnlock' }, { type: 'abilityCd', mult: 0.8 }], desc: 'Überladung ist von Beginn an verfügbar, Abklingzeit -20 %.' },
    { id: 't_chainreact', branch: 'pulse', x: 2, y: 2, group: 'pulse', name: 'Kettenreaktion', max: 1, req: [['t_lure', 't_start']], cost: { base: 8, growth: 1 }, effects: [{ type: 'clickChain' }], desc: 'Jeder Puls während der Überladung verlängert sie um 0,25 s (bis +60 s).' },
    { id: 't_resopulse', branch: 'pulse', x: 3, y: 2, group: 'pulse', name: 'Resonanzpuls', max: 1, req: [['t_lure', 't_start']], cost: { base: 8, growth: 1 }, effects: [{ type: 'clickResources' }], desc: 'Jeder Puls bringt zusätzlich 1 s Mangan-, Legierungs- und Kristallproduktion.' },
    { id: 't_cap_pulse', branch: 'pulse', x: 2.5, y: 3, capstone: true, name: 'Sturmflut', max: 1, req: [['t_chainreact', 't_resopulse']], cost: { base: 25, growth: 1 }, effects: [{ type: 'abilityPowerAdd', add: 3 }, { type: 'abilityChains' }], desc: 'Überladung +3 Multiplikator und beschleunigt auch Schmelzen & Fertigungen.' },
    // Schwarm
    { id: 't_rest', branch: 'swarm', x: 4.5, y: 0, name: 'Ruheströmung', max: 3, cost: { base: 2, growth: 1.8 }, effects: [{ type: 'offlineHours', add: 2 }], desc: 'Offline-Grenze +2 h pro Stufe.' },
    { id: 't_auto', branch: 'swarm', x: 4, y: 1, name: 'Automaton', max: 1, req: ['t_rest'], cost: { base: 4, growth: 1 }, effects: [{ type: 'autobuy' }], desc: 'Kauft automatisch die günstigste Anlage (abschaltbar).' },
    { id: 't_colony', branch: 'swarm', x: 5, y: 1, name: 'Kolonie', max: 10, req: ['t_rest'], cost: { base: 3, growth: 1.8 }, effects: [{ type: 'perBuildingPct', pct: 0.0008 }], desc: '+0,08 % Produktion pro gebauter Anlage, je Stufe.' },
    { id: 't_selfrun', branch: 'swarm', x: 4, y: 2, group: 'swarm', name: 'Selbstverwaltung', max: 1, req: [['t_auto', 't_colony']], cost: { base: 8, growth: 1 }, effects: [{ type: 'autoUpgrades' }, { type: 'autoReinforce' }], desc: 'Kauft bezahlbare Verbesserungen und Verstärkungen automatisch (abschaltbar).' },
    { id: 't_sleep', branch: 'swarm', x: 5, y: 2, group: 'swarm', name: 'Tiefschlaf', max: 1, req: [['t_auto', 't_colony']], cost: { base: 8, growth: 1 }, effects: [{ type: 'offlineMult', mult: 2 }, { type: 'offlineHours', add: 4 }], desc: 'Offline-Produktion x2 und +4 h Grenze. Für Spieler, die lieber zurückkommen als dabeibleiben.' },
    { id: 't_cap_swarm', branch: 'swarm', x: 4.5, y: 3, capstone: true, name: 'Schwarmgeist', max: 1, req: [['t_selfrun', 't_sleep']], cost: { base: 25, growth: 1 }, effects: [{ type: 'autoResearch' }, { type: 'autoDescend' }, { type: 'perBuildingPct', pct: 0.002 }], desc: 'Forscht und taucht automatisch ab (abschaltbar). +0,2 % pro Anlage.' },
    // Tiefe
    { id: 't_compass', branch: 'deep', x: 6.5, y: 0, name: 'Tiefenkompass', max: 3, cost: { base: 2, growth: 2 }, effects: [{ type: 'descentDiscount', add: 0.1 }], desc: 'Abstiegskosten -10 % pro Stufe.' },
    { id: 't_archive', branch: 'deep', x: 6, y: 1, name: 'Gesichertes Archiv', max: 1, req: ['t_compass'], cost: { base: 5, growth: 1 }, effects: [], desc: 'Die ersten Knoten jedes Tech-Zweigs bleiben nach der Gezeitenwende erforscht.' },
    { id: 't_charts', branch: 'deep', x: 7, y: 1, name: 'Alte Seekarten', max: 1, req: ['t_compass'], cost: { base: 4, growth: 1 }, effects: [{ type: 'subSpeed', mult: 1.3 }], desc: 'U-Boote +30 % schneller. Die Sektortypen der Zonen 1–2 sind zu Laufbeginn bekannt.' },
    { id: 't_fleet', branch: 'deep', x: 6, y: 2, group: 'deep', name: 'Flottenkommando', max: 1, req: [['t_archive', 't_charts']], cost: { base: 8, growth: 1 }, effects: [{ type: 'subs', add: 1 }, { type: 'outposts', add: 1 }], desc: '+1 U-Boot und +1 Außenposten.' },
    { id: 't_archeo', branch: 'deep', x: 7, y: 2, group: 'deep', name: 'Archäologie', max: 1, req: [['t_archive', 't_charts']], cost: { base: 8, growth: 1 }, effects: [{ type: 'relicChance', add: 0.35 }, { type: 'salvageMult', mult: 1.5 }], desc: 'Ruinen geben doppelt so oft Relikte, Bergungen +50 %.' },
    { id: 't_cap_deep', branch: 'deep', x: 6.5, y: 3, capstone: true, name: 'Abgrundgänger', max: 1, req: [['t_fleet', 't_archeo']], cost: { base: 25, growth: 1 }, effects: [{ type: 'depthAdd', add: 0.25 }, { type: 'deepDiscount', mult: 0.5 }], desc: 'Tiefenbonus +0,25 pro Zone. Schlund und Herzkammer 50 % günstiger.' },
  ];

  // --- Tiefenproben (Herausforderungen) --------------------------------------
  // Ziel je Stufe: Zone erreichen. Belohnung dauerhaft (auch über Weltenwenden).
  C.PROBES = {
    goals: [3, 4, 5],
    list: [
      { id: 'silent', name: 'Stille Wasser', rule: 'Der Puls ist deaktiviert.', reward: 'Alle Lumen-Anlagen +30 % pro Stufe.', effects: [{ type: 'allMult', mult: 1.3 }] },
      { id: 'ore', name: 'Erzarmut', rule: 'Mangan-Förderung ÷10.', reward: 'Schmelzen brauchen 15 % weniger Input pro Stufe.', effects: [{ type: 'chainInput', mult: 0.85 }] },
      { id: 'blackout', name: 'Stromausfall', rule: 'Reaktoren liefern nur halb so viel Energie.', reward: 'Reaktoren +25 % Energie pro Stufe.', effects: [{ type: 'reactorMult', mult: 1.25 }] },
      { id: 'blind', name: 'Blindflug', rule: 'Sonarbojen liefern keine Daten.', reward: 'Tech-Baum 12 % günstiger pro Stufe.', effects: [{ type: 'techCost', mult: 0.88 }] },
      { id: 'flat', name: 'Ohne Auftrieb', rule: 'Kein Tiefenbonus.', reward: 'Tiefenbonus +0,05 pro Zone und Stufe.', effects: [{ type: 'depthAdd', add: 0.05 }] },
      { id: 'lonely', name: 'Einsiedler', rule: 'Die Tiefseekarte ist gesperrt.', reward: '+1 Außenposten pro Stufe.', effects: [{ type: 'outposts', add: 1 }] },
    ],
  };

  // --- Prestige 2: Weltenwende -----------------------------------------------
  // Urlicht = floor(scale * (log10(Perlen dieses Zyklus) - minLog) ^ exponent) – logarithmisch, damit
  // spätere Weltenwenden nicht explodieren.
  C.WORLD = { requireDepth: 6, scale: 4, minLog: 2, exponent: 1.5 };
  C.ORIGIN = [
    { id: 'o_light', name: 'Ewiges Licht', max: 40, cost: { base: 1, growth: 1.5 }, effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Lumen-Anlagen x1,5 pro Stufe.' },
    { id: 'o_pearl', name: 'Perlenstrom', max: 15, cost: { base: 2, growth: 1.8 }, effects: [{ type: 'perlenMult', mult: 1.5 }], desc: 'Perlen +50 % pro Stufe.' },
    { id: 'o_grid', name: 'Weites Raster', max: 2, cost: { base: 3, growth: 3 }, effects: [{ type: 'gridRows', add: 1 }], desc: 'Stationsraster +1 Zeile pro Stufe.' },
    { id: 'o_dual', name: 'Doppelprotokoll', max: 1, cost: { base: 4, growth: 1 }, effects: [{ type: 'dualProtocol' }], desc: 'Zwei Protokolle gleichzeitig aktiv.' },
    { id: 'o_third', name: 'Drittes Kapitel', max: 1, cost: { base: 6, growth: 1 }, effects: [{ type: 'capstones', add: 1 }], desc: 'Drei statt zwei Capstones im Gezeiten-Baum.' },
    { id: 'o_command', name: 'Kommandozentrale', max: 1, cost: { base: 3, growth: 1 }, effects: [{ type: 'autoResearch' }, { type: 'autoDescend' }, { type: 'autobuy' }], desc: 'Automatischer Anlagenkauf, Forschung und Abstieg von Beginn an (abschaltbar).' },
    { id: 'o_heritage', name: 'Erbstationen', max: 1, cost: { base: 5, growth: 1 }, effects: [], desc: 'Wähle bei jeder Gezeitenwende einen Stationstyp mit eigenem Start (Schmiede, Forschungsschiff, Jäger).' },
    { id: 'o_relic', name: 'Reliktresonanz', max: 5, cost: { base: 4, growth: 2 }, effects: [{ type: 'relicPower', mult: 1.2 }], desc: 'Relikt-Effekte 20 % stärker pro Stufe.' },
  ];
  C.ARCHETYPES = [
    { id: 'none', name: 'Standard', desc: 'Kein besonderer Start.' },
    { id: 'forge', name: 'Schmiede', desc: 'Start mit 2 Reaktoren, 2 Schmelzen und 500 Legierung. Schmelzen +50 %.', effects: [{ type: 'smelterMult', mult: 1.5 }] },
    { id: 'science', name: 'Forschungsschiff', desc: 'Tech-Baum 40 % günstiger, Daten x2.', effects: [{ type: 'techCost', mult: 0.6 }, { type: 'dataMult', mult: 2 }] },
    { id: 'hunter', name: 'Jäger', desc: '+2 U-Boote, +2 Außenposten, U-Boote +50 % schneller.', effects: [{ type: 'subs', add: 2 }, { type: 'outposts', add: 2 }, { type: 'subSpeed', mult: 1.5 }] },
  ];

  // --- Tiefenrekord (endlos, ab Herzkammer) ----------------------------------
  C.RECORD = { depth: 6, metersPer: 500, cost: { crystal: 2e4, crystalGrowth: 1.45, lumen: 1e21, lumenGrowth: 4 }, mult: 1.25, perlenPer: 0.05 };

  // --- Logbuch (Erfolge) -----------------------------------------------------
  C.ACHIEVEMENT_BONUS = 0.01; // +1 % Produktion pro Eintrag

  // --- Aufträge (kurzfristige Ziele) -----------------------------------------
  // reward: lumenSec = Sekunden aktueller Produktion (mind. lumenMin)
  C.MISSIONS = [
    { id: 'm1', name: 'Erster Puls', cond: { clicks: 15 }, reward: { lumen: 25 } },
    { id: 'm2', name: 'Netze auswerfen', cond: { gen: 'plankton', n: 3 }, reward: { lumen: 40 } },
    { id: 'm3', name: 'Dichtes Netz', cond: { gen: 'plankton', n: 10 }, reward: { lumenSec: 60, lumenMin: 100 } },
    { id: 'm4', name: 'Erste Verbesserung', cond: { upgrades: 1 }, reward: { lumenSec: 60, lumenMin: 100 } },
    { id: 'm5', name: 'Algenteppich', cond: { gen: 'algae', n: 5 }, reward: { lumenSec: 90 } },
    { id: 'm6', name: 'Lichtvorrat', cond: { lumenRun: 2500 }, reward: { lumenSec: 90 } },
    { id: 'm7', name: 'Abwärts', cond: { depth: 1 }, reward: { mangan: 40 } },
    { id: 'm8', name: 'Knollenernte', cond: { miner: 'drone', n: 5 }, reward: { lumenSec: 120 } },
    { id: 'm8b', name: 'Erster Strom', cond: { module: 'reactor', n: 1 }, reward: { mangan: 60 } },
    { id: 'm8c', name: 'Heiße Esse', cond: { module: 'smelter', n: 1 }, reward: { lumenSec: 120 } },
    { id: 'm9', name: 'Verstärkt', cond: { reinforce: 2 }, reward: { mangan: 60 } },
    { id: 'm9b', name: 'Feinmechanik', cond: { upgrades: 10 }, reward: { lumenSec: 120 } },
    { id: 'm9c', name: 'Erster Barren', cond: { alloyRun: 50 }, reward: { mangan: 150 } },
    { id: 'm10', name: 'Schwarmbildung', cond: { gen: 'jelly', n: 15 }, reward: { lumenSec: 120 } },
    { id: 'm11', name: 'Laternen im Dunkel', cond: { gen: 'angler', n: 10 }, reward: { lumenSec: 150 } },
    { id: 'm12', name: 'Irrlichtjäger', cond: { events: 1 }, reward: { lumenSec: 120 } },
    { id: 'm13', name: 'Stationsausbau', cond: { modulesTotal: 4 }, reward: { alloy: 30 } },
    { id: 'm14', name: 'Mitternacht', cond: { depth: 2 }, reward: { data: 15 } },
    { id: 'm15', name: 'Wissbegierig', cond: { research: 3 }, reward: { lumenSec: 180 } },
    { id: 'm16', name: 'Doktrin', cond: { protocol: 1 }, reward: { data: 40 } },
    { id: 'm16b', name: 'Weggabelung', cond: { forks: 1 }, reward: { data: 80 } },
    { id: 'm17', name: 'Heiße Quellen', cond: { gen: 'vent', n: 15 }, reward: { lumenSec: 180 } },
    { id: 'm17b', name: 'Nachbarschaft', cond: { module: 'cooler', n: 1 }, reward: { alloy: 100 } },
    { id: 'm18', name: 'Korallengarten', cond: { gen: 'coral', n: 10 }, reward: { mangan: 3000 } },
    { id: 'm19', name: 'Technokrat', cond: { upgrades: 30 }, reward: { lumenSec: 240 } },
    { id: 'm20', name: 'Ins Abyssal', cond: { depth: 3 }, reward: { data: 200 } },
    { id: 'm21', name: 'Leinen los', cond: { scans: 1 }, reward: { alloy: 300 } },
    { id: 'm21b', name: 'Kristallklar', cond: { crystalRun: 10 }, reward: { lumenSec: 300 } },
    { id: 'm22', name: 'Außenposten', cond: { exploits: 1 }, reward: { data: 400 } },
    { id: 'm23', name: 'Gesang der Riesen', cond: { gen: 'leviathan', n: 10 }, reward: { lumenSec: 300 } },
    { id: 'm23b', name: 'Fundstück', cond: { relics: 1 }, reward: { crystal: 20 } },
    { id: 'm24', name: 'Unter Strom', cond: { abilityUses: 3 }, reward: { lumenSec: 300 } },
    { id: 'm25', name: 'Der Graben', cond: { depth: 4 }, reward: { lumenSec: 600 } },
    { id: 'm26', name: 'Herzschlag', cond: { gen: 'heart', n: 5 }, reward: { lumenSec: 600 } },
    { id: 'm27', name: 'Gezeitenwende', cond: { prestiges: 1 }, reward: { lumen: 5000 } },
    { id: 'm28', name: 'Erste Wurzeln', cond: { treeNodes: 3 }, reward: { lumenSec: 300 } },
    { id: 'm28b', name: 'Probe aufs Exempel', cond: { probeLevels: 1 }, reward: { lumenSec: 600 } },
    { id: 'm29', name: 'Wiederkehr', cond: { depth: 4, prestigesMin: 1 }, reward: { lumenSec: 900 } },
    { id: 'm29b', name: 'Der Riss', cond: { depth: 5 }, reward: { crystal: 500 } },
    { id: 'm30', name: 'Gezeitenmeister', cond: { prestiges: 3 }, reward: { lumenSec: 900 } },
    { id: 'm31', name: 'Sammler', cond: { relics: 5 }, reward: { crystal: 2000 } },
    { id: 'm32', name: 'Gabelmeister', cond: { capstones: 1 }, reward: { lumenSec: 900 } },
    { id: 'm33', name: 'Die Herzkammer', cond: { depth: 6 }, reward: { crystal: 1e5 } },
    { id: 'm34', name: 'Weltenwende', cond: { worlds: 1 }, reward: { lumen: 1e6 } },
    { id: 'm35', name: 'Bodenlos', cond: { record: 10 }, reward: { lumenSec: 1800 } },
  ];
  C.MISSIONS_VISIBLE = 3;

  // --- Abgeleitete Lookups ---------------------------------------------------
  const byId = (list) => { const o = {}; list.forEach((x) => { o[x.id] = x; }); return o; };
  C.GENERATORS.forEach((g, i) => { g.tier = i; });
  C.GEN_BY_ID = byId(C.GENERATORS);
  C.MINER_BY_ID = byId(C.MINERS);
  C.RESEARCH_BY_ID = byId(C.RESEARCH);
  C.PROTOCOL_BY_ID = byId(C.PROTOCOLS);
  C.MODULE_BY_ID = byId(C.MODULES);
  C.CURRENT_BY_ID = byId(C.CURRENTS.types);
  C.SECTOR_BY_ID = byId(C.MAP.types);
  C.RELIC_BY_ID = byId(C.RELICS);
  C.TREE_BY_ID = byId(C.TREE);
  C.PROBE_BY_ID = byId(C.PROBES.list);
  C.ORIGIN_BY_ID = byId(C.ORIGIN);
  C.ARCHETYPE_BY_ID = byId(C.ARCHETYPES);

  // Alle Lumen-Upgrades in eine Liste bauen (generiert + handgeschrieben)
  C.UPGRADES = [];
  C.GENERATORS.forEach((g) => {
    C.GEN_UPGRADE_TIERS.forEach((t, ti) => {
      C.UPGRADES.push({
        id: 'u_' + g.id + '_' + ti, kind: 'gen', name: g.name + ': ' + t.name,
        cost: g.baseCost * t.costMult, req: { gen: g.id, n: t.at },
        effects: [{ type: 'genMult', gen: g.id, mult: 2 }],
        desc: g.name + ' produziert doppelt so viel.',
      });
    });
  });
  C.GENERATORS.forEach((g, i) => {
    if (i === 0) return;
    const src = C.GENERATORS[i - 1];
    C.UPGRADES.push({
      id: 's_' + g.id, kind: 'synergy', name: 'Symbiose: ' + src.name + ' → ' + g.name,
      cost: g.baseCost * C.SYNERGY.costMult,
      req: { all: [{ gen: src.id, n: C.SYNERGY.needSrc }, { gen: g.id, n: C.SYNERGY.needDst }] },
      effects: [{ type: 'synergy', gen: g.id, src: src.id, perUnit: C.SYNERGY.perUnit }],
      desc: g.name + ' +' + (C.SYNERGY.perUnit * 100).toFixed(1).replace('.', ',') + ' % pro ' + src.name + '.',
    });
  });
  C.CLICK_UPGRADES.forEach((u) => C.UPGRADES.push(Object.assign({ kind: 'click' }, u)));
  C.GLOBAL_UPGRADES.forEach((u) => C.UPGRADES.push(Object.assign({ kind: 'global' }, u)));
  C.UPGRADE_BY_ID = byId(C.UPGRADES);

  // Logbuch-Einträge generieren
  C.ACHIEVEMENTS = [];
  const ach = (id, name, cond, desc) => C.ACHIEVEMENTS.push({ id, name, cond, desc });
  C.GENERATORS.forEach((g) => {
    [1, 25, 50, 100].forEach((n) => ach('a_' + g.id + '_' + n, g.name + ' ×' + n, { gen: g.id, n }, 'Besitze ' + n + '× ' + g.name + '.'));
  });
  [[1e3, 'Funke', '1.000'], [1e6, 'Glimmen', '1 Million'], [1e9, 'Leuchtfeuer', '1 Milliarde'], [1e12, 'Polarlicht', '1 Billion'], [1e15, 'Sonnenkern', '1 Billiarde'], [1e18, 'Supernova', '1 Trillion'],
    [1e24, 'Quasar', '1 Quadrillion'], [1e30, 'Urknall', '1 Quintillion']].forEach(([n, name, txt], i) =>
    ach('a_lum' + i, name, { lumenAll: n }, 'Insgesamt ' + txt + ' Lumen gesammelt.'));
  [[100, 'Taktgeber'], [1000, 'Dauerpuls'], [5000, 'Herzrasen']].forEach(([n, name], i) =>
    ach('a_clk' + i, name, { clicks: n }, n + ' Pulse ausgelöst.'));
  [[1, 'Irrlicht gefangen'], [10, 'Lichtsammler'], [30, 'Irrlicht-Flüsterer']].forEach(([n, name], i) =>
    ach('a_evt' + i, name, { events: n }, n + ' Irrlichter gefangen.'));
  C.DEPTHS.forEach((d, i) => { if (i > 0) ach('a_depth' + i, d.name, { depth: i }, 'Erreiche ' + d.meters.toLocaleString('de-DE') + ' m Tiefe.'); });
  ach('a_res10', 'Gelehrter', { research: 10 }, '10 Forschungen in einem Lauf.');
  ach('a_rein10', 'Gepanzert', { reinforce: 10 }, '10 Verstärkungsstufen insgesamt.');
  ach('a_build250', 'Metropole', { buildings: 250 }, '250 Anlagen gleichzeitig.');
  ach('a_mod9', 'Volles Raster', { modulesTotal: 9 }, '9 Module in der Station.');
  ach('a_mod20', 'Industriekomplex', { modulesTotal: 20 }, '20 Module in der Station.');
  ach('a_alloy', 'Gießer', { alloyAll: 1e5 }, '100.000 Legierung insgesamt hergestellt.');
  ach('a_crys', 'Kristallgärtner', { crystalAll: 1e5 }, '100.000 Kristalle insgesamt gezüchtet.');
  ach('a_scan10', 'Kartograf', { scans: 10 }, '10 Sektoren erkundet.');
  ach('a_scan50', 'Weltumsegler', { scans: 50 }, '50 Sektoren erkundet.');
  ach('a_rel3', 'Fundgrube', { relics: 3 }, '3 verschiedene Relikte.');
  ach('a_rel12', 'Museum der Tiefe', { relics: 12 }, 'Alle 12 Relikte gefunden.');
  ach('a_holds', 'Strömungsreiter', { holds: 5 }, '5 Strömungen gehalten.');
  ach('a_pres1', 'Erste Flut', { prestiges: 1 }, 'Erste Gezeitenwende.');
  ach('a_pres5', 'Ewige Gezeiten', { prestiges: 5 }, 'Fünf Gezeitenwenden.');
  ach('a_pres20', 'Mondgebunden', { prestiges: 20 }, 'Zwanzig Gezeitenwenden.');
  ach('a_cap', 'Gipfelstürmer', { capstones: 1 }, 'Erster Capstone im Gezeiten-Baum.');
  ach('a_probe1', 'Prüfling', { probeLevels: 1 }, 'Erste Tiefenprobe bestanden.');
  ach('a_probe9', 'Prüfungsmeister', { probeLevels: 9 }, '9 Probestufen bestanden.');
  ach('a_probe18', 'Unerschütterlich', { probeLevels: 18 }, 'Alle 18 Probestufen bestanden.');
  ach('a_world1', 'Weltenwender', { worlds: 1 }, 'Erste Weltenwende.');
  ach('a_rec10', 'Bohrkern', { record: 10 }, 'Tiefenrekord Stufe 10.');
  ach('a_rec50', 'Erdmantel', { record: 50 }, 'Tiefenrekord Stufe 50.');
  C.ACHIEVEMENT_BY_ID = byId(C.ACHIEVEMENTS);

  AB.CONFIG = C;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
