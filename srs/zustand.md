# 11. Zustandsmaschine

## 11.1 Grundprinzip

Die gesamte Anwendung basiert auf einer **serverseitig kontrollierten Zustandsmaschine**.

Der Server ist die einzige Instanz, die Zustandsübergänge ausführt.

Der Client darf Zustände nur anzeigen, nicht verändern.

Jeder Zustand bestimmt:

* erlaubte Aktionen
* gültige WebSocket-Events
* gültige Übergänge
* UI-Darstellung

---

# 11.2 Hauptzustände

Das System kennt folgende globale Hauptzustände einer Lobby:

```text id="states_main"
Lobby
Countdown
Playing
Reviewing
RoundResult
GameOver
```

---

# 11.3 Zustandsdefinitionen

## 11.3.1 Lobby

### Beschreibung

Vorbereitungszustand vor Spielbeginn.

### Erlaubte Aktionen

* Spieler beitreten
* Spieler verlassen
* Host kann:

  * Kategorien ändern
  * Settings ändern
  * Spieler kicken
  * Spiel starten

### Verbotene Aktionen

* Antworten senden
* Buzz
* Bewertung

---

## 11.3.2 Countdown

### Beschreibung

3-Sekunden-Übergang vor einer Runde.

### Erlaubte Aktionen

* Reconnect
* State Sync

### Verboten

* Antworten
* Buzz
* Bewertung
* Änderungen an Settings

---

## 11.3.3 Playing

### Beschreibung

Aktive Eingabephase einer Runde.

### Erlaubte Aktionen

* answerUpdate
* buzz
* Reconnect

### Bedingungen

* Antworten werden serverseitig validiert
* Buzz nur erlaubt, wenn alle Kategorien ausgefüllt

---

## 11.3.4 Reviewing

### Beschreibung

Bewertungsphase durch den Host.

### Erlaubte Aktionen

* setAnswerValidity
* mergeAnswers
* unmergeAnswers
* nextCategory
* previousCategory
* finishReview

### Bedingungen

* nur Host darf Bewertungsaktionen ausführen
* alle Spieler sehen denselben Bewertungsstand

---

## 11.3.5 RoundResult

### Beschreibung

Ergebnisphase nach abgeschlossener Bewertung.

### Erlaubte Aktionen

* startNextRound
* endGame
* Reconnect

### Eigenschaften

* Punkte sind finalisiert
* Rangliste ist fix
* keine Änderungen mehr möglich

---

## 11.3.6 GameOver

### Beschreibung

Endzustand des Spiels.

### Erlaubte Aktionen

* neues Spiel starten (über neue Lobby)
* zurück zum Startscreen

### Eigenschaften

* alle Daten bleiben lesbar, aber unveränderlich
* automatische neue Lobby wird vorbereitet

---

# 11.4 Zustandsübergänge

## 11.4.1 Hauptfluss

```text id="flow_main"
Lobby
  ↓ (startGame)
Countdown
  ↓
Playing
  ↓ (buzz OR time end)
Reviewing
  ↓ (finishReview)
RoundResult
  ↓ (startNextRound)
Countdown
```

---

## 11.4.2 Spielende

```text id="flow_end"
RoundResult
  ↓ (alphabet exhausted)
GameOver
```

oder

```text id="flow_end_host"
Any State
  ↓ (host ends game)
GameOver
```

oder

```text id="flow_end_disconnect"
Any State
  ↓ (host disconnect > 30s)
GameOver
```

---

## 11.4.3 automatische neue Lobby

Nach GameOver:

* neue Lobby wird erstellt
* Spieler werden übernommen
* neuer Lobbycode wird generiert
* Zustand → Lobby

---

# 11.5 Zustandsregeln (global)

## 11.5.1 Server-Regel

Der Server muss vor jeder Aktion prüfen:

* Ist Aktion im aktuellen Zustand erlaubt?
* Ist Spieler berechtigt?
* Ist Spielstatus konsistent?

Ungültige Aktionen werden ignoriert oder als Fehler zurückgegeben.

---

## 11.5.2 Client-Regel

Der Client darf:

* nur UI rendern
* keine Zustände berechnen
* keine Übergänge erzwingen

---

## 11.5.3 Konsistenzregel

Der Zustand des Servers ist:

* eindeutig
* nicht parallelisierbar
* sequenziell verarbeitet

Bei konkurrierenden Events gilt:

> first valid server-side processed event wins

---

# 11.6 Subzustände

## 11.6.1 Review Substates

Innerhalb von `Reviewing` existieren Subzustände:

```text id="review_substates"
CategoryReview
→ AnswerReview
→ MergeState
→ NavigationState
```

Diese beeinflussen:

* aktuelle Kategorie
* sichtbare Antworten
* Host-Aktionen

---

## 11.6.2 Playing Substates

```text id="playing_substates"
InputActive
BuzzAvailable
BuzzLocked
```

BuzzLocked tritt ein sobald:

* Buzz erfolgt ist
* oder Zeit abgelaufen ist

---

# 11.7 Fehlerzustände

## 11.7.1 HostDisconnected

```text id="host_dc"
HostDisconnected
```

### Verhalten

* UI blockiert
* keine Interaktionen möglich
* 30 Sekunden Timeout

---

## 11.7.2 SyncRequired

```text id="sync_required_state"
SyncRequired
```

### Verhalten

* Client muss vollständigen State neu laden
* tritt bei Inkonsistenzen auf

---

# 11.8 Zustandsdiagramm (Gesamt)

```text id="state_diagram"
Lobby
  ↓
Countdown
  ↓
Playing
  ↓
Reviewing
  ↓
RoundResult
  ↓
(Countdown wiederholen)
  ↓
GameOver
  ↓
Lobby (neu)
```

Zusätzliche Übergänge:

* AnyState → GameOver (Host end / Disconnect / Abort)
* AnyState → SyncRequired (Fehlerfall)
* AnyState → HostDisconnected (Host loss)

---

# 11.9 zentrale Regel dieses Kapitels

Die Zustandsmaschine ist:

* vollständig serverseitig
* deterministisch
* sequenziell
* nicht manipulierbar durch Clients

Jeder Zustand definiert exakt:

* erlaubte Events
* verbotene Events
* gültige Übergänge

---

# 11.10 Bedeutung für Implementierung

Dieses Kapitel ist die **Basis für die gesamte Backend-Logik**.

Es garantiert:

* keine Race Conditions im Design
* klare Event-Zuordnung
* eindeutige UI-Zustände
* einfache Reconnect-Logik

