# Spielgefühl-Labor

Eigenständiger explorativer SLF-Prototyp: 15 Situationen, je drei Varianten. Kein Teil des produktiven Frontends und kein neues Backend.

Start aus dem Repository:

```bash
python3 -m http.server 8890 --bind 0.0.0.0 --directory AGENT
```

[Versuch 01](http://localhost:8890/engagement-lab/) · [Versuch 02](http://localhost:8890/engagement-lab/v2/) · [Recherche](../engagement-research.md) · [Testplan](../engagement-test-plan.md)

Die HTML-Datei lässt sich auch direkt öffnen. Ton ist freiwillig, reduzierte Bewegung wird berücksichtigt. Alle Testdaten bleiben im lokalen Browser; JSON/CSV-Export über die Seite. Die Beispielgruppe ist simuliert. Eine Messung mit echter Gruppe oder langfristiger Motivation ist noch ausständig.

`?scenario=review` öffnet direkt den Reveal-Versuch; `?scenario=reviewflow` den Vergleich der Bewertungsarbeit. Eine fünf Runden lange Probestrecke steht separat bereit. Sie nimmt eigene Wörter auf und bietet manuelle Bewertung. Fremde Antworten und Ranglisten sind Beispieldaten.
