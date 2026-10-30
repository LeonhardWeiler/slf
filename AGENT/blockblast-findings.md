# Block Blast: Analyse und Übertragung auf slf

Quelle: Bildschirmaufnahme (`~/Downloads/signal-2026-10-25-01-28-13-382.mp4`, 480x854, ~57 fps, 8:50).
Video 2 (Handy, `recording_20261030_002116.mp4`, 1080x2400, ~38 fps, 8:30, **ohne Ton**): 0:00–2:45 slf
im Sprint, ab 2:45 Block Blast mit neuen Themes. Auswertung in Abschnitt 9.
Methode: Frames per `ffmpeg` mit 5–20 fps als Kontaktbögen, Schlüsselframes in voller Auflösung,
Audio als Spektrogramm und RMS-Pegel pro Sekunde. Referenzbilder liegen in `AGENT/blockblast/`.

Legende: **[belegt]** = im Material nachgewiesen, **[Annahme]** = plausibel, aber nicht messbar.

---

## 1. Kernthese

Block Blast ist mechanisch trivial. Die Qualität entsteht aus 4 Schichten, die über jede Aktion gelegt werden:

1. **Material**: Alles sieht anfassbar aus (3D-Ebenen, Highlight, Schatten, Textur). Selbst ein Ziffernblock
   oder ein Zahnrad.
2. **Antwort auf jede Aktion**: Aufnehmen, Halten, Loslassen, Löschen, Punkte – jede hat eine eigene
   Ton-, Bild- und Vibrationsantwort. Nichts passiert stumm.
3. **Eskalation mit Deckel**: Je besser man spielt, desto mehr passiert (Combo-Zahl, Tonhöhe, Herzschlag,
   Callouts, Full-Clear-Stufen x1/x2/x4). Das ist begrenzt, damit es nicht in Lärm kippt.
4. **Kontrast Ruhe ↔ Überflutung**: Die Basis ist extrem ruhig (leise, ziellose Musik, statisches Brett).
   Dadurch wirken die 1–5 s Feuerwerk stark. Ohne die Ruhe wäre das Feuerwerk Rauschen.

Dazu kommt **variable Belohnung**: Man weiß nie genau, welcher Callout, welche Animation oder welcher
Themewechsel kommt.

---

## 2. Visueller Stil („zum Reinbeißen“)

Bilder: `01-logo.jpg`, `03-hud.jpg`, `13-thumb-leather.jpg`, `11-themes.jpg`

### 2.1 Aufbau eines Elements [belegt]
Jedes Element besteht aus übereinanderliegenden Ebenen:
- **Schlagschatten/Unterkante**: dunklere Farbe des Körpers, 3–6 px nach unten versetzt (Logo-Buchstaben,
  Buttons im Menü, Blöcke).
- **Körper** mit leichtem Verlauf (oben heller, unten satter).
- **Glanzlicht** oben links / oben als weiche, helle Kante oder Fleck.
- **Innenschatten** unten innen, gibt Rundung.
- **Textur/Detail** passend zum Material: Kerne bei Melone, Ziernaht bei Leder, Löcher bei Käse,
  Maserung bei Jade.

Schriftzüge („Combo“, „Epic Blast“, „Combo Master“, „Legendary Comeback“) sind immer **2-lagig**:
eine dicke Kontur-/Extrusionsebene hinten und der eigentliche Text leicht nach oben versetzt davor.
Dadurch „schwebt“ der Text näher am Auge. Selbst Gold auf Gold (Käse-Theme) bleibt lesbar, weil Kontur +
Schatten den Kontrast liefern, nicht die Farbe.

### 2.2 Spielfeld [belegt]
- Spielfeld ist eine eingelassene Wanne: dunkler als der Hintergrund, weicher Innenschatten, keine harten
  Kanten, Zellen nur als hauchdünnes Raster.
- Hintergrund hat einen vertikalen Verlauf, der zur Mitte (Spielfeld) hin heller wird – Vignette,
  die den Blick aufs Feld zieht.
- Leere Zellen sind fast schwarz-transparent, volle Zellen sehr gesättigt → maximaler Figur-Grund-Kontrast.

### 2.3 Punktezahl [belegt]
- Groß, mittig, jede Ziffer mit eigenem Regenbogenverlauf (Cyan → Gelb → Pink), der langsam animiert.
- Bei aktiver Combo: hinter der Zahl ein leuchtendes Symbol (Herz, später Raute) mit Glow und Partikeln,
  Zahl selbst wird größer.
- Combo verloren (0:33,75–0:34,75): Herz schrumpft und blendet in ~1 s aus, Zahl wird wieder kleiner.
  Der Verlust wird **gezeigt, nicht bestraft**: kein roter Text, kein Fehlerton.

### 2.4 Konfetti [belegt] (`01-logo.jpg`)
- Rechteckige Schnipsel in sehr unterschiedlichen Größen (Faktor ~5), jeder mit eigener Drehung um
  mehrere Achsen. Dadurch wechselt die sichtbare Fläche und Helligkeit (Vorder-/Rückseite) → wirkt 3D.
- Nahe Schnipsel sind groß und unscharf (Tiefenunschärfe), ferne klein und scharf.
- Abbau: nicht alle gleichzeitig, sondern einzeln nacheinander.

### 2.5 Icons [belegt]
- Krone, Zahnrad, „NEW“-Badge: alle mit Unterkante + Glanz. Das „NEW“-Badge wackelt dauerhaft leicht
  (Neugier-Haken).

---

## 3. Ablauf einer Explosion, Schritt für Schritt (0:09,5–0:12,0)

Bilder: `04-ripple-mark.jpg`, `05-blast-steps.jpg`, `06-blast-combo2.jpg`, `07-epic-blast-counter.jpg`

| Zeit | Was passiert |
|---|---|
| 0:09,50 | Stein wird aufgenommen. Im Fach ist er auf ~50 % verkleinert, beim Aufnehmen springt er auf volle Größe und schwebt über dem Finger (Finger verdeckt ihn nicht). |
| 0:09,60–0:09,90 | Geist-Vorschau an der Zielposition (dunkel). Sobald eine Reihe/Spalte vollständig würde: **Markierungswelle** – die betroffenen Zellen werden reihenweise weiß überblendet, beginnend am Stein, ~65 ms pro Reihe, danach wieder zurück. Nicht synchron, sondern als Welle (`04-ripple-mark.jpg`). |
| 0:09,95 | Loslassen. Die gelöschten Zellen „zerbrechen“: jede Zelle zerfällt in Material-Stücke (Melonenscheiben). |
| 0:10,00–0:10,15 | Stücke fliegen rotierend nach außen/oben, dazu Kerne und Saftkugeln. Wellenförmig vom platzierten Stein weg. Gleichzeitig erscheinen weiße `+1` auf jeder gelöschten Zelle. |
| 0:10,15–0:10,30 | Saftkugeln fallen, auf den leeren Zellen bleiben dunkelrote **Saftflecken** (Decals) kurz liegen. Weiße Funkelsterne. |
| 0:10,30 | „Combo“ erscheint klein und wächst (Scale-in mit Überschwingen). |
| 0:10,45 | `+1`-Punkte fliegen nacheinander (gestaffelt) nach oben zur Punktezahl. |
| 0:10,60 | Spielfeldrahmen leuchtet gold, goldene Blattpartikel am Rand. Über „Combo“ steht `+468` in Gold. Punktezahl hat Glow + Lichtring. |
| 0:10,90 | `+468` fliegt nach oben zur Punktezahl. |
| 0:11,00–0:12,40 | Punktezahl zählt hoch, ~230–300 Punkte/s, unabhängig davon, dass schon weitergespielt wird. |
| 0:12,50 | Alle 3 Steine verbraucht → 3 neue wachsen aus grünen Glühpunkten (~0,4 s). |

### Combo 2 / „Epic Blast“ (0:14,1–0:16,5) [belegt]
- Zuerst Zellen zu Scheiben, dann Saftkugeln (gleiches Muster).
- 0:14,42: **goldener Sonnen-Burst** an der Stelle, wo gleich die Combo-Zahl steht, *bevor* der Text kommt
  (Vorankündigung der Belohnung).
- 0:14,50: „Combo 2“, die 2 mit goldenem Strahlenkranz.
- 0:14,70: „Epic Blast“ in Grün darunter, bleibt ~1,7 s stehen, während weitergespielt wird.
- `+1683` fliegt zur Punktezahl. Zählung läuft dann in **größeren Schritten bei gleichem Tempo**.
- 0:15,90: Punktezahl flackert zwischen Zielwert (2169) und aktuellem Zwischenstand (`07-...jpg`).
- Platzierte Steine tragen `+1` auf jeder ihrer Zellen.

### Neue Beobachtungen, die nicht in der Beschreibung standen
- **Ladeszene**: Beim Laden des Spiels füllt sich das Brett 1 Frame komplett und gibt dann den
  gespeicherten Stand frei (0:02,0–0:02,6, `02-load-reveal.jpg`). Wirkt wie „aufgedeckt“.
- **Saftflecken bleiben kurz** auf leeren Zellen liegen → die Explosion hat ein Nachbild.
- **Sonnen-Burst vor dem Combo-Text** → Erwartung wird aufgebaut, Text löst sie ein.
- **Settings pausieren die Musik komplett** (Spektrogramm 0:05,3–0:06,6 ist stumm). Menü = Pause, auch akustisch.
- **Settings-Popup** übernimmt die Farbe des aktuellen Themes.
- **Endscreen zeigt nicht die Punktezahl, sondern den besten Combo** dieses Spiels und den Allzeit-Combo
  (siehe 6). Das Spiel endet mit einer Erfolgsmeldung.
- **Kein „Game Over“-Text**, nirgends.
- **Themewechsel versteckt sich hinter dem Höhepunkt**: der Hintergrund springt in genau dem Frame um, in dem
  der Lichtblitz am stärksten ist (0:56,4; 1:22,6; 4:30,2). Kein Überblenden nötig.
- **Bildschirmwackeln** beim 2. Full Clear: der ganze Frame ist um einige Pixel verschoben (schwarzer Rand
  oben in `09-fullclear-sss.jpg`, 1:22,25).

---

## 4. Full Clears (Brett komplett leer)

Bilder: `08-fullclear-x1.jpg`, `09-fullclear-sss.jpg`, `10-fullclear-x4-heart.jpg`

### x1 (0:55,8–1:00,5, ~4,7 s) [belegt]
1. Letzte Reihen explodieren wie gewohnt.
2. 0:56,0: Lichtsäulen fallen von oben, Party-Kanonen (Tüten) links/rechts schießen Konfetti.
3. 2 Figuren („Block“ lila mit Krone, „Blast“ rot) stürzen tollpatschig von der Seite herein und bilden mit
   ihren Körpern „X“ und „1“. Sie haben nur 2–3 Posen als Einzelbilder, die hart wechseln (Comic-Stil).
4. 0:56,2: Brett füllt sich mit bunten **Classic-Blöcken** (Regenbogenfarben), 3D-Würfel fliegen rotierend
   durchs Bild.
5. 0:56,4: Hintergrund springt grün → petrol (neues Theme). Lichterkette (Punkte) um den Rahmen erscheint.
6. 0:56,6–0:57,8: Brett füllt sich von oben nach unten mit Melonenblöcken des alten Themes, die dann nach oben
   aus dem Brett **in die Punktezahl gesaugt** werden. Spotlight-Kegel über der Punktezahl öffnet sich.
7. Punkte zählen hoch (`+819`).
8. 0:58,0: Spieler spielt bereits weiter, Figuren stehen noch. 0:58,6: Figuren weg.
9. Lichterkette bleibt bis ~1:00,5 und leuchtet am Ende noch einmal auf (Nachklang).

### x2 (1:22,0–1:24,5) [belegt]
- Großes goldenes **„S“** knallt (aus übergroß) ins Bild, Bildschirm wackelt.
- Das S teilt sich in **„SSS“** auf goldener Raute, Comic-Burst dahinter.
- Herz hinter der Punktezahl wird zur **Raute**.
- Stimme jetzt hoch und kindlich statt tief und männlich.
- Alles aus x1 zusätzlich (Figuren, Blöcke, Konfetti).
- Theme: lila Gelee → Jade auf grünem Marmor.
- Weiterspielen läuft parallel; nächster Full Clear schon bei 1:26,8.

### x4 (6:16,4–6:19,4) [belegt]
- Riesiges pinkes Herz in der Brettmitte, ein Herz-Umriss wächst über den ganzen Bildschirm hinaus.
- Rest wie x1/x2. Käse → Melone.

**Prinzip**: Jede Stufe enthält alles der vorigen plus ein neues Hauptelement (Figuren → S/SSS → Riesenherz).

---

## 5. Themes

Bilder: `11-themes.jpg`, `12-theme-overview.jpg` (1 Frame alle 10 s)

| Zeit | Block-Material | Hintergrund | Explosion | Symbol hinter Punkten |
|---|---|---|---|---|
| 0:00–0:56 | Melone (rot, Kerne, weiße Rinde) | Grün | Scheiben, Kerne, Saftflecken | Herz (cyan) |
| 0:56–1:22 | Lila Gelee/Glas | Petrol | Neon-Lichtsäule pro Linie mit Funken | Herz (rot) |
| 1:22–1:27 | Jade, matt-milchig | Grüner Marmor | Weißer Staub/Splitter | Raute (grün) |
| 1:27–4:30 | Leder-Kissen mit Ziernaht, **jedes Teil eigene Farbe** | Beige, Brett dunkelbraun | Bunte Splitter | Herz (orange) |
| 4:30–6:16 | Käse mit Löchern | Ocker/Braun | Goldene Krümel | Herz (pink) |
| 6:16–Ende | Melone | Grün | wie oben | Herz |

- Wechsel bei jedem Full Clear **oder** beim ersten normalen Clear, wenn der letzte Wechsel ~3 min her ist
  [belegt in 2 Fällen: Video 1 1:27 → 4:30, Video 2 4:56 → 7:57, siehe 9].
- Beim Wechsel werden auch **die schon liegenden Blöcke sofort umgeskinnt** (4:30,2).
- Jedes Theme hat eine eigene Löschanimation, aber die gleiche Choreografie (zerbrechen → Partikel →
  Nachbild → Punkte fliegen).
- Themes sind Materialien/Lebensmittel, nicht nur Farbpaletten. Das macht sie „anfassbar“.

---

## 6. Callouts und Belohnungsleiter

Bilder: `14-combo-master.jpg`, `15-legendary-comeback.jpg`, `13-thumb-leather.jpg`, `16-endscreen.jpg`

Gesehene Callouts: „Combo n“, „Good“, „Great“, „Epic Blast“, „Perfect!“ (2:10), „Unbelievable“ (Full Clear),
„Combo Master“ (4:43), „Legendary Comeback“ (4:08, 8:20).

- **„Legendary Comeback“**: Buchstaben fliegen einzeln auseinander gezogen herein und schließen sich,
  mit Krone und Lorbeer-Flügeln, ~2 s. Wird offenbar ausgelöst, wenn man sich aus fast vollem Brett rettet
  → belohnt nicht nur Können, sondern auch **Drama**.
- **„Combo Master“**: Krone fliegt von ganz nah (bildschirmfüllend, unscharf) auf ihre kleine Position –
  Tiefe durch Skalierung.
- **Daumen hoch (4:15)**: Statt normalem Platzieren erscheinen auf jeder Zelle Holz-Badges mit Daumen und
  `+1` vor goldenem Strahlenkranz, mit eigenem Ton. Seltene Variante einer Routineaktion → Überraschung.
- **Stimme** sagt die großen Callouts. Tief, ruhig, stolz bei x1; kindlich hoch bei x2. Die Stimme ist der
  **Anker** im Chaos – das Auge kann nicht alles erfassen, das Ohr bekommt eine klare Botschaft.
- **Endscreen (8:44–8:50)**: Dimmen + 5-s-Countdown-Ring „Revive“ (Werbung), dann warmer Bühnenhintergrund
  mit Spotlights, „Combo Master“ mit Krone, „Combo 6 → 24“ zählt hoch, „All Time Combo 67“, Play-Button.
  0,5 s nach Tap läuft das neue Spiel. Keine Hürde zum Weiterspielen.

---

## 7. Audio

Bilder: `17-sfx-spectrum.jpg` (0:09–0:34), `18-music-spectrum.jpg` (ruhige Passage 1:48–1:55)

### 7.1 Musik [belegt]
- Pegel ~-40 dBFS RMS, Effekte -15 bis -25 dBFS → **Effekte 15–25 dB lauter**. Musik ist Tapete.
- Klavier-/Glockentöne im Bereich ~550–1600 Hz, **lange Ausklänge (2–4 s)**, neuer Ton nur alle ~1,5–3 s.
- Gelegentlich ein tiefer Ton (~250–300 Hz) als Ruhepol.
- **Echte Pausen**: 0:21,2–0:23,3 fast stumm.
- **Kein Schlagzeug, keine Bassline, kein Puls, kein Groove.** Keine erkennbare Taktzählung.
- 30-s-Loop: im gemischten Mono-Signal nicht sauber nachweisbar [Annahme, passt aber zum Bild].
- Ducking bei Explosionen: nicht messbar, weil Musik und Effekte gemischt sind [Annahme].

### 7.2 Effekte [belegt]
- **Platzieren**: kurzer, trockener Klick-Transient mit kleinem tonalen Körper (~400–600 Hz).
- **Explosion** besteht aus 4 Lagen:
  1. Rausch-Crunch (breitbandig, kurz),
  2. tonaler Glocken-Doppelton (~350 + 420 Hz),
  3. aufsteigende Obertöne 2–5 kHz („Glitzer-Arpeggio“),
  4. 0,5–0,8 s später ein gebogener Swoop (Punkte fliegen zur Anzeige).
- Ladesound: aufsteigendes Glissando (0:01,5 und 0:07,5 sichtbar als steile Linie).
- Explosion ersetzt den Platzierton (nie beides gleichzeitig) [laut Beschreibung, im Spektrogramm konsistent].
- Steigende Tonhöhe mit Combo bis zu einem Deckel: nicht sicher messbar [Annahme, laut Beschreibung].
- Haptik am Handy bei Platzieren/Explosion [laut Beschreibung].

---

## 8. Übertragung auf slf

### 8.1 Zuordnung der Momente

| Block Blast | slf-Entsprechung |
|---|---|
| Stein aufnehmen | Fokus in ein Kategoriefeld |
| Vorschau-Markierungswelle | Wort wird während des Tippens gültig (Live-Check aus `answerValidation.ts`) |
| Stein platzieren | Gültiges Wort abgeschlossen (Feld verlassen) |
| Linie löschen | Kategorie fertig |
| Combo | Mehrere gültige Wörter hintereinander ohne lange Pause / ohne Fehler |
| Full Clear | Alle Kategorien gefüllt; im Ergebnis: „alles einzigartig“, Rundensieg |
| Punktezahl zählt hoch | Rundenergebnis, Punkte pro Antwort fliegen zur Summe |
| Herz hinter Punktezahl | Siegesserie über Runden (Herz → Raute → Krone) |
| Theme-Wechsel | Neue Runde (`worldFor(seed, round)` existiert schon) |
| Legendary Comeback | Von Platz letzter auf Platz 1 in einer Runde |
| Endscreen „Combo Master“ | Game Over zeigt die beste Leistung (bestes Wort, längste Serie), nicht nur die Platzierung |

Achtung: slf ist ein Tipp-Spiel. **Während des Tippens** darf nichts den Fokus oder den Blick stören
(vgl. TODO: Fokus fliegt aus dem Input). Große Effekte gehören an **Übergänge** (Stop, Review → Ergebnis,
Rundenende). Während der Runde nur kleine, lokale Antworten am Feld.

### 8.2 Musik (höchste Priorität, kleinster Aufwand)
Heute: `sound.ts` ist ein Sequencer mit `bpm`, Kick (`tone(95…glide)`), Hi-Hats (`noise` 9–10 kHz) und
`pulse/hat`-Stufen pro Szene. Genau das ist der zu starke Rhythmus.

Empfehlung: Den Sequencer durch einen **ambienten Generator** ersetzen:
- Kick, Hats und Puls ersatzlos streichen; `SCENES` steuert nur noch Dichte, Register und Helligkeit.
- Zufällige Töne aus einer pentatonischen Skala über einem langsam wechselnden Akkord (alle ~8–15 s).
- Klavier/Glocke mit langem Release (2–4 s), weicher Attack, Hall per `ConvolverNode` mit generierter
  Rausch-Impulsantwort.
- Abstand zwischen Tönen zufällig 1,5–3 s, gelegentliche Pausen von 2–4 s.
- Alle ~30 s ein tiefer Ton als Ruhepol.
- Musik ~15–20 dB unter den Effekten mischen.
- Bei großen Momenten Musik kurz absenken (Ducking über `section`-Gain).
- Musik pausiert, solange ein Menü/Dialog offen ist.

### 8.3 Material-Stil (Kontrast gegen „dull“)
Ein gemeinsames Rezept in `index.css` für Btn, Tiles, Av, Mascot, Score:
- Unterkante: `box-shadow: 0 4px 0 <dunklere Körperfarbe>`,
- Körperverlauf oben hell → unten satt,
- Glanz: `inset 0 2px 0 rgb(255 255 255 / .5)` plus weicher heller Fleck oben (Pseudo-Element),
- Innenschatten unten,
- Schlagschatten weich nach unten.
- Hintergrund: radialer Verlauf, zur Mitte heller; Inhaltsfläche als eingelassene Wanne.
- Überschriften/Callouts 2-lagig: dicke dunkle Kontur hinten (`-webkit-text-stroke` auf einer
  Kopie bzw. `paint-order: stroke`), Text davor leicht nach oben versetzt.
- Punktezahl mit animiertem Regenbogenverlauf pro Ziffer (`background-clip: text`).

### 8.4 Partikel (`fx.ts`)
- Konfetti: Größen stärker streuen (Faktor 5), 3D-Drehung durch Skalieren einer Achse mit `cos(phase)`
  und Helligkeitswechsel Vorder-/Rückseite, große Teile leicht unscharf.
- Abbau gestaffelt statt gleichzeitig.
- Pro World eigene Partikelform (Material-Splitter statt nur Farbquadrate).
- Kurzes Nachbild (Flecken/Glitzer), das 0,5–1 s liegen bleibt.

### 8.5 Während der Runde (klein, lokal)
- Wort wird gültig: Feld bekommt eine kurze Welle über die Buchstaben-Kacheln (gestaffelt ~40–65 ms
  pro Buchstabe, leicht zufällig versetzt) und einen weichen Ton.
- Kategorie fertig: Feld „zerbricht“ in 6–10 Partikel am Feldrand, `+n` fliegt zur Kopfzeile.
- Serie gültiger Wörter: Tonhöhe der Bestätigung steigt pro Wort einen Skalenschritt, gedeckelt nach ~6.
- Selten (z. B. 1 von 8) eine Variante des Bestätigungstons/-bilds → Überraschung.

### 8.6 Übergänge (groß)
- **Rundenergebnis**: Punkte pro Antwort fliegen gestaffelt zur Summe, Summe zählt in festem Tempo hoch
  und flackert zwischen Ziel- und Zwischenwert.
- Vor großen Texten ein Burst an der Zielstelle (Vorankündigung), dann Scale-in mit Überschwingen.
- **Eskalationsleiter** für besondere Runden: Stufe 1 Konfetti + Callout, Stufe 2 + Maskottchen-Auftritt
  + Wackeln, Stufe 3 + bildschirmfüllendes Symbol. Jede Stufe enthält die vorige.
- **Weltwechsel auf dem Höhepunkt** des Blitzes, nicht als Überblendung.
- Nachklang: Rahmen leuchtet am Ende noch einmal auf, dann Ruhe.
- Nie Eingabe blockieren; Animationen laufen parallel.

### 8.7 Callouts
- Pool je Stufe („Gut“, „Stark“, „Episch“, „Unglaublich“, „Comeback!“) mit Zufallsauswahl.
- Stimme ist der stärkste Anker, aber teuer: aufgenommene Samples (2 Stimmen: tief/ruhig und
  hoch/kindlich). `speechSynthesis` klingt zu billig und ist nicht zu empfehlen.

### 8.8 Worlds statt Paletten
Heute: 2 Worlds (`candy`, `rubber`) mit Farbpaletten. Block Blast zeigt: der Reiz entsteht durch
**Materialien** (Melone, Gelee, Jade, Leder, Käse), jeweils mit eigener Textur, eigener Löschanimation
und eigenem Symbol. Ausbau: pro World Kachel-Textur (CSS-Verlauf/Muster, keine Bilder nötig),
Partikelform und Timbre.

### 8.9 Game Over
- Zuerst die beste persönliche Leistung zeigen (bestes Wort, meiste einzigartige Antworten, längste
  Serie), Platzierung danach.
- Bühnen-Look mit Spotlights, Zahlen zählen hoch.
- „Nochmal“ mit 1 Tap, sofort in die Lobby.

### 8.10 Empfohlene Reihenfolge
1. Musik auf Ambient umbauen (8.2) – größter Effekt, wenig Code, nur `sound.ts`.
2. Material-Rezept für Kit-Komponenten und Punktezahl (8.3).
3. Rundenergebnis mit fliegenden Punkten, Zähler, Eskalationsleiter (8.6).
4. Konfetti/Partikel überarbeiten (8.4).
5. Kleine Antworten während der Runde (8.5), erst nach dem Fokus-Fix aus der TODO.
6. Material-Worlds (8.8), Callout-Stimmen (8.7) – teuerster Teil, zuletzt.

### 8.11 Grenzen
- slf ist ein Wortspiel, kein Puzzle mit 1 s Takt. Belohnungen kommen seltener; die Ruhephasen sind
  länger. Das ist gut für den Kontrast, verlangt aber, dass jeder Höhepunkt stark ist.
- Multiplayer: Effekte, die von anderen Spielern ausgelöst werden, dürfen nur dezent sein.
- `prefers-reduced-motion` und Stumm/Musik-aus müssen alle neuen Ebenen abschalten.
- Performance: viele gleichzeitige Partikel auf schwachen Handys testen.

---

## 9. Video 2: neue Themes, Fluffy, slf im Vergleich

Bilder: `20-…` bis `28-…` in `AGENT/blockblast/`. Kein Ton in der Aufnahme, Audio-Fragen aus 7 bleiben offen.

### 9.1 Neue Themes [belegt]

| Zeit | Block-Material | Hintergrund / Brett | Explosion |
|---|---|---|---|
| 3:27–4:29 | Default: blaue Fasen-Blöcke (2 Blautöne), harte Lichtkante oben, dunkle unten | Blauviolett / Nachtblau | Blaue Lichtsäule pro Linie mit Funken |
| 4:29–4:34 | Pinke, weiche Würfel | Violett, Lichterkette | Ein Lichtkomet läuft die Reihe entlang, Würfel springen als kleine rosa Würfel heraus und taumeln |
| 4:34–4:38 | Goldbarren | Ocker, Brett fast schwarz | Gold-Funken |
| 4:38–4:54 | Ziegel (Mauerwerk-Muster) | Himmelblau | Aus jedem Ziegel springt eine sich drehende **Goldmünze** (wie Mario), dazu Ziegelbrösel |
| 7:57– | **Fluffy**: Fell/Plüsch, 2 Blautöne | Hellbraune Fellstruktur, Brett dunkles Holz mit erhabenem Holzrahmen | Siehe 9.2 |

- 4:29, 4:34, 4:38: **3 Full Clears in 10 s** (x1, x2, x3), jedes Mal ein neues Theme. Die Eskalation
  zählt sichtbar mit.
- 4:54: Der Spieler wählt im Menü „Default Skin“ → zurück auf Blau. 7:57: automatischer Wechsel zu Fluffy,
  genau ~3 min später, bei einem normalen Clear (Combo 8).

### 9.2 Fluffy im Detail [belegt] (`22-fluffy.jpg`, `23-fluffy-blast.jpg`, `24-fluffy-switch.jpg`)
- **Alles hat dasselbe Material**: Blöcke, Hintergrund (Fell), sogar das **Herz hinter der Punktezahl ist
  aus Fell**. Die `+1086`-Schrift ist hellbraun mit dunkler Kontur, passend zum Holz.
- Farben bleiben beim Wechsel erhalten: Die blauen Blöcke bleiben blau, nur das Material wird von
  Fase zu Fell (`24-…`). **Die Farbe gehört zum Stein, das Theme ist nur die Haut darüber.**
- Der Wechsel ist ein harter Schnitt in 1 Frame (7:57,23) im Moment des Clears. Das Herz erscheint groß
  und setzt sich dann.
- **Explosion ist leise**: Zellen schrumpfen zu kleinen dunklen Quadraten, dann bleibt ein weicher
  Fell-/Staubschleier über der Reihe, der ausblendet. Keine Spritzer, keine Münzen. Das Material
  bestimmt die Lautstärke der Animation: Fell = weich, Melone = saftig, Ziegel = klimpernd.
- Wirkung: warm, ruhig, gemütlich. Dunkles Holz + helles Fell + gesättigtes Blau = 3 klar getrennte
  Helligkeitsstufen trotz weicher Optik.

### 9.3 Weitere neue Beobachtungen [belegt]
- **Vorschau färbt um**: Beim Ziehen nehmen die Zellen der Reihen, die gelöscht würden, **die Farbe des
  gezogenen Steins** an (8:01,07, `23-…`). Zusätzlich zur Welle aus Video 1.
- **Ziel-Umriss**: Wo der Stein landen würde, sind die leeren Zellen mit hellem Rahmen umrandet
  (4:42,3, `25-…`).
- **Combo-Ankündigung**: Vor „Combo 11“ blitzt an der Stelle der Zahl eine weiße Lichtkugel auf
  (4:42,7). Gleiches Muster wie der Goldburst in Video 1.
- **Neues Spiel startet mit vorgefülltem Brett** (~60 % voll, zufälliges Muster, 3:27 und Video 1 0:08).
  Die ersten Züge räumen sofort Reihen ab, **die erste Belohnung kommt nach Sekunden**.
- Beim Laden erscheint das Brett kurz im bunten Classic-Skin und springt dann ins aktive Theme.
- Werbebanner unten dauerhaft, Vollbildwerbung bei 8:10. Das stört deutlich; die Qualität des Spiels
  wirkt trotzdem.

### 9.4 slf im Vergleich (0:00–2:45, Sprint) (`27-slf-vs-bb.jpg`, `28-slf-word-accept.jpg`)

**Was slf schon gut macht**
- Maskottchen mit Glanzlicht und Schatten, Countdown „3, 2, 1“ mit Gesichtsausdruck.
- Buchstabenkacheln mit Unterkante, Punktebadges, Konfetti beim Rekord („NEU!“).
- Punktezahl zählt beim Tippen pro Buchstabe hoch (75, 100, 125 …).

**Was fehlt (direkt sichtbar)**
1. **Zu wenig Helligkeitsstufen**: Pinker heller Hintergrund, weiße Karten, helle Blasen → alles im
   oberen Helligkeitsbereich. Block Blast hat immer 3 Stufen: mittlerer Hintergrund, dunkle eingelassene
   Fläche, gesättigte Elemente darauf. Das ist der Hauptgrund für „dull“.
2. **Punktezahl ist Nebensache**: `4350` dunkel, klein, neben dem Maskottchen. Bei Block Blast ist die
   Zahl das größte, bunteste Element mit Symbol dahinter.
3. **Wort bestätigt (0:37,2)**: Die Karte rutscht in die Liste, die Zahl springt von 175 auf 425,
   ein paar kleine flache Punkte. Es fehlen: `+250` fliegt zur Zahl, Zahl zählt hoch, kurzer
   Lichtimpuls am Badge, eine Welle über die Buchstaben.
4. **Konfetti** (2:38): kleine, flache, gleich große Kreise. Bei Block Blast: Rechtecke in sehr
   unterschiedlichen Größen, die sich in 3D drehen.
5. **Kacheln haben kein Glanzlicht** und keine Materialtextur, nur die Unterkante.
6. **Hintergrund-Blasen** sind groß und hell, konkurrieren mit dem Inhalt. Block Blast: ruhiger Verlauf
   bzw. feine Textur, zur Mitte heller.

### 9.5 Ergänzungen zu Abschnitt 8
- **Worlds = Haut über fester Farbe** (8.8): Kachelfarben pro Buchstabe/Spieler bleiben, die World
  tauscht nur Material, Hintergrund, Partikel und das Symbol hinter der Punktezahl. Das passt zu
  `feel.ts` (Palette und World sind schon getrennt).
- **Fluffy als erste Material-World**: Fell lässt sich mit CSS-Rauschen (SVG `feTurbulence` als
  Hintergrundbild) plus weichem Verlauf bauen, Holz mit einem gestreiften Verlauf. Explosion: leiser
  Staubschleier, passend zur gewünschten ruhigen Musik.
- **Material bestimmt die Lautstärke**: Jede World bekommt eine eigene „Explosionsenergie“ (weich bis
  laut). So entsteht Abwechslung ohne mehr Effekte.
- **Weltwechsel-Takt**: neue World bei besonderen Momenten, sonst spätestens nach ~3 min beim nächsten
  positiven Ereignis. Nicht pro Runde, sonst nutzt sich der Wechsel ab.
- **Schneller erster Erfolg** (wie das vorgefüllte Brett): Die erste Runde soll in den ersten Sekunden
  eine Belohnung liefern, z. B. einen leichten Buchstaben oder eine Bestätigung schon beim ersten Wort.
- **Vorschau vor dem Abschluss**: Wenn ein Wort beim Tippen gültig wird, die Kacheln schon in die
  Bestätigungsfarbe umfärben (wie die umgefärbten Reihen), bevor das Feld verlassen wird.
