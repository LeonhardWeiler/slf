Ich würde in etwa in dieser Reihenfolge vorgehen:

### Phase 1 – Architektur festlegen (1 Tag)

Bevor eine einzige React-Komponente entsteht:

* Zustandsdiagramm des Spiels
* Game-State definieren
* WebSocket-Protokoll entwerfen
* Nachrichten mit Zod definieren
* Dokumentation unter `docs/`

Am Ende sollte klar sein:

```
Home
   ↓
Lobby
   ↓
Countdown
   ↓
Playing
   ↓
Waiting
   ↓
Review
   ↓
Round Scoreboard
   ↓
Next Round
   ↓
Endscreen
```

---

# Phase 2 – Shared Package

Jetzt das komplette gemeinsame Protokoll bauen.

```
shared/
└── protocol/
    events.ts
    schemas.ts
    types.ts
```

Darin beispielsweise:

* JoinLobby
* CreateLobby
* LeaveLobby
* LobbyState
* StartGame
* StartRound
* SubmitAnswer
* Buzz
* ReviewNextCategory
* ReviewVote
* RoundFinished
* GameFinished
* Error

Erst wenn dieses Paket steht, mit Backend und Frontend beginnen.

---

# Phase 3 – Backend-Grundgerüst

Jetzt das Go-Projekt.

Noch **keine Spiellogik**.

Nur:

```
main.go

↓

WebSocket

↓

Hub

↓

Rooms

↓

Clients
```

Beispielsweise:

```
cmd/server/main.go

↓

Hub

↓

RoomManager

↓

Room

↓

Clients
```

Jetzt kann man schon testen:

```
Browser 1

↓

Lobby erstellen

↓

Browser 2

↓

Lobby beitreten

↓

Beide erhalten LobbyState
```

Wenn das funktioniert, ist die Netzwerkbasis fertig.

---

# Phase 4 – Frontend-Grundgerüst

Jetzt React.

Noch keine Spiellogik.

Nur:

```
Home

Lobby

404
```

mit

* React Router
* Zustand
* Theme
* Tailwind
* shadcn/ui

Außerdem:

```
WebSocket Provider
```

und

```
Reconnect
```

bereits vorbereiten.

---

# Phase 5 – Lobby

Jetzt die erste vollständige Funktion.

Fertigstellen:

* Lobby erstellen
* Lobby beitreten
* QR-Code
* Host
* Spielerliste
* Kategorien
* Einstellungen

Wenn das fertig ist, kann man bereits mit mehreren Browsern testen.

---

# Phase 6 – Spielzustand

Jetzt kommt die eigentliche Spiellogik.

Im Backend:

```
Room
    ↓
CurrentRound
    ↓
CurrentLetter
    ↓
Timer
    ↓
Answers
```

Jetzt funktionieren:

* Countdown
* Buchstaben ziehen
* Timer
* Eingaben
* Buzzern

---

# Phase 7 – Bewertung

Das ist vermutlich der komplizierteste Teil.

Ich würde zuerst die Datenstruktur entwickeln.

Etwa:

```go
Category

↓

PlayerAnswer

↓

GroupID
```

Wenn zwei Antworten gleich bewertet werden sollen:

```
Tiger
Tiger

↓

Group 1
```

oder

```
Tiger
Tieger

↓

Group 1
```

Dadurch lässt sich die Punkteberechnung später sehr einfach durchführen.

---

# Phase 8 – Punkte

Jetzt erst:

```
ScoreCalculator
```

mit exakt den vier Regeln:

```
0

5

10

20
```

Diese Funktion sollte vollständig unabhängig vom Rest sein und nur Daten erhalten und Punkte zurückgeben.

---

# Phase 9 – Rundenablauf

Jetzt:

```
Review

↓

Scoreboard

↓

Neue Runde

↓

Nächster Buchstabe
```

---

# Phase 10 – Spielende

Zum Schluss:

* letzter Buchstabe
* Endscreen
* Host verlässt Lobby
* Spieler verlässt Lobby
* Reconnect
* automatische Wiederherstellung

---

# Empfohlene Reihenfolge der Commits

```
1. Projekt aufsetzen
2. Shared Protocol
3. WebSocket Server
4. React Grundgerüst
5. Lobby
6. Lobby Synchronisation
7. Countdown
8. Spiel
9. Buzzern
10. Review
11. Punkte
12. Scoreboard
13. Endscreen
14. Reconnect
15. Themes
16. Responsive Design
17. Docker
18. GitLab CI
```
