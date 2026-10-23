# Versuch 04: Duolingo-Look, Maskottchen, Funktionen des echten Spiels

## Was v3 gezeigt hat

- Block war der beste Look, aber nicht einzigartig. Papier war schwer lesbar, Pop fiel weg.
- Der Ton war zu leise, die Hi-Hats zu langsam, es fehlte eine Kick.
- Enter auf dem letzten Feld soll sofort STOPP auslösen.
- Die Farben sollen öfter wechseln, aber nicht bei jedem Wort.
- Die Funktionen des echten Spiels fehlten.

## Was v4 anders macht

1. **Ein Look, rund und verspielt:** weiße Karten mit dicker Unterkante, Pastell-Hintergrund mit schwebenden Blasen. Kippen oder Maus bewegt Blasen, Glanz und Lichtfleck (Parallaxe).
2. **Maskottchen:** Der Buchstabe ist ein gelber Spielstein mit Gesicht. Er schaut dir beim Tippen zu, freut sich beim Sperren, jubelt bei 4/4, schwitzt bei wenig Zeit und ist traurig bei Fehlern. Beim Buchstaben-Slot dreht er sich in der Mitte und fliegt dann in die Leiste.
3. **Tiles als Spielsteine:** mit 3D-Kante und Schatten. Sie fallen mit Squash herein und hüpfen beim Sperren als Welle.
4. **Farben:** neue Palette bei jedem Phasenwechsel und bei 4/4. Dazwischen driftet der Farbton langsam mit der Zeit und etwas zufällig.
5. **Hover und Druck:** Beim Hover wird alles etwas heller und größer, beim Drücken kleiner, beim Loslassen federt es zurück.
6. **Ton:** Limiter und deutlich mehr Pegel, 16tel-Hi-Hats, Kick mit Sub, Clap, eigene Hook-Melodie. Musik und Effekte sind getrennt regelbar (Zahnrad).
7. **Enter auf das letzte offene Feld = sofort STOPP.** Blur löst das nicht aus.
8. **Vibration:** Android über `navigator.vibrate`. iOS 18+ über den versteckten Switch-Trick, das gibt nur einen leichten Tick und klappt nur bei einer Berührung.
9. **Funktionen des echten Spiels:**
   - Lobby mit Code als Tiles, QR (Attrappe) und Link kopieren.
   - Host-Einstellungen: Kategorien umbenennen, löschen und hinzufügen (1–6), Zeit 60/90/120/∞, 3 oder 5 Runden, Buchstaben, Flammen.
   - Spieler entfernen (×) und Bots einladen (+). Ohne Bots läuft der **Solo**-Modus: STOPP geht immer, Bewertung auf einem Bildschirm, keine Flammen.
   - **Flammen-Wette:** Pro Runde darf eine Antwort eine Flamme bekommen. Ist sie eindeutig, gibt es +5, sonst 0.
   - **Zusammenführen:** Ähnliche Antworten (Köln/Koln) bekommen einen Link-Knopf. Zusammengeführt zählen sie als gleich (5 statt 10).
   - **Später Beitritt:** Ben kommt mitten in Runde 1 als Zuschauer (Auge) dazu und spielt ab Runde 2 mit.
   - Nur skizziert: **Kommentator** (Mikrofon, du siehst live das Board der anderen und beendest die Runde), **Letzter Buchstabe** (…A, das Wort muss mit dem Buchstaben enden) und **Host-Verbindung weg** (Zahnrad → WLAN-Knopf, 15-s-Ring, der Host kommt zurück).
10. **Bewertung umschaltbar** (Krone oben links, in der Lobby):
    - **Host:** Karten antippen, um sie gelten zu lassen oder nicht, Link-Knopf zum Zusammenführen, ✓/✗ bei zweifelhaften Antworten.
    - **Spieler:** Daumen hoch oder runter, Mia entscheidet.
    - Pro Kategorie dauert die Bewertung etwa 1,5 s, wenn es nichts zu entscheiden gibt, sonst etwa 5 s. Der Pfeil springt sofort weiter.
11. **Sprint** wie in v3, im neuen Look.
12. **Kein Bewertungsbogen mehr.** Feedback bitte über den Chat.

## Was du testen solltest

- Je eine Partie als Host und als Spieler, am besten am Handy mit Ton.
- Einmal alle Bots entfernen (Solo) und einmal Sprint.
- Flamme, Zusammenführen, Kommentator und „Letzter Buchstabe“ ausprobieren.
