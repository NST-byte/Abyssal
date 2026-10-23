/* ==========================================================================
   ABYSSAL – zentrale Balance-Konfiguration
   Alle Preise, Raten, Skalierungen und Freischaltungen stehen hier.
   Wer balancen will, muss nur diese Datei anfassen.
   ========================================================================== */
(function (AB) {
  'use strict';

  const C = {};

  // --- Technik ---------------------------------------------------------------
  C.SAVE_KEY = 'abyssal_save';
  C.SAVE_VERSION = 1;
  C.EXPORT_PREFIX = 'ABYSSAL1:';
  C.AUTOSAVE_SECONDS = 15;
  C.MAX_STEP = 60;               // max. Sekunden pro Simulationsschritt
  C.OFFLINE = { baseCapHours: 4, minSeconds: 60 };
  C.MAX_VALUE = 1e300;           // Sicherheitsdeckel gegen Infinity

  // --- Aktiver Puls ----------------------------------------------------------
  C.CLICK = { base: 1 };

  // --- Tiefenzonen -----------------------------------------------------------
  // Jede Zone: globaler Produktionsbonus (DEPTH_MULT^Zone) + neue Mechaniken.
  C.DEPTH_MULT = 1.25;
  C.DEPTHS = [
    {
      name: 'Schelfkante', meters: 0, cost: {},
      story: 'Die Station Tethys-7 erwacht. Restlicht, Plankton, Stille.',
      unlocks: ['Planktonnetze', 'Leuchtalgen-Beete'],
    },
    {
      name: 'Dämmerzone', into: 'in die Dämmerzone', meters: 200, cost: { lumen: 30000 },
      story: 'Das Sonnenlicht verblasst. Quallen ziehen in Schwärmen vorbei, und am Grund liegen Manganknollen.',
      unlocks: ['Mangan & Knollen-Drohnen', 'Verstärkungen', 'Quallenschwärme', 'Anglerfisch-Zucht'],
    },
    {
      name: 'Mitternachtszone', into: 'in die Mitternachtszone', meters: 1000, cost: { lumen: 1.8e7, mangan: 1500 },
      story: 'Absolute Dunkelheit. Nur noch das, was selbst leuchtet. Die alten Sonarbojen der Station reagieren wieder.',
      unlocks: ['Daten & Sonarbojen', 'Forschung', 'Protokolle (Spezialisierung)', 'Schlotturbinen', 'Korallen-Resonatoren'],
    },
    {
      name: 'Abyssal', into: 'ins Abyssal', meters: 4000, cost: { lumen: 2e10, mangan: 5e4, data: 1200 },
      story: 'Eiskaltes Wasser, enormer Druck. Irgendetwas Großes antwortet auf deine Sonarpulse.',
      unlocks: ['Expeditionen & Artefakte', 'Tiefbohrer', 'Leviathan-Echos', 'Gezeiten-Vorschau'],
    },
    {
      name: 'Hadal', into: 'in den Hadal-Graben', meters: 8000, cost: { lumen: 8e12, mangan: 6e5, data: 2e4 },
      story: 'Der Graben. Ganz unten pulsiert etwas Uraltes – ein Herz aus Licht. Die Gezeiten gehorchen ihm.',
      unlocks: ['Tiefenherzen', 'Gezeitenwende (Prestige)'],
    },
  ];

  // --- Lumen-Anlagen ---------------------------------------------------------
  // cost(n) = baseCost * growth^n
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
      desc: 'Hydrothermale Quellen treiben chemolumineszente Turbinen an.' },
    { id: 'coral', name: 'Korallen-Resonator', depth: 2, baseCost: 5e6, baseProd: 2100, growth: 1.15,
      desc: 'Tiefseekorallen, die Licht speichern und gebündelt abgeben.' },
    { id: 'leviathan', name: 'Leviathan-Echo', depth: 3, baseCost: 9e7, baseProd: 14000, growth: 1.15,
      desc: 'Die Gesänge riesiger Wesen bringen das Wasser selbst zum Leuchten.' },
    { id: 'heart', name: 'Tiefenherz', depth: 4, baseCost: 2.5e9, baseProd: 110000, growth: 1.15,
      desc: 'Ein Splitter des uralten Herzens im Graben. Er schlägt in Licht.' },
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

  // Puls-Upgrades
  C.CLICK_UPGRADES = [
    { id: 'c1', name: 'Gebündelter Puls', cost: 80, req: { gen: 'plankton', n: 1 }, effects: [{ type: 'clickMult', mult: 2 }], desc: 'Puls-Ertrag x2.' },
    { id: 'c2', name: 'Lichtleiter', cost: 1500, req: { lumenRun: 800 }, effects: [{ type: 'clickPct', pct: 0.01 }], desc: 'Jeder Puls bringt zusätzlich 1 % deiner Lumen/s.' },
    { id: 'c3', name: 'Kohärente Emission', cost: 6e4, req: { lumenRun: 3e4 }, effects: [{ type: 'clickPct', pct: 0.02 }], desc: 'Puls +2 % deiner Lumen/s.' },
    { id: 'c4', name: 'Fokuslinse', cost: 2e6, req: { depth: 1 }, effects: [{ type: 'clickMult', mult: 3 }], desc: 'Puls-Grundertrag x3.' },
    { id: 'c5', name: 'Photonenkaskade', cost: 2e9, req: { depth: 2 }, effects: [{ type: 'clickPct', pct: 0.03 }], desc: 'Puls +3 % deiner Lumen/s.' },
    { id: 'c6', name: 'Herzschlag-Synchron', cost: 5e13, req: { depth: 3 }, effects: [{ type: 'clickPct', pct: 0.04 }], desc: 'Puls +4 % deiner Lumen/s.' },
  ];

  // Globale Upgrades
  C.GLOBAL_UPGRADES = [
    { id: 'g1', name: 'Phototaxis', cost: 6000, req: { lumenRun: 3000 }, effects: [{ type: 'allMult', mult: 1.25 }], desc: 'Alle Anlagen +25 %.' },
    { id: 'g2', name: 'Biolumineszenz-Netz', cost: 4e5, req: { lumenRun: 1.5e5 }, effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'g3', name: 'Druckausgleich', cost: 2e8, req: { depth: 2 }, effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'g4', name: 'Kaltlicht-Doktrin', cost: 1e11, req: { depth: 3 }, effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
    { id: 'g5', name: 'Grabenchor', cost: 2e14, req: { depth: 4 }, effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
    { id: 'g6', name: 'Drohnen-Scheinwerfer', cost: 5e4, req: { depth: 1 }, effects: [{ type: 'manganMult', mult: 1.5 }], desc: 'Mangan-Förderung +50 %.' },
    { id: 'g7', name: 'Sonar-Verstärker', cost: 5e8, req: { depth: 2 }, effects: [{ type: 'dataMult', mult: 1.5 }], desc: 'Datengewinnung +50 %.' },
  ];

  // --- Mangan --------------------------------------------------------------
  C.MINERS = [
    { id: 'drone', name: 'Knollen-Drohne', depth: 1, baseCost: 1500, growth: 1.17, prod: 0.35,
      desc: 'Kleine Sammler, die Manganknollen vom Meeresboden picken.' },
    { id: 'drill', name: 'Tiefbohrer', depth: 3, baseCost: 1e10, growth: 1.2, prod: 12,
      desc: 'Schwere Bohrköpfe fressen sich in die Krustenplatten.' },
  ];

  // Verstärkung: Mangan in einzelne Anlagen investieren
  // Kosten = baseCost * tierScale^tier * growth^level ; Effekt x(mult) pro Stufe
  C.REINFORCE = { baseCost: 15, tierScale: 3.2, growth: 3, mult: 1.25, maxLevel: 15 };

  // --- Daten -----------------------------------------------------------------
  C.SONAR = { id: 'sonar', name: 'Sonarboje', depth: 2, baseCost: { lumen: 4e6, mangan: 120 }, growth: 1.22, prod: 0.12,
    desc: 'Lauscht in die Tiefe und wertet Echos aus. Erzeugt Daten.' };

  // --- Forschung -------------------------------------------------------------
  C.RESEARCH = [
    { id: 'r_calib', name: 'Sonar-Kalibrierung', cost: 15, depth: 2, effects: [{ type: 'dataMult', mult: 2 }], desc: 'Datengewinnung x2.' },
    { id: 'r_proto', name: 'Protokoll-Kern', cost: 30, depth: 2, effects: [{ type: 'protocolUnlock' }], desc: 'Schaltet die Protokoll-Spezialisierung frei.' },
    { id: 'r_dronelogic', name: 'Schwarmlogik der Drohnen', cost: 40, depth: 2, effects: [{ type: 'manganMult', mult: 2 }], desc: 'Mangan-Förderung x2.' },
    { id: 'r_catalyst', name: 'Biokatalyse', cost: 70, depth: 2, req: ['r_calib'], effects: [{ type: 'allMult', mult: 1.5 }], desc: 'Alle Anlagen +50 %.' },
    { id: 'r_lure', name: 'Lockstoffe', cost: 60, depth: 2, effects: [{ type: 'eventFreq', mult: 0.7 }, { type: 'eventDur', mult: 1.4 }], desc: 'Irrlichter erscheinen 30 % häufiger und bleiben länger.' },
    { id: 'r_neural', name: 'Neuronale Pulse', cost: 120, depth: 2, effects: [{ type: 'clickPct', pct: 0.02 }], desc: 'Puls +2 % deiner Lumen/s.' },
    { id: 'r_overcharge', name: 'Überladung', cost: 150, depth: 2, req: ['r_proto'], effects: [{ type: 'abilityUnlock' }], desc: 'Aktive Fähigkeit: 30 s doppelte Produktion, 5 min Abklingzeit.' },
    { id: 'r_chain', name: 'Nahrungskette', cost: 260, depth: 2, req: ['r_catalyst'], effects: [{ type: 'synergyBoost', mult: 2 }], desc: 'Alle Synergie-Boni werden verdoppelt.' },
    { id: 'r_hull', name: 'Druckrumpf', cost: 400, depth: 2, req: ['r_catalyst'], effects: [{ type: 'depthAdd', add: 0.15 }], desc: 'Tiefenbonus pro Zone von x1,25 auf x1,40.' },
    { id: 'r_memory', name: 'Echospeicher', cost: 350, depth: 2, effects: [{ type: 'offlineHours', add: 4 }], desc: 'Offline-Fortschritt bis zu 4 h länger.' },
    { id: 'r_alloy', name: 'Abyssal-Legierung', cost: 1500, depth: 3, effects: [{ type: 'reinforceEff', add: 0.1 }], desc: 'Jede Verstärkungsstufe wirkt x1,35 statt x1,25.' },
    { id: 'r_cascade', name: 'Kaskaden-Überladung', cost: 2200, depth: 3, req: ['r_overcharge'], effects: [{ type: 'abilityDur', mult: 1.5 }, { type: 'abilityCd', mult: 0.7 }], desc: 'Überladung hält 50 % länger, Abklingzeit -30 %.' },
    { id: 'r_song', name: 'Leviathan-Gesang', cost: 3500, depth: 3, effects: [{ type: 'genMult', gen: 'leviathan', mult: 3 }], desc: 'Leviathan-Echos x3.' },
    { id: 'r_deepdata', name: 'Tiefen-Telemetrie', cost: 2800, depth: 3, effects: [{ type: 'dataMult', mult: 2 }, { type: 'manganMult', mult: 2 }], desc: 'Daten und Mangan x2.' },
    { id: 'r_heart', name: 'Herzstimmung', cost: 9000, depth: 4, effects: [{ type: 'allMult', mult: 2 }], desc: 'Alle Anlagen x2.' },
  ];

  // Wiederholbare Forschung als dauerhafte Datensenke (ab Abyssal)
  C.ANALYSIS = { name: 'Tiefenanalyse', depth: 3, baseCost: 1500, growth: 2.2, mult: 1.1, maxLevel: 40,
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
      desc: 'Mangan x3, Daten x2, Expeditionen 40 % schneller, Offline-Grenze +4 h.',
      effects: [{ type: 'manganMult', mult: 3 }, { type: 'dataMult', mult: 2 }, { type: 'expSpeed', mult: 0.6 }, { type: 'offlineHours', add: 4 }] },
  ];
  C.PROTOCOL_SWITCH_COST = 50; // Daten, verdoppelt sich je Wechsel

  // --- Aktive Fähigkeit ------------------------------------------------------
  C.ABILITY = { name: 'Überladung', duration: 30, cooldown: 300, mult: 2 };

  // --- Irrlichter (seltene Ereignisse) ---------------------------------------
  // Wahrscheinlichkeiten werden im Spiel exakt so angezeigt.
  C.EVENTS = {
    firstDelay: 240, minDelay: 120, maxDelay: 300, lifetime: 12,
    outcomes: [
      { id: 'burst', weight: 55, seconds: 90, manganSeconds: 60, name: 'Lichtflut', desc: 'Sofort 90 s Lumen-Produktion (+60 s Mangan ab der Dämmerzone).' },
      { id: 'frenzy', weight: 45, mult: 3, duration: 25, name: 'Lichtrausch', desc: 'Produktion x3 für 25 s.' },
    ],
  };

  // --- Expeditionen (ab Abyssal) ---------------------------------------------
  C.EXPEDITIONS = [
    { id: 'wreck', name: 'Wrack der Meridian', duration: 120, cost: { mangan: 6000, data: 120 }, growth: 1.9, maxLevel: 10,
      artifact: 'Messingkompass', desc: 'Ein Forschungsschiff, 1974 verschollen.',
      effects: [{ type: 'clickMult', mult: 1.5 }, { type: 'eventFreq', mult: 0.92 }], effectText: 'Puls x1,5 und Irrlichter 8 % häufiger pro Stufe' },
    { id: 'smoker', name: 'Schwarzer Raucher', duration: 300, cost: { mangan: 15000, data: 300 }, growth: 1.9, maxLevel: 10,
      artifact: 'Schlackekristall', desc: 'Ein Feld kochender Schlote voller Mineralien.',
      effects: [{ type: 'manganMult', mult: 1.35 }, { type: 'dataMult', mult: 1.25 }], effectText: 'Mangan +35 % und Daten +25 % pro Stufe' },
    { id: 'grave', name: 'Leviathan-Friedhof', duration: 600, cost: { mangan: 40000, data: 800 }, growth: 1.9, maxLevel: 10,
      artifact: 'Echoschädel', desc: 'Hier sterben die Giganten. Ihre Knochen singen noch.',
      effects: [{ type: 'allMult', mult: 1.15 }], effectText: 'Alle Anlagen +15 % pro Stufe' },
  ];

  // --- Prestige: Gezeitenwende -----------------------------------------------
  // Perlen = floor(scale * (LumenDiesenLauf / base) ^ exponent)  – flach, damit Weiterspielen sich lohnt, aber abflacht
  C.PRESTIGE = { requireDepth: 4, base: 5e13, exponent: 0.33, scale: 10, unspentBonus: 0.02 };

  C.PRESTIGE_SHOP = [
    { id: 'p_memory', name: 'Gezeitengedächtnis', maxLevel: 50, cost: { base: 2, growth: 1.45 },
      effects: [{ type: 'allMult', mult: 1.25 }], desc: 'Alle Anlagen +25 % pro Stufe (multiplikativ).' },
    { id: 'p_flotsam', name: 'Treibgut', maxLevel: 5, cost: { base: 1, growth: 2 },
      effects: [], desc: 'Starte jeden Lauf mit Lumen: 500 / 5 Tsd. / 50 Tsd. / 500 Tsd. / 5 Mio.' },
    { id: 'p_knowledge', name: 'Vorwissen', maxLevel: 1, cost: { base: 4, growth: 1 },
      effects: [], desc: 'Starte jeden Lauf direkt in der Dämmerzone, mit 5 Knollen-Drohnen.' },
    { id: 'p_compass', name: 'Tiefenkompass', maxLevel: 3, cost: { base: 3, growth: 2 },
      effects: [{ type: 'descentDiscount', add: 0.15 }], desc: 'Abstiegskosten -15 % pro Stufe.' },
    { id: 'p_archive', name: 'Gesichertes Archiv', maxLevel: 1, cost: { base: 5, growth: 1 },
      effects: [], desc: 'Sonar-Kalibrierung und Protokoll-Kern bleiben nach der Gezeitenwende erforscht.' },
    { id: 'p_tide', name: 'Ruheströmung', maxLevel: 4, cost: { base: 2, growth: 1.8 },
      effects: [{ type: 'offlineHours', add: 2 }], desc: 'Offline-Grenze +2 h pro Stufe.' },
    { id: 'p_automaton', name: 'Automaton', maxLevel: 1, cost: { base: 6, growth: 1 },
      effects: [{ type: 'autobuy' }], desc: 'Schaltet automatischen Anlagenkauf frei (abschaltbar).' },
    { id: 'p_luster', name: 'Perlenglanz', maxLevel: 1, cost: { base: 10, growth: 1 },
      effects: [{ type: 'unspentBonusAdd', add: 0.02 }], desc: 'Unausgegebene Perlen geben +4 % statt +2 % Produktion.' },
    { id: 'p_dual', name: 'Doppelprotokoll', maxLevel: 1, cost: { base: 18, growth: 1 },
      effects: [{ type: 'dualProtocol' }], desc: 'Zwei Protokolle gleichzeitig aktiv.' },
  ];
  C.FLOTSAM_START = [0, 500, 5000, 5e4, 5e5, 5e6];

  // --- Logbuch (Erfolge) -----------------------------------------------------
  C.ACHIEVEMENT_BONUS = 0.01; // +1 % Produktion pro Eintrag

  // --- Aufträge --------------------------------------------------------------
  // reward: lumenSec = Sekunden aktueller Produktion (mind. lumenMin)
  C.MISSIONS = [
    { id: 'm1', name: 'Erster Puls', cond: { clicks: 15 }, reward: { lumen: 25 } },
    { id: 'm2', name: 'Netze auswerfen', cond: { gen: 'plankton', n: 3 }, reward: { lumen: 40 } },
    { id: 'm3', name: 'Dichtes Netz', cond: { gen: 'plankton', n: 10 }, reward: { lumenSec: 60, lumenMin: 100 } },
    { id: 'm4', name: 'Erste Verbesserung', cond: { upgrades: 1 }, reward: { lumenSec: 60, lumenMin: 100 } },
    { id: 'm5', name: 'Algenteppich', cond: { gen: 'algae', n: 5 }, reward: { lumenSec: 90 } },
    { id: 'm6', name: 'Lichtvorrat', cond: { lumenRun: 2500 }, reward: { lumenSec: 90 } },
    { id: 'm7', name: 'Abwärts', cond: { depth: 1 }, reward: { mangan: 25 } },
    { id: 'm8', name: 'Knollenernte', cond: { miner: 'drone', n: 5 }, reward: { lumenSec: 120 } },
    { id: 'm9', name: 'Verstärkt', cond: { reinforce: 2 }, reward: { mangan: 60 } },
    { id: 'm9b', name: 'Feinmechanik', cond: { upgrades: 10 }, reward: { lumenSec: 120 } },
    { id: 'm10', name: 'Schwarmbildung', cond: { gen: 'jelly', n: 15 }, reward: { lumenSec: 120 } },
    { id: 'm11', name: 'Laternen im Dunkel', cond: { gen: 'angler', n: 10 }, reward: { lumenSec: 150 } },
    { id: 'm12', name: 'Irrlichtjäger', cond: { events: 1 }, reward: { lumenSec: 120 } },
    { id: 'm13', name: 'Stationsausbau', cond: { buildings: 120 }, reward: { mangan: 200 } },
    { id: 'm14', name: 'Mitternacht', cond: { depth: 2 }, reward: { data: 15 } },
    { id: 'm15', name: 'Wissbegierig', cond: { research: 2 }, reward: { lumenSec: 180 } },
    { id: 'm16', name: 'Doktrin', cond: { protocol: 1 }, reward: { data: 40 } },
    { id: 'm17', name: 'Heiße Quellen', cond: { gen: 'vent', n: 15 }, reward: { lumenSec: 180 } },
    { id: 'm18', name: 'Korallengarten', cond: { gen: 'coral', n: 10 }, reward: { mangan: 3000 } },
    { id: 'm19', name: 'Technokrat', cond: { upgrades: 30 }, reward: { lumenSec: 240 } },
    { id: 'm20', name: 'Ins Abyssal', cond: { depth: 3 }, reward: { data: 200 } },
    { id: 'm21', name: 'Expedition', cond: { expeditions: 1 }, reward: { lumenSec: 300 } },
    { id: 'm22', name: 'Bohrfeld', cond: { miner: 'drill', n: 5 }, reward: { data: 400 } },
    { id: 'm23', name: 'Gesang der Riesen', cond: { gen: 'leviathan', n: 10 }, reward: { lumenSec: 300 } },
    { id: 'm24', name: 'Unter Strom', cond: { abilityUses: 3 }, reward: { lumenSec: 300 } },
    { id: 'm25', name: 'Der Graben', cond: { depth: 4 }, reward: { lumenSec: 600 } },
    { id: 'm26', name: 'Herzschlag', cond: { gen: 'heart', n: 5 }, reward: { lumenSec: 600 } },
    { id: 'm27', name: 'Gezeitenwende', cond: { prestiges: 1 }, reward: { lumen: 1000 } },
    { id: 'm28', name: 'Perlentaucher', cond: { shopLevels: 5 }, reward: { lumenSec: 300 } },
    { id: 'm29', name: 'Wiederkehr', cond: { depth: 4, prestigesMin: 1 }, reward: { lumenSec: 900 } },
    { id: 'm30', name: 'Gezeitenmeister', cond: { prestiges: 3 }, reward: { lumenSec: 900 } },
  ];
  C.MISSIONS_VISIBLE = 3;

  // --- Abgeleitete Lookups ---------------------------------------------------
  C.GEN_BY_ID = {};
  C.GENERATORS.forEach((g, i) => { g.tier = i; C.GEN_BY_ID[g.id] = g; });
  C.MINER_BY_ID = {};
  C.MINERS.forEach((m) => { C.MINER_BY_ID[m.id] = m; });
  C.RESEARCH_BY_ID = {};
  C.RESEARCH.forEach((r) => { C.RESEARCH_BY_ID[r.id] = r; });
  C.PROTOCOL_BY_ID = {};
  C.PROTOCOLS.forEach((p) => { C.PROTOCOL_BY_ID[p.id] = p; });
  C.EXPEDITION_BY_ID = {};
  C.EXPEDITIONS.forEach((e) => { C.EXPEDITION_BY_ID[e.id] = e; });
  C.SHOP_BY_ID = {};
  C.PRESTIGE_SHOP.forEach((s) => { C.SHOP_BY_ID[s.id] = s; });

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
  C.UPGRADE_BY_ID = {};
  C.UPGRADES.forEach((u) => { C.UPGRADE_BY_ID[u.id] = u; });

  // Logbuch-Einträge generieren
  C.ACHIEVEMENTS = [];
  const ach = (id, name, cond, desc) => C.ACHIEVEMENTS.push({ id, name, cond, desc });
  C.GENERATORS.forEach((g) => {
    [1, 25, 50, 100].forEach((n) => ach('a_' + g.id + '_' + n, g.name + ' ×' + n, { gen: g.id, n }, 'Besitze ' + n + '× ' + g.name + '.'));
  });
  [[1e3, 'Funke', '1.000'], [1e6, 'Glimmen', '1 Million'], [1e9, 'Leuchtfeuer', '1 Milliarde'], [1e12, 'Polarlicht', '1 Billion'], [1e15, 'Sonnenkern', '1 Billiarde'], [1e18, 'Supernova', '1 Trillion']].forEach(([n, name, txt], i) =>
    ach('a_lum' + i, name, { lumenAll: n }, 'Insgesamt ' + txt + ' Lumen gesammelt.'));
  [[100, 'Taktgeber'], [1000, 'Dauerpuls'], [5000, 'Herzrasen']].forEach(([n, name], i) =>
    ach('a_clk' + i, name, { clicks: n }, n + ' Pulse ausgelöst.'));
  [[1, 'Irrlicht gefangen'], [10, 'Lichtsammler'], [30, 'Irrlicht-Flüsterer']].forEach(([n, name], i) =>
    ach('a_evt' + i, name, { events: n }, n + ' Irrlichter gefangen.'));
  C.DEPTHS.forEach((d, i) => { if (i > 0) ach('a_depth' + i, d.name, { depth: i }, 'Erreiche ' + d.meters + ' m Tiefe.'); });
  ach('a_res10', 'Gelehrter', { research: 10 }, '10 Forschungen abgeschlossen.');
  ach('a_resall', 'Allwissend', { research: C.RESEARCH.length }, 'Alle Forschungen abgeschlossen.');
  ach('a_exp5', 'Tiefseeforscher', { expeditions: 5 }, '5 Expeditionen abgeschlossen.');
  ach('a_rein10', 'Gepanzert', { reinforce: 10 }, '10 Verstärkungsstufen insgesamt.');
  ach('a_build250', 'Metropole', { buildings: 250 }, '250 Anlagen gleichzeitig.');
  ach('a_pres1', 'Erste Flut', { prestiges: 1 }, 'Erste Gezeitenwende.');
  ach('a_pres5', 'Ewige Gezeiten', { prestiges: 5 }, 'Fünf Gezeitenwenden.');
  C.ACHIEVEMENT_BY_ID = {};
  C.ACHIEVEMENTS.forEach((a) => { C.ACHIEVEMENT_BY_ID[a.id] = a; });

  AB.CONFIG = C;
})(typeof window !== 'undefined' ? (window.AB = window.AB || {}) : (globalThis.AB = globalThis.AB || {}));
