# Prüfungen Versuch 04

Stand 23.10.2026, headless Chromium 155 über Playwright.

Geprüft:

- Host bei 390×844 (Touch) und 1280×800: Lobby, QR, 3 Runden mit Sofort-STOPP per Enter, Flamme, Bot-STOPP, Podium, dann alle Bots entfernt und 3 Runden Solo.
- Bewertung mit zweifelhafter Antwort (✗) und Zusammenführen (Köln/Koln).
- Spieler-Sicht: Bereit, Mia startet, Abstimmen.
- Kommentator mit „Letzter Buchstabe“, Sprint mit Buchstabenwechsel und Bewertung, Einstellungen, Host-Disconnect-Overlay.
- Keine Konsolen- oder Seitenfehler. Alle Screenshots angesehen.

Nicht geprüft:

- Ton und Musik (headless ohne Audioausgabe).
- Vibration, Kippen (Parallaxe) und Bildschirmtastatur auf echten Handys.
- Reduzierte Bewegung nur im Code.
- Wirkung auf echte Menschen.

Start aus dem Repository:

```bash
python3 -m http.server 8890 --bind 0.0.0.0 --directory AGENT
```

Dann <http://localhost:8890/engagement-lab/v4/>.
