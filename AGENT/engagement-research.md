# Stadt Land Fluss: mehr Vorfreude, mehr Spielgefühl

Recherche und Konzeptstand: 23. Oktober 2026. Forschungsprototyp, keine Produktfreigabe.

## Arbeitsstand und ehrliche Grenze

Das Ergebnis dieser Runde sind ein [spielbares Labor](engagement-lab/index.html) mit 15 Situationen und 45 Varianten, ein [Testplan](engagement-test-plan.md) und eine priorisierte Umsetzungsskizze. Produktionscode, Spielregeln, WebSocket-Protokoll und Backend wurden nicht verändert. Es wurden keine echten Menschen getestet. Browserprüfungen belegen Bedienbarkeit, keine Freude oder Bindung.

Die Zielaussage „Danach will niemand mehr aufhören“ kann ich nicht seriös zusichern. Sie lässt sich weder aus Firmenerfolgen ableiten noch durch meine eigene Einschätzung ersetzen. Auch „Dopamin“ ist hier keine gemessene Größe. Die überprüfbare Frage lautet: **Wollen Menschen aus Freude freiwillig eine weitere Runde spielen, und gefällt ihnen auch die fünfte Runde noch?** Das Labor macht diese Frage testbar. Weitere Recherche ohne Spieltests würde die entscheidende Unsicherheit nicht beseitigen.

## Deine Vorgaben und Präferenzen

Direkt aus deinen Nachrichten, keine von mir erfundenen Nutzerbedürfnisse:

- Hoher visueller Anspruch; ansprechend und spannend ist Grundvoraussetzung.
- Block Blast als Referenz für häufige, farbige, animierte Rückmeldung und sichtbare Transformation nach einem besonderen Erfolg.
- Keine Monetarisierung. Keine Anzeigenmechanik, keine Wartezeiten zur Umsatzsteigerung erforderlich.
- Zuerst lernen, unterschiedliche Entwürfe ausprobieren, mit Menschen vergleichen; noch kein großer Umbau der App.
- Solo und Multiplayer sind gleich wichtig.
- **Die Bewertung ist ein „Downfall-Moment“.** Sie verliert die Energie der Spielphase.
- Eine gute Antwort zu schreiben vermittelt bisher zu wenig Befriedigung.
- Spätestens nach ungefähr zwölf Buchstaben wünscht man sich das Ende.
- Nichtwissen ist langweilig, kann unter passendem Zeitdruck aber spannend werden.
- Die ganze Gruppe soll schnell ins Mitfiebern kommen.
- Das fertige Labor soll im Browser geöffnet werden.

Noch offen: gewünschte Tonalität zwischen elegant, verspielt und überdreht; Präferenz für Ton; bevorzugte Dauer eines Freundesabends; ob eher das Finden, Gewinnen oder die überraschenden Antworten Spaß machen. Diese Fragen sollen die Varianten beantworten, nicht neue Annahmen als Präferenz verkleiden.

## Was ich am bestehenden Spiel untersucht habe

Gelesen: README, CLAUDE.md, GameScreen, ReviewScreen, SoloReviewScreen, RoundResultScreen, GameOverScreen, RoundLetter, CountUp und die zentralen Styles. Zusätzlich den Live-Einstieg unter [slf.coprime.tech](https://slf.coprime.tech) im Browser angesehen. Kein vollständiges Live-Gruppenspiel durchgeführt.

Der bestehende Ablauf ist Lobby → Countdown → Schreiben → Bewertung → Zwischenstand → nächste Runde. Solo verkürzt die Auswertung bereits: alle eigenen Antworten stehen auf einer Seite; danach geht es direkt weiter. Die Produktion enthält bereits Countdown-Pops, Haken beim Ausfüllen, CountUp, Ranglisteneinblendung und eine Flammenanimation. „Es ist gar nichts animiert“ wäre also falsch.

Das größere Problem scheint die Bedeutung und Verteilung des Feedbacks zu sein:

1. Beim Schreiben erscheint ein Haken nach formaler Prüfung; das ist noch kein gefühlter Treffer.
2. Im Multiplayer prüft der Host Kategorien nacheinander. Andere Menschen warten oder schauen zu. Das ist ein struktureller Engpass, kein reines Farbproblem.
3. Punkte erscheinen als Zahlen. Welche eigene Entscheidung gut war, bleibt wenig präsent.
4. „Nächste Runde“ ist hauptsächlich ein weiterer Buchstabe. Ein nahes Finale oder eine inhaltliche Aussicht fehlt.
5. Solo hat wenig Überraschung durch andere Menschen. Deshalb braucht Solo ein eigenes Können-Ziel, keine simulierte Konkurrenz.

Diese Diagnose ist eine Kombination aus Codebefund und deiner Erfahrung. Ihr Ausmaß ist noch nicht mit Zeitmessungen quantifiziert.

## Quellen und was sie tatsächlich tragen

### S1 — Block Blast: offizielle Produktvorschau

[Hungry Studio im App Store, inklusive bewegter Vorschau](https://apps.apple.com/us/app/block-blast/id1617391485), angesehen am 23.10.2026. Untersucht wurde die ungefähr 30 Sekunden lange offizielle Gameplay-/Produktvorschau; mehrere Zeitpunkte wurden visuell verglichen. Kein vollständiger nativer Langzeitspieltest, kein Nachbau einer nicht offiziellen Browserkopie. Die Suche nach Gameplay führte auch zu Fan-Seiten; diese wurden nicht als Beleg für die Originalregeln verwendet.

Beobachtbar: farbige, plastische Blöcke; sehr kurze Aktions-Rückmeldung; kleine schwebende Punkte; deutlich größere Combo-Schriftzüge und Leuchteffekte; sichtbare Räumung schafft freien Raum und einen neuen Ausgangszustand. Beispielsweise sind um 6 Sekunden eine Combo 2, um 15 Sekunden Combo 4 und um 18 Sekunden Combo 6 sichtbar. Die genaue Kausalwirkung auf Bindung ist daraus nicht bekannt. Ein Farbwechsel nach *jedem* vollständigen Clear wurde in dieser Vorschau nicht nachgewiesen; das ist deine Referenz und kann je nach Version variieren.

**Eigene Übertragung:** „Wort landet“ als kurzer lokaler Treffer; vier gefüllte Felder als vollständiger Satz; seltene bestätigte Antwort als höherer Rang des Feedbacks. Eine volle Wortliste ist kein gelöstes Puzzle und keine semantische Validierung.

### S2 — Hungry Studio: systematisches Experimentieren, Stand 2026

[Sensor Tower: Interview/Kundengeschichte mit Hungry Studio, April 2026](https://sensortower.com/blog/hungry-studio-use-case). Das Unternehmen berichtet mehr als 10.000 A/B-Tests im Jahr 2025 und mehr als 300 gleichzeitig laufende tägliche Experimente. Quelle ist eine kommerzielle Kundengeschichte mit Unternehmensangaben, kein unabhängiges Experiment über einzelne Animationen.

**Eigene Übertragung:** Die wertvollste übertragbare Praxis ist, unklare Designentscheidungen mit Varianten zu prüfen. Erfolgreiche Firmen kennen die beste Variante nicht im Voraus. Downloadzahlen verraten nicht, welche einzelne Änderung SLF verbessert.

### S3 — Feedback-Intensität: empirischer Befund gegen „immer mehr“

[Dominic Kao, *The effects of juiciness in an action RPG*, 2020](https://doi.org/10.1016/j.entcom.2020.100359), N = 3.018, vier Intensitätsstufen. Fehlende und extreme Effekte schnitten gegenüber mittleren/starken Effekten bei mehreren Erlebnis-, Spielzeit- und Leistungsmaßen schlechter ab. Der frei auffindbare Abstract und das Autor-Manuskript auf [ResearchGate](https://www.researchgate.net/publication/339467686_The_Effects_of_Juiciness_in_an_Action_RPG) waren zugänglich; der direkte Elsevier-Volltextaufruf lieferte 403.

Grenze: Action-RPG, kein Wortspiel; das optimale Timing oder die optimale Partikelzahl für SLF ist nicht belegt.

**Eigene Übertragung:** eine Ereignishierarchie statt Dauerfeuer. Mittlere Intensität als Startentwurf, stärkere Intensität als ernst zu nehmender Gegenentwurf. Konzentration beim Tippen und Sichtbarkeit der Antworten sind harte Voraussetzungen.

### S4 — Motivation: Kompetenz, Autonomie, Verbundenheit

[Ryan, Rigby & Przybylski, *The Motivational Pull of Video Games*, 2006](https://doi.org/10.1007/s11031-006-9051-8). Vier Studien untersuchen die Verbindung zwischen Bedürfnisbefriedigung im Spiel, Spielspaß und Motivation. Erlebte Kompetenz und Autonomie sind relevante Faktoren; soziale Verbundenheit kommt in der Untersuchung einer Online-Spielpopulation hinzu. Daraus folgt keine Garantie für eine konkrete Oberfläche.

**Eigene Übertragung:** eigenes Können erklären, sinnvolle Entscheidungen anbieten, die Gruppe an echten Momenten beteiligen. Das spricht für mehr als Effekte: eine seltene Antwort verstehen, ein eigenes Ziel erreichen, mit Freunden gemeinsam aufdecken.

### S5 — Game Feel als Verbindung zwischen Absicht und Rückmeldung

[Johansen et al., *Designing Game Feel. A Survey*, 2020/2021](https://arxiv.org/abs/2011.09201). Der Überblick behandelt unmittelbare Interaktion, Unterstützung von Spielerabsichten und Verstärkung von Aktionen durch Rückmeldung. Er ist eine Design-Synthese, kein Nachweis einer universellen Erfolgsformel.

**Eigene Übertragung:** Das Wortfeld muss sofort reagieren; der Effekt darf nicht den nächsten Tastendruck verzögern. Bestätigen, Enthüllen und Punktevergabe müssen jeweils verständlich auf die auslösende Aktion folgen.

### S6 — Duolingo: Fortschritt zelebrieren

[Duolingo: Streak und Gewohnheit](https://blog.duolingo.com/how-duolingo-streak-builds-habit/), 2022; [Animationsprozess](https://blog.duolingo.com/streak-milestone-design-animation/), 2022. Duolingo berichtet +1,7 % bei der Wahrscheinlichkeit, dass neue Lernende nach sieben Tagen noch aktiv sind, nach einer Animationsänderung. Die Meldung liefert keinen vollständigen öffentlichen Versuchsdatensatz; Prozent und Prozentpunkte nicht verwechseln. Die Korrelation langer Streaks mit Kursabschluss ist außerdem kein Beweis für die Wirkung des Streaks. Der Designbericht zeigt mehrere Animationsentwürfe, wiederholte Timing-Überarbeitung und eine eigene Gestaltung für Meilensteine.

**Eigene Übertragung:** Erreichte kleine Ziele verständlich und attraktiv feiern. Für einen gelegentlichen Spieleabend sind ein kurzer Sessionbogen und Erinnerungen an gute Antworten plausibler als eine tägliche Anwesenheitspflicht. Das ist eine Hypothese für SLF, keine Duolingo-Ergebnisübernahme.

### S7 — Duolingo: das richtige Ziel messen

[Duolingo: *Time Spent Learning Well*, 2024](https://blog.duolingo.com/time-spent-learning-well/). Der Produktbericht beschreibt, warum reine Aktivität und XP-Sammeln nicht automatisch dem eigentlichen Lernziel dienen und wie Belohnungen entsprechend ausgerichtet werden. Unternehmensbericht, keine externe Replikation.

**Eigene Übertragung:** Lange Sitzungen und hektisches Klicken sind nicht automatisch Spaß. Eine freiwillige weitere Runde und stabile Freude nach mehreren Runden sind bessere Entwicklungsziele als bloße Verweildauer.

### S8 — TikTok: Relevanz und Entdeckung

[TikTok: aktuelle Hilfeseite zu Empfehlungen](https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content), über den Suchindex am 23.10.2026 eingesehen; direkter Abruf war robots-blockiert. Ergänzend vollständig geöffnet: [offizielle Systembeschreibung, 18.06.2020](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you). Beschrieben werden Personalisierung über Interaktionen, Interesse/Überspringen und die bewusste Einmischung unterschiedlicher Inhalte. Die genaue heutige Gewichtung ist nicht öffentlich festgelegt.

**Eigene Übertragung:** Kategorieauswahl statt eines komplexen Empfehlungsmodells; spannende nächste Aufgabe konkret zeigen; frische Inhalte mit Vertrautem mischen. SLF soll den Vorteil gemeinsamen Handelns nutzen. Die These „2026 haben alle nur noch x Sekunden Aufmerksamkeit“ ist hier nicht belegt und wird nicht behauptet.

### S9 — Candy Crush: Varianten und Spielerfeedback

[King Community: neue Schwierigkeitsdarstellung, 2025, mit Rückmeldungen bis 2026](https://community.king.com/en/candy-crush-saga/discussion/496696/new-hard-level-labels-what-do-you-think) und [King: Crush & Tell, 2026](https://community.king.com/en/candy-crush-saga/discussion/comment/3474192). Das Entwicklerteam diskutiert Erkennbarkeit, Farben, Gestaltung und Rückmeldungen; die öffentlichen Antworten zeigen auch unterschiedliche ästhetische Präferenzen. Offene Community-Abstimmungen sind selbstselektiert und liefern keine repräsentative Wirkungsgröße.

**Eigene Übertragung:** Auch ein hübscher Entwurf kann manchen zu kindlich oder zu unruhig sein. Einfache, nicht suggestive Spieltests sind wichtiger als Übereinstimmung mit meinem Geschmack.

## Was „engaging“ für genau dieses Spiel bedeuten sollte

Vier ineinandergreifende Bögen, als eigene Designhypothese:

1. **Sekundenbogen:** Frage verstehen → Idee haben → Wort abschließen → kurze, präzise Rückmeldung.
2. **Rundenbogen:** einige sichere Wörter → letztes schwieriges Feld → STOPP → andere Ideen → bestätigte Überraschung.
3. **Sessionbogen:** drei bis fünf Runden → erkennbare Entwicklung → Finale → freiwillige Revanche.
4. **Wiederkehrbogen:** Erinnerung an die Freunde und den besten Einfall → nächste passende Gelegenheit. Längerfristige Sammlung erst prüfen, wenn die unmittelbare Runde funktioniert.

Bei Block Blast erzeugt das Freiräumen sofort neue Möglichkeiten. Bei SLF muss eine abgeschlossene Runde ebenfalls neue Energie freisetzen. Eine weitere identische Formularrunde plus lange Verwaltungsphase leistet das noch nicht. Deshalb ist der **erste große Hebel der Bewertungsablauf**, der zweite das Antwortgefühl und der dritte die Sessionlänge.

### Gute Eingabe und gute Antwort auseinanderhalten

Beim Tippen wissen wir zuverlässig: Text vorhanden, Länge passt, Buchstabenregel passt. Wir wissen noch nicht: richtige Stadt, wirklich ein Beruf, einzigartig im aktuellen Spiel. Ein Haken darf daher „ausgefüllt“ bedeuten; „genial“ oder „selten“ erst nach inhaltlicher Prüfung und Vergleich. Andernfalls belohnt das Spiel Unsinn und der schönste Effekt entwertet die Regeln.

Vorschlag: beim Feldabschluss ein kurzes Einfedern, kleines Zeichen, ein präziser Ton. **Einmal pro Kategorie und Runde**, nicht pro Buchstabe. Bei vier gefüllten Feldern ein höherer Moment; bei einer bestätigten einzigartigen Antwort eine eigene seltene Animation. Wiederholtes Löschen erzeugt keine Bonuspunkte. Lange Wörter sind nicht automatisch bessere Wörter.

### Bewertung: Spannung behalten, Arbeit reduzieren

Zwei getrennte Experimente:

- **Inszenierung:** sofort sichtbar vs. gemeinsamer Klick vs. kurze Staffelung. Ist das Aufdecken selbst interessant?
- **Arbeitsmenge:** Kategorie für Kategorie vs. eine gemeinsame Übersicht vs. zuerst nur echte Streitfälle. Spart der Ablauf Zeit, ohne Fehler zu verstecken?

Möglicher späterer Ablauf: alle geben ab → gemeinsame Übersicht erscheint → gleiche Antworten werden nachvollziehbar gruppiert → jede Person kann eine Antwort markieren → Host klärt die offenen Fälle → alle bestätigen/Host schließt ab → erst dann endgültige Punkte. Animationen beim Überfliegen laufen parallel zur Interaktion. Der Host behält Kontrolle, korrigiert und kann wieder zurück. Ein von anderen nicht angefochtener Vorschlag ist kein automatischer Wahrheitsnachweis.

Die Demo enthält den absichtlichen Streitfall **„Mensch“ als Beruf**. Ein schneller Ablauf, bei dem niemand das bemerkt, ist kein guter Gewinner. Die Gruppe soll etwas zu diskutieren haben, aber keine endlose Wartearbeit. Ein wortreicher, diskutierter Einfall darf mehr Zeit bekommen als vier offensichtliche Antworten.

### Die zwölfte Runde ist auch ein Inhalts- und Längenproblem

Ein ganzes Alphabet ist kein automatisch guter Spannungsbogen. Eigener Vorschlag: Auswahl „kurzes Match: 5 Runden“, „Mini: 3“, „offen spielen“. Ein Match hat ein angekündigtes Finale; danach ist ein Ende ein normaler Erfolg. Drei/fünf sind Testwerte, keine erforschten optimalen Zahlen. Schwierige Buchstaben und interessante Kategorien können vorab für alle gleich ausgewählt werden. Keine versteckten Eingriffe in laufende Konkurrenz.

Varianten: vorgegebene kurze Strecke; nach drei Runden Themenwahl; optional ein Abschluss mit einer Lieblingskategorie. Erst den kürzeren Bogen testen, dann Inhaltsrotation ergänzen. Sonst lässt sich die Ursache eines besseren Gefühls nicht auseinanderhalten.

### Feststecken darf zwei Antworten haben

Manche wollen genau jetzt mehr Druck, andere einen Ausweg. Teste Zeitdruck getrennt von Effekten. Ruhiges Solo ohne Timer ist eine echte Variante. Gemeinsame Hilfen dürfen nicht heimlich nur einem Teilnehmer eine Lösung schenken. Der kleinste Multiplayer-Ausweg ist ein Vorschlag zum frühen Beenden mit Zustimmung der Gruppe; eine Abstimmung ist aber auch zusätzliche Arbeit und muss sich lohnen.

## 45 konkrete Varianten im Labor

Die A-Variante ist jeweils eine ruhige bzw. direkte **Vergleichsbasis im neuen visuellen Entwurf**, keine exakte Kopie der Produktion. Viele Vergleiche sind bewusst Konzepte mit mehreren Änderungen. Nur ein nachfolgender enger A/B-Test kann die Wirkung einzelner Elemente isolieren.

| Situation | A | B | C | Entscheidende Beobachtung |
|---|---|---|---|---|
| Einstieg | direkt starten | Fünfer-Mission | gemeinsames Wortziel | Startlust und Zielverständnis |
| Countdown | schlichte Ziffer | Buchstabenimpuls | sichtbare Gruppenbereitschaft | gleichzeitige Aufmerksamkeit |
| Wortabschluss | Haken | Feld federt, Tonleiter | zusätzlich lokale Partikel | Schreibfluss und Befriedigung |
| Voll ausgefüllt | fertige Felder | All clear + Palette | größere Effektstufe | verdienter Höhepunkt oder Gewöhnung |
| Endspurt | Uhr | letztes Feld fokussiert | begrenzte Endimpulse | Spaßstress vs. Denkblockade |
| Feststecken | weiterdenken | allgemeiner Denkimpuls | freiwilliger Abschluss/Abstimmung | Leerlauf und Autonomie |
| Reveal | sofort alle sichtbar | gemeinsam aufdecken | kurz gestaffelt, überspringbar | Vorfreude vs. zusätzliche Wartezeit |
| Bewertungsarbeit | einzeln je Kategorie | alle auf einen Blick | Streitfälle zuerst | Dauer UND Streitfall-Erkennung |
| Flamme | Zahl | Einsatz + Auflösung | Auflösung + Gruppenreaktion | Regelverständnis bei Erfolg/Verlust |
| Zwischenstand | Rangliste | eigener Beitrag | kurzer Führungswechsel | Motivation außerhalb von Platz eins |
| Nächste Runde | offene Buchstabenfolge | nahes Finale | Finale + Kategorienwahl | tatsächliche freiwillige Fortsetzung |
| Solo | nur Punkte | eigene Beispiel-Bestmarke | erreichbare Wortmission | eigener Fortschritt ohne Scheingegner |
| Farbwelt | konstant | Wechsel nach voller Runde | manuelle Auswahl | Frische nach mehreren Wiederholungen |
| Finale | Ergebnis | bester bestätigter Einfall | mehrere Gruppentitel, Revanche | guter Abschluss und echte Wiederkehrlust |
| Warten | Status | anonyme Füllstände | begrenzte Reaktion | Verbundenheit ohne Ablenkung/Antwortleck |

## Gestaltung und Timing: Startwerte für Prototypen

Keine wissenschaftlich optimierten Konstanten; mit Geräten und Menschen nachjustieren.

- Berühren/Drücken: sichtbare Rückmeldung im nächsten Frame, kompaktes Eindrücken statt ganzer Bildschirmbewegung.
- Feldabschluss: ungefähr 180–320 ms; lokaler Effekt, nächste Eingabe bleibt frei.
- Fortschritt: vier kleine Segmente; Text und Form zusätzlich zur Farbe.
- All clear: ungefähr 500–900 ms visuelle Hauptbewegung, Caption maximal etwa 1,4 s. STOPP bleibt bedienbar.
- Gemeinsame Enthüllung: gleichzeitig oder Staffelung der vier Karten innerhalb ca. 0,9 s; direkt überspringbar.
- Punkte: 400–650 ms von altem zum neuen Wert; Zahlen und Endstand sofort verständlich.
- Palette: weicher Übergang in einer Eingabepause, nicht während eines Tastendrucks.
- Audio: aus bis zur ausdrücklichen Aktivierung. Kurzer Timbre-Familienstil für Feld, vollständige Runde, seltene Antwort. Nicht jeder Tastendruck bekommt Sound.
- Bewegung reduzieren: Partikel, Shake, große Translationen und Ton nicht zur Voraussetzung des Verständnisses machen. Das Labor berücksichtigt Systemeinstellung und eigenen Schalter.

Visueller Entwurf: warmer heller Grund, kräftiges Violett, Apricot und Gelbgrün; plastische Buchstabenkacheln; deutliche Typografie; weitgehend ruhiger Bereich beim Schreiben. Der Entwurf ist absichtlich kein Block-Blast-Skin. Eine dunkle und eine deutlich erwachsenere alternative Art Direction sind spätere Vergleichskandidaten; sie sind in dieser Runde nicht als vollwertige Designs umgesetzt.

## Umsetzungsskizze für die echte App

### P0 — Erst messen und die drei Kernprobleme bestätigen

Einige Solo-Sessions und Freundesgruppen im aktuellen Spiel beobachten. Zeit vom STOPP bis zum nächsten Schreiben getrennt erfassen: Enthüllung, Lesen, Diskussion, Host-Bedienung, Zwischenstand. Nach Runde 1, 3 und 5 kurze Spaßfrage; nach frei gewähltem Ende Grund erfragen. Die Produktion als echte Baseline verwenden, nicht Labor-A.

### P1 — Antwortgefühl und bestätigte Höhepunkte

Ansatzpunkte: `GameScreen.tsx`, `RoundLetter.tsx`, `CountUp.tsx`, `index.css`.

Lokale Effekte für erstmaligen Feldabschluss aus formaler Validierung ableiten; je Runde/Kategorie deduplizieren. Keine Effekte bei wieder eingespielten Entwürfen oder Reconnect. Vollständigkeit separat von Punkten benennen. All clear erzeugt keine neuen Spielpunkte. Themendesign und Tonoption als lokale Darstellung. Ein bestätigter seltener Einfall kommt erst aus dem Auswertungsergebnis.

Aufwand relativ klein bis mittel, solange Regeln unverändert bleiben. Die Messfrage ist, ob das Schreiben besser wirkt, ohne mehr Korrekturen, Tippabbrüche oder verlorene Eingaben zu verursachen.

### P1 — Bewertungsfluss als wahrscheinlich größter Hebel

Ansatzpunkte: `ReviewScreen.tsx`, `SoloReviewScreen.tsx`, `serverEvents.ts`, `room.ts`, Backend-Reviewnachrichten.

Für eine gemeinsame Gesamtübersicht müssten im Multiplayer mehrere Kategorien kontrolliert bereitgestellt werden. Das aktuelle kategorieweise Datenmodell darf nicht durch eine rein optische Fiktion überspielt werden. Gleichbedeutende Antworten, ungültige Antworten, Rückwärtsnavigation, Flammen, verlassene Spieler und nachträgliche Korrekturen müssen weiterhin korrekt sein. Bereits vorhandene Solo-Gesamtübersicht als Erfahrung nutzen; Solo nicht künstlich wieder in Einzelseiten zerlegen.

Eine gemeinsame Reveal-Freigabe wäre ein serverseitiges Ereignis mit Phase/Version und Zeitstempel. Eingaben müssen geschlossen sein, bevor fremde Antworten veröffentlicht werden. Punkte bleiben serverautoritativ. Eine einfache erste Stufe kann ohne Gruppenabstimmung auskommen: bessere Übersicht, kurze Enthüllung, Host prüft und bestätigt.

Aufwand mittel bis groß, deshalb erst nach Labortest. Hauptziel: weniger subjektiver Spannungsabfall bei gleichbleibender Prüfgüte, nicht allein weniger Sekunden.

### P1 — Kurzes Match und sinnvolles Finale

Ansatzpunkte: `Lobby.tsx`, Settings- und Ereignistypen, Backend-Rundenfortschritt, `RoundResultScreen.tsx`, `GameOverScreen.tsx`.

Konfigurierbares angekündigtes Ende nach drei/fünf Runden, offene Session weiter möglich. Limit und verbleibende Runden vom Server, nicht aus Clientzählung. Wiederverbinden, Hostende und ausgeschöpfte Buchstaben müssen denselben Abschluss ergeben. Revanche setzt genau die vorgesehenen Sessiondaten zurück. Ergebnis erklärt einen echten persönlichen Beitrag und bietet Ende und Revanche gleich klar an.

### P2 — Solo mit eigener Identität

Zuerst eine freiwillige Mission ohne Zeitlimit gegen die reine Punktanzeige testen. Persönlicher Rekord braucht persistente lokale Daten und eine klare Kennzeichnung der Selbstbewertung; daraus entsteht keine objektive Rangliste. Ein späteres Wörterbuch oder eine Datenquelle wäre ein eigenes Validierungsprojekt mit Mehrdeutigkeiten und Sprachvarianten. Kein fingiertes „nur du kanntest das“ im Solo.

### P2 — Frische Inhalte und Gruppenreaktionen

Kuratierte Kategorienpakete, kleine Wahl vor einer neuen Strecke, Highlights erst nach bestätigtem Ergebnis, begrenzte Reaktionen. Kategorienwahl könnte der Host nach Gruppenabsprache treffen; eine weitere Abstimmung lohnt sich erst bei nachgewiesenem Mehrwert. Kurze Ereignisse dürfen Zwischenstände nicht überdecken. Neu hinzukommende Zuschauer behalten den bestehenden fairen Einstieg ab der nächsten Runde.

### P3 — Langfristige Sammlung erst nach dem Kernspiel

Optionale Wortgalerie, Lieblingsantworten, lokale Farbwelten, gemeinsame Rekordstrecke oder wiederkehrende kuratierte Challenge. Erst prüfen, ob Menschen das Kernspiel wiederholen möchten. Sammlung ist kein Ersatz für eine gute fünfte Runde. Private Antworten/Freundesnamen sollten nur durch explizites Speichern oder Teilen in neue Oberflächen gelangen.

## Weitere Ideen und warum sie noch keine Empfehlungen sind

| Idee | Erwarteter Nutzen | Noch offene Frage / Preis |
|---|---|---|
| Aufsteigende Klänge pro Feld | Fortschritt wird hörbar | stört gemeinsames Spielen auf mehreren Handys? |
| Lokaler Wort-„Stempel“ | Einfall bekommt Gewicht | erscheint bei Tab/Blur zu früh oder zu spät? |
| Gemeinsamer „3, 2, Reveal“-Moment | soziale Gleichzeitigkeit | zusätzliche Zwangswartezeit? |
| Seltenheits-Titel nach Prüfung | eigene Kompetenz wird sichtbar | bleibt verständlich, dass einzigartig nicht immer schwer bedeutet? |
| Themenwechsel erst nach 3 vollen Runden | längerfristige Steigerung | schöner als nach jeder Runde? als Folgetest vorgesehen |
| Passende Kategorien nach Interessen | mehr relevante Ideen | Gruppenüberschneidung und Hostaufwand? |
| Finale mit Lieblingskategorie | Höhepunkt gegen Ermüdung | fair und freiwillig genug? |
| Eigener Geistlauf / Bestmarke | Solo-Vergleich mit sich selbst | selbstbewertete Scores vergleichbar? |
| Kooperatives Wortziel | auch schwächere Spieler tragen bei | erzeugt zusätzliche Pflicht oder echte Gemeinsamkeit? |
| Rückblick pro Person | mehr als ein Sieger fühlt sich gesehen | Titel inhaltlich wahr und nicht austauschbar? |
| Gute Korrektur kurz positiv quittieren | Bewertung wird gemeinsames Spiel | zu viele kleine Effekte beim Prüfen? |
| Allgemeiner Hinweis nach längerer Denkpause | Langeweile aufbrechen | automatische Unterbrechung nervt vielleicht; lieber auf Abruf |
| „Knapp noch geschafft“ bei echtem Zeitereignis | Spannung hat eine Geschichte | nur aus tatsächlichen Zeitdaten ableiten |
| Zuschauerreaktion / Kommentatorbühne | Freundesgruppe bleibt beteiligt | Ablenkung und Tempo bei großen Gruppen? |

Nicht priorisiert: tägliche Pflicht-Streaks, automatische nächste Runden, erfundene Knappheit, versteckte Gegneranpassung, zufällige Punkte ohne Bezug zur Leistung. Diese Dinge passen nicht zu deinen beschriebenen Problemen und würden die Tests schwerer interpretierbar machen.

## Was ich nach der ersten Iteration selbst korrigiert habe

Die ersten Entwürfe konzentrierten sich zu stark auf Effektintensität. Dein späteres Feedback machte deutlich, dass das allein nicht reicht. Deshalb kamen ein gesonderter Vergleich der **Bewertungsarbeit**, eine echte fünf Runden lange Probestrecke mit eigenen Eingaben, freiwillige Auswege und ein definierter Abschluss hinzu. Die Varianten zur Enthüllung und zur Arbeitsmenge sind getrennt, damit wir nicht eine hübsche zusätzliche Wartephase mit einem besseren Bewertungsablauf verwechseln.

Das ist eine Design- und Funktionsiteration, keine vorgetäuschte menschliche Studie. Die nächste Wiederholung von Recherche → Entwurf → Test → Entscheidung braucht deine Eindrücke und echte Spielbeobachtungen. Das [Entscheidungsprotokoll im Testplan](engagement-test-plan.md) hält auch Ablehnung und gemischte Ergebnisse fest.

## Iteration 2 nach deinem Spieltest (23.10.2026)

Dein Test hat 3 Annahmen aus v1 widerlegt. Details und Studien: [v2/NOTES.md](engagement-lab/v2/NOTES.md). Labor: [Versuch 02](engagement-lab/v2/index.html).

- **Zurückhaltung war falsch.** „Direkt starten“ mit wenig Effekten bekam die schlechteste Wiederspiel-Wertung (2/7). Mehr Bewegung und Ton ist Grundausstattung, keine Variante.
- **Text ist Lärm.** Klarheit lag immer bei 6/7, auch mit vielen Erklärungen. Die Texte haben also nichts verständlicher gemacht, nur das Spiel abgeschwächt.
- **Konfetti pro Wort trägt.** Die Belohnung pro Wort war das Einzige, was den Unterschied gemacht hat. Gewünscht ist sie edler.

### Geänderter Umsetzungsplan für die echte App

1. **Texte streichen** (sofort, klein): Erklärsätze und Statuszeilen in Game-, Review- und Result-Screen entfernen; Icons, Felder, Buttons und Zahlen bleiben.
2. **Eingabe-Feedback** (`GameScreen`): Buchstaben animieren einzeln, fertiges Wort fliegt in den Rundenbuchstaben, Ton pro Anschlag. Gewinner-Material per Blindvergleich in v2 bestimmen.
3. **Musik-Schicht** (neues Modul im Frontend, Web Audio, ohne Assets): startet mit dem Countdown, wächst mit gefüllten Feldern, Stumm-Knopf und Lautstärke dauerhaft gespeichert.
4. **Clear = Farbwechsel**: alle Kategorien gefüllt → Clear-Animation und neue Palette für den Rest der Partie. Rein clientseitig, Server unberührt.
5. **Review in einem Bild**: alle Antworten auf einmal, Punkte zählen live hoch. Für Multiplayer ist das eine Protokolländerung am Review-Ablauf und damit der größte Brocken.
6. **Kürzere Partien**: Standard 3 bis 5 Runden mit klarem Finale und „Nochmal“ als Hauptknopf.
7. **Duell/Sprint als Solo-Modi** erst, wenn 1 bis 6 im echten Spiel getestet sind.

## Iteration 3 nach dem zweiten Spieltest (23.10.2026)

Ergebnis von v2: Musik ist der stärkste Hebel, Animationen bringen Dopamin, der Sprint soll ins Spiel (steht in `AGENT/TODO.md`). Das Design war zu sci-fi, die Materialien zu ähnlich, und getestet wurde fast nur das Schreiben.

v3 (`engagement-lab/v3/`) antwortet darauf mit:

1. **Ganze Partie statt Schreibtest:** Lobby, Buchstaben-Slot, Schreiben mit 3 simulierten Freunden, Bewertung als Show, Rangliste mit Überholen, Podium. Dazu der Sprint mit Combo und Rekord.
2. **3 klar verschiedene Looks** statt 3 ähnlicher Materialien: *Block* (glänzende Candy-Tiles), *Papier* (Notizblock, Textmarker, Stempel), *Pop* (Knallfarben, schwarze Konturen, harte Schatten). Jeder Look hat eigene Schrift, eigene 4 Paletten und eigenen Klang.
3. **Musik als Rückgrat:** eine durchgehende Progression mit Szenen je Phase (96–132 bpm), die mit jedem gesperrten Wort oder Combo eine Schicht dichter wird.
4. **Mobile zuerst:** eine Spalte mit max. 460 px, Tippen über ein unsichtbares Eingabefeld, die Buchstaben erscheinen als Tiles.

Was v3 testen soll: welcher Look, ob die Bewertung als Show Spaß macht statt nach Arbeit aussieht, und ob Rangliste und Podium Lust auf eine weitere Partie machen. Details in `engagement-lab/v3/NOTES.md`.

## Iteration 4 nach dem dritten Spieltest (23.10.2026)

Ergebnis von v3: Block gefällt am besten, ist aber nicht einzigartig. Papier ist schwer lesbar, der Ton zu leise. Gewünscht sind ein Look wie Duolingo (verspielt, rund, sauber, nicht futuristisch), Sofort-STOPP bei Enter auf dem letzten Feld, häufigere Farbwechsel, Vibration und die Funktionen des echten Spiels.

v4 (`engagement-lab/v4/`) antwortet darauf mit:

1. **Ein Look mit Maskottchen:** Der Buchstabe ist ein Spielstein mit Gesicht, der auf alles reagiert. Tiles haben Gewicht und eine 3D-Kante. Dazu Parallaxe, ein Hover-Feedback und ein Feder-Effekt beim Drücken.
2. **Lauter und mit mehr Druck:** Limiter, Kick mit Sub, 16tel-Hi-Hats und eine eigene Hook.
3. **Funktionen des echten Spiels:** Lobby mit Code, QR und Link. Host-Einstellungen, Flammen, Zusammenführen, Solo und später Beitritt. Kommentator, „Letzter Buchstabe“ und Host-Disconnect sind skizziert.
4. **Bewertung als Host oder Spieler umschaltbar.** Ohne Entscheidung dauert sie etwa 1,5 s pro Kategorie.

Details in `engagement-lab/v4/NOTES.md`.
