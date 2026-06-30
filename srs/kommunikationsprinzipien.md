# 9. WebSocket-Protokoll

## 9.1 Zielsetzung

Die gesamte Kommunikation zwischen Frontend und Backend erfolgt ausschließlich über WebSockets.

Es existieren keine HTTP-Endpunkte zur Spiellogik. HTTP wird lediglich zum Ausliefern der Webanwendung verwendet.

Der WebSocket bildet die einzige Kommunikationsschnittstelle zwischen Client und Server.

Der Server ist jederzeit die einzige autoritative Instanz (Single Source of Truth).

Der Client darf niemals eigenständig Spielzustände berechnen oder verändern.

Jede Spieländerung entsteht ausschließlich durch eine serverseitig validierte Aktion.

---

# 9.2 Kommunikationsprinzipien

## Ereignisbasierte Kommunikation

Die Kommunikation erfolgt vollständig ereignisbasiert.

Jede Benutzeraktion erzeugt genau eine WebSocket-Nachricht.

Beispiele:

* Lobby erstellen
* Lobby beitreten
* Kategorie hinzufügen
* Antwort aktualisieren
* Buzz
* Bewertung ändern

Der Server verarbeitet jede Nachricht unabhängig.

Anschließend entscheidet ausschließlich der Server, ob die Aktion gültig ist.

Falls die Aktion gültig ist, wird der Spielzustand aktualisiert und an alle betroffenen Clients synchronisiert.

---

## Autorität des Servers

Der Server besitzt jederzeit den vollständigen Spielzustand.

Der Client besitzt ausschließlich:

* UI-Zustände
* Theme
* Session-ID
* temporäre lokale Eingaben für den Reconnect

Alle anderen Informationen stammen ausschließlich vom Server.

Beispiele:

Der Client darf **nicht** berechnen:

* Punkte
* Platzierungen
* Gewinner
* verwendete Buchstaben
* verfügbare Buchstaben
* Hostrechte
* Bewertungsergebnisse
* Buzz-Gültigkeit
* Spielstatus

Der Client stellt ausschließlich die vom Server übermittelten Informationen dar.

---

## Vollständige Synchronisation

Nach jeder erfolgreichen Änderung erzeugt der Server einen neuen gültigen Zustand.

Dieser wird unmittelbar an alle verbundenen Clients übertragen.

Alle Clients sehen dadurch jederzeit denselben Spielzustand.

Es existieren keine lokalen Unterschiede zwischen Spielern.

---

## Keine Clientlogik

Der Client übernimmt keinerlei Spiellogik.

Der Client darf beispielsweise nicht entscheiden:

* ob eine Antwort gültig ist
* ob ein Spieler buzzern darf
* ob Kategorien geändert werden dürfen
* ob ein Spieler Host ist
* ob eine Runde beendet ist

Diese Entscheidungen trifft ausschließlich der Server.

---

# 9.3 Nachrichtenformat

Alle Nachrichten besitzen denselben grundsätzlichen Aufbau.

```ts
{
    type: string;
    payload: unknown;
}
```

Der Nachrichtentyp beschreibt eindeutig die gewünschte Aktion oder das übertragene Ereignis.

Die eigentlichen Daten befinden sich im Payload.

Alle Nachrichten werden im Frontend mittels Zod validiert.

Nachrichten, die die Validierung nicht bestehen, dürfen nicht verarbeitet werden.

---

## Beispiel

Client:

```ts
{
    type: "createLobby",
    payload: {
        name: "Max"
    }
}
```

Server:

```ts
{
    type: "lobbyState",
    payload: {
        ...
    }
}
```

---

# 9.4 Kommunikationsrichtung

Es existieren zwei Arten von Nachrichten.

## Client → Server

Der Client fordert eine Aktion an.

Beispiele:

* Lobby erstellen
* Lobby beitreten
* Kategorie hinzufügen
* Buzz
* Bewertung ändern

Der Server entscheidet anschließend, ob diese Aktion gültig ist.

---

## Server → Client

Der Server informiert Clients über Änderungen.

Beispiele:

* Spieler beigetreten
* Runde gestartet
* Bewertung geändert
* Punkte aktualisiert
* Rangliste aktualisiert

Diese Nachrichten dürfen vom Client niemals verändert werden.

---

# 9.5 Zustandsorientierte Synchronisation

Der Server verschickt keine einzelnen UI-Änderungen.

Stattdessen werden immer vollständige Zustände oder vollständige Teilzustände übertragen.

Dadurch entstehen keine inkonsistenten Clients.

Beispiel:

Nicht:

```
Spieler A erhielt 10 Punkte.
```

Sondern:

```
Aktuelle Rangliste.
```

Oder:

```
Aktueller Bewertungszustand.
```

Oder:

```
Aktueller Lobbyzustand.
```

Dadurch kann jeder Client jederzeit vollständig synchronisiert werden.

---

# 9.6 Reihenfolge von Nachrichten

Innerhalb einer WebSocket-Verbindung werden Nachrichten in der Reihenfolge verarbeitet, in der sie vom Server empfangen werden.

Treffen mehrere konkurrierende Aktionen gleichzeitig ein, entscheidet ausschließlich die Reihenfolge ihres Eingangs auf dem Server.

Beispiele:

* Zwei Spieler buzzern gleichzeitig.
* Mehrere Spieler treten gleichzeitig einer Lobby bei.
* Zwei Spieler senden nahezu gleichzeitig ihre letzte Antwort.

In allen Fällen gewinnt die zuerst vollständig empfangene Nachricht.

Diese Entscheidung ist endgültig.

---

# 9.7 Idempotenz

Jede Nachricht darf beliebig oft empfangen werden, ohne den Spielzustand mehrfach zu verändern.

Beispiele:

Ein erneutes Senden eines bereits erfolgreichen Buzzs verändert den Spielzustand nicht.

Ein erneutes Beitreten mit derselben gültigen Session erzeugt keinen zweiten Spieler.

Ein erneutes Aktualisieren derselben Antwort mit identischem Inhalt verändert nichts.

---

# 9.8 Fehlerbehandlung

Jede eingehende Nachricht wird serverseitig validiert.

Eine Nachricht gilt als ungültig, wenn beispielsweise:

* Pflichtfelder fehlen
* Datentypen falsch sind
* Zeichenbegrenzungen überschritten werden
* Rechte fehlen
* der aktuelle Spielzustand die Aktion nicht erlaubt

Ungültige Nachrichten dürfen niemals den Spielzustand verändern.

---

## Fehlerantworten

Der Server antwortet auf ungültige Nachrichten mit einer Fehlernachricht.

Die Fehlernachricht besitzt denselben Nachrichtenaufbau.

```ts
{
    type: "error",
    payload: {
        code: "...",
        message: "..."
    }
}
```

Der Fehlercode dient ausschließlich der Programmlogik.

Die Fehlermeldung dient ausschließlich der Anzeige im Frontend.

---

# 9.9 Validierung

Der Server validiert ausnahmslos jede eingehende Nachricht.

Hierzu gehören unter anderem:

## Spieler

* Name vorhanden
* Name eindeutig
* Namenslänge
* Session gültig

---

## Lobby

* Lobby existiert
* Lobby befindet sich im richtigen Zustand
* Lobbycode gültig

---

## Host

Bei jeder Host-Aktion wird geprüft:

* Spieler ist Host
* Lobby existiert
* Aktion ist im aktuellen Zustand erlaubt

---

## Kategorien

Beim Hinzufügen oder Bearbeiten:

* Länge 1–30 Zeichen

Es existiert **keine** Einschränkung hinsichtlich identischer Kategorienamen.

---

## Einstellungen

Der Server validiert unter anderem:

* Zeitlimit
* Countdown-Einstellungen
* erlaubte Werte

Nur der Host darf Änderungen vornehmen.

---

## Antworten

Der Server validiert:

* Länge 1–30 Zeichen
* erster Buchstabe nach Normalisierung entspricht dem aktuellen Buchstaben
* aktuelle Runde läuft
* Spieler gehört zur Lobby

Die Normalisierung erfolgt serverseitig:

1. führende Leerzeichen entfernen
2. nachfolgende Leerzeichen entfernen
3. erstes Zeichen großschreiben
4. restliche Zeichen kleinschreiben

Weitere Änderungen erfolgen nicht.

---

## Buzz

Vor jedem Buzz prüft der Server:

* Runde läuft
* Spieler gehört zur Lobby
* Spieler besitzt für jede Kategorie eine Antwort
* alle Antworten erfüllen die formalen Regeln

Erst danach wird die Runde beendet.

---

## Bewertung

Während der Bewertung prüft der Server:

* Spieler ist Host
* Kategorie existiert
* Antwort existiert
* Ziel einer Zusammenführung existiert
* Aktion ist im aktuellen Bewertungsschritt zulässig

---

## Reconnect

Beim Reconnect prüft der Server:

* Session existiert
* Lobby existiert
* Spieler gehört zur Lobby

Nur dann wird der Spielzustand wiederhergestellt.

---

# 9.10 Lokale Speicherung

Der Client speichert ausschließlich Daten, die zur Verbesserung der Benutzererfahrung dienen.

Hierzu gehören:

* Theme
* Session-ID
* aktuelle lokale Eingaben der laufenden Runde

Diese Daten besitzen niemals Priorität gegenüber dem Server.

---

## Wiederherstellung nach Reconnect

Nach erfolgreichem Reconnect sendet der Server den aktuellen Spielzustand.

Anschließend vergleicht der Client die lokal gespeicherten Eingaben mit den vom Server bekannten Antworten.

Falls lokale Eingaben existieren, die dem Server noch nicht bekannt sind, werden diese erneut an den Server übertragen.

Der Server entscheidet anschließend, ob diese Änderungen noch zulässig sind.

Ist die Runde bereits beendet, werden diese Eingaben verworfen.

---

# 9.11 Erweiterbarkeit

Das WebSocket-Protokoll ist so aufgebaut, dass neue Nachrichtentypen hinzugefügt werden können, ohne bestehende Clients zu verändern.

Jeder Nachrichtentyp ist eindeutig.

Nicht erkannte Nachrichtentypen dürfen vom Client ignoriert werden.

---

# 9.12 Anforderungen an die Implementierung

Das Protokoll muss folgende Eigenschaften erfüllen:

* ausschließlich WebSockets
* typisierte Nachrichten
* vollständige Zod-Validierung im Frontend
* vollständige Validierung im Backend
* deterministische Verarbeitung
* vollständige Synchronisation aller Clients
* keine Spiellogik im Frontend
* Server ist jederzeit Single Source of Truth
* Reconnect ohne Datenverlust
* klare Trennung zwischen Client-Anfragen und Server-Ereignissen

Dieses Kapitel definiert ausschließlich die allgemeinen Regeln des Kommunikationsprotokolls.

Die konkreten Nachrichten (Client → Server und Server → Client) sowie deren Payloads werden im folgenden Kapitel vollständig spezifiziert.

