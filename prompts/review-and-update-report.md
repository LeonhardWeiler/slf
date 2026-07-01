# Projekt-Review durchführen & Health-Report aktualisieren

**Zweck:** Führe einen vollständigen, frischen Review des gesamten Projekts durch
und bringe den Health-Report `prompts/project-health-report.html` auf den
aktuellen Stand. Es werden **keine** Code-Änderungen vorgenommen — nur der Report
wird angepasst und committet.

**Ergebnis:** Ein einziger Commit, der ausschließlich
`prompts/project-health-report.html` ändert.

---

## Schritt 1 — Projekt vollständig analysieren

- Scanne das **gesamte** Projekt neu (Frontend + Backend + Config/CI/Docs).
- Bewerte den **aktuellen Codestand**, nicht frühere Report-Versionen. Verifiziere
  jedes bestehende Finding gegen den echten Code, bevor du es behältst.
- Achte insbesondere auf:
  - Bugs & Korrektheit
  - Security (Auth, Input-Validierung, Header, Rate-Limits, Leaks)
  - Performance
  - UX & UI-/UX-Konsistenz
  - Accessibility (A11y)
  - Code-Qualität, Wartbarkeit, Architektur, technische Schuld
  - Projektstruktur & Sauberkeit
  - Fehlende oder brüchige Tests
  - Dokumentationslücken
  - Sonstiges Verbesserungspotenzial

## Schritt 2 — `prompts/project-health-report.html` aktualisieren

Passe **ausschließlich** diese Datei an. Behalte ihre bestehende HTML-Struktur und
ihr Styling bei (Titel, Meta-Zeile mit Datum/Branch, Summary-Zähler,
Inhaltsverzeichnis, Karten mit Schweregrad-Badges, Legende).

Regeln für den Inhalt:

- Der Report ist eine **Momentaufnahme** (Health-Check) — er enthält **keine Historie**.
- **Erledigte oder nicht mehr relevante Findings vollständig löschen.** Nicht als
  „Done/Completed" markieren, nicht archivieren — einfach entfernen.
- **Neue Erkenntnisse** aus dem Scan als Findings ergänzen.
- **Bestehende Findings aktualisieren**, wenn sich ihre Bewertung geändert hat.
- Jedes Finding hat: eine kurze ID, einen Schweregrad
  (`kritisch` → `hoch` → `mittel` → `niedrig` → `info`), die betroffene
  Datei/Stelle, eine knappe Beschreibung und eine konkrete Empfehlung.
- Sortiere/priorisiere klar von **kritisch → optional**.
- Halte die Summary-Zähler, das Inhaltsverzeichnis und die Abschnittsnummern
  **konsistent** mit den tatsächlich vorhandenen Findings.

## Schritt 3 — Keine Implementierungen

Nimm **keinerlei** Änderungen außerhalb von
`prompts/project-health-report.html` vor:

- Keine Fixes, Refactorings oder neuen Features.
- Keine Formatierungs- oder sonstigen Änderungen an anderen Dateien.

## Schritt 4 — Commit

Erstelle einen Commit, der **nur** `prompts/project-health-report.html` enthält,
mit einer aussagekräftigen Commit-Message (z. B. was hinzugekommen/entfernt wurde).
