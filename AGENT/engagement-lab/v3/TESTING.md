# Prüfungen Versuch 03

Stand 23.10.2026, headless Chromium 155 über Playwright.

Geprüft (je Lauf: Lobby → 3 Runden Klassisch inkl. Abstimmung → Podium → Sprint mit Buchstabenwechsel → Sprint-Bewertung → Ergebnis → Bewertungsdialog):

- Block, Papier, Pop bei 390×844 (Touch), Block bei 1534×875.
- Keine Konsolen- oder Seitenfehler, Events landen in `localStorage`.
- Eigener STOPP, Bot-STOPP mit 5 s Restzeit, Ablehnung durch ✗, Rangliste sortiert um.
- Screenshots aller Phasen angesehen: Kontrast, Rangliste, STOPP-Knopf und Paletten korrigiert.

Nicht geprüft:

- Ton und Musik (headless ohne Audioausgabe).
- Echte Handys und Bildschirmtastaturen (nur emulierter Viewport).
- Reduzierte Bewegung nur im Code, nicht visuell.
- Wirkung auf echte Menschen.

Start aus dem Repository:

```bash
python3 -m http.server 8890 --bind 0.0.0.0 --directory AGENT
```

Dann <http://localhost:8890/engagement-lab/v3/>, Look direkt mit `?look=paper` oder `?look=pop`.
