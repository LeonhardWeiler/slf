# TODO-Punkte abarbeiten & einzeln committen

**Zweck:** Arbeite die Punkte aus `prompts/TODO.md` der Reihe nach ab und setze
jeden im Code um. Nach **jedem** Punkt folgt ein eigener Commit.

**Kontext:** Die Punkte in `TODO.md` sind häufig meine Reaktionen/Entscheidungen zu
den Findings im Health-Report `prompts/project-health-report.html` (z. B. „ux-2 fix",
„cq-1 fix"). Eine ID wie `UX-2` verweist auf die gleichnamige Finding-Karte im
Report — lies dort die Beschreibung + Empfehlung, wenn ein Punkt darauf Bezug nimmt.

---

## Bevor du startest

1. Lies `prompts/TODO.md` vollständig und ordne jedem Punkt zu, was konkret zu tun
   ist (ziehe bei Bedarf die passende Finding-Karte im Health-Report heran).
2. **Erstelle zuerst einen kurzen Plan** (ein Commit pro Punkt) und nenne ihn.
3. **Stelle Rückfragen**, wenn ein Punkt mehrdeutig ist oder eine echte
   Design-Entscheidung nötig ist — bevor du anfängst, nicht mittendrin.

## Pro Punkt (in Reihenfolge)

1. **Umsetzen** — nimm die nötigen Code-Änderungen vor. Bleib beim Scope des Punkts;
   fasse keine unabhängigen Änderungen mit an.
2. **Verifizieren** — vor dem Commit lokal grün machen:
   - Frontend: `tsc` (Typecheck), Biome-Lint, ggf. Vitest, Vite-Build.
   - Backend: `go build`, `go vet`, `go test ./...` (bei Nebenläufigkeit `-race`).
   - Wenn ein Verhalten neu/geändert ist, ergänze oder aktualisiere einen Test.
3. **Committen** — ein eigener, fokussierter Commit **nur** mit den Dateien dieses
   Punkts und einer aussagekräftigen Commit-Message (kurzer Präfix, der den Punkt
   benennt, z. B. `ux-2 fix: …`).

## README pflegen

Wenn ein Punkt dokumentiertes Verhalten in der `README.md` ändert (Features,
Sicherheits-/Header-Details, Protokoll, bewusste Entscheidungen), aktualisiere die
README und committe diese Änderung **separat danach**.

## Health-Report pflegen

Wenn ein umgesetzter Punkt ein Finding in
`prompts/project-health-report.html` behebt oder dessen Bewertung ändert,
aktualisiere den Report entsprechend: gelöste Findings **entfernen** (nicht
abhaken), Zähler/Inhaltsverzeichnis konsistent halten. Neu entdeckte Probleme, die
du nicht umsetzt, dürfen als Finding im Report ergänzt werden.

## Grundregeln

- **Ein Commit pro TODO-Punkt.** Vermische keine Punkte in einem Commit.
- Fasse Dateien, die nicht zum aktuellen Punkt gehören, nicht an (insb. andere
  Arbeitsdateien im `prompts/`-Ordner nicht ungefragt committen).
- Melde am Ende knapp, was pro Punkt geändert und in welchem Commit es gelandet ist.
