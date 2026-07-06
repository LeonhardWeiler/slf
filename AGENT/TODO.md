## Microinteraction-Ideen (Vorschläge)

1. **Lobbycode kopieren** – beim Kopieren kurz ein Häkchen über dem Code
   einblenden + Code leicht „aufpoppen" (scale 1→1.03→1) statt nur Textwechsel
   darunter. Gleiches Feedback für Ctrl+C.

2. **Buchstaben-Toggle** – beim Aktivieren/Deaktivieren eines Buchstabens ein
   kleiner Pop (scale) und weiche Deckkraft-/Durchstreich-Transition, statt
   hartem Umschalten. Aktuell nur `transition-colors`.

3. **Spielerliste** – neu beitretende Spieler mit fade/slide-in einblenden,
   verlassende ausblenden (statt hartem Ein-/Ausspringen). Der Verbindungspunkt
   wechselt seine Farbe weich (grau↔grün) mit kurzem Pulsieren bei „verbindet".

4. **„Spiel starten"** – dezenter Hover-Lift (translateY/scale) + kurze
   Press-Animation; ist der Button disabled, den Grundtext beim Klickversuch
   kurz shaken/aufblitzen lassen.

5. **Switch-Thumb** – leichte Feder-/Overshoot-Bewegung beim Umschalten statt
   linearem Slide; optional ein kurzes Aufleuchten der Bahn.

6. **Zeitlimit-/Buchstaben-Auswahl** – ausgewählte Option mit kurzem Scale-Pop
   bestätigen; „Alle aktivieren" lässt alle Buchstaben gestaffelt (stagger)
   zurückploppen.

7. **QR-Popup** – Panel mit scale+fade öffnen (Backdrop hat bereits fade-in),
   beim Schließen sanft ausblenden.

8. **Toaster** – Toasts mit slide-in (leichter Bounce) statt hartem Erscheinen;
   Auto-Dismiss mit dünnem Fortschrittsbalken.

9. **Countdown** – zur bestehenden `countdown-pop` einen Farb-/Ring-Fortschritt
   ergänzen; letzter Tick („Los!") mit stärkerem Puls.

10. **Antwort-Eingabe (Spielscreen)** – pro ausgefüllter Kategorie ein Häkchen
    animieren; ein Mini-Fortschrittsbalken zeigt, wie viele Felder befüllt sind.

11. **Ergebnis/Ranking** – Punkte per Count-up hochzählen, Platzierungen
    gestaffelt einsortieren; Flammen-Treffer mit kurzem Flacker-/Glow-Effekt.

12. **Kategorie hinzufügen** – die neu angelegte Kategorie beim Erscheinen kurz
    hervorheben (Highlight-Flash), damit klar ist, was dazukam.

13. Es ist noch bei den buttons eine im dark mode dunkle, aber nicht so dunkle wie die background farbe border da. Die ist da, wenn die fillcolor weiß und wenn sie dunkel ist, aber es soll nur angezeigt werden, wenn die fill color dunktler ist, wenn du verstesthst was ich mein. Das ist beim zeitlimit, switches und buchstaben

14. Bei den buchstaben soll doch obendrüber Buchstaben stehen, also in der gleichen zeile wie 26 von 26 aktiv

15. Kannst du bei den anderen sachen auch die tooltips hinzufügen, nicht nur beim ersten und kannst du die breite von den tooltips größer machen.
