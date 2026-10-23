# SLF: Spielgefühl mit Menschen prüfen

Stand: 23.10.2026. Noch keine menschlichen Ergebnisse. Die folgenden Zahlen sind Planwerte, keine vorhandenen Stichproben und keine behauptete statistische Absicherung.

## Labor starten

Die Datei `AGENT/engagement-lab/index.html` ist eine eigenständige Seite mit eingebettetem CSS und JavaScript. Keine Installation, keine neuen Abhängigkeiten, kein Backend, kein externer Font. Direkt öffnen funktioniert; ein lokaler Server ist für wiederauffindbare Speicherung und die Dokumentlinks zuverlässiger:

```bash
python3 -m http.server 8890 --bind 0.0.0.0 --directory AGENT
```

Dann [Labor öffnen](http://localhost:8890/engagement-lab/). Für ein Gerät im selben Netzwerk die LAN-Adresse des Rechners statt localhost verwenden. Läuft der Server nur lokal oder ist die Firewall geschlossen, ist das Labor nicht von anderen Geräten erreichbar. Es wurde nichts auf die Produktionsdomain veröffentlicht.

Direktlinks: `?scenario=review`, `?scenario=reviewflow`, `?scenario=answer`, `?scenario=next`, `?scenario=solo`. Es handelt sich um 15 Situationen × 3 Varianten. **Die Variante A ist nicht die Produktions-Baseline.** Der echte Ausgangszustand muss separat im bestehenden Spiel getestet werden.

## Was man ausprobieren kann

1. **Bewertung:** Szenario 07 für die Enthüllung, Szenario 08 für die Bewertungsarbeit. In 08 ist absichtlich „Mensch“ als Beruf enthalten. Aufdeckung und Korrektur selbst ausprobieren.
2. **Antwortgefühl:** Szenario 03. Mit M z.B. Madrid, Mexiko, Marder, Maler schreiben; mit Tab ein Feld verlassen. Ein Rückmeldungsereignis pro Feld, keine Buchstaben-Punkte. Inhalt wird nicht automatisch als richtig erkannt.
3. **Fünf Runden:** links „Fünf Runden ausprobieren“. Fünf echte Eingaberunden mit wechselnden Buchstaben, manueller Prüfung der eigenen Antworten und Finale. Andere Spieler und deren Zahlen bleiben Simulation. Keine echten Multiplayer-Sockets.
4. **Druck / Stillstand:** Szenario 05 mit explizitem Start des 8-Sekunden-Versuchs und 06 mit verschiedenen Auswegen. Das Experiment startet absichtlich nicht beim bloßen Öffnen automatisch.
5. **Solo:** eigener Versuch 12 (nach Einfügen des zweiten Bewertungsversuchs) sowie Solo-Schalter für gemeinsame Situationen. Die isolierte Flammendemo bleibt ausdrücklich Multiplayer, weil echte Solo-Flammen ausgeschaltet sind. Der Solo-Versuch hat eine simulierte Beispiel-Bestmarke, keine aus vorherigen Sessions gelesene Statistik.
6. **Palette:** Szenario 13 mehrfach auslösen; mindestens dreimal vergleichen. Nicht nur den ersten Überraschungseffekt bewerten.

Die Nummern sind Reihenfolge im Labor, IDs in Export und Links sind stabil: entry, countdown, answer, clear, pressure, stuck, review, reviewflow, flame, ranking, next, solo, theme, finale, waiting.

## Was das Labor erfasst

- Vier Skalen von 1 bis 7: Spaß, Lust auf nächste Runde, Verständlichkeit, Überforderung.
- Freitextnotiz, zufällige Testpersonen-ID, lokale Session-ID, Zeitpunkt, Situation, Variante und Kontext Solo/simulierte Gruppe.
- Im Blindvergleich: zufällige Variantenreihenfolge; gemeinsame Vergleichs-ID; Versuch 1/2/3; Interaktionsereignisse mit relativer Zeit; Ende/Weiter, Korrekturen, erneutes Starten und Sichtbarkeit des Tabs.
- Ton, reduzierte Bewegung und Viewportgröße werden bei Versuchsbeginn protokolliert. Während eines Blindvergleichs sind Ton, Modus und Bewegung gesperrt, damit die Bedingungen innerhalb des Vergleichs gleich bleiben.
- Das eigentliche eingegebene Wort wird **nicht** in den Testexport geschrieben. Freitextnotizen können natürlich enthalten, was man hineinschreibt.
- Daten bleiben unter `slf-engagement-lab-v1` im Browser. Es gibt keine Übertragung an einen Server. Export ist JSON inklusive Ereignissen bzw. CSV der Bewertungen. CSV-Zellen sind maskiert, potenzielle Tabellenformeln werden als Text exportiert.
- „Neue Testperson starten“ erzeugt eine neue ID; vorhandene Ergebnisse bleiben im Gesamtexport. Bei blockiertem Browserspeicher steht nur die laufende Sitzung zur Verfügung: sofort exportieren.

Gespeicherte Daten sind keine Beweise für Freude. Blind bedeutet hier **verdeckte Labels und Hypothesen**, nicht doppelt blind. Menschen sehen die unterschiedlichen Effekte und können ihre Variante wiedererkennen. Auch die moderierende Person kann wissen, welcher Entwurf läuft.

## Reihenfolge der ersten echten Tests

### Runde 0 — Dein Geschmack, ohne ihn zur allgemeinen Wahrheit zu erklären

Zuerst du selbst, ungefähr 20–30 Minuten, nicht alle 45 Varianten am Stück. Reihenfolge: Bewertung/Arbeitsmenge, Antwortgefühl, Rundenbogen, Solo, erst dann stärkere Effekte und Farbwelten. Notiere je Situation:

- Bevorzugte Variante und was genau sie besser macht.
- „Das möchte ich auf keinen Fall im eigentlichen Spiel.“
- Ob der fünfte Versuch noch angenehm ist.
- Welche Elemente sich hochwertig oder billig anfühlen.

Das Ergebnis dokumentiert deine Präferenz. Es ist keine repräsentative Nutzerstudie. Eine von dir abgelehnte Art Direction wird nicht gegen deinen Produktwunsch durchoptimiert.

### Runde 1 — Kurze moderierte Konzeptvergleiche

Plan: zunächst etwa 6–10 Personen für Solo und 3–4 bestehende Freundesgruppen mit jeweils 3–5 Personen für Gruppenbeobachtung. Kleiner qualitativer Pilot, keine ausreichend geplante konfirmatorische Wirksamkeitsstudie. Gelegenheitsspieler und Wortspiel-Fans mischen; Interessen und Erfahrung vorher kurz notieren. Kein Bedarf, alle Situationen von jeder Person testen zu lassen.

Pro Person maximal 3–4 Situationen, ungefähr 15–25 Minuten. Zuerst ohne Wirkungsversprechen erklären: „Wir vergleichen Abläufe. Sag, was angenehm, langweilig, unklar oder zu viel war.“ Nicht „Welche Variante gibt mehr Dopamin?“ fragen. Die Gruppenbedingung bleibt mit diesem Labor gemeinsames Betrachten einer Simulation; echte soziale Gleichzeitigkeit wird erst später geprüft.

Je Situation:

1. Ton und Bewegungspräferenz vor Beginn einstellen, Solo-/Gruppenkontext wählen.
2. Im Entdeckenmodus Situation auswählen, dann „Blind vergleichen“.
3. Aufgabe gleich erklären; gleiches Eingabebeispiel und gleiche Buchstaben innerhalb des Vergleichs verwenden.
4. Variante bedienen, vier Skalen und eine konkrete Notiz speichern.
5. Zwei weitere Varianten in der zufällig zugeteilten Reihenfolge testen.
6. Erst danach die Variante auflösen und nach Präferenz samt Begründung fragen.

Eine weitere Runde im nächsten Moment freiwillig wählen lassen; nicht durch die Moderation als Pflicht formulieren. Wird ein anderer Versuch gewünscht, nicht als „Abbruchproblem“ umdeuten. Verdeckte Reihenfolge pro Person verhindert nicht jeden Lerneffekt. Für kleine Gruppen bewusst die sechs möglichen Reihenfolgen ausgleichen und die tatsächliche Reihenfolge aus dem Export kontrollieren; der Zufallsgenerator garantiert keine perfekte Verteilung.

### Runde 2 — Enger A/B-Test statt Effektpaket

Aus jedem vielversprechenden Konzept eine präzise Änderung isolieren. Beispiele:

- Antwortfeld federt in beiden Bedingungen; nur Partikel an/aus variieren.
- Dieselbe Gesamtübersicht, dieselben Buttons; sofortige gegen 600-ms-Enthüllung testen.
- Dieselben Inhalte und Effekte; angekündigtes Fünfermatch gegen offene Buchstabenfolge testen.

Zuerst diesen engeren Prototyp bauen und mit denselben Aufgaben testen. Das aktuelle Labor enthält Konzeptpakete; seine Ergebnisse dürfen nicht als isolierte Wirkung eines Tons oder einer Animation ausgewiesen werden.

### Runde 3 — Echtes Spiel und Gruppenverhalten

Erst nach Auswahl der Favoriten einen ausdrücklich freigegebenen kleinen Produktprototyp anlegen. Anforderungen: echte gemeinsame Auswertung, echte gültige/gleiche Antworten, echte Regeln, Host und Mitspieler auf getrennten Geräten. Das aktuelle Labor kann das nicht ersetzen.

Vergleiche Kontrollversion und Kandidat in Freundesgruppen. Die Gruppe ist die Einheit der Zuteilung; Stimmen aus derselben Gruppe sind nicht unabhängige Stichproben. Inhaltspakete nach Schwierigkeit ausgleichen. Gleiche Buchstaben direkt nacheinander erzeugen Erinnerungslernen; deshalb äquivalente Pakete und Gegenbalancierung verwenden. Solo unabhängig auswerten.

Reihenfolge innerhalb eines Abends ausgleichen; zusätzlich einen zweiten Termin nach einigen Tagen planen. So lassen sich Neuheit und Ermüdung zumindest teilweise trennen. Für eine belastbare quantitative Aussage eine Stichprobengröße erst aus Pilotstreuung, gewünschtem Mindesteffekt und dem Gruppendesign planen. Keine beliebige kleine Zahl als „statistisch sicher“ verkaufen.

## Was als Verbesserung zählt

Primärziel: Anteil der Sessions/Gruppen, die bei einer klaren, gleich leicht erreichbaren Wahl freiwillig eine zusätzliche Runde beginnen. Kein Auto-Weiter. Nicht mit der Selbstauskunft „Lust auf nächste Runde“ gleichsetzen. In einer Freundesgruppe zusätzlich fragen, ob einzelne eigentlich aufhören wollten.

Begleitmaße:

| Maß | Erhebung | Warum |
|---|---|---|
| Freude nach Runde 1/3/5 | kurze 1–7-Frage, gleiche Zeitpunkte | Neuheit und Ermüdung unterscheiden |
| Spaß während Bewertung | direkt danach | adressiert den beschriebenen Einbruch |
| STOPP → nächste Schreibphase | aufteilen nach Lesen/Diskussion/Bedienung | Leerlauf von guter Diskussion trennen |
| Fehler-/Streitfallerkennung | absichtlich eingebauter Fall plus Korrekturen | schneller darf nicht blind heißen |
| Antwortfluss | Fokusverlust, verlorene Zeichen, Korrekturen | Effekte dürfen Schreiben nicht beschädigen |
| Freiwilliger Abschluss | Entscheidung und Grund | ein gutes Ende ist kein Misserfolg |
| Erinnerung | „Welcher eigene Einfall blieb hängen?“ | konkrete Bedeutung statt generisches Lob |
| Wiederkehr | freiwilliger zweiter Termin | über die erste Überraschung hinaus |
| Gruppengefühl | kurze Frage plus Beobachtung | schauen mehrere zur selben Zeit hin? |

**Vorläufige Auswahlregel für den qualitativen Pilot:** Favorit muss nachvollziehbar mehr Freude/Vorfreude erzeugen, verständlich bleiben und keine wiederkehrende starke Überforderung oder Bewertungsfehler verursachen. Ein schöner Effekt mit schlechterem Schreiben wird verworfen. Gespaltene Präferenzen können eine wählbare Intensität rechtfertigen. Ein gleichwertiger, aber einfacher Entwurf ist ein guter Kandidat.

Für den späteren quantitativen Test die Erfolgsgrenzen *vorher* festlegen, z.B. welche Verbesserung bei freiwilligen Folgerunden praktisch relevant ist und welche zusätzliche Bewertungsdauer höchstens akzeptabel wäre. Effekt mit Unsicherheitsintervall berichten, Kontext getrennt ausweisen; keine nachträgliche Siegerwahl aus 45 Vergleichen. Viele kleine Entwurfsvergleiche sind explorativ.

## Ereignisse richtig lesen

`trial_started` startet den Laborversuch, nicht die ganze reale Spielrunde. `review_done` bzw. `flow_confirm` zeigen Bedienfortschritt. `reveal` und `reveal_finished` helfen die Inszenierungszeit abzuschätzen. `free_choice` hält Weiter/Ende fest. Tabwechsel werden protokolliert; relative Dauer über einen langen Hintergrundaufenthalt ist nicht reine aktive Denkzeit.

Ein Reset startet den Versuch erneut; das vorausgehende `trial_restarted` bleibt mit Zeit sichtbar. Unvollständige/abgebrochene Vergleiche getrennt berichten, nicht still löschen. Mehrere Speicherungen derselben Person sind wiederholte Beobachtungen, keine neuen Personen. JSON enthält die zeitlichen Ereignisse; CSV enthält nur die Bewertungen. Freie Entscheidungen im Entdeckenmodus werden nicht als kontrollierter Test protokolliert.

## Entscheidungsprotokoll nach jeder Runde

| Frage | Einzutragen |
|---|---|
| Was wurde tatsächlich getestet? | Situation, Varianten, Datum, Geräte, Modus |
| Wer hat getestet? | anonyme Personen-/Gruppen-IDs, Erfahrung |
| Wie war die Reihenfolge? | Export/gegenbalancierte Reihenfolge |
| Deine Präferenz | Favorit und Begründung, getrennt von anderen |
| Beobachtetes Verhalten | freiwilliges Weiter, Fehler, Wartearbeit |
| Was war nur eine Aussage? | Skalen, Interviews, Vermutungen |
| Was widerspricht der Hypothese? | Überforderung, schlechte fünfte Runde, Regelmissverständnis |
| Entscheidung | übernehmen, enger testen, ändern oder verwerfen |
| Nächste offene Frage | genau ein nächster Vergleich |

Aktuell: alle menschlichen Ergebnisfelder **offen**. Technische Funktionsprüfungen und eigene Designkritik stehen in [VALIDATION.md](engagement-lab/VALIDATION.md). Es gibt bisher keinen nachgewiesenen Gesamtsieger.
