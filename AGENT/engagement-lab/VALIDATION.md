# Technische Prüfung

Geprüft am 23.10.2026 mit dem kollaborativen T3-Browser und dem lokalen statischen Server auf Port 8890. Diese Prüfungen sind technische Beobachtungen, keine menschlichen Spieltestergebnisse.

Erfolgreich geprüft:

- Inline-JavaScript syntaktisch ausführbar; endgültige Datei nach den Korrekturen erneut geprüft.
- Alle 15 Situationen × drei Varianten lassen sich aufrufen. Keine `undefined`-/`NaN`-Anzeige und keine erfasste JavaScript-Ausnahme in diesen Durchläufen.
- Breite und schmale Darstellung; alle 45 Varianten nochmals bei sehr schmalem Viewport geprüft, zuletzt gemessene Breite 240 CSS-Pixel. Ein anfänglicher Überlauf langer Variantenüberschriften wurde durch flexible Spalten und Wortumbruch behoben. Die Browser-Viewportangabe und die tatsächlich gemessene CSS-Breite unterschieden sich zeitweise; die Layoutaussage bezieht sich auf `innerWidth`.
- Vier eigene Eingaben, formaler Fehler bei falschem Anfangsbuchstaben, Feldabschluss, Freischalten von STOPP, vollständige Runde und anschließende Enthüllung.
- Gestaffelte Enthüllung zeigt alle Karten; eigene Antwort auf ungültig setzen führt in der Vorschau zu 0 Punkten.
- Gesamtübersicht enthält alle vier Kategorien; absichtlicher Streitfall „Mensch“ als Beruf kann erkannt und korrigiert werden.
- Flammengewinn ergibt 15 (10 + 5), geteilte Antwort mit Flamme ergibt 0; Verlust wird nicht als Gewinn gefeiert.
- Farbwechsel mehrfach ausgelöst: z.B. Violett → Mint → Abendsonne.
- Fünf komplette Runden mit eigenen Eingaben und vier manuellen Prüfungen pro Runde durchlaufen: M/B/K/S/T. Je 25 bestätigte Demopunkte, 125 Gesamtpunkte, danach Finale statt endloser Fortsetzung. Eigene Wörter erschienen in der jeweiligen Kategorie. Die simulierte Rangliste wurde anschließend an die berechneten eigenen Punkte angepasst; sie bleibt ausdrücklich eine Simulation.
- Die Fünferstrecke zusätzlich komplett im Solo-Modus durchlaufen: 80 pro Runde, 400 Gesamtpunkte; berechneter Zwischenstand und Abschluss geprüft. Solo zeigt ausschließlich den eigenen Punktestand.
- Blindvergleich: drei verschiedene Varianten in zufälliger Reihenfolge, genau drei neue Bewertungen, Abschlussereignis und Wiederherstellung der sichtbaren Labels. Keine eingegebenen Antwortwörter in den Testdaten. Synthetische Prüfbewertungen danach aus dem Browserspeicher entfernt / Ausgangsdaten wiederhergestellt.
- JSON- und CSV-Export tatsächlich heruntergeladen und gelesen. JSON enthält Schema, Version und Bewertung; eine Notiz `=1+1` wird in CSV als Text mit vorangestelltem Apostroph maskiert.
- Reduzierte Bewegung: keine Partikel, Transition-Dauer 0; Informationen und Buttons bleiben vorhanden.
- Acht-Sekunden-Versuch läuft bis zur Auswertung; ein Szenariowechsel während eines Countdowns wird nicht durch einen alten Timer überschrieben.
- Wiederverbinden in der Simulation stellt vier Eingaben wieder her; es ist kein echter Netzwerktest.
- Lokale Dokumentlinks und `git diff --check` geprüft. Keine Änderung an Produktionsdateien oder Abhängigkeiten.

Eine zusätzliche Prüfung mit `html_preview` wurde versucht, konnte auf diesem Host aber nicht starten. Rohmeldung beginnt: **„This host is missing libraries T3's browser needs (libglib-2.0.so.0, libgobject-2.0.so.0, libnspr4.so, libnss3.so, …)“**. Deshalb erfolgten Bedienungs- und Layoutprüfung im verfügbaren kollaborativen Browser. Es wurden keine Systembibliotheken installiert und keine funktionierende Headless-Prüfung behauptet.

Nicht nachgewiesen:

- Spaß, Retention, Dopaminausschüttung oder ein allgemeiner Gewinner der 45 Varianten.
- Reale soziale Gleichzeitigkeit, Internetlatenz, echte Gruppenabstimmung oder echte Verbindungswiederherstellung. Andere Personen sind simuliert.
- Semantische Wortprüfung oder langfristig faire eigene Rekorde. Gültigkeit wird von Menschen bewertet.
- Performance auf älteren Telefonen, echte Touch-/Tastaturnutzung auf iOS/Android, Screenreader-Komplettprüfung und vergleichender Dunkelmodus. Browserbreite ist kein Ersatz für echte Geräte.
- Vollständige Produktionsintegration. Die Produktions-Tests wurden nicht erneut ausgeführt, weil die Produktdateien unverändert blieben; sie würden die isolierte HTML-Demo ohnehin nicht abdecken.

Nächster Schritt: [moderierter Testplan](../engagement-test-plan.md). Eine positive Browserprüfung darf nicht als positiver menschlicher Test in das Entscheidungsprotokoll übernommen werden.
