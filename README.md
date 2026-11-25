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
