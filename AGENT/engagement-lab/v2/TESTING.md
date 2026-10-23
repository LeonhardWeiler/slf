# Prüfungen Versuch 02

Stand 23.10.2026, headless Chromium 155 über Playwright, Viewport 1534×875.

Geprüft:

- Laden ohne Konsolen- oder Seitenfehler.
- Klassisch: 3 Runden mit Eingabe, Auswertung, Ergebnis (240 Punkte bei 12 gültigen Wörtern).
- Duell: 3 Runden, Bot-Fortschritt und Bot-Antworten in der Auswertung sichtbar.
- Sprint: Wortkette, Buchstabenwechsel nach 4 Wörtern, Restzeit läuft.

Nicht geprüft:

- Ton und Musik (headless ohne Audioausgabe).
- Smartphone-Viewports und Touch-Tastatur.
- Blindvergleich der 3 Materialien bis zum Export.
- Wirkung auf echte Menschen.

Starten aus dem Repository:

```bash
python3 -m http.server 8890 --bind 0.0.0.0 --directory AGENT
```

Dann <http://localhost:8890/engagement-lab/v2/>.
