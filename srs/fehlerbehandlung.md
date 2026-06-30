# 12. Fehlerbehandlung

## 12.1 Grundprinzip

Die Fehlerbehandlung im System ist strikt serverzentriert.

Der Server ist die einzige Instanz, die Fehler erkennt, bewertet und klassifiziert.

Der Client dient ausschließlich der Anzeige.

Fehler dürfen niemals den Zustand des Servers unkontrolliert verändern.

---

# 12.2 Fehlerarten

Das System unterscheidet drei Hauptklassen von Fehlern:

```text id="error_types"
ValidationError
StateError
RuntimeError
```

---

## 12.2.1 ValidationError

### Beschreibung

Tritt auf, wenn eingehende Daten strukturell oder inhaltlich ungültig sind.

### Beispiele

* Name > 20 Zeichen
* Kategorie > 30 Zeichen
* fehlende Pflichtfelder
* falscher Datentyp
* ungültige sessionId

### Verhalten

* Nachricht wird verworfen
* keine Zustandsänderung
* optional error Event an Client

---

## 12.2.2 StateError

### Beschreibung

Tritt auf, wenn eine Aktion im aktuellen Zustand nicht erlaubt ist.

### Beispiele

* Buzz während Lobby
* Antworten während Countdown
* Bewertung ohne Host-Rechte
* Kategorieänderung während Playing

### Verhalten

* Aktion wird ignoriert
* error Event wird gesendet
* Zustand bleibt unverändert

---

## 12.2.3 RuntimeError

### Beschreibung

Interne Serverfehler oder unerwartete Zustände.

### Beispiele

* fehlende Referenz im Speicher
* inkonsistenter GameState
* kaputte Session-Referenz

### Verhalten

* Logging serverseitig
* Versuch einer Recovery
* ggf. SyncRequired Event

---

# 12.3 Fehlerstruktur

Alle Fehler werden über ein einheitliches Event übertragen:

```ts id="error_event_final"
{
  type: "error",
  payload: {
    code: string,
    message: string,
    severity: "info" | "warning" | "critical"
  }
}
```

---

## 12.3.1 Fehlercodes

### Auth & Session

* INVALID_SESSION
* SESSION_EXPIRED
* SESSION_NOT_FOUND

---

### Lobby

* LOBBY_NOT_FOUND
* LOBBY_FULL
* INVALID_LOBBY_CODE
* ALREADY_IN_LOBBY

---

### Player

* NAME_TOO_LONG
* NAME_TOO_SHORT
* NAME_NOT_UNIQUE
* PLAYER_NOT_FOUND
* PLAYER_KICKED

---

### Game State

* INVALID_STATE
* STATE_TRANSITION_NOT_ALLOWED
* GAME_ALREADY_RUNNING
* GAME_NOT_RUNNING

---

### Host

* NOT_HOST
* HOST_REQUIRED
* HOST_DISCONNECTED

---

### Answers

* INVALID_ANSWER_LENGTH
* INVALID_FIRST_LETTER
* ANSWER_ALREADY_EXISTS
* ANSWER_NOT_FOUND

---

### Review

* REVIEW_NOT_STARTED
* INVALID_MERGE
* CATEGORY_MISMATCH
* ANSWER_ALREADY_MERGED

---

### Buzz

* BUZZ_NOT_ALLOWED
* BUZZ_ALREADY_TRIGGERED
* INCOMPLETE_ANSWERS

---

# 12.4 Validierungsstrategie

## 12.4.1 doppelte Validierung

Alle Eingaben werden geprüft:

### Client-seitig (UX only)

* Zod Validation
* schnelle Feedbackanzeige

### Server-seitig (authoritativ)

* finale Entscheidung
* Sicherheitsvalidierung

---

## 12.4.2 Prinzip

> Client validation is optional. Server validation is mandatory.

---

# 12.5 Fehlerverhalten im WebSocket

## 12.5.1 ignorierte Nachrichten

Ungültige Nachrichten:

* werden verworfen
* erzeugen optional error Event
* verändern keinen Zustand

---

## 12.5.2 kritische Fehler

Bei schwerwiegenden Fehlern:

* Session wird invalidiert
* Reconnect erforderlich
* syncRequired wird gesendet

---

## 12.5.3 Synchronisationsfehler

Wenn Client und Server auseinanderlaufen:

```text id="sync_flow"
syncRequired → fullStateResync → continue
```

---

# 12.6 Disconnect-Verhalten

## 12.6.1 Spieler Disconnect

* Spieler wird als disconnected markiert
* bleibt im Spiel erhalten
* Antworten bleiben bestehen

---

## 12.6.2 Host Disconnect

* HostDisconnected Zustand aktiviert
* 30 Sekunden Timer startet
* danach GameOver

---

## 12.6.3 vollständiger Verbindungsverlust

Wenn Session nicht wiederhergestellt werden kann:

* Spieler wird entfernt
* State wird aktualisiert
* Lobby bleibt stabil

---

# 12.7 Race Condition Handling

## 12.7.1 Prinzip

Der Server verarbeitet Events strikt sequenziell.

## 12.7.2 Konflikte

Bei gleichzeitigen Events:

* erste gültige Nachricht gewinnt
* alle anderen werden verworfen oder ignoriert

---

## 12.7.3 Beispiele

* zwei Buzz gleichzeitig → erster gewinnt
* zwei Merge Aktionen → sequentiell angewendet
* Antworten gleichzeitig → letzte Server-Verarbeitung zählt

---

# 12.8 Recovery Mechanismen

## 12.8.1 automatische Wiederherstellung

Bei inkonsistentem Zustand:

* vollständiger GameState wird gesendet
* Client überschreibt lokalen Zustand

---

## 12.8.2 Reconnect Recovery

* Session wird geprüft
* State wird neu aufgebaut
* fehlende Daten werden ergänzt

---

# 12.9 Logging

## 12.9.1 Server Logging

Der Server protokolliert:

* alle StateTransitions
* alle Host-Aktionen
* kritische Fehler
* Disconnect Events

---

## 12.9.2 Debugging Unterstützung

stateVersion wird genutzt für:

* Replay
* Debugging
* Synchronisationsanalyse

---

# 12.10 zentrale Regel dieses Kapitels

Fehlerbehandlung folgt diesen Prinzipien:

* keine clientseitige Autorität
* keine inkonsistenten Zustände
* keine halben Updates
* vollständige Kontrolle durch Server
* deterministische Verarbeitung

---

# 12.11 Zusammenfassung

Dieses Kapitel definiert:

* Fehlerklassen
* Fehlercodes
* Validierungsstrategie
* Disconnect Verhalten
* Recovery Mechanismen
* Race Condition Handling

Damit ist die gesamte Fehlerlogik des Systems vollständig spezifiziert.

