# 10. Datenmodelle

## 10.1 Grundprinzip

Dieses Kapitel definiert die **kanonischen Datenstrukturen des Servers**.

Der Server hält den vollständigen Zustand aller Lobbies, Spiele und Sitzungen im Speicher.

Der Client erhält ausschließlich abgeleitete, serialisierte Versionen dieser Daten über WebSocket-Events.

Alle Modelle sind:

* eindeutig typisiert
* serverseitig autoritativ
* nicht vom Client veränderbar
* zustandsorientiert

---

# 10.2 Session

## Beschreibung

Eine Session repräsentiert die Identität eines Clients innerhalb des Systems.

## Struktur

```ts id="session_model"
{
  sessionId: string,
  playerId: string,
  lobbyId: string,
  createdAt: number,
  lastSeenAt: number,
  status: "active" | "disconnected" | "kicked"
}
```

## Eigenschaften

* wird serverseitig erzeugt
* wird im LocalStorage gespeichert
* ist einzige Identifikation eines Spielers
* kann bei Reconnect wiederhergestellt werden

---

# 10.3 Player

## Beschreibung

Ein Player ist eine aktive oder temporär getrennte Person innerhalb einer Lobby.

## Struktur

```ts id="player_model"
{
  id: string,
  sessionId: string,
  name: string,
  isHost: boolean,
  connected: boolean,
  score: number,
  roundScore: number,
  joinedAt: number,
  lastActiveAt: number,
  status: "active" | "disconnected" | "kicked"
}
```

## Regeln

* Name ist einzigartig innerhalb einer Lobby
* Score ist akkumuliert über alle Runden
* roundScore wird pro Runde neu berechnet
* disconnected Spieler bleiben im System erhalten (außer Kick)

---

# 10.4 Lobby

## Beschreibung

Eine Lobby ist der zentrale Container für ein Spiel.

## Struktur

```ts id="lobby_model"
{
  id: string,
  code: string,
  hostId: string,
  players: Player[],
  categories: Category[],
  settings: Settings,
  game: Game | null,
  state: "Lobby" | "Countdown" | "Playing" | "Reviewing" | "RoundResult" | "GameOver",
  createdAt: number
}
```

## Regeln

* Lobbycode besteht aus 6 Ziffern
* genau ein Host
* kann beliebig viele Spieler enthalten
* existiert ausschließlich im RAM

---

# 10.5 Game

## Beschreibung

Ein Game repräsentiert ein laufendes Spiel innerhalb einer Lobby.

## Struktur

```ts id="game_model"
{
  id: string,
  lobbyId: string,
  currentRound: Round | null,
  usedLetters: string[],
  remainingLetters: string[],
  status: "Countdown" | "Playing" | "Reviewing" | "RoundResult" | "GameOver",
  startedAt: number,
  endedAt: number | null
}
```

## Regeln

* ein Game existiert nur innerhalb einer Lobby
* Buchstaben werden pro Game nur einmal verwendet
* Game endet automatisch bei leerem Alphabet oder Host-Ende

---

# 10.6 Round

## Beschreibung

Eine Round repräsentiert eine einzelne Spielrunde mit genau einem Buchstaben.

## Struktur

```ts id="round_model"
{
  id: string,
  gameId: string,
  letter: string,
  startedAt: number,
  endedAt: number | null,
  status: "Countdown" | "Playing" | "Reviewing" | "RoundResult",
  buzzedBy: string | null
}
```

## Regeln

* genau ein Buchstabe pro Runde
* Buzz beendet Runde sofort (wenn gültig)
* endet auch durch Timeout

---

# 10.7 Category

## Beschreibung

Kategorie definiert eine Spalte im Spiel.

## Struktur

```ts id="category_model"
{
  id: string,
  name: string,
  createdAt: number
}
```

## Regeln

* keine Unique-Constraint auf Name
* Länge: 1–30 Zeichen
* vom Host verwaltbar

---

# 10.8 Answer

## Beschreibung

Antwort eines Spielers für eine Kategorie in einer Runde.

## Struktur

```ts id="answer_model"
{
  id: string,
  roundId: string,
  playerId: string,
  categoryId: string,
  value: string,
  normalizedValue: string,
  isValid: boolean,
  points: number,
  mergedInto: string | null,
  createdAt: number,
  submittedAt: number
}
```

## Regeln

* value wird vom Client gesendet
* normalizedValue wird serverseitig erzeugt
* isValid wird erst im Review final bestimmt
* mergedInto bestimmt Gruppierung
* points werden pro Runde berechnet

---

# 10.9 Settings

## Beschreibung

Globale Spieleinstellungen einer Lobby.

## Struktur

```ts id="settings_model"
{
  timeLimit: number | null,
  showLetterDuringCountdown: boolean
}
```

## Regeln

* nur Host darf ändern
* timeLimit = null bedeutet unbegrenzt
* Änderungen wirken sofort auf neue Runden

---

# 10.10 Score

## Beschreibung

Aggregierte Punktestruktur eines Spielers.

## Struktur

```ts id="score_model"
{
  playerId: string,
  total: number,
  round: number,
  history: Array<{
    roundId: string,
    points: number
  }>
}
```

## Regeln

* total wächst über gesamte Spielzeit
* round wird pro Runde neu gesetzt
* history ist unveränderliche Historie

---

# 10.11 Ranking

## Beschreibung

Abgeleitete Struktur zur Darstellung von Platzierungen.

## Struktur

```ts id="ranking_model"
{
  playerId: string,
  rank: number,
  score: number
}
```

## Regeln

* gleiche Punkte → gleicher Rank
* sekundäre Sortierung: alphabetisch
* wird serverseitig berechnet

---

# 10.12 Session Store (Server-intern)

## Beschreibung

Interne Struktur zur Verwaltung aller Verbindungen.

```ts id="session_store"
{
  sessions: Map<string, Session>,
  sockets: Map<string, WebSocket>
}
```

## Regeln

* nicht Teil der Client-API
* dient Reconnect und Routing
* ephemeral (RAM only)

---

# 10.13 zentrale Modellregel

Alle Datenmodelle gelten als:

* serverauthoritativ
* transient (RAM-basiert)
* vollständig synchronisiert über Events
* niemals direkt vom Client manipulierbar

---

# 10.14 Zusammenfassung

Dieses Kapitel definiert die vollständige Datenbasis des Systems:

* Identität (Session, Player)
* Struktur (Lobby, Game, Round)
* Inhalt (Category, Answer)
* Zustand (Settings, Score, Ranking)

Diese Modelle bilden die Grundlage für:

> Zustandsmaschine (Kapitel 11)
> Fehlerbehandlung (Kapitel 12)
> Nichtfunktionale Anforderungen (Kapitel 13)

