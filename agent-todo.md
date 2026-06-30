# Agent-TODO — Vorgeschlagene kleine Verbesserungen

> **STATUS: alle 12 Punkte umgesetzt & per Playwright verifiziert** (Lobby-Politur,
> Game-Politur inkl. Autofokus/Animationen/aria-live, Verbindungs-Anzeige,
> Review-Legende, Endstand-Hervorhebung, Safe-Area-Padding). Dabei behoben:
> fehlende `@radix-ui/react-switch`-Dependency in package.json.
>
> Diese Liste war als Vorschlag zur Durchsicht gedacht — kleine Politur-
> Verbesserungen, keine großen Umbauten.

Aufwand: **XS** = wenige Zeilen · **S** = ein kleiner, abgegrenzter Block.

## Spielfluss / Bedienung

1. **Erstes Antwortfeld automatisch fokussieren (XS)** — Wenn die Playing-Phase
   startet, direkt ins erste Kategorie-Feld fokussieren, damit man sofort tippen
   kann (besonders auf Desktop). *Datei:* `pages/game/GameScreen.tsx`.

2. **Verbindungs-Anzeige auch im Spiel (S)** — Aktuell sieht man „Keine
   Verbindung" nur auf dem Home-Screen. Fällt die WS-Verbindung mitten im Spiel
   aus, gibt es kein Signal. Ein kleines Banner / ein Punkt im `RoomHeader` via
   `ws.onStatusChange`. *Dateien:* `components/RoomHeader.tsx`, ggf. globaler Hook.

3. **Tastatur-Hinweise im Review (XS)** — Kleine Legende für den Host, z. B.
   „← → Kategorie · Enter = abschließen", damit die Pfeil-/Enter-Steuerung
   sichtbar/auffindbar ist. *Datei:* `pages/game/ReviewScreen.tsx`.

4. **„Enter"-Hinweis nur wenn aktiv (XS)** — Der Buzz-Button zeigt aktuell immer
   „STOPP — Fertig! (Enter)". Den `(Enter)`-Teil nur einblenden, wenn wirklich
   gebuzzert werden kann. *Datei:* `pages/game/GameScreen.tsx`.

## Lobby

5. **Lobbycode gruppiert anzeigen (XS)** — Die große Code-Anzeige als
   „123 456" lesbarer machen (kopiert/joint weiterhin die reinen 6 Ziffern).
   *Datei:* `pages/Lobby.tsx`.

6. **Buchstaben-Auswahl: „Alle / Keine" + Zähler (S)** — Schnellaktionen zum
   Zurücksetzen/Leeren und ein „X von 26 aktiv"-Hinweis. *Datei:* `pages/Lobby.tsx`.

7. **Dynamischer Lobby-Untertitel (XS)** — Statt statisch „Wartet auf Spieler…"
   etwas Zustandsbezogenes, z. B. „Warte auf Mitspieler…" bei 1 Person bzw.
   „N Spieler bereit". *Datei:* `pages/Lobby.tsx`.

8. **Kopier-Feedback per Icon (XS)** — Beim Kopieren von Code/Link kurz ein
   Häkchen-Icon statt nur Textwechsel zeigen. *Datei:* `pages/Lobby.tsx`.

## Politur / Zugänglichkeit

9. **Countdown-/Übergangs-Animation (S)** — Die Countdown-Zahl pro Tick sanft
   skalieren/einblenden und einen dezenten Fade zwischen den Phasen. Bewusst
   subtil, ohne Layout-Ruckeln. *Dateien:* `pages/game/GameScreen.tsx`, evtl.
   kleine CSS-Utility.

10. **`aria-live` für die letzten 5 Sekunden (XS)** — Screenreader-Ansage „Noch
    5 Sekunden", passend zum roten Rand. *Datei:* `pages/game/GameScreen.tsx`.

11. **Safe-Area-Padding für Notch-Handys (XS)** — `env(safe-area-inset-*)` am
    äußeren Container, damit Header/Buttons auf Geräten mit Notch nicht ans
    Display-Eck stoßen. *Dateien:* Screen-Container bzw. `index.css`.

12. **Rundenergebnis: Top-Platz hervorheben (XS)** — Im Zwischenstand den
    aktuell Führenden dezent betonen (analog zur Trophäe im Endstand).
    *Datei:* `pages/game/RoundResultScreen.tsx`.

---

### Bewusst NICHT vorgeschlagen
- Mehrspaltige Antwortfelder (du wolltest sie einspaltig — bleibt so).
- „System"-Theme (entfernt — bleibt entfernt).
- Konfetti o. Ä. auf dem Endstand (würde eine neue Dependency bringen; nur auf
  Wunsch).
