# ABYSSAL – Tiefsee-Idle

Du bist das KI-Kernsystem der versunkenen Forschungsstation **Tethys-7**. Du sammelst Biolumineszenz (**Lumen**), baust die Station aus und tauchst Zone für Zone tiefer ab, bis ganz unten im Graben das **Tiefenherz** schlägt. Dort kannst du die **Gezeitenwende** auslösen: Neustart mit dauerhaften **Perlen**.

Mit jeder Zone wird es dunkler, das Leben leuchtet stärker, und es kommt eine neue Spielmechanik dazu.

---

## Start

**Windows:** Doppelklick auf `start.bat` oder direkt auf `index.html`.

**Andere Systeme:** `index.html` im Browser öffnen.

- Kein Server, keine Installation, kein Internet nötig. Alles läuft lokal aus der HTML-Datei.
- Getestet mit Chromium (Playwright). Aktuelle Versionen von Chrome, Edge und Firefox sollten genauso laufen.
- Gespeichert wird im `localStorage` des Browsers, also pro Browser und pro Speicherort der Datei. Wer den Ordner verschiebt oder den Browser wechselt, nimmt den Stand per **Export/Import** mit (Einstellungen → Spielstand).

> Hinweis: Firefox kann bei `file://`-Seiten den Speicher je nach Einstellung strenger behandeln. Falls der Fortschritt dort nicht erhalten bleibt, Chrome/Edge nehmen oder einen beliebigen lokalen Server verwenden (z. B. `npx serve .`). Für das Spiel selbst ist kein Server nötig.

---

## Projektstruktur

```
abyssal/
├── index.html          Grundgerüst
├── start.bat           Windows-Starter (öffnet index.html)
├── css/style.css       komplettes Design, Animationen, Responsive
├── js/
│   ├── config.js       ZENTRALE BALANCE-KONFIGURATION (alle Zahlen)
│   ├── format.js       Zahlen-/Zeitformatierung (K, M, B … / wiss. / ing.)
│   ├── state.js        Zustandsmodell, Lauf-Reset, Validierung kaputter Stände
│   ├── economy.js      Effekt-Engine, Produktion, Kostenformeln
│   ├── unlocks.js      Bedingungen, Aufträge, Logbuch, Feature-Freischaltung
│   ├── actions.js      alle Spieleraktionen (prüfen selbst ihre Bedingungen)
│   ├── core.js         Zeitsimulation, Offline-Fortschritt, Gezeitenwende
│   ├── save.js         Speichern/Laden, Backup, Export/Import
│   ├── icons.js        selbst gezeichnete SVG-Icons
│   ├── audio.js        optionale Soundeffekte (WebAudio-Synthese, keine Dateien)
│   ├── scene.js        Hintergrund-Canvas (Wasser, Lichtstrahlen, Lebewesen)
│   ├── ui.js           Oberfläche: Panels, Karten, Modals, Toasts
│   ├── tutorial.js     kurzes Kontext-Tutorial
│   └── main.js         Start, Hauptschleife, Eingaben, Irrlichter, Autosave
└── tests/
    ├── harness.js      lädt die DOM-freien Module in Node
    ├── run-tests.js    Unit-Tests + Langzeit-Simulationen
    ├── simulate.js     Wirtschafts-Bot (spielt mit der echten Spiellogik)
    └── e2e.js          End-to-End-Test im echten Browser (Playwright)
```

Kein Framework, keine Abhängigkeiten. Die Module sind klassische Skripte mit einem gemeinsamen Namespace `AB`, weil ES-Module unter `file://` in Chrome blockiert werden. Alles bis einschließlich `save.js` kommt ohne DOM aus und läuft deshalb auch in Node (Tests, Simulation).

---

## Spielmechaniken

### Kern-Loop
1. **Lumen-Kern pulsen** (Klick / Leertaste): sofort Lumen. Später skaliert der Puls mit deiner Produktion.
2. **Anlagen** kaufen: produzieren automatisch. Kosten steigen pro Kauf um 15 %.
3. **Verbesserungen**: einmalige Käufe, die bei bestimmten Anlagenzahlen freigeschaltet werden (je ×2), dazu Synergien, Puls- und globale Upgrades.
4. **Abstieg** in die nächste Zone: kostet Ressourcen und bringt einen dauerhaften Tiefenbonus (×1,25 pro Zone) plus neue Mechaniken.
5. **Gezeitenwende** am Grund: Reset gegen Perlen und dauerhafte Boni.

### Zonen und was sie freischalten
| Zone | Tiefe | Neu |
|---|---|---|
| Schelfkante | 0 m | Planktonnetze, Leuchtalgen, Puls-Upgrades, Aufträge |
| Dämmerzone | 200 m | **Mangan** (Knollen-Drohnen), **Verstärkung**, Quallen, Anglerfische |
| Mitternachtszone | 1.000 m | **Daten** (Sonarbojen), **Forschung**, **Protokolle**, **Überladung**, Schlotturbinen, Korallen |
| Abyssal | 4.000 m | **Expeditionen & Artefakte**, Tiefbohrer, **Tiefenanalyse**, Leviathan-Echos |
| Hadal | 8.000 m | Tiefenherzen, **Gezeitenwende** |

### Ressourcen
- **Lumen**: Hauptwährung für Anlagen, Upgrades, Drohnen, Bojen und Abstiege.
- **Mangan**: für Verstärkungen, Sonarbojen, Abstiege und Expeditionen.
- **Daten**: für Forschung, Protokollwechsel, Expeditionen, Tiefenanalyse und Abstiege.
- **Perlen**: dauerhaft. Jede unausgegebene Perle gibt +2 % Produktion. Alternativ gibst du sie im Perlen-Erbe aus. Das ist eine echte Abwägung.

### Systeme im Detail
- **Verstärkung** (Mangan): Jede Anlage einzeln verbessern, ×1,25 pro Stufe, Kosten ×3 pro Stufe. Die Kosten wachsen schnell, deshalb lohnt sich das Verteilen.
- **Forschung** (Daten): 15 Projekte mit Voraussetzungen, darunter Protokoll-Kern, Überladung, Biokatalyse, Druckrumpf und Herzstimmung.
- **Protokolle** (Spezialisierung, exklusiv):
  - *Schwarm* (passiv): +0,15 % Produktion pro gebauter Anlage.
  - *Puls* (aktiv): Puls ×5 und +12 % der Lumen/s pro Klick, Überladung ×3, Irrlichter doppelt so oft.
  - *Strömung* (Wirtschaft): Mangan ×3, Daten ×2, Expeditionen schneller, mehr Offline-Zeit.
  Die erste Wahl ist gratis. Ein Wechsel kostet Daten (verdoppelt sich pro Wechsel).
- **Überladung**: aktive Fähigkeit, 30 s doppelte Produktion, 5 min Abklingzeit (Taste `Q`).
- **Irrlichter**: seltene, faire Ereignisse. Alle 2–5 min treibt ein Irrlicht 12 s lang durchs Bild. Wer es anklickt, bekommt mit 55 % sofort 90 s Produktion, mit 45 % ×3 Produktion für 25 s. Die Wahrscheinlichkeiten stehen im Logbuch. Wer eins verpasst, verliert nichts.
- **Expeditionen**: Ein Team gleichzeitig, 2–10 min. Jede Rückkehr bringt garantiert eine Artefakt-Stufe, ohne Zufall. Läuft auch offline weiter.
- **Tiefenanalyse**: wiederholbares Datenprojekt (+10 % pro Stufe), damit Daten im Late Game nicht wertlos werden.
- **Aufträge**: 31 geführte Ziele mit Belohnungen. Drei sind gleichzeitig sichtbar, sie dienen auch als roter Faden.
- **Logbuch**: 55 Erfolge, je +1 % Produktion dauerhaft, auch über Gezeitenwenden hinweg.

### Gezeitenwende (Prestige)
- **Verfügbar** ab Hadal (8.000 m).
- **Belohnung:** `Perlen = floor(10 × (Lumen dieses Laufs / 5·10¹³)^0,33)`. Die Kubikwurzel sorgt dafür, dass Weiterspielen sich lohnt, der Ertrag aber abflacht. Den Zeitpunkt wählst du also selbst.
- **Zurückgesetzt** werden Lumen, Mangan, Daten, Anlagen, Upgrades, Verstärkungen, Forschung, Protokolle, Artefakte und die Tiefe.
- **Erhalten bleiben** Perlen, Perlen-Erbe, Logbuch, Aufträge, Statistiken und Einstellungen.
- **Perlen-Erbe:** 9 dauerhafte Upgrades, z. B. Gezeitengedächtnis (+25 %/Stufe), Vorwissen (Start in der Dämmerzone), Treibgut (Startkapital), Tiefenkompass (günstigere Abstiege), Gesichertes Archiv, Automaton (Auto-Kauf), Perlenglanz und Doppelprotokoll (zwei Protokolle gleichzeitig).
- **Sicherheit:** Vor der Wende zeigt ein Bestätigungsdialog genau, was verloren geht und was bleibt. Der Bestätigen-Knopf wird erst nach 1,2 s aktiv (Schutz gegen Doppelklick). Danach wird sofort gespeichert.

---

## Balancing-System

Alle Zahlen stehen in **`js/config.js`**: Kosten, Raten, Wachstumsfaktoren, Freischaltbedingungen, Abstiegskosten, Forschung, Protokolle, Ereignisse, Prestige-Formel, Shop und Aufträge.

**Formeln:**
- Wiederholbare Käufe: `Kosten(n) = Basis × Wachstum^n`. Mehrfachkäufe werden als geometrische Reihe exakt berechnet, Max-Kauf analytisch.
- Produktion einer Anlage: `Basis × Anzahl × (Upgrades × Verstärkung × Synergien) × Global`.
- Global: `Upgrades/Forschung/Artefakte × Logbuch × Perlen × Tiefe × Schwarm × aktive Boosts`.
- Alle Boni (Upgrades, Forschung, Protokolle, Artefakte, Perlen-Erbe) laufen durch **eine** Effekt-Engine (`economy.js`). Neue Boni sind daher reine Konfiguration.

**Designprinzipien:**
- Jede Zone ist ein Plateau: Innerhalb einer Zone wachsen die Amortisationszeiten, bis der nächste Abstieg das Wachstum wieder öffnet. Abstiege verlangen die Nebenressourcen (Mangan, Daten), die deshalb nie egal sind.
- Frühe Anlagen bleiben über Upgrades bei 100/150/200 Stück, Synergien und Verstärkung relevant.
- Mehrere Wege: Die drei Protokolle führen alle zuverlässig nach Hadal, aber mit unterschiedlichem Tempo und Spielgefühl (per Simulation geprüft).
- Rechenschwache Stellen sind abgefangen: Werte über 1e300 werden gedeckelt, NaN/Infinity aus Speicherständen verworfen.

**Simulation** (`node tests/simulate.js <min> <protokoll> <klicks/s> [2] [prüfintervall]`): Ein Bot spielt mit der echten Spiellogik und protokolliert Meilensteine. Typische Ergebnisse:

| Spielertyp | Dämmerzone | Mitternacht | Abyssal | Hadal |
|---|---|---|---|---|
| optimaler Bot (kauft jede Sekunde) | ~7 min | ~22 min | ~50 min | ~87 min |
| gemütlich (kauft alle 45 s, klickt wenig) | ~12 min | ~31 min | ~59 min | ~94 min |
| 2. Lauf nach Gezeitenwende | ~5 min | ~15 min | ~35 min | ~65 min |

Ein Mensch, der liest, ausprobiert und nicht immer optimal kauft, liegt erfahrungsgemäß darüber. Hadal und die erste Gezeitenwende landen damit im Bereich **~100–130 Minuten**. Beim Erreichen von Hadal gibt es ~10–15 Perlen, 30 min später ~30–40.

---

## Technik

- **Zeit**: Die Produktion wird aus der real vergangenen Zeit berechnet (`Date.now()`), nicht aus Timer-Ticks. Große Zeitsprünge werden in Schritte von max. 60 s geteilt, zusätzlich exakt an Boost- und Expeditions-Enden. Ein Sprung über 600 s liefert also genau dasselbe Ergebnis wie 6.000 Schritte à 0,1 s (per Test geprüft).
- **Hintergrund-Tabs**: Gedrosselte Timer verfälschen nichts. Lücken über 60 s (Ruhezustand, eingefrorener Tab) werden wie Offline-Zeit behandelt, also gedeckelt und mit Bericht.
- **Offline-Fortschritt**: volle Produktion für bis zu 4 h. Erweiterbar über Forschung (+4 h), Strömungs-Protokoll (+4 h) und Perlen-Erbe (+2 h/Stufe). Nach der Rückkehr zeigt ein Bericht, wie lange du weg warst, was angerechnet wurde und was entstanden ist.
- **Speichern**: Autosave alle 15 s, zusätzlich beim Verbergen/Schließen des Tabs, bei Abstieg und Gezeitenwende. Speichern geht auch manuell. Jedes Speichern legt ein Backup des vorherigen Stands an. Ist der Hauptstand kaputt, wird automatisch das Backup geladen.
- **Export/Import**: als Text (`ABYSSAL1:` + Base64) oder als Datei. Importe werden vollständig validiert: unbekannte Felder werden verworfen, Zahlen auf gültige Bereiche geklemmt, IDs gegen die Konfiguration geprüft, die Version kontrolliert. Kaputte Daten werden mit verständlicher Meldung abgelehnt, der aktuelle Stand bleibt unangetastet.
- **Zahlen**: JavaScript-`Number` (doppelte Genauigkeit, ~15 signifikante Stellen, bis 1,8e308). Das reicht hier, weil Werte nur auf 3 Stellen angezeigt werden und die Progression weit unter dem Grenzwert bleibt. Eine Big-Number-Bibliothek hätte nur Abhängigkeiten und Rechenzeit gekostet.

---

## Bedienung

- **Maus/Touch**: alles klickbar. Gesperrte Knöpfe reagieren trotzdem und sagen, was fehlt (inkl. geschätzter Wartezeit).
- **Tastatur**: `Leertaste` Puls (Gedrückthalten zählt nicht als Dauerfeuer), `Q` Überladung, `1`–`8` Tabs, `Esc` schließt Fenster, `Tab`/`Enter` für alle Knöpfe.
- **Einstellungen** (Zahnrad): Animationen reduzieren (wird beim ersten Start automatisch aktiviert, wenn das Betriebssystem „Bewegung reduzieren“ meldet), Zahlenformat, Sound an/aus und Lautstärke, Speichern, Export/Import (Text und Datei), Tutorial neu starten, Spielstand löschen (nur nach Eingabe von „LÖSCHEN“).
- **Responsive**: Desktop (zweispaltig), Tablet und Smartphone (einspaltig).

---

## Tatsächlich implementierte Funktionen

- 8 Lumen-Anlagen, 2 Mangan-Förderer, Sonarbojen
- 56 Anlagen-Upgrades, 7 Synergien, 6 Puls- und 7 globale Upgrades
- 5 Tiefenzonen mit Story-Texten und sich verändernder Grafik (Farben, Lichtstrahlen, Anzahl und Farbe der Leuchtwesen, Farbe des Kerns)
- Verstärkungssystem (Mangan → einzelne Anlagen)
- 15 Forschungsprojekte mit Voraussetzungen, dazu die wiederholbare Tiefenanalyse
- 3 exklusive Protokolle (Spezialisierung) mit kostenpflichtigem Wechsel
- Aktive Fähigkeit „Überladung“ mit Abklingzeit
- Irrlichter (seltene Ereignisse) mit offen angezeigten Wahrscheinlichkeiten
- 3 Expeditionen mit je 10 Artefakt-Stufen
- 31 Aufträge, 55 Logbuch-Einträge, ausführliche Statistik inkl. Multiplikator-Aufschlüsselung
- Gezeitenwende mit 9 Perlen-Erbe-Upgrades, inkl. Automaton (Auto-Kauf, abschaltbar)
- Kontext-Tutorial (5 Schritte, überspringbar) und einmalige Erklärfenster bei jedem neuen System
- Offline-Fortschritt mit Bericht und Obergrenze
- Autosave, Backup, Export/Import (Text und Datei), validierter Import, sicherer Reset
- Optionale synthetische Soundeffekte (erst nach der ersten Interaktion)
- Kaufmengen ×1 / ×10 / ×25 / Max, erwarteter Produktionszuwachs pro Kauf, Fortschrittsbalken für Abstiege und Aufträge

---

## Durchgeführte Tests

Alle Tests wurden in dieser Entwicklungsumgebung tatsächlich ausgeführt (Node 22, Chromium über Playwright 1.56).

**Unit-Tests & Simulation:** `npm test` bzw. `node tests/run-tests.js` → **33/33 bestanden**
- Formatierung, Kostenreihen, Max-Kauf
- Käufe mit/ohne genug Ressourcen, Zonensperren, Upgrade-Bedingungen, Doppelkauf-Schutz
- Verstärkung, Forschungs-Voraussetzungen, Protokollwahl und -wechsel, Abstieg
- Produktion = Rate × Zeit, großer Schritt = viele kleine Schritte, exakte Boost-Enden, Expeditions-Abschluss
- Ungültige Zeitwerte, Offline-Deckelung, kein Bericht bei kurzer Abwesenheit
- Aufträge, Logbuch-Bonus
- Prestige: nur ab Hadal, setzt nur Lauf-Werte zurück, Perlen-Erbe wirkt beim Reset, Perlenformel steigt monoton und flacht ab
- Serialisierung, Export/Import-Roundtrip, 8 Varianten kaputter Importe, Reparatur ungültiger Einzelwerte
- Bot-Simulation über 130 min: Meilensteine in plausiblen Zeiträumen; alle drei Protokolle erreichen Hadal; der zweite Lauf ist schneller

**End-to-End im echten Browser:** `node tests/e2e.js [screenshot-ordner]` → **48/48 bestanden**
- Start ohne JS-Fehler, Puls, erster Kauf, laufende Produktion
- Blockierter Kauf mit Hinweis
- Speichern + Reload (Stand erhalten, keine doppelten Elemente)
- Offline-Fortschritt (2 h simuliert, Bericht + korrekte Menge)
- Alle 8 Tabs in einer späten Spielphase ohne Fehler
- Protokoll, Forschung, Expedition, Verstärkung, Überladung per UI
- Abstieg, Gezeitenwende inkl. Doppelklick-Schutz, Reset der richtigen Werte, Erhalt von Logbuch und Perlen-Erbe nach Reload
- Export, zwei kaputte Importe (abgelehnt, Zustand unverändert), gültiger Import
- Tastatur: Leertaste, Zifferntasten, Kauf mit Enter
- Irrlicht erscheint und lässt sich fangen
- Einstellungen (reduzierte Animation, Zahlenformat), Reset nur mit Bestätigungswort
- Kein horizontaler Überlauf bei 390, 768 und 1920 px Breite

Zusätzlich lief ein beschleunigter Komplett-Durchlauf im Browser (Bot spielt bis zur Prestige-Reife, UI rendert dabei alle Tabs). Dabei traten keine JS-Fehler auf.

**Nicht getestet:** echte 2 Stunden Echtzeit-Spiel durch einen Menschen, andere Browser als Chromium, echte Touch-Geräte, Screenreader. Die 2-Stunden-Kurve stammt aus den Simulationen oben.

---

## Bekannte Einschränkungen

- Speicherstände liegen im Browser-Speicher. Wer Browserdaten löscht, verliert sie. Deshalb gelegentlich exportieren.
- Firefox kann `localStorage` unter `file://` je nach Datenschutzeinstellung einschränken (siehe Hinweis oben).
- Nach der ersten Gezeitenwende gibt es keine weitere große Mechanik-Stufe. Die Langzeitmotivation kommt aus dem Perlen-Erbe (inkl. Doppelprotokoll), schnelleren Läufen, den restlichen Logbuch-Einträgen und den Post-Prestige-Aufträgen. Für deutlich mehr als ~4–6 Stunden Spielzeit wären weitere Systeme nötig.
- Die Sounds sind bewusst schlicht (synthetisch erzeugt, keine Musik).
