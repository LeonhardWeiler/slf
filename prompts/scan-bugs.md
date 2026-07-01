# Kontinuierlicher Projekt-Review & Report-Update

Führe folgende Schritte in genau dieser Reihenfolge aus:

## 1. Projekt vollständig analysieren

* Scanne das gesamte Projekt erneut.
* Berücksichtige den aktuellen Stand des Codes, nicht frühere Reports.
* Suche insbesondere nach:

  * Code Quality
  * Projektstruktur & Sauberkeit
  * Bugs
  * Potenziellen Security-Problemen
  * Performance-Problemen
  * UX-Problemen
  * UI-/UX-Konsistenz
  * Accessibility
  * Wartbarkeit
  * Architektur
  * Technischer Schuld
  * Fehlenden Tests oder problematischen Testbereichen
  * Dokumentationslücken
  * Sonstigen Auffälligkeiten oder Verbesserungspotenzial

## 2. `prompts/agent-writeup.html` aktualisieren

Passe ausschließlich die Datei `prompts/agent-writeup.html` an.

Dabei gilt:

* Der Report soll immer den aktuellen Stand des Projekts widerspiegeln.
* Entferne alle Punkte vollständig, die inzwischen erledigt oder nicht mehr relevant sind.

  * Nicht als "Done", "Completed" oder ähnlich markieren.
  * Nicht archivieren.
  * Einfach löschen.
* Ergänze alle neu gefundenen Erkenntnisse aus dem aktuellen Scan.
* Aktualisiere bestehende Einträge, wenn sich deren Bewertung geändert hat.
* Achte auf eine klare Priorisierung (kritisch → wichtig → optional).
* Der Report soll wie ein aktueller Health-Check des Projekts wirken und keine Historie enthalten.

## 3. Keine Implementierungen

Nimm keinerlei Codeänderungen außerhalb von `prompts/agent-writeup.html` vor.

* Keine Fixes.
* Keine Refactorings.
* Keine neuen Features.
* Keine Formatierungsänderungen an anderen Dateien.

## 4. Commit

Erstelle nach der Aktualisierung einen Git-Commit.

Der Commit soll ausschließlich die Änderungen an `prompts/agent-writeup.html` enthalten und eine aussagekräftige Commit-Message besitzen.
