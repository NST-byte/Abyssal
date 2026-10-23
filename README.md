# ABYSSAL – Tiefsee-Incremental

Du bist das KI-Kernsystem der versunkenen Forschungsstation **Tethys-7**. Du sammelst Biolumineszenz (**Lumen**), baust eine Station mit echten Verarbeitungsketten auf, erkundest die Tiefsee mit U-Booten und tauchst Zone für Zone tiefer, bis in die **Herzkammer** 15 km unter dem Meer. Zwei Prestige-Ebenen (**Gezeitenwende**, **Weltenwende**) und ein endloser **Tiefenrekord** tragen das Spiel weit über 50 Stunden.

**Version 2.0** ist eine grundlegende Überarbeitung. Was sich warum geändert hat, steht unten unter „Design-Überarbeitung“.

---

## Start

**Windows:** Doppelklick auf `start.bat` oder direkt auf `index.html`.
**Andere Systeme:** `index.html` im Browser öffnen.

- Kein Server, keine Installation, kein Internet. Alles läuft lokal aus der HTML-Datei.
- Gespeichert wird im `localStorage` des Browsers. Für einen Wechsel von Rechner oder Browser gibt es Export/Import in den Einstellungen.
- **Alte Spielstände (v1) werden automatisch übernommen.** Im Perlen-Shop ausgegebene Perlen werden erstattet, Expeditions-Artefakte werden zu Relikten.

> Firefox kann `localStorage` unter `file://` je nach Datenschutzeinstellung einschränken. Dann Chrome/Edge nehmen oder einen lokalen Server starten (z. B. `npx serve .`).

---

## Design-Überarbeitung (v1 → v2)

### Analyse von v1: Warum es monoton wurde
1. **Alle 8 Anlagen machten dasselbe** (Lumen/s), nur mit größeren Zahlen. Die einzige Entscheidung war „bester Payback zuerst“.
2. **Mangan und Daten waren reine Torwächter.** Sie wurden produziert und nie verbraucht, es gab keine Engpässe und keine Abwägungen.
3. **Die Forschung war eine flache Liste von Multiplikatoren**, die jeder komplett kaufte. Builds gab es keine.
4. **Expeditionen waren ein Timer für einen Multiplikator.**
5. **Prestige hatte eine Ebene** mit einem Shop aus Multiplikatoren. Lauf 2 spielte sich genau wie Lauf 1.
6. **Nach Hadal (~2 h) kam inhaltlich nichts mehr.**

### Was geblieben ist
Zonen und Abstieg als roter Faden, Lumen-Kern (Klick), Anlagen + Upgrades als Grundgerüst, Verstärkung, Protokolle, Überladung, Irrlichter, Aufträge, Logbuch, die Effekt-Engine, das Speicher-/Offline-System und die visuelle Identität.

### Was neu ist und warum

| System | Was es ist | Welches Problem es löst |
|---|---|---|
| **Station (Modulraster)** | Begrenztes Raster mit Reaktoren, Schmelzen, Fertigungen, Laboren, Prismen, Docks und Nachbarschaftsmodulen (Kühlturm, Relais, Druckresonator) | Räumliche Optimierung, Energie als Budget, echte Abwägung um Platz |
| **Verarbeitungsketten** | Mangan + Lumen → **Legierung** → mit Daten → **Resonanzkristalle**. Inputs werden **wirklich verbraucht** | Engpässe statt Ansammeln. Tiefe Anlagen und Abstiege brauchen Kettenprodukte |
| **Tech-Baum mit Gabelungen** | 24 Knoten in 3 Zweigen, 4 exklusive Gabeln, die **Rezepte ändern** (z. B. Kaltschmelze vs. Lichtschmelze) | Die beste Wahl verschiebt sich mit dem Spielstand. Umrüsten ist eine echte Entscheidung |
| **Strömungen** | Alle 10 min ein neuer Weltzustand mit Vorschau, der einen Bereich verstärkt. Mit Forschung lassen sich Strömungen „halten“ | Temporäre Modifikatoren, auf die man reagiert (umschalten, umbauen, halten). Ausschließlich positiv |
| **Tiefseekarte** | U-Boote erkunden 30 Sektoren. Danach **Ausbeuten** (begrenzte Außenposten, Dauerbonus) oder **Bergen** (sofortiger Ertrag, Relikte) | Erkundung mit langfristig/kurzfristig-Abwägung |
| **Relikte** | 12 Relikte mit je bis zu 3 Stufen, dauerhaft über alle Resets | Sammelziel über viele Wenden |
| **Gezeiten-Baum** | 24 Knoten in 4 Zweigen (Wirtschaft / Aktiv / Passiv & Automatik / Erkundung), je eine Gabel, max. 2 Capstones, **kostenloser Respec bei jeder Wende** | Echte Builds. Prestige eröffnet neue Spielweisen statt nur ×-Boni |
| **Tiefenproben** | 6 Herausforderungs-Läufe mit Sonderregeln (z. B. „kein Puls“, „Mangan ÷10“), je 3 Stufen, mit **einzigartigen Dauerbelohnungen** | Optionale Ziele für Optimierer, die andere Lösungswege erzwingen |
| **Schlund & Herzkammer** | Zwei neue Zonen hinter Hadal, erst nach 1 bzw. 3 Gezeitenwenden erreichbar | Neue Ziele für die Phase nach dem ersten Prestige |
| **Weltenwende + Ursprung** | 2. Prestige-Ebene: setzt auch Perlen und Baum zurück und gibt **Urlicht**. Damit gibt es Automatik, größeres Raster, **Erbstationen** (alternative Starts), drittes Capstone und Dauer-Multiplikatoren | Langfristige Ebene, die den Lauf-Aufbau grundlegend verändert |
| **Tiefenrekord** | Endloses Bohren aus der Herzkammer, bleibt über alle Resets | Wiederholbare Langzeitprogression für 50 h+ |
| **Ziel-Hierarchie** | Aufträge (jetzt) · nächste Schritte (diese Sitzung) · Wende, Proben, Relikte, Weltenwende (langfristig) | Immer mehrere klare nächste Ziele, nicht nur „höhere Zahl“ |

### Wie die Systeme ineinandergreifen
- **Mangan** wird von Verstärkung, Schmelzen, Sonarbojen und Abstiegen gebraucht. Du musst entscheiden, wohin es geht.
- **Daten** fließen in Forschung, Fertigungen (je nach Rezept stark), Protokollwechsel, Tiefenanalyse und späte Abstiege. Die Station warnt, wenn die Verarbeitung eine Ressource auffrisst, die der nächste Abstieg braucht.
- **Legierung** geht in Schlotturbinen/Korallen, Module, U-Boote, Erkundungen und Abstiege. **Kristalle** brauchen die tiefsten Anlagen, tiefe Erkundungen, Hadal und Herzkammer sowie der Tiefenrekord.
- **Energie** ist ein Budget, kein Vorrat. Relais senken den Verbrauch, Kühltürme stärken Reaktoren *und* Produktion. Platz im Raster ist knapp.
- **Strömungen** belohnen Reaktion: Bei „Warmer Strömung“ laufen Schmelzen doppelt, bei „Magnetsturm“ Daten und Fertigungen.
- **Karte ↔ Station:** Docks bestimmen die Zahl der U-Boote, Schlotfelder liefern Energie, Kristallnester steigern Fertigungen.
- **Tiefendruck:** Jede erreichte Zone macht Verarbeitungsmodule 15 % effizienter. Abtauchen stärkt also auch die Ketten.
- **Prioritäten verschieben sich:** Anfangs baust du Produktion auf. Ab der Dämmerzone optimierst du Engpässe. Ab dem Abyssal wägst du Außenposten, Bergungen und Kristalle gegen Legierung ab. Nach der Wende wählst du Builds, in Proben gelten andere Regeln, nach der Weltenwende andere Starts.

---

## Progression & Zeithorizonte

Die Zeiten unten stammen aus Simulationen mit der echten Spiellogik (siehe Balancing). Ein Mensch, der liest und ausprobiert, braucht etwa 1,5× so lange wie der optimal spielende Bot.

| Horizont | Was passiert | Neue Entscheidungen |
|---|---|---|
| **0–15 min** | Puls, Planktonnetze, erste Upgrades, Dämmerzone (~7–12 min), erster Reaktor und erste Schmelze | Klicken vs. Bauen, erste Upgrades |
| **15 min – 2 h** | Mangan, Station (Reaktor/Schmelze), Legierung, Mitternachtszone, Tech-Baum, Protokoll, Strömungen, Abyssal | Energie-/Platzbudget, Mangan aufteilen, erste Gabelungen |
| **2–8 h** | Karte & Relikte, Kristalle, Hadal, **erste Gezeitenwende** (~3,5–5 h), Gezeiten-Baum, Tiefenproben, **Schlund** (~6–10 h) | Ausbeuten vs. Bergen, Build-Wahl, Respec, Probe statt Wende? |
| **8–20 h** | Viele kurze Läufe mit wechselnden Builds, Probestufen, Relikt-Sammlung, Capstones, **Herzkammer** (~20 h) | Kristall-/Datenoptimierung, Druckresonator-Platzierung, Proben-Reihenfolge |
| **20–50 h** | **Weltenwende** (~20–30 h), Ursprung, Erbstationen, Kommandozentrale, Tiefenrekord | Was zuerst im Ursprung? Welche Erbstation passt zu welchem Build? |
| **50 h+** | Wiederholbare Ebenen: Ewiges Licht (40 Stufen), Perlenstrom, Tiefenrekord (endlos), Gezeitengedächtnis (40 Stufen), Proben bis Stufe 3, Relikte bis Stufe 3 | Optimierung von Zyklus-Länge, Builds und Erbstationen |

---

## Spielmechaniken im Detail

### Zonen
| Zone | Tiefe | Voraussetzung | Neu |
|---|---|---|---|
| Schelfkante | 0 m | – | Planktonnetze, Leuchtalgen, Aufträge |
| Dämmerzone | 200 m | Lumen | Mangan, Verstärkung, **Station** (Reaktor, Schmelze), Legierung |
| Mitternachtszone | 1.000 m | Lumen, Mangan, Legierung | Daten, **Tech-Baum**, Protokolle, **Strömungen**, Kühlturm/Relais/Labor/Prisma |
| Abyssal | 4.000 m | + Daten | **Karte**, Relikte, **Fertigung** (Kristalle), Dock, Tiefbohrer, +1 Rasterzeile |
| Hadal | 8.000 m | Kristalle u. a. | Tiefenherzen, **Gezeitenwende** |
| Schlund | 11.000 m | 1 Gezeitenwende | Schlundgärten, **Druckresonator** |
| Herzkammer | 15.000 m | 3 Gezeitenwenden | Kernresonanz, **Tiefenrekord**, **Weltenwende** |

### Station
- Raster anfangs 3×3, erweiterbar auf bis zu 6×6: per Tech-Baum (Erweiterter Rumpf), beim Erreichen des Abyssals, im Gezeiten-Baum (Großindustrie) und im Ursprung (Weites Raster).
- **Module:** Reaktor (+Energie), Schmelze, Fertigung, Sonarlabor, Prisma (+Lumen %), U-Boot-Dock, Kühlturm (Nachbarn +35 % bzw. Reaktoren +25 %), Relais (Nachbarn −40 % Energie), Druckresonator (Nachbarn ×1,5).
- **Stufen 1–20:** Leistung pro Stufe = Stufe × 1,25^(Stufe−1), Kosten ×2,3 pro Stufe.
- **Verschieben ist kostenlos**, denn Nachbarschaft soll man ausprobieren können. Beim Abreißen gibt es 50 % der Baukosten zurück.
- Bei zu wenig Energie laufen alle Verbraucher anteilig. Fehlt ein Rohstoff, laufen die Verarbeiter nur so weit, wie Lager und Zufluss reichen. Bestände werden nie negativ.
- „Verarbeitung pausieren“ schaltet alle Schmelzen und Fertigungen mit einem Klick ab, z. B. wenn der nächste Abstieg Mangan oder Daten braucht.

### Tech-Baum (pro Lauf)
24 Knoten in Biologie / Industrie / Navigation. **Gabelungen:**
- *Flachwasserzucht* (frühe Anlagen ×4) vs. *Tiefenzucht* (tiefe Anlagen ×2,5)
- *Kaltschmelze* (kein Lumen, mehr Mangan) vs. *Lichtschmelze* (kein Mangan, dafür 6.000 Lumen pro Legierung; wird mit wachsender Lumen-Produktion immer besser)
- *Kristallzucht* (keine Daten, langsamer) vs. *Datenkompression* (schneller, 2,5× Daten)
- *Breitband-Sonar* (Daten ×2) vs. *Tiefensonar* (U-Boote schneller, Bergungen ergiebiger)

Umrüsten ist jederzeit möglich und kostet den vollen Knotenpreis.

### Gezeitenwende & Gezeiten-Baum
- **Perlen** = ⌊10 · (Lumen des Laufs / 5·10¹³)^0,3 · Tiefenfaktor · Boni⌋. Der Tiefenfaktor gibt +25 % pro Zone jenseits von Hadal.
- Jede in diesem Zyklus verdiente Perle erhöht die Produktion: ×(1 + 0,25 · log₁₀(1 + Perlen)²). Das Wachstum ist bewusst langsam, damit es sich nicht aufschaukelt.
- Das Gezeiten-Fenster zeigt **Perlen pro Stunde**. Sinkt der Wert, lohnt sich die Wende meist. Pflicht ist sie nie.
- Der Baum hat **4 Zweige** mit je einer Gabel und max. 2 Capstones (3 mit Ursprung). Bei jeder Wende lässt er sich kostenlos neu verteilen.
- Capstones: *Großindustrie* (Raster +1, Module ½ Preis), *Sturmflut* (Überladung +3 und beschleunigt Ketten), *Schwarmgeist* (Auto-Forschung/-Abstieg), *Abgrundgänger* (Tiefenbonus, tiefe Zonen ½ Preis).

### Tiefenproben
Starten einen neuen Lauf mit Sonderregel, aber ohne Perlen. Ziele: Abyssal, Hadal, Schlund. Die Belohnungen sind dauerhaft, auch über Weltenwenden hinweg:
- Stille Wasser (kein Puls) → +30 % Produktion/Stufe
- Erzarmut (Mangan ÷10) → Kettenrezepte −15 % Input/Stufe
- Stromausfall (Reaktoren ½) → Reaktoren +25 %/Stufe
- Blindflug (keine Bojen-Daten) → Tech-Baum −12 %/Stufe
- Ohne Auftrieb (kein Tiefenbonus) → +0,05 Tiefenbonus/Stufe
- Einsiedler (keine Karte) → +1 Außenposten/Stufe

Eine Probe lässt sich jederzeit abbrechen. Dann fällt die Regel weg und der Lauf geht normal weiter.

### Weltenwende & Ursprung
- **Urlicht** = ⌊4 · (log₁₀ Perlen des Zyklus − 2)^1,5⌋. Logarithmisch, deshalb bringt jede Weltenwende ähnlich viel und nichts explodiert.
- Zurückgesetzt werden alles aus der Gezeitenwende plus Perlen und Gezeiten-Baum. Urlicht, Ursprung, Relikte, Proben, Tiefenrekord und Logbuch bleiben, ebenso die Freischaltung von Schlund und Herzkammer.
- **Ursprung:** Ewiges Licht, Perlenstrom, Weites Raster, Doppelprotokoll, Drittes Kapitel, Kommandozentrale, Erbstationen, Reliktresonanz.
- **Erbstationen:** *Schmiede* (Start mit Modulen und Legierung), *Forschungsschiff* (Tech-Baum günstiger, Daten ×2), *Jäger* (mehr U-Boote/Außenposten).

### Weiteres
- **Irrlichter:** seltene, faire Ereignisse. Wahrscheinlichkeiten stehen im Ziele-Tab.
- **Überladung:** aktive Fähigkeit (Taste `Q`).
- **Automatik:** Freischaltbar über Gezeiten-Baum und Ursprung, jede Funktion einzeln abschaltbar in den Einstellungen. Gabelungen werden von der Automatik nie umgeworfen.

---

## Balancing

Alle Zahlen stehen in **`js/config.js`**: Kosten, Raten, Rezepte, Module, Baum-Knoten, Strömungen, Sektoren, Relikte, Proben, Prestige-Formeln, Aufträge.

**Leitlinien:**
- Kein Strecken durch Wartezeiten. Gebremst wird durch Ressourcen, die man selbst herstellen und verteilen muss.
- **Lineare Ketten gegen exponentielles Lumen:** Modulstufen skalieren exponentiell, Tiefendruck und Rezeptwechsel sorgen dafür, dass Ketten im Spätspiel nicht absterben.
- **Beide Prestige-Währungen wachsen unterlinear.** Perlen wachsen mit der Wurzel, ihr Produktionsbonus mit log², Urlicht logarithmisch. Ohne das schaukelten sich die Schleifen in den Simulationen auf 1e33 Lumen/s nach 36 h und Weltenwenden alle 20 Minuten auf.
- **Kein Softlock:** Module lassen sich abschalten, abreißen und verschieben. Gabeln lassen sich umrüsten, Proben abbrechen. Die Station warnt vor Ressourcen-Konflikten mit dem nächsten Abstieg, vor zu hohem Lumen-Verbrauch der Schmelzen und vor fehlenden Modulen (z. B. „Abstieg braucht Kristalle – Fertigung bauen, ggf. Platz schaffen“). Diese Warnungen sind direkte Lehren aus den Simulationen: Bei Seeds, in denen der Bot genau diese Fehler machte, stand der Fortschritt stundenlang.

**Simulation** (`node tests/simulate.js <stunden> <active|passive|idle> <flow|pulse|swarm|deep>`): Ein Bot spielt mit der echten Spiellogik inkl. Station, Gabeln, Karte, Strömungen, Wenden, Baum und Weltenwende. Weil Karte und Strömungen ausgewürfelt werden, stehen hier Spannen über mehrere Seeds (aktiv: 9 Seeds, passiv/idle: je 3 Seeds, je 22–40 h simuliert):

| Profil | Mitternacht | Hadal | 1. Wende | Schlund | Herzkammer / 1. Weltenwende |
|---|---|---|---|---|---|
| Aktiv (kauft alle 5 s, klickt) | 0,5 h | 1,3–1,7 h | 2,3–2,7 h | 4,1–6,7 h | 9–20 h |
| Passiv (alle 30 s, wenig Klicks) | – | 1,7–2,3 h | 2,7–3,3 h | ≤ 10–13 h | ~24 h (1 von 3 Seeds), sonst > 40 h |
| Idle (alle 2 min, kein Klicken) | – | 2,1–3,0 h | 3,2–4,0 h | ≤ 11–12 h | > 40 h |

Ein Mensch, der liest, ausprobiert und nicht perfekt optimiert, liegt bei aktivem Spiel grob beim 1,5-Fachen der aktiven Bot-Zeiten. Idle-Spieler profitieren zusätzlich von Offline-Zeit, die in diesen Werten nicht steckt.

Alle Builds und Protokolle erreichen jede Phase, es gibt keine dominante Einzelstrategie. Die Unterschiede liegen in Tempo und Spielgefühl.

---

## Bedienung

- **Navigation:** Produktion · Verbesserungen · Verstärkung · Station · Forschung · Karte · Abstieg · Gezeiten · Ursprung · Ziele. Bereiche erscheinen erst, wenn sie relevant werden. Badges zeigen, wo etwas zu tun ist (`!` Entscheidung, `⚠` Engpass, Zahl = bezahlbar).
- **Linke Spalte:** Lumen-Kern, aktive Boosts, Überladung, **Strömung** mit Vorschau, laufende Probe, Aufträge.
- **Tastatur:** `Leertaste` Puls · `Q` Überladung · `H` Strömung halten · `1`–`0` Bereiche · `Esc` Fenster schließen.
- **Einstellungen:** Animationen, Zahlenformat, Sound, Automatik-Schalter, Export/Import (Text & Datei), Reset (nur mit Bestätigungswort).
- Gesperrte Knöpfe reagieren trotzdem und erklären, was fehlt, inkl. Wartezeit.

---

## Technik

- **Struktur:** reine HTML/CSS/JS-Dateien, keine Abhängigkeiten. Die Logik (`config`, `format`, `state`, `economy`, `unlocks`, `actions`, `core`, `save`) ist DOM-frei und läuft auch in Node. Die UI ist aufgeteilt in `ui.js` (Kern, Navigation, Bausteine inkl. Baum-Renderer) sowie `ui-panels.js`, `ui-station.js`, `ui-research.js`, `ui-map.js` und `ui-tides.js`.
- **Zeit:** Produktion nach real vergangener Zeit. Schritte werden an Boost-, U-Boot- und Strömungsgrenzen geteilt (max. 30 s), die Kette wird pro Schritt durch Lager und Zufluss begrenzt. Ein großer Schritt liefert dasselbe Ergebnis wie viele kleine (per Test geprüft).
- **Offline:** volle Produktion bis zur Offline-Grenze (4 h, erweiterbar), U-Boote und Strömungen laufen weiter. *Tiefschlaf* verdoppelt die Offline-Produktion.
- **Speichern:** Autosave alle 15 s plus bei Tab-Wechsel, Schließen, Abstieg und Resets. Jedes Speichern legt ein Backup an.
- **Speicherformat v2 mit Migration von v1.** Importe werden vollständig validiert: IDs gegen die Config geprüft, Zahlen geklemmt, Gabeln bereinigt, unbekannte Felder verworfen.
- **Große Zahlen:** JavaScript-`Number` mit Deckel bei 1e300. Die Prestige-Formeln sind so gedämpft, dass 40 h aktive Simulation bei rund 1e24–1e26 Lumen/s liegen, weit unter dem Deckel.
- **Performance:** Effekte und Stationsflüsse werden gecacht. HTML mit Knöpfen wird höchstens 1×/s neu gezeichnet (sofort bei Strukturänderungen), damit Klicks nie verloren gehen.

---

## Durchgeführte Tests

Alle Tests liefen in dieser Umgebung (Node 22, Chromium via Playwright 1.56).

**Unit-Tests & Simulationen:** `npm test` → **44/44 bestanden** (`npm run test:quick` ohne Langzeit-Sims: 41)
- Kosten inkl. Zweitressourcen, Käufe, Upgrades, Verstärkung
- Station: Energie, Teil-Energie, Verbrauch/Produktion, Input-Mangel ohne negative Bestände, Kühlturm/Relais/Nachbarschaft (auch diagonal = kein Effekt), gesperrte Felder, Verschieben, Abreißen, Fertigung, Verarbeitung pausieren
- Tech-Gabeln (Rezeptwechsel, Umrüsten)
- Strömungen: Start, Wechsel, Effekt, Halten
- Karte: Erkunden, U-Boot-Limit, Außenposten-Limit und Bonus, Bergen, Relikt-Chancen, Dockplätze
- Gezeitenwende: was zurückgesetzt wird und was bleibt; Baum-Voraussetzungen, Gabeln, Capstone-Limit, Respec-Erstattung, Startboni; Perlenformel; Zonensperre Schlund
- Proben: Start ohne Perlen, Regel aktiv, Abschluss mit Dauerbelohnung, Abbruch
- Weltenwende (logarithmisches Urlicht, Reset-Umfang), Ursprung, Erbstation, Tiefenrekord
- Zeit: großer Schritt = viele kleine (inkl. Kette), Buff-Grenzen, Offline-Deckel, Tiefschlaf, laufende Scans, ungültige Zeiten, sehr große Werte
- Speichern: Roundtrip aller neuen Systeme, 8 kaputte Importe, Reparatur ungültiger Felder, **Migration v1 → v2**
- Langzeit-Bot: Meilensteine aktiv (14 h); passiv und idle ohne Sackgasse bis zur Wende; alle drei Protokolle erreichen Hadal

**End-to-End im Browser:** `node tests/e2e.js [screenshot-ordner]` → **70/70 bestanden** (3× hintereinander stabil)
- Start, Puls, Kauf, Produktion, blockierter Kauf mit Hinweis
- Speichern/Reload ohne doppelte Elemente, Offline-Bericht
- Station per UI: bauen, verschieben, ein-/ausschalten, Produktion läuft, Verarbeitung pausieren, gesperrtes Feld erklärt
- Alle 10 Bereiche in später Phase ohne JS-Fehler
- Protokoll, Tech-Knoten, Gabel umrüsten (mit Rückfrage), Strömung halten per Taste
- Karte: U-Boot entsenden, Rückkehr, Außenposten, Wrack bergen → Relikt
- Abstieg, Gezeitenwende mit Doppelklick-Schutz und Respec, Relikte bleiben
- Gezeiten-Baum per Klick, gesperrter Knoten erklärt sich, Probe starten → Puls gesperrt → Probe abbrechen
- Tiefenrekord, Weltenwende, Ursprung kaufen
- Export, kaputter Import, **Import eines v1-Spielstands mit Migration**, Re-Import
- Tastatur (Leertaste, Ziffern, Enter), Irrlicht, Einstellungen, Reset mit Bestätigungswort
- Kein horizontaler Überlauf bei 390 / 768 / 1920 px

**Nicht getestet:** echtes Spielen durch Menschen über viele Stunden (die Zeitangaben sind Bot-Simulationen), andere Browser als Chromium, echte Touch-Geräte, Screenreader.

---

## Bekannte Einschränkungen

- Die Zeithorizonte stammen aus Simulationen. Menschen spielen anders als der Bot, etwa 1,5× langsamer bei aktivem Spiel. Passive Spieler kommen deutlich langsamer voran, aber ohne Sackgasse.
- Der Bot nutzt Nachbarschaftsboni kaum. Wer die Station geschickt plant, ist schneller als in der Tabelle.
- Ab etwa 60–100 Stunden besteht der Fortschritt aus wiederholbaren Systemen (Ursprung, Tiefenrekord, Baumstufen). Neue Mechaniken kommen dann nicht mehr dazu.
- Speicherstände liegen im Browser. Wer Browserdaten löscht, verliert sie, deshalb gelegentlich exportieren.
- Sound ist bewusst schlicht (synthetisch, keine Musik).
