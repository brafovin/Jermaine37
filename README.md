# JERMAINE37 – Battle Royale (3D-Shooter im Browser)

3D-Shooter mit Three.js: Lobby, Matchmaking, Ranked-System und ein 100-Spieler-Battle-Royale auf einer großen Insel.

## Starten

```bash
npm install
npm run dev        # Entwicklung, http://localhost:5173
npm run build      # Produktions-Build nach dist/
```

## Inhalt

- **Lobby** (angelehnt an die Screenshots): Account oben links (Name, Level, Rang), Battle-Pass-Banner daneben, links die Menüs **Shop / Battle Pass / Waffen / Rang**, unten rechts **SPIEL STARTEN** mit Moduswahl (Battle Royale oder Ranked). Im Hintergrund steht dein 3D-Soldat mit der gewählten Waffe und dem ausgerüsteten Skin.
- **Matchmaking**: füllt eine 100er-Lobby nach Skill (Rang). Ranked beginnt mit engem Skill-Bereich, der mit der Wartezeit wächst. Die Gegner-Stärke (Bot-Skill) richtet sich nach den gefundenen Rängen.
- **Ranked-System**: Unranked → Bronze → Silber → Gold → Platin → Diamant → Elite → Master → Mythik → Champion (je Rang 3 Stufen, außer Champion). 3 Platzierungsmatches. RP nach Platzierung und Kills.
- **Battle Royale**: 100 Spieler (du + 99 Bots), Absprung mit Fallschirm, 2 × 2 km Insel, **bei jedem Match zufällig neu**: 10 Viertel als Mix aus New York (Hochhäuser aus Glas/Stein/Backstein, Straßenraster, Taxis, Hydranten, Ampeln, Wolkenkratzer mit Spitze) und London (Backstein-Reihenhäuser mit Giebeldächern und Schornsteinen, Uhrturm, Telefonzellen, Doppeldecker-Busse), dazu Parks, Straßen, Wald und Wasser, schrumpfende Zone (6 Phasen), Minimap und Vollbildkarte (M).
- **Kisten**: Waffen, Munition, Bargeld, Rüstung und Medkits (normal / selten / legendär). Besiegte Gegner hinterlassen eine Beutekiste. Bargeld wird nach dem Match zu Münzen.
- **20 Waffen**: Pistole, Revolver, 3 MPs, 4 Sturmgewehre, 2 DMRs, 2 LMGs, 3 Schrotflinten, 3 Scharfschützengewehre, Raketenwerfer. Jede mit eigenen Werten (Schaden, Feuerrate, Magazin, Streuung, Rückstoß, Zoom, Seltenheit).
- **Shop & Battle Pass**: 8 Waffen-Skins, 30 Stufen mit kostenloser und Premium-Spur, XP aus Matches.
- **Grafik**: PBR-Materialien, Wüsten-Stadtkulisse (Sandstein-Häuser mit Bogenfenstern, Mauern, Autowracks, Fässer, Reifen, Sandsäcke, Strommasten), Himmel mit Umgebungslicht, Sonnenschatten, Nebel, ACES-Tonemapping. Unter Einstellungen gibt es Niedrig / Mittel / Hoch / Ultra (Supersampling für hohe Auflösung).

## Steuerung

| Taste | Aktion |
|---|---|
| WASD | Bewegen |
| Shift | Sprinten |
| Leertaste | Springen / im Fall Fallschirm öffnen |
| Strg oder C | Ducken |
| Linke Maustaste | Schießen |
| Rechte Maustaste | Zielen |
| R | Nachladen |
| 1–3 oder Mausrad | Waffe wechseln |
| F halten | Kiste öffnen |
| H | Medkit |
| E | Fahrzeug einsteigen / aussteigen |
| M | Karte |
| Esc | Pause |

## Hinweise

- Die Modi **Battle Royale** und **Ranked** sind Einzelspieler gegen Bots (100er-Lobby und Matchmaking simuliert). Der Modus **ONLINE** spielt mit echten Spielern, siehe unten.
- Fortschritt (Münzen, Rang, Skins, Battle Pass) liegt im `localStorage` des Browsers.
- Entwickler-Parameter in der URL: `?fast` (kurzes Matchmaking), `?nolock` (ohne Maus-Fangen), `?speed=4` (Spielzeit schneller).
- Aktuell nur für Desktop mit Maus und Tastatur, nicht für Touch.

## Fahrzeuge

Taxis, Limousinen, SUVs, Transporter und Busse stehen auf den Straßen. Mit **E** einsteigen, **W/S** Gas/Bremse, **A/D** lenken, **Leertaste** Handbremse. Fahrzeuge können Gegner überfahren, bei Unfällen oder Beschuss Schaden nehmen und explodieren.

## Online-Modus (echte Spieler)

1. Server starten (baut das Spiel und liefert es mit aus):

```bash
npm run online
```

2. Alle Spieler öffnen `http://<Server-IP>:8080` (am besten im selben Browser-Typ, damit die zufällige Karte identisch erzeugt wird), wählen **ONLINE** und **SPIEL STARTEN**.
3. Der Server sammelt Spieler in einer Warteschlange (Standard: ab 2 Spielern startet das Match nach 20 s, bei 16 sofort), schickt allen denselben Karten-Seed und startet, sobald alle geladen haben.

Einstellbar per Umgebungsvariablen: `PORT`, `MIN_PLAYERS`, `MAX_PLAYERS`, `WAIT_SEC`, z. B. `MIN_PLAYERS=1 npm run online` zum Testen allein. Läuft das Spiel über den Vite-Entwicklungsserver (Port 5173), startet man den Server separat mit `npm run server`. Eine abweichende Server-Adresse trägt man unter Einstellungen ein.

Im Online-Modus gibt es keine Bots und keine Fahrzeuge. Zone, Kisten und Karte sind für alle gleich, Spieler sehen und treffen sich gegenseitig, Kisten werden geteilt, Gefallene lassen eine Beutekiste zurück. Treffer werden vom Schützen berechnet (kein Anti-Cheat), das passt für Freunde und LAN, nicht für ein öffentliches Spiel.

## Charaktermodell

Bots, Online-Spieler und der Soldat in der Lobby nutzen das geriggte Modell `public/models/Soldier.glb` (aus den three.js-Beispielen, ursprünglich von Mixamo) mit Idle-/Geh-/Lauf-Animationen. Lädt es nicht, greift die prozedurale Menschenfigur als Rückfall. Prüfe vor einer Veröffentlichung die Lizenz der Datei (Mixamo/three.js-Beispielassets) oder ersetze sie durch ein eigenes Modell mit Knochen `mixamorig*` und Animationen `Idle`, `Walk`, `Run`.

## Echte Assets (Poly Haven, CC0)

Unter `public/assets/` liegen frei nutzbare CC0-Assets von [Poly Haven](https://polyhaven.com) (1k-Auflösung, ca. 45 MB): Texturen (Gras, Asphalt, Backstein, Sandstein, Kistenholz) und Modelle (Pistole, Repetiergewehr, Hydrant, Straßenlaterne, Mülleimer, Betonbarriere, Payphone, Reifen). Sie werden für Gelände, Straßen, Hausfassaden, Straßenmöbel, Beutekisten sowie die Pistolen (Sidekick, Magnum) und Scharfschützengewehre (Longshot, Phantom, Reaper) genutzt. Fehlen sie, greift das Spiel auf selbst erzeugte Texturen und Modelle zurück. Die übrigen Waffen sind weiterhin selbst gebaut, weil es dafür keine passenden freien Modelle gab.

## Stabilität & Effekte

- Die Karte wird in Etappen mit Fortschrittsanzeige aufgebaut, damit der Browser beim Laden nicht einfriert.
- Dynamische Auflösung: ruckelt es, senkt das Spiel die Render-Auflösung automatisch und erhöht sie bei Reserve wieder. Fehler im Spiel-Loop werden abgefangen, das Spiel läuft weiter.
- Schüsse: geschichteter Knall mit Hall, dumpferem Klang und Schallverzögerung bei Entfernung, Hülsen, Mündungsrauch und Einschusslöcher auf Wänden und Boden.
- Treffer: Blutspritzer, Blutflecken auf Boden und Wänden, Blutlachen bei Kills und Blut auf dem Bildschirm, wenn man selbst getroffen wird.

## Bomben-Modus (6 gegen 6, online)

Wähle in der Lobby **BOMBE 6v6** (Server nötig, siehe Online-Modus). Der Server bildet zwei Teams (bis zu 6 gegen 6, Start ab 2 Spielern nach 20 s) und steuert die Runden:

- **Ablauf:** 8 s Vorbereitung (Waffe wählen mit **1–4**: Sturmgewehr, MP, Schrotflinte, Scharfschütze, dazu Pistole und Rüstung), danach 2 Minuten Rundenzeit. Wer zuerst 4 Runden gewinnt, gewinnt das Match. Nach 3 Runden wechseln die Seiten.
- **Angreifer:** gehen zu Platz **A** oder **B** und halten **F** (4 s), um die Bombe zu legen. Danach explodiert sie nach 40 s.
- **Verteidiger:** verhindern das Legen oder halten **F** (6 s) an der Bombe, um sie zu entschärfen.
- **Rundenende:** alle Gegner ausgeschaltet, Bombe explodiert/entschärft oder Zeit abgelaufen (dann gewinnen die Verteidiger).
- Gestorbene schauen bis zur nächsten Runde zu (Klick wechselt den Spieler). Kein Friendly Fire. Gespielt wird in der größten Stadt der (zufälligen) Karte, ohne Kisten, Fahrzeuge und Zone. Der Server kann mit `BOMB_MIN=1 npm run online` zum Testen allein gestartet werden.

## Flaggen-Modus (6 gegen 6, online)

Wähle in der Lobby **FLAGGEN 6v6**. Drei Flaggen (A, B, C) liegen in der größten Stadt der zufälligen Karte. Stehe im Ring, um sie einzunehmen (mehrere Spieler sind schneller, stehen beide Teams im Ring, ist die Flagge umkämpft). Jede gehaltene Flagge bringt deinem Team jede Sekunde 1 Punkt. Wer zuerst **150 Punkte** hat oder nach **10 Minuten** vorne liegt, gewinnt. Gefallene Spieler respawnen nach 5 Sekunden (2,5 s Spawnschutz) und können ihre Waffe (Taste 1–4) vorher wählen. Testen allein: `FLAG_MIN=1 npm run online`.

## Anpassung, Battle Pass & Token

- **Shop** mit drei Kategorien: **Waffenlackierungen** (Muster wie Digital-Camo, Tiger, Karbon, Marmor, Hex-Tech, Inferno), **Skin-Farben** (färben die Lackierung um) und **Charakter-Skins** (Tönung des Soldaten). Der **Battle Pass** (30 Stufen, kostenlos und Premium) enthält Münzen, Lackierungen, Farben und Charakter-Skins.
- **Token-Truhe:** In jeder 100. Runde (Battle Royale und Ranked gegen Bots) liegt eine violette Truhe mit einem Token auf der Karte, markiert mit einem Stern auf Minimap und Karte. Sie schaltet den Battle Pass (Premium) gratis frei, wer Premium schon hat, bekommt 1500 Münzen. Zum Testen: `?token` an die URL hängen.
- **Steuerung ändern:** unter Einstellungen (Lobby) oder im Pause-Menü (Esc → „Steuerung ändern"): Taste anklicken, neue Taste drücken. Dazu „Zielen umschalten" und „Maustasten tauschen".

## Bestenliste (Top 100) & weitere 3D-Charaktere

- **TOP 100** (Lobby, links): Tabelle der besten Ranked-Spieler mit Platz, Name, Rang, RP, Siegen und Matches; deine Zeile ist markiert. Mit laufendem Server (`npm run online`) sind es echte Spieler: Jedes Ranked-Match meldet deine RP an den Server (`server/leaderboard.json`). Fehlen echte Spieler, füllen simulierte Spieler (BOT) die Liste auf; ohne Server erscheint eine Offline-Liste mit simulierten Spielern und deinem Eintrag. Ein Eintrag erscheint nach den 3 Platzierungsmatches. Die Daten sind nicht gegen Manipulation geschützt.
- **Charaktere:** Neben dem Soldaten gibt es den **X-Bot** (Chrom-Android) und den **Roboter** als eigene 3D-Modelle mit Animationen, jeweils mit Farbvarianten. Sie sind im Battle Pass (Roboter, X-Bot, X-Bot Rubin, Roboter Blau, X-Bot Gold) und im Shop. Online sehen die anderen Spieler deinen gewählten Charakter. Einige Bots laufen als X-Bot. Modelle stammen aus den three.js-Beispielen (Mixamo/CC0), prüfe vor einer Veröffentlichung die Lizenzen.

## Level-System & freischaltbare Waffen

- **Level 1–50:** XP gibt es nach jedem Match (Platzierung, Kills, Überlebenszeit). Jedes Level bringt Münzen (alle 5 Level einen Bonus). Die Übersicht findest du in der Lobby unter **LEVEL**; am Matchende zeigt der Ergebnisbildschirm Level-Ups mit Münzen und neu freigeschalteten Waffen.
- **Waffen freischalten:** Sidekick, Viper, Falcon AR und Breacher sind von Anfang an da, die übrigen 16 Waffen schalten sich nach Level frei (z. B. Hornet Level 2, Marksman Level 8, Titan Level 18, Longshot Level 22, Reaper Level 28, Boomstick Level 30). Die **Waffenkammer** zeigt gesperrte Waffen mit Schloss und Level.
- **Im Spiel:** Offline (Battle Royale, Ranked) enthalten Kisten nur Waffen, die du schon freigeschaltet hast. Im Online-Battle-Royale ist der Kisteninhalt für alle gleich, gesperrte Waffen werden beim Aufheben zu Munition. In Bombe und Flaggen wählt das Loadout (1–4) automatisch die stärkste freigeschaltete Waffe der Klasse. Die Freischaltung wird nur auf deinem Rechner geprüft.
