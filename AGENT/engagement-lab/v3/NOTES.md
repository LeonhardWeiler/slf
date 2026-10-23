# Versuch 03: die ganze Partie in 3 Looks

Grundlage: `slf-spieltest-v2-2026-10-23.json` und dein Kommentar dazu.

## Was v2 gezeigt hat

- Musik ist das Wichtigste, Animationen bringen das Dopamin.
- „Licht“ hat sich beim Schreiben am besten angefühlt, „Impuls“ am schlechtesten. Die 3 Materialien waren zu ähnlich.
- Das Design war zu sci-fi bzw. Neo-Wave (vor allem der Kreis).
- Getestet wurde fast nur das Schreiben, v1 hatte mehr Breite.
- Der Sprint war sehr gut → `AGENT/TODO.md`.

## Was v3 anders macht

1. **Eine ganze Partie, 3 Runden, mit Mia, Jonas und Lea** (Bots).
   - Lobby: Logo-Tiles zum Antippen, die Freunde ploppen rein, Klassisch oder Sprint.
   - Buchstabe: Slot-Maschine mit abbremsenden Ticks, Landung mit Schlag und Partikeln.
   - Schreiben: Jeder Buchstabe wird ein farbiges Tile, Löschen zerplatzt. Eine Zündschnur statt Kreis, die Pips der Freunde füllen sich live. Enter sperrt das Wort (Welle, Glanz, Akkord). 4/4 wechselt die Palette und macht STOPP scharf. Ruft ein Freund STOPP, knallt es und du hast 5 s.
   - Bewertung als Show: Pro Kategorie werden die Karten ausgeteilt und umgedreht, deine zuletzt. Zweifelhafte Antworten (Mallorca als Land, Wolpertinger als Tier …) bekommen Daumen von den anderen und du entscheidest mit ✓/✗. Gleiche Wörter klacken zusammen, Punkte werden gestempelt und fliegen zu den Avataren.
   - Rangliste: Punkte zählen hoch, Überholen wird animiert, Krone für Platz 1, Flamme für eine Serie (alle 4 gültig), die Freunde melden sich bereit.
   - Podium mit Konfetti, Fanfare und deinem besten Wort.
2. **Sprint mit Combo:** 45 s, ein Wort nach dem anderen. Kommt das nächste Wort innerhalb von 6 s, steigt die Combo (×2 bis ×5, Punkte ×10). Nach 4 Wörtern Clear und neuer Buchstabe, die letzten 10 s werden rot und schneller. Am Ende: Wörter antippen zum Streichen, dann der Score mit Rekord.
3. **3 Looks zum Umschalten** (oben rechts, wird gespeichert): Block, Papier, Pop. Jeder Look hat eine eigene Schrift, Tile-Form, Partikelform und Klangfarbe.
4. **Kein Text, wo ein Icon reicht.** Kategorien als Icon und Wort, Runden als Balken, Punkte als Stempel.

## Was du testen solltest

- Spiel je eine ganze Partie in jedem Look, am besten einmal am Handy.
- Danach über den Balken-Knopf oben rechts bewerten (der pulsiert nach dem Ende). Skalen: Spaß, Nochmal, Schreiben, Bewertung, Rangliste & Ende, Musik, Aussehen.
- Einmal Sprint, gern mehrmals hintereinander (Rekord).
- Am Ende „JSON exportieren“ und mir die Datei schicken.
