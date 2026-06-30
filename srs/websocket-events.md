1. **9.13 Client → Server Events (Teil 1)** – Lobby, Reconnect, Einstellungen, Kategorien, Spielverwaltung
2. **9.14 Client → Server Events (Teil 2)** – Antworten, Buzz, Bewertung, Navigation, Spielende
3. **9.15 Server → Client Events (Teil 1)** – Zustände, Lobby, Spieler, Countdown, Runde
4. **9.16 Server → Client Events (Teil 2)** – Bewertung, Punkte, Ranglisten, Fehler, Reconnect
5. Danach folgen die **Datenmodelle**, **Zustandsmaschine** und **Fehlercodes**.

# 9.13 Client → Server Events (Teil 1)

## 9.13.1 Grundprinzip

Client → Server Events repräsentieren **alle Aktionen eines Spielers**.

Der Server ist die einzige Instanz, die diese Events verarbeitet.

Jedes Event wird strikt validiert und kann abhängig vom aktuellen Spielzustand akzeptiert oder verworfen werden.

Alle Events sind zustandsabhängig (state-aware).

---

## 9.13.2 Event-Struktur (einheitlich)

Alle Client → Server Nachrichten folgen dem gleichen Schema:

```ts id="evt_base"
{
  type: string,
  payload: unknown,
  sessionId: string
}
```

### sessionId

* wird vom Server erzeugt
* identifiziert eindeutig einen Spieler
* ist erforderlich für jede Client → Server Nachricht
* wird im LocalStorage gespeichert

---

## 9.13.3 createLobby

### Beschreibung

Erstellt eine neue Lobby und setzt den sendenden Spieler automatisch als Host.

### Voraussetzungen

* keine aktive Session erforderlich (Neuer Spieler)

### Payload

```ts id="create_lobby"
{
  playerName: string
}
```

### Validierung

* playerName: 1–20 Zeichen
* keine leeren Namen
* keine Duplikate in initialer Lobby (immer eindeutig)

### Server-Verhalten

* erstellt neue Lobby
* generiert 6-stelligen Lobbycode (Ziffern 0–9)
* erstellt Host-Spieler
* erstellt Session-ID
* setzt Standardkategorien:

  * Stadt
  * Land
  * Fluss
* setzt Standard-Settings
* sendet LobbyState an alle Clients

---

## 9.13.4 joinLobby

### Beschreibung

Ein Spieler tritt einer bestehenden Lobby bei.

### Payload

```ts id="join_lobby"
{
  playerName: string,
  lobbyCode: string
}
```

### Validierung

* lobbyCode existiert
* Lobby ist im Zustand "Lobby"
* playerName: 1–20 Zeichen
* playerName eindeutig innerhalb Lobby

### Server-Verhalten

* fügt Spieler zur Lobby hinzu
* erzeugt neue Session-ID
* sendet aktualisierten LobbyState an alle Clients
* informiert alle Clients über neuen Spieler

---

## 9.13.5 reconnect

### Beschreibung

Stellt eine bestehende Session nach Verbindungsverlust wieder her.

### Payload

```ts id="reconnect"
{
  sessionId: string
}
```

### Validierung

* sessionId existiert
* Spieler gehört zu einer aktiven Lobby

### Server-Verhalten

* ordnet Verbindung dem Spieler zu
* stellt vollständigen Zustand wieder her:

  * Lobby
  * Spielstatus
  * Runde
  * Antworten
  * Punkte
* sendet vollständigen GameState

---

## 9.13.6 updateSettings

### Beschreibung

Ändert Spiel-Einstellungen (nur Host erlaubt).

### Payload

```ts id="update_settings"
{
  timeLimit: number | null,
  showLetterDuringCountdown: boolean
}
```

### Validierung

* sender ist Host
* timeLimit >= 0 oder null (unbegrenzt)
* gültige Lobby

### Server-Verhalten

* aktualisiert Settings
* synchronisiert LobbyState an alle Clients

---

## 9.13.7 addCategory

### Beschreibung

Fügt eine neue Kategorie hinzu.

### Payload

```ts id="add_category"
{
  name: string
}
```

### Validierung

* sender ist Host
* name: 1–30 Zeichen
* keine weiteren Einschränkungen (Duplikate erlaubt)

### Server-Verhalten

* Kategorie wird zur Liste hinzugefügt
* LobbyState wird aktualisiert

---

## 9.13.8 updateCategory

### Beschreibung

Bearbeitet eine bestehende Kategorie.

### Payload

```ts id="update_category"
{
  categoryId: string,
  name: string
}
```

### Validierung

* sender ist Host
* Kategorie existiert
* name: 1–30 Zeichen

### Server-Verhalten

* Kategorie wird aktualisiert
* State wird synchronisiert

---

## 9.13.9 removeCategory

### Beschreibung

Entfernt eine Kategorie aus der Lobby.

### Payload

```ts id="remove_category"
{
  categoryId: string
}
```

### Validierung

* sender ist Host
* mindestens 1 Kategorie muss verbleiben

### Server-Verhalten

* entfernt Kategorie
* aktualisiert LobbyState

---

## 9.13.10 kickPlayer

### Beschreibung

Entfernt einen Spieler aus der Lobby (nur im Lobby-Zustand erlaubt).

### Payload

```ts id="kick_player"
{
  playerId: string
}
```

### Validierung

* sender ist Host
* Zielspieler existiert
* Spielstatus == Lobby
* Spieler ist nicht Host

### Server-Verhalten

* Spieler wird aus Lobby entfernt
* Session wird ungültig markiert
* Client erhält Kick-Event
* LobbyState wird aktualisiert

---

## 9.13.11 startGame

### Beschreibung

Startet ein neues Spiel innerhalb der aktuellen Lobby.

### Payload

```ts id="start_game"
{}
```

### Validierung

* sender ist Host
* mindestens 1 Spieler vorhanden
* mindestens 1 Kategorie vorhanden
* aktueller Zustand = Lobby

### Server-Verhalten

* setzt Spielstatus auf Countdown
* initialisiert erstes Alphabet
* sendet CountdownStarted Event

---

## 9.13.12 nextRoundRequest (intern kontrolliert)

### Beschreibung

Wird vom Host ausgelöst, wenn er nach einer Runde fortfahren möchte.

### Payload

```ts id="next_round"
{}
```

### Validierung

* sender ist Host
* Zustand = RoundResult

### Server-Verhalten

* wählt nächsten verfügbaren Buchstaben
* startet Countdown
* setzt neue Runde auf

---

## 9.13.13 leaveLobby

### Beschreibung

Spieler verlässt aktiv die Lobby.

### Payload

```ts id="leave_lobby"
{}
```

### Validierung

* sessionId gültig

### Server-Verhalten

* entfernt Spieler aus Lobby
* falls Host:

  * Host-Disconnect-Flow startet
* sendet LobbyState Update

---

## 9.13.14 answerUpdate

### Beschreibung

Aktualisiert eine oder mehrere Antworten eines Spielers.

### Payload

```ts id="answer_update"
{
  categoryId: string,
  value: string
}
```

### Validierung

* Spielstatus = Playing
* Antwortlänge 1–30 Zeichen
* beginnt mit aktuellem Buchstaben
* Spieler gehört zur Lobby

### Server-Verhalten

* speichert Antwort
* überschreibt vorherige Version
* aktualisiert optional andere Clients (nicht zwingend sofort broadcast, aber persistent gespeichert)

---

## 9.13.15 buzz

### Beschreibung

Beendet eine laufende Runde vorzeitig durch einen Spieler.

### Payload

```ts id="buzz"
{}
```

### Validierung

* Spieler gehört zur Lobby
* Runde aktiv
* Spieler hat alle Kategorien ausgefüllt

### Server-Verhalten

* Runde endet sofort
* alle Antworten werden finalisiert
* Zustand wechselt zu WaitingForReview
* Buzz-Gewinner wird gespeichert

# 9.14 Client → Server Events (Teil 2)

## 9.14.1 Grundprinzip

Dieser Abschnitt beschreibt alle **spielkritischen Client → Server Events**, insbesondere:

* Bewertung von Antworten
* Navigation im Review-Prozess
* Zusammenführen von Antworten
* Abschluss von Runden und Spielen

Diese Events sind ausschließlich im Zustand **Reviewing** oder **RoundResult** erlaubt (abhängig vom Event).

---

# 9.14.2 reviewStart (implizit durch Serverzustand)

Dieses Event wird nicht aktiv vom Client gesendet, sondern ist ein Zustand, der die folgenden Events erlaubt.

Der Client darf erst Review-Events senden, wenn der Server den Zustand `Reviewing` gesetzt hat.

---

# 9.14.3 setAnswerValidity

## Beschreibung

Der Host markiert eine Antwort als gültig oder ungültig.

## Payload

```ts id="set_answer_validity"
{
  answerId: string,
  valid: boolean
}
```

## Validierung

* sender ist Host
* Spielzustand = Reviewing
* Antwort existiert
* Antwort gehört zur aktuellen Kategorie

## Server-Verhalten

* setzt Validitätsstatus der Antwort
* beeinflusst Punkteberechnung
* synchronisiert ReviewState an alle Clients

---

# 9.14.4 mergeAnswers

## Beschreibung

Der Host führt mehrere Antworten zusammen (gleichwertige Antworten werden gruppiert).

Beispiel:

* „PKW“
* „Auto“
* „Automobil“

werden als identisch behandelt.

## Payload

```ts id="merge_answers"
{
  targetAnswerId: string,
  sourceAnswerId: string
}
```

## Validierung

* sender ist Host
* beide Antworten existieren
* beide Antworten in gleicher Kategorie
* Spielzustand = Reviewing

## Server-Verhalten

* sourceAnswer wird targetAnswer zugeordnet
* beide teilen künftig Bewertung
* Änderungen wirken sich direkt auf Punkte aus
* ReviewState wird aktualisiert

---

# 9.14.5 unmergeAnswers (optional Korrektur)

## Beschreibung

Hebt eine vorherige Merge-Entscheidung auf.

## Payload

```ts id="unmerge_answers"
{
  answerId: string
}
```

## Validierung

* sender ist Host
* Antwort existiert
* Antwort ist Teil eines Merges

## Server-Verhalten

* entfernt Zuordnung
* Antworten werden wieder einzeln bewertet

---

# 9.14.6 nextCategory

## Beschreibung

Der Host wechselt zur nächsten Kategorie im Bewertungsprozess.

## Payload

```ts id="next_category"
{}
```

## Validierung

* sender ist Host
* Zustand = Reviewing

## Server-Verhalten

* setzt aktuelle Kategorie auf nächste
* synchronisiert ReviewState an alle Clients

---

# 9.14.7 previousCategory

## Beschreibung

Der Host wechselt zur vorherigen Kategorie.

## Payload

```ts id="previous_category"
{}
```

## Validierung

* sender ist Host
* Zustand = Reviewing

## Server-Verhalten

* setzt aktuelle Kategorie zurück
* synchronisiert ReviewState

---

# 9.14.8 finishReview

## Beschreibung

Der Host beendet die gesamte Bewertungsphase einer Runde.

Dies ist ein kritischer Übergang in den Zustand `RoundResult`.

## Payload

```ts id="finish_review"
{}
```

## Validierung

* sender ist Host
* alle Kategorien wurden mindestens einmal geöffnet
* Zustand = Reviewing

## Server-Verhalten

* berechnet endgültige Punkte der Runde
* addiert Punkte zum Gesamtscore
* erstellt Rangliste der Runde
* setzt Zustand auf `RoundResult`
* sendet RoundResultState an alle Clients

---

# 9.14.9 startNextRound

## Beschreibung

Startet eine neue Runde innerhalb eines laufenden Spiels.

## Payload

```ts id="start_next_round"
{}
```

## Validierung

* sender ist Host
* Zustand = RoundResult
* Spiel ist nicht beendet

## Server-Verhalten

* wählt neuen zufälligen Buchstaben aus verbleibendem Alphabet
* initialisiert neue Runde
* setzt Zustand auf `Countdown`
* synchronisiert alle Clients

---

# 9.14.10 endGame

## Beschreibung

Beendet das aktuelle Spiel manuell.

## Payload

```ts id="end_game"
{}
```

## Validierung

* sender ist Host
* Spiel existiert

## Server-Verhalten

* setzt Zustand auf `GameOver`
* berechnet finale Rangliste
* sendet GameOverState an alle Clients
* bereitet automatische neue Lobby vor (gemäß Spezifikation)

---

# 9.14.11 forceEndRound (Timeout/Host Disconnect Handling)

## Beschreibung

Wird intern oder durch Host-Verlust ausgelöst, um eine Runde zwangsweise zu beenden.

## Payload

```ts id="force_end_round"
{}
```

## Validierung

* nur serverintern oder Host-Timeout

## Server-Verhalten

* beendet aktuelle Runde sofort
* setzt Zustand auf `RoundResult`
* wenn keine Bewertung erfolgt:

  * alle Antworten werden als ungültig behandelt oder 0 Punkte
* synchronisiert Clients

---

# 9.14.12 kickDuringGame (server enforced extension)

## Beschreibung

Erweiterung des Kick-Systems für Fälle während eines laufenden Spiels.

## Payload

```ts id="kick_during_game"
{
  playerId: string
}
```

## Validierung

* sender ist Host
* Spieler existiert

## Server-Verhalten

* Spieler wird sofort entfernt
* Antworten des Spielers werden ignoriert oder als 0 Punkte behandelt (abhängig vom Zeitpunkt)
* State wird aktualisiert

---

# 9.14.13 acknowledgeState (optional Sync-Handshake)

## Beschreibung

Client bestätigt Empfang eines neuen Spielzustands.

Wird für Debugging und Synchronisationssicherheit genutzt.

## Payload

```ts id="ack_state"
{
  stateVersion: number
}
```

## Validierung

* session gültig

## Server-Verhalten

* markiert Client als synchronisiert
* optional für Debug/Resync-Mechaniken

---

# 9.14.14 summary dieses Abschnitts

Dieser Teil umfasst alle:

## Bewertungslogik

* setAnswerValidity
* mergeAnswers
* unmergeAnswers

## Navigation im Review

* nextCategory
* previousCategory

## Spielabschluss

* finishReview
* startNextRound
* endGame

## Edge Cases

* forceEndRound
* kickDuringGame

## Synchronisation

* acknowledgeState

---

# 9.14.15 zentrale Regel dieses Abschnitts

Alle Events in diesem Kapitel gelten ausschließlich innerhalb kontrollierter Server-Zustände.

Der Server entscheidet jederzeit:

* ob eine Antwort noch gültig ist
* ob ein Review-Schritt erlaubt ist
* ob ein Spiel fortgesetzt oder beendet wird
* ob ein Spieler noch Teil des Spiels ist

Der Client ist ausschließlich ausführend.

# 9.15 Server → Client Events (Teil 1)

## 9.15.1 Grundprinzip

Server → Client Events sind die **einzige Quelle der Wahrheit für den Client**.

Der Server sendet nach jeder relevanten Änderung den vollständigen oder teilweisen aktuellen Zustand.

Der Client darf diese Daten **niemals verändern oder interpretieren im Sinne der Spiellogik**, sondern ausschließlich darstellen.

Alle Events sind deterministisch und vollständig synchronisierend.

---

## 9.15.2 Event-Struktur (einheitlich)

Alle Server → Client Nachrichten folgen diesem Schema:

```ts id="server_event_base"
{
  type: string,
  payload: unknown,
  stateVersion: number
}
```

### stateVersion

* wird vom Server inkrementiert
* ermöglicht Debugging und Synchronisationsprüfung
* hilft bei Reconnect und State-Konsistenz

---

## 9.15.3 lobbyState

## Beschreibung

Übermittelt den vollständigen aktuellen Zustand der Lobby.

Dieses Event wird bei jeder relevanten Änderung der Lobby gesendet.

## Payload

```ts id="lobby_state"
{
  lobbyCode: string,
  hostId: string,
  players: Array<{
    id: string,
    name: string,
    connected: boolean,
    isHost: boolean,
    score: number
  }>,
  categories: Array<{
    id: string,
    name: string
  }>,
  settings: {
    timeLimit: number | null,
    showLetterDuringCountdown: boolean
  },
  gameState: "Lobby" | "Countdown" | "Playing" | "Reviewing" | "RoundResult" | "GameOver"
}
```

## Trigger

* Spieler join/leave
* Kick
* Settings update
* Category changes
* Host change (implizit)
* Reconnect

---

## 9.15.4 gameState

## Beschreibung

Übermittelt den aktuellen Spielzustand inklusive Runde.

## Payload

```ts id="game_state"
{
  roundId: string,
  letter: string,
  usedLetters: string[],
  remainingLetters: string[],
  timeRemaining: number | null,
  startedAt: number,
  status: "Countdown" | "Playing"
}
```

## Trigger

* Spielstart
* neue Runde
* Countdown Start
* Tick-Updates (optional reduziert)
* Buzz-Übergang

---

## 9.15.5 countdownStarted

## Beschreibung

Signalisiert Beginn des 3-Sekunden-Countdowns vor einer Runde.

## Payload

```ts id="countdown_started"
{
  roundId: string,
  startsAt: number,
  showLetter: boolean
}
```

## Trigger

* startGame
* startNextRound

---

## 9.15.6 roundStarted

## Beschreibung

Signalisiert den offiziellen Start einer Runde.

## Payload

```ts id="round_started"
{
  roundId: string,
  letter: string,
  startedAt: number,
  timeLimit: number | null
}
```

## Trigger

* Countdown endet

---

## 9.15.7 answerState

## Beschreibung

Übermittelt alle aktuellen Antworten eines Spielers oder aller Spieler (je nach Optimierung).

## Payload

```ts id="answer_state"
{
  roundId: string,
  answers: Array<{
    playerId: string,
    categoryId: string,
    value: string,
    submittedAt: number
  }>
}
```

## Trigger

* answerUpdate
* reconnect
* buzz
* force sync

---

## 9.15.8 playerJoined

## Beschreibung

Informiert über neuen Spieler in der Lobby.

## Payload

```ts id="player_joined"
{
  player: {
    id: string,
    name: string,
    isHost: boolean
  }
}
```

---

## 9.15.9 playerLeft

## Beschreibung

Informiert über das Verlassen eines Spielers.

## Payload

```ts id="player_left"
{
  playerId: string
}
```

---

## 9.15.10 playerDisconnected

## Beschreibung

Markiert einen Spieler als temporär offline.

## Payload

```ts id="player_disconnected"
{
  playerId: string
}
```

---

## 9.15.11 playerReconnected

## Beschreibung

Markiert erfolgreichen Reconnect eines Spielers.

## Payload

```ts id="player_reconnected"
{
  playerId: string
}
```

---

## 9.15.12 buzzResult

## Beschreibung

Übermittelt das Ergebnis eines Buzz-Vorgangs.

## Payload

```ts id="buzz_result"
{
  roundId: string,
  winnerPlayerId: string,
  timestamp: number
}
```

## Trigger

* erster gültiger Buzz

---

## 9.15.13 roundResult

## Beschreibung

Übermittelt das Ergebnis einer Runde nach Bewertung oder Zeitende.

## Payload

```ts id="round_result"
{
  roundId: string,
  letter: string,
  scores: Array<{
    playerId: string,
    roundPoints: number,
    totalPoints: number
  }>,
  ranking: Array<{
    playerId: string,
    rank: number
  }>
}
```

## Trigger

* finishReview
* forceEndRound
* timeLimit expired
* buzz completion

---

## 9.15.14 gameOver

## Beschreibung

Signalisiert das Ende des gesamten Spiels.

## Payload

```ts id="game_over"
{
  finalRanking: Array<{
    playerId: string,
    name: string,
    totalPoints: number,
    rank: number
  }>,
  reason: "AlphabetFinished" | "HostEnded" | "HostDisconnected"
}
```

## Trigger

* Alphabet erschöpft
* Host beendet Spiel
* Host Disconnect Timeout

---

## 9.15.15 error

## Beschreibung

Übermittelt Fehlerzustände an den Client.

## Payload

```ts id="error_event"
{
  code: string,
  message: string
}
```

## Beispiele

* INVALID_LOBBY
* NOT_HOST
* INVALID_STATE
* INVALID_SESSION
* ACTION_NOT_ALLOWED

---

## 9.15.16 syncRequired

## Beschreibung

Fordert den Client auf, seinen Zustand neu zu synchronisieren.

## Payload

```ts id="sync_required"
{
  reason: string
}
```

## Trigger

* Version mismatch
* Reconnect Konflikte
* Inkonsistenter State

---

## 9.15.17 zentrale Regel dieses Abschnitts

Server → Client Events sind:

* vollständig
* zustandsorientiert
* autoritativ
* nicht manipulierbar durch Clients

Der Client darf niemals entscheiden, ob ein Event gültig ist.

Er darf ausschließlich:

* speichern
* darstellen
* UI aktualisieren

---

## 9.15.18 Zusammenfassung

Dieser Abschnitt definiert die komplette Echtzeit-Synchronisation:

### Lobby

* lobbyState
* playerJoined
* playerLeft
* playerDisconnected
* playerReconnected

### Spiel

* gameState
* countdownStarted
* roundStarted
* answerState

### Runde

* buzzResult
* roundResult

### Spielende

* gameOver

### System

* error
* syncRequired

# 9.16 Server → Client Events (Teil 2)

## 9.16.1 Grundprinzip

Dieser Abschnitt beschreibt alle **dynamischen und hochfrequenten Spiel-Updates**, insbesondere während der:

* Bewertungsphase (Reviewing)
* Punkteberechnung in Echtzeit
* Host-Interaktionen (Merge / Validierung)
* Live-Synchronisation von Bewertungen

Diese Events sind besonders kritisch für Konsistenz und müssen stets serverseitig autoritativ sein.

---

# 9.16.2 reviewState

## Beschreibung

Übermittelt den vollständigen aktuellen Bewertungszustand einer Kategorie.

Dieses Event wird bei jeder Änderung im Review-Prozess gesendet.

## Payload

```ts id="review_state"
{
  roundId: string,
  categoryId: string,
  currentIndex: number,
  categories: Array<{
    id: string,
    name: string
  }>,
  answers: Array<{
    answerId: string,
    playerId: string,
    value: string,
    valid: boolean,
    mergedInto: string | null,
    pointsPreview: number
  }>
}
```

## Trigger

* nextCategory
* previousCategory
* setAnswerValidity
* mergeAnswers
* unmergeAnswers
* reconnect
* initial review start

---

## Verhalten

* zeigt exakt eine Kategorie gleichzeitig
* enthält alle Antworten dieser Kategorie
* enthält bereits berechnete **Punkte-Vorschau**
* wird nach jeder Host-Aktion neu gesendet

---

# 9.16.3 reviewProgress

## Beschreibung

Übermittelt den Fortschritt der Bewertung.

## Payload

```ts id="review_progress"
{
  roundId: string,
  reviewedCategories: number,
  totalCategories: number
}
```

## Trigger

* jede Kategorie wird abgeschlossen
* nextCategory / previousCategory
* finishReview Vorbereitung

---

# 9.16.4 scoreUpdate

## Beschreibung

Übermittelt Live-Updates der Punktestände während der Bewertung.

## Payload

```ts id="score_update"
{
  playerId: string,
  roundPoints: number,
  totalPoints: number
}
```

## Trigger

* setAnswerValidity
* mergeAnswers
* unmergeAnswers
* reviewState recalculation

---

## Verhalten

* Punkte werden **sofort sichtbar aktualisiert**
* ersetzt keine finalen RoundResult Daten
* dient nur UI-Live-Feedback

---

# 9.16.5 mergeUpdate

## Beschreibung

Informiert alle Clients über eine erfolgreiche Zusammenführung von Antworten.

## Payload

```ts id="merge_update"
{
  roundId: string,
  categoryId: string,
  targetAnswerId: string,
  mergedAnswerIds: string[]
}
```

## Trigger

* mergeAnswers
* unmergeAnswers

---

## Verhalten

* Clients gruppieren visuell Antworten zusammen
* Punkte werden neu berechnet
* ReviewState wird aktualisiert

---

# 9.16.6 answerValidityChanged

## Beschreibung

Signalisiert Änderung der Gültigkeit einer Antwort.

## Payload

```ts id="answer_validity_changed"
{
  answerId: string,
  valid: boolean
}
```

## Trigger

* setAnswerValidity

---

## Verhalten

* beeinflusst Punkte sofort
* UI aktualisiert Markierung (grün/rot/neutral)
* wird in reviewState reflektiert

---

# 9.16.7 categoryFocusChanged

## Beschreibung

Informiert alle Clients über den aktuell betrachteten Kategorieindex im Review.

## Payload

```ts id="category_focus_changed"
{
  categoryId: string,
  index: number
}
```

## Trigger

* nextCategory
* previousCategory

---

## Verhalten

* alle Clients synchronisieren UI auf gleiche Kategorie
* verhindert Desync zwischen Host und Spielern

---

# 9.16.8 liveLeaderboard

## Beschreibung

Übermittelt ein laufend aktualisiertes Ranking während der Bewertungsphase.

## Payload

```ts id="live_leaderboard"
{
  players: Array<{
    playerId: string,
    name: string,
    roundPoints: number,
    totalPoints: number,
    rank: number
  }>
}
```

## Trigger

* scoreUpdate
* reviewState recalculation
* mergeAnswers

---

## Verhalten

* dient ausschließlich UI-Feedback
* ersetzt nicht roundResult
* wird häufig aktualisiert

---

# 9.16.9 hostActionBroadcast

## Beschreibung

Informiert alle Clients über eine Host-Aktion im Review.

## Payload

```ts id="host_action_broadcast"
{
  type: "VALIDATE" | "INVALIDATE" | "MERGE" | "UNMERGE" | "NAVIGATE",
  targetId?: string,
  categoryId?: string,
  timestamp: number
}
```

## Trigger

* jede Host-Bewertungsaktion

---

## Verhalten

* sorgt für Transparenz aller Änderungen
* kann für Replay/Debug genutzt werden
* garantiert identische UI bei allen Clients

---

# 9.16.10 reviewLocked

## Beschreibung

Signalisiert, dass die Bewertung abgeschlossen ist und keine Änderungen mehr erlaubt sind.

## Payload

```ts id="review_locked"
{
  roundId: string
}
```

## Trigger

* finishReview

---

## Verhalten

* sperrt UI für alle Clients
* verhindert weitere Host-Aktionen
* Übergang zu roundResult vorbereitet

---

# 9.16.11 finalScoreConfirmed

## Beschreibung

Übermittelt endgültige Punkte nach Abschluss einer Runde.

## Payload

```ts id="final_score_confirmed"
{
  scores: Array<{
    playerId: string,
    roundPoints: number,
    totalPoints: number
  }>
}
```

## Trigger

* finishReview
* forceEndRound

---

## Verhalten

* ersetzt alle preview Werte
* ist Grundlage für roundResult
* final und unveränderlich für diese Runde

---

# 9.16.12 reviewError

## Beschreibung

Fehler während der Bewertungsphase.

## Payload

```ts id="review_error"
{
  code: string,
  message: string
}
```

## Beispiele

* INVALID_MERGE
* ANSWER_NOT_FOUND
* CATEGORY_MISMATCH
* NOT_ALLOWED_IN_STATE

---

# 9.16.13 zentrale Regel dieses Abschnitts

Alle Events in diesem Kapitel gelten ausschließlich für:

* aktive Review-Phase
* Live-Bewertung
* synchronisierte UI-Updates

Der Server garantiert:

* identische Sicht für alle Clients
* sofortige Konsistenz nach jeder Host-Aktion
* keine clientseitige Berechnung von Punkten oder Merges

---

# 9.16.14 Zusammenfassung

Dieser Abschnitt definiert das vollständige Live-Bewertungssystem:

## Bewertung

* reviewState
* answerValidityChanged
* mergeUpdate
* reviewError

## Fortschritt

* reviewProgress
* categoryFocusChanged

## Punkte

* scoreUpdate
* liveLeaderboard
* finalScoreConfirmed

## Kontrolle

* hostActionBroadcast
* reviewLocked

---

# 9.16.15 Abschluss WebSocket-Spezifikation

Mit diesem Abschnitt ist die **vollständige WebSocket-Schnittstelle abgeschlossen**:

* Client → Server Events (Teil 1 & 2)
* Server → Client Events (Teil 1 & 2)
* vollständige Review-Logik
* vollständige Spiel- und Rundenlogik
* Reconnect- und Fehlermechanismen

---

## Nächster Abschnitt

Im nächsten Schritt folgt:

> **10. Datenmodelle**

Dort werden alle Strukturen exakt definiert:

* Player
* Lobby
* Game
* Round
* Answer
* Category
* Settings
* Session
* Score

inklusive Typen, Beziehungen und Zustandsfeldern.

