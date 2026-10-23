# Versuch 02: was sich nach deinem Spieltest geändert hat

Grundlage: `slf-spieltest-2026-10-23.json` (3 bewertete Durchgänge, Szenario „Einstieg“).

## Was der Test gezeigt hat

| Variante | Spaß | Nochmal | Kernaussage |
|---|---|---|---|
| Direkt starten | 3 | 2 | Viel langweiliger, kaum Musik, kaum Animation. „Es soll die ganze Zeit was passieren.“ |
| 5-Runden-Mission | 3 | 4 | Mehr los, aber der Name „Stadt Land Flow“ ist peinlich, Kommentare wie „Inhalt wird gemeinsam geprüft“ oder „vier kleine Treffer“ stören. |
| Gemeinsames Ziel | 4 | 4 | Bisher am besten, wegen Konfetti pro Wort. Lieber ein edleres, polierteres Highlight. Viel zu viel Text: Icons, Eingabefelder und Buttons reichen. |

Klarheit war immer 6/7. Das Problem war also nie das Verstehen, sondern das Gefühl. Ich habe v1 zu vorsichtig gebaut und zu viel erklärt.

## Entscheidungen für v2

1. **Fast kein Text.** Keine Erklärsätze, keine Kommentare, keine Phasentitel. Kategorien als Icon plus kurzes Label, Fortschritt als 4 Rauten, Punkte als Zahl. Der einzige Hinweis in der Auswertung ist `✓ / ×`.
2. **Echter Name, kein Wortspiel.** „Stadt Land Fluss“, Logo `slf`.
3. **Jeder Tastendruck tut etwas.** Neue Buchstaben springen einzeln ins Feld, der große Buchstabe gibt nach, der Hintergrund schwingt mit, jeder Anschlag spielt einen Ton, der zur Musik passt und mit der Wortlänge steigt.
4. **Edles Highlight statt Konfetti.** Ein fertiges Wort fliegt als Schriftzug in den großen Buchstaben und löst dort einen Ring aus. Drei Materialien zum Vergleichen: *Licht* (leuchtender Strich), *Prägung* (schwerer, physischer Schlag), *Impuls* (stärkste Welle).
5. **Musik von Anfang an, die mit dir wächst.** Generative Musik ab „Spielen“. Ab 2 gültigen Feldern wird sie dichter, ab 3 kommt ein Glanzton dazu, bei 4/4 ein aufsteigender Akkord. Im Duell-Endspurt und im Sprint ist sie schneller.
6. **Block-Blast-Moment.** Alle 4 Felder voll → Clear-Animation am Buchstaben, Farbwelt wechselt (5 Paletten). Die neue Farbe bleibt, bis zum nächsten Clear.
7. **Druck, ohne Countdown-Stress am Anfang.** Duell: ein Bot füllt sichtbar seine Felder; sobald er fertig ist, bleiben dir 5 Sekunden. Er wird pro Runde schneller. Sprint: 45 Sekunden, ein Wort nach dem anderen, alle 4 Wörter wechselt der Buchstabe.
8. **Auswertung ohne Arbeitsgefühl.** Alle Antworten auf einmal, Punkte pro Zeile, Antippen kippt gültig/ungültig, Summe zählt sofort mit.
9. **Kurzes Match.** 3 Runden, danach Ergebnis, Bestwert und dein Wort der Partie. „Nochmal“ ist der größte Knopf.

## Studien, auf die sich das stützt

- Hicks et al., *Juicy Game Design*, CHI PLAY 2019: visuelle Verzierungen ohne spielmechanischen Nutzen verbessern das erlebte Spielgefühl, wenn sie an Handlungen gekoppelt sind. → Effekte nur als Antwort auf eine Eingabe, nie als Dauerberieselung.
- Kao, *The effects of juiciness in an action RPG*, Entertainment Computing 2020: mehr Juice hilft bis zu einem Punkt, extremes Juice bringt nichts mehr dazu. → 3 Materialien in unterschiedlicher Stärke statt eines Maximums.
- Ryan, Rigby & Przybylski 2006, Selbstbestimmungstheorie im Spiel: Kompetenz, Autonomie und Verbundenheit sagen Spaß und Wiederspielen vorher. → Gefühl „ich war gut“ (Wort fliegt in den Buchstaben), freie Moduswahl, Duell statt reiner Pflichtrunde.
- Csikszentmihalyi, Flow: klare Ziele, sofortiges Feedback, Herausforderung passend zum Können. → 4 sichtbare Ziele pro Runde, Bot passt sich über die Runden an, kein Leerlauf zwischen den Runden.
- Nacke, Grimshaw & Lindley 2010, Sound und Musik im FPS: Ton und Musik erhöhen positive Gefühle und Immersion messbar. → Musik ist Grundausstattung, kein Extra.

## Was noch offen ist

- Ob die Musik nach 3 Partien nervt. Darum Lautstärke und Stumm-Knopf.
- Welches Material am besten ist: dafür der Blindvergleich unter „Vergleichen“.
- Multiplayer mit echten Menschen: das Duell ersetzt ihn nur als Druckquelle, nicht als soziales Erlebnis.
