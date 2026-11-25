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
- **Battle Royale**: 100 Spieler (du + 99 Bots), Absprung mit Fallschirm, 2 × 2 km Insel mit 13 Städten, Hütten, Straßen, Wald, Felsen und Wasser, schrumpfende Zone (6 Phasen), Minimap und Vollbildkarte (M).
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
| M | Karte |
| Esc | Pause |

## Hinweise

- Das Spiel ist ein **Einzelspieler-Spiel gegen Bots**. Die 100er-Lobby und das Matchmaking sind simuliert, es gibt keinen Online-Server. Echtes Multiplayer bräuchte ein eigenes Backend.
- Fortschritt (Münzen, Rang, Skins, Battle Pass) liegt im `localStorage` des Browsers.
- Entwickler-Parameter in der URL: `?fast` (kurzes Matchmaking), `?nolock` (ohne Maus-Fangen), `?speed=4` (Spielzeit schneller).
- Aktuell nur für Desktop mit Maus und Tastatur, nicht für Touch.
