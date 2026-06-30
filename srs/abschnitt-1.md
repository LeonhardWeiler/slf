# Stadt-Land-Fluss

## Software Requirements Specification (SRS)

> Version 1.0 (Draft)

---

# Inhaltsverzeichnis

* 1. Einleitung

  * 1.1 Projektübersicht
  * 1.2 Zielsetzung
  * 1.3 Projektumfang
  * 1.4 Begriffsdefinitionen
* 2. Architektur

  * 2.1 Gesamtarchitektur
  * 2.2 Technologie-Stack
  * 2.3 Projektstruktur
  * 2.4 Server als Single Source of Truth
* 3. Designrichtlinien

  * 3.1 UI
  * 3.2 Responsiveness
  * 3.3 Themes
* 4. Lobby-System
* 5. Spielablauf
* 6. Bewertungsprozess
* 7. Punkteberechnung
* 8. Reconnect
* 9. WebSocket-Protokoll
* 10. Datenmodelle
* 11. Zustandsmaschine
* 12. Fehlerbehandlung
* 13. Nichtfunktionale Anforderungen
* 14. Akzeptanzkriterien

---

# 1. Einleitung

## 1.1 Projektübersicht

Dieses Projekt entwickelt eine moderne Multiplayer-Version des klassischen Spiels **Stadt-Land-Fluss**.

Die Anwendung besteht aus einem React-Frontend und einem Go-Backend und verwendet ausschließlich WebSockets zur Kommunikation zwischen Client und Server.

Es existieren keine Benutzerkonten und keine Datenbank. Sämtliche Spielzustände werden ausschließlich im Arbeitsspeicher des Servers gehalten.

Das Frontend dient ausschließlich zur Darstellung des aktuellen Zustands sowie zur Eingabe von Benutzeraktionen. Die gesamte Spiellogik befindet sich auf dem Server.

Alle verbundenen Clients sehen jederzeit denselben Spielzustand.

---

## 1.2 Zielsetzung

Ziel ist die Entwicklung einer vollständig synchronisierten Echtzeit-Anwendung, die folgende Eigenschaften besitzt:

* vollständige Synchronisation aller Clients
* einfache Bedienung
* vollständig responsive Benutzeroberfläche
* keine Benutzerkonten
* keine persistente Datenbank
* automatische Wiederverbindung nach Verbindungsabbrüchen
* minimalistische Benutzeroberfläche
* klare Trennung zwischen Client und Server

Der Server stellt jederzeit die einzige autoritative Quelle sämtlicher Spielinformationen dar.

---

## 1.3 Projektumfang

Das Projekt umfasst:

* Lobbyverwaltung
* Spielerverwaltung
* Host-System
* Verwaltung von Kategorien
* Spielkonfiguration
* Echtzeitkommunikation
* Bewertungsoberfläche
* Punkteberechnung
* automatische Ranglisten
* Reconnect-System
* automatische Host-Erkennung
* Spielende
* automatischer Neustart einer Lobby nach Spielende

Nicht Bestandteil des Projekts sind:

* Benutzerkonten
* Datenbank
* Chat
* Freundeslisten
* Statistiken über mehrere Spiele hinweg
* Persistierung von Spielständen
* KI-Spieler

---

## 1.4 Begriffsdefinitionen

### Lobby

Eine Lobby beschreibt den Zustand vor Beginn eines Spiels.

Innerhalb einer Lobby können:

* Spieler beitreten
* Spieler entfernt werden
* Kategorien verwaltet werden
* Einstellungen verändert werden
* das Spiel gestartet werden

Eine Lobby besitzt:

* einen sechsstelligen Lobbycode
* einen Einladungslink
* einen QR-Code
* genau einen Host

---

### Spiel

Ein Spiel beginnt mit dem Start der ersten Runde.

Ein Spiel besteht aus beliebig vielen aufeinanderfolgenden Runden.

Während eines Spiels bleiben erhalten:

* Spieler
* Kategorien
* Einstellungen
* Gesamtpunktestand
* bereits verwendete Buchstaben

Ein Spiel endet:

* wenn alle Buchstaben verwendet wurden
* wenn der Host das Spiel beendet
* wenn der Host länger als 30 Sekunden getrennt bleibt

---

### Runde

Eine Runde beschreibt genau einen Buchstaben.

Eine Runde besitzt:

* einen zufälligen Buchstaben
* Antworten aller Spieler
* Bewertung
* Rundenergebnis

Eine Runde endet:

* nach einem Buzz
* nach Ablauf des Zeitlimits

Anschließend folgt die Bewertung.

---

### Sitzung

Jeder Spieler besitzt eine eindeutige Sitzungs-ID.

Die Sitzungs-ID dient ausschließlich dem automatischen Wiederverbinden eines Spielers.

Die Sitzungs-ID wird:

* serverseitig erzeugt
* an den Client übertragen
* im LocalStorage gespeichert

---

### Host

Der Ersteller einer Lobby wird automatisch Host.

Der Host besitzt zusätzliche Berechtigungen.

Nur der Host darf:

* Kategorien verwalten
* Einstellungen verändern
* Spieler entfernen
* das Spiel starten
* Antworten bewerten
* neue Runden starten
* das Spiel beenden

---

# 2. Architektur

## 2.1 Gesamtarchitektur

Die Anwendung besteht aus zwei Komponenten.

```
┌──────────────────────┐
│      React Client    │
│                      │
│ Darstellung          │
│ Eingaben             │
│ LocalStorage         │
└──────────┬───────────┘
           │
      WebSocket
           │
┌──────────▼───────────┐
│      Go Server       │
│                      │
│ Lobbyverwaltung      │
│ Spiellogik           │
│ Bewertung            │
│ Punkteberechnung     │
│ Synchronisation      │
│ Reconnect            │
└──────────────────────┘
```

Es existiert ausschließlich eine WebSocket-Verbindung zwischen Client und Server.

Es werden keine REST-Endpunkte zur Spiellogik verwendet.

Die einzige HTTP-Anfrage dient dem Ausliefern der Webanwendung.

---

## 2.2 Technologie-Stack

### Frontend

* TypeScript
* React
* React Router
* Vite
* TailwindCSS
* shadcn/ui
* Zustand
* Zod
* Bun

### Backend

* Go
* coder/websocket

### Entwicklung

* Nix Flakes
* Docker
* Docker Compose
* Air
* GitLab CI/CD

---

## 2.3 Projektstruktur

Das Projekt besteht aus zwei unabhängig entwickelbaren Anwendungen.

```
root
│
├── frontend/
│
├── backend/
│
├── docker/
│
├── compose.yaml
│
├── flake.nix
│
└── README.md
```

Frontend und Backend kommunizieren ausschließlich über definierte WebSocket-Nachrichten.

Es dürfen keine gemeinsamen Laufzeitabhängigkeiten zwischen beiden Projekten existieren.

---

## 2.4 Server als Single Source of Truth

Der Server verwaltet den vollständigen Spielzustand.

Kein Client besitzt einen autoritativen Zustand.

Der Client darf ausschließlich:

* Benutzereingaben erfassen
* lokale UI-Zustände speichern
* den Serverzustand darstellen

Der Server verwaltet:

* Lobbys
* Spieler
* Sitzungen
* Kategorien
* Einstellungen
* Buchstaben
* Antworten
* Bewertungen
* Punkte
* Platzierungen
* Spielstatus
* Verbindungsstatus

Jede Spieländerung erfolgt ausschließlich durch den Server.

Der Client darf niemals versuchen, Spielzustände selbst zu berechnen.

---

## 2.5 Grundprinzipien

Die gesamte Anwendung orientiert sich an folgenden Grundprinzipien.

### Serverautorität

Der Server entscheidet über jede Aktion.

Alle vom Client gesendeten Daten werden validiert.

Ungültige Nachrichten werden verworfen.

---

### Ereignisbasierte Kommunikation

Sämtliche Kommunikation erfolgt ereignisbasiert über WebSockets.

Es existieren keine HTTP-Endpunkte für Spielfunktionen.

Jede Benutzeraktion wird als WebSocket-Ereignis an den Server übertragen.

Der Server verarbeitet die Aktion und verteilt den aktualisierten Zustand an alle betroffenen Clients.

---

### Echtzeitsynchronisation

Alle Clients sehen jederzeit denselben Zustand.

Jede Änderung wird unmittelbar an alle verbundenen Spieler übertragen.

Es existieren keine lokalen Spielzustände, die vom Serverzustand abweichen dürfen.

---

### Fehlertoleranz

Kurzzeitige Verbindungsabbrüche dürfen das Spiel nicht unterbrechen.

Spieler können jederzeit mit ihrer Sitzungs-ID zurückkehren.

Während einer Trennung bleibt der Spieler Bestandteil des Spiels.

Der Host bildet eine Ausnahme. Bleibt der Host länger als 30 Sekunden getrennt, wird das Spiel beendet.

---

### Sicherheit

Der Client gilt grundsätzlich als nicht vertrauenswürdig.

Der Server validiert jede eingehende Nachricht.

Hierzu gehören unter anderem:

* Spielername
* Lobbycode
* Sitzungs-ID
* Kategorien
* Einstellungen
* Antworten
* Buzz
* Bewertungsaktionen
* Hostrechte
* Spielstatus
* Verbindungsstatus

Keine Spielentscheidung darf ausschließlich auf Basis von Clientdaten getroffen werden.

---

# 3. Designrichtlinien

Die Benutzeroberfläche verfolgt einen minimalistischen Ansatz.

Der Fokus liegt auf Übersichtlichkeit, geringer Ablenkung und schneller Bedienbarkeit.

Alle Ansichten müssen sowohl auf Desktop- als auch auf Mobilgeräten vollständig nutzbar sein.

Das Layout darf sich an die Bildschirmgröße anpassen, die Funktionalität bleibt jedoch auf allen Geräten identisch.

Weitere UI-Komponenten und Bildschirmabläufe werden in den folgenden Kapiteln detailliert beschrieben.

# 4. Lobby-System

## 4.1 Grundprinzip

Die Lobby ist der zentrale Einstiegspunkt für alle Spieler.

Eine Lobby existiert unabhängig vom Spielzustand und kann sich in folgenden Situationen befinden:

* leer (keine Spieler)
* befüllt (Spieler verbunden)
* im Spiel (aktive Runde)
* im Review / Ergebniszustand
* nach Spielende (automatischer Reset möglich)

---

## 4.2 Lobby-Erstellung

Eine Lobby wird durch einen Client erstellt.

Der Ersteller wird automatisch Host.

Beim Erstellen werden folgende Daten gesetzt:

* Spielername (1–20 Zeichen)
* automatisch generierter Lobbycode (6 Ziffern)
* Host-Session-ID
* initiale Standardkategorien („Stadt“, „Land“, „Fluss“)
* Standard-Einstellungen

---

## 4.3 Lobbycode

* Der Lobbycode besteht ausschließlich aus **6 zufälligen Ziffern**
* Beispiel: `482915`
* Er ist eindeutig pro aktiver Lobby
* Wird für Beitritt und Einladung verwendet

---

## 4.4 Beitritt zur Lobby

Ein Spieler kann einer Lobby beitreten durch:

* Eingabe des Lobbycodes
* Einladungslink (`/join/123456`)
* QR-Code (enthält denselben Link)

### Validierung beim Beitritt (Server)

Der Server prüft:

* Lobby existiert
* Lobby ist im Zustand „Lobby“ (nicht laufendes Spiel)
* Name ist gültig (1–20 Zeichen)
* Name ist innerhalb der Lobby eindeutig

Bei Erfolg wird:

* eine Session-ID erzeugt
* Spieler der Lobby hinzugefügt
* Zustand an alle Clients synchronisiert

---

## 4.5 Spielerstatus

Ein Spieler kann folgende Zustände haben:

* connected
* disconnected (Reconnect möglich)
* kicked
* removed (bei Lobby-Ende)

Disconnected Spieler bleiben Teil der Lobby und behalten:

* Name
* Punkte
* Status im Spiel

---

## 4.6 Host-Verlust

Wenn der Host die Verbindung trennt:

* wird ein **Host-Disconnected-State** aktiviert
* alle Clients sehen einen blockierenden Screen
* keine Interaktion möglich

### Timeout-Regel

* nach 30 Sekunden ohne Reconnect:

  * wird das aktuelle Spiel beendet
  * entweder:

    * Ergebnis wird angezeigt (falls vorhanden)
    * oder Rückkehr zum Startscreen

---

## 4.7 Spieler entfernen (Kick)

Der Host kann Spieler aus der Lobby entfernen, jedoch nur im Lobby-Zustand (vor Spielstart).

Beim Kick passiert:

* Spieler wird sofort aus der Lobby entfernt
* Session bleibt ungültig
* Client wird auf Startscreen zurückgesetzt
* Nachricht: „Du wurdest gekickt“

---

## 4.8 Lobby-Lebensdauer

Eine Lobby bleibt bestehen solange:

* der Host verbunden ist
* oder der Host innerhalb von 30 Sekunden reconnectet

Wenn diese Bedingung verletzt wird:

* Lobby wird zerstört
* alle Spieler werden zurück zum Startscreen gebracht

---

# 5. Spielsystem

## 5.1 Trennung: Lobby vs Spiel

* **Lobby:** Konfiguration, Vorbereitung, Beitritt
* **Spiel:** aktive Runden + Punkte + Buchstaben
* **Runde:** einzelner Buchstabe + Eingaben + Bewertung

---

## 5.2 Spielstart

Das Spiel kann nur vom Host gestartet werden.

Voraussetzungen:

* mindestens 1 Spieler in Lobby
* alle Einstellungen gültig
* mindestens 1 Kategorie vorhanden

Beim Start:

* Spielstatus wechselt zu `Countdown`
* erste Runde wird initialisiert

---

## 5.3 Countdown

Vor jeder Runde:

* 3 Sekunden Countdown
* optionaler Buchstaben-Visibility-Modus:

  * sichtbar während Countdown
  * oder erst danach sichtbar

Nach Countdown:

* Spielstatus → `Playing`

---

## 5.4 Buchstabenlogik

* Alphabet: A–Z
* keine Umlaute (Ä, Ö, Ü, ß ausgeschlossen)
* jeder Buchstabe darf nur einmal pro Spiel vorkommen
* zufällige Auswahl aus verbleibenden Buchstaben

Wenn keine Buchstaben übrig sind:

* Spiel endet automatisch

---

## 5.5 Eingabe-Regeln

Eine Antwort ist gültig, wenn:

* sie mit dem aktuellen Buchstaben beginnt (nach Normalisierung)
* sie 1–30 Zeichen lang ist
* sie nicht leer ist

### Normalisierung:

* trim()
* erstes Zeichen uppercase
* rest lowercase

Der Server ist die einzige Instanz der Validierung.

---

## 5.6 Antwortübertragung

* Eingaben werden kontinuierlich an den Server gesendet:

  * bei Input-Wechsel (wenn möglich)
  * ansonsten mindestens alle 5 Sekunden
* zusätzlich Speicherung im LocalStorage

Bei:

* Buzz
* Zeitablauf

werden alle aktuellen Antworten final an den Server gesendet.

---

## 5.7 Buzz-System

Ein Spieler darf nur buzzern wenn:

* alle Kategorien ausgefüllt sind

Wenn ein Spieler buzzert:

* Runde endet sofort
* alle Antworten werden finalisiert
* Eingaben werden gesperrt
* Status → `WaitingForReview`

Bei unbegrenzter Zeit:

* Buzz ist einziger Rundenschluss

Bei Zeitlimit:

* Buzz oder Timeout beendet Runde

---

## 5.8 Zeitlogik

Es existieren zwei Modi:

### Unbegrenzte Zeit

* Stoppuhr läuft
* nur Buzz beendet Runde

### Zeitlimit

* Countdown-Timer
* Ablauf beendet Runde automatisch

---

## 5.9 Rundenende

Nach Ende einer Runde:

* Zustand → `WaitingForReview`
* keine Änderungen mehr erlaubt
* Host beginnt Bewertung

---

# 6. Bewertungsystem

## 6.1 Grundprinzip

* Host bewertet alle Antworten synchron
* alle Spieler sehen denselben Bewertungszustand
* Bewertung erfolgt Kategorie für Kategorie

---

## 6.2 Bewertungsschnittstelle

Der Host kann:

* Antwort akzeptieren
* Antwort ablehnen
* Antworten zusammenführen (Merge)

---

## 6.3 Merge-Regel

Mehrere Antworten können zu einer Gruppe zusammengeführt werden.

Alle zusammengeführten Antworten gelten als identisch.

---

## 6.4 Validität

Antworten sind gültig wenn:

* sie regelkonform sind
* sie mit Buchstaben beginnen
* sie nicht leer sind

Ungültige Antworten erhalten automatisch 0 Punkte.

---

## 6.5 Bewertungssperre

Sobald Bewertung abgeschlossen ist:

* keine Änderungen mehr möglich
* Punkte werden finalisiert

---

# 7. Punkteberechnung

Die Punkte werden pro Kategorie berechnet.

Regeln:

* 0 Punkte → ungültig oder leer
* 5 Punkte → gültig, aber nicht einzigartig
* 10 Punkte → einzigartig gültig
* 20 Punkte → einzige gültige Antwort in Kategorie

---

## 7.1 Gesamtscore

* Punkte werden über alle Runden hinweg addiert
* Anzeige nach jeder Runde
* finale Rangliste am Spielende

---

## 7.2 Ranking

* Sortierung nach Punktzahl (absteigend)
* bei Gleichstand:

  * gleiche Platzierung
  * alphabetische Sortierung als sekundäres Kriterium

---

# 8. Reconnect-System

## 8.1 Session-ID

* wird vom Server erzeugt
* im LocalStorage gespeichert
* dient als einzige Identität eines Spielers

---

## 8.2 Reconnect Ablauf

Beim Laden:

1. Session-ID prüfen
2. Reconnect an Server senden
3. Server stellt Zustand wieder her

---

## 8.3 Wiederherstellung

Der Spieler erhält:

* Lobby-Zustand
* Spielstatus
* aktuelle Runde
* bisherige Eingaben
* Punkte

---

## 8.4 Disconnect Verhalten

* Spieler bleibt „existent“
* Eingaben werden lokal gespeichert
* Server synchronisiert bei Reconnect

---

## 8.5 Host-Disconnect

* Blockierender Screen für alle Spieler
* 30 Sekunden Timeout
* danach Spielende oder Ergebnisanzeige

---

# 9. Spielende

## 9.1 Automatisches Spielende

Ein Spiel endet wenn:

* alle Buchstaben verbraucht wurden

oder

* Host das Spiel beendet

---

## 9.2 Ergebnis

Nach Spielende:

* finale Rangliste wird angezeigt
* Lobby bleibt bestehen

---

## 9.3 Neue Runde (neues Spiel)

Nach Spielende kann Host:

* neues Spiel starten

Dabei:

* neues Alphabet
* neue Spielrunde beginnt
* Spieler bleiben in Lobby
* neue Session der Runde

---

## 9.4 Lobby-Neuerstellung nach Alphabet

Wenn das Alphabet vollständig gespielt wurde:

* automatische neue Lobby-Session
* Spieler werden übernommen
* neuer Code wird generiert
* Settings bleiben editierbar

---

# 10. Host-System

## 10.1 Rechte

Der Host darf:

* Spieler kicken
* Kategorien bearbeiten
* Einstellungen ändern
* Spiel starten
* Bewertung durchführen
* Runden navigieren
* Spiel beenden

---

## 10.2 Einschränkungen

* Host kann sich nicht selbst kicken
* Host-Aktionen werden serverseitig validiert

---

## 10.3 Host-Verlust

Siehe Abschnitt 8.5

---

# 11. Server-Validierung (Grundprinzip)

Der Server ist die einzige autoritative Instanz.

Er validiert:

* Namen (1–20 Zeichen)
* Kategorien (1–30 Zeichen)
* Lobbycodes
* Session-IDs
* Antworten (Länge + Buchstabe)
* Buzz-Regeln
* Host-Rechte
* Bewertungsaktionen
* Merge-Operationen
* Reconnect-Authentizität

Alle ungültigen Aktionen werden ignoriert oder mit Fehlercode beantwortet.

---

# 12. Abschluss dieses Abschnitts

Dieser Teil der SRS definiert:

* Lobby-System
* Spielsystem
* Rundenlogik
* Bewertung
* Punkte
* Reconnect
* Host-System
* Server-Validierung

Im nächsten Abschnitt folgen:

> WebSocket-Protokoll + Datenmodelle + Zustandsmaschine (technisch detailliert)

1. Kommunikationsprinzipien (Nachrichtenformat, Fehlerbehandlung, Synchronisation)
2. Vollständige WebSocket-Events (Client → Server und Server → Client)
3. Alle Datenmodelle (Lobby, Spieler, Runde, Bewertung, Einstellungen, Antworten usw.)
4. Zustandsmaschine (Server- und Client-Zustände mit erlaubten Übergängen)
5. Fehlercodes und Akzeptanzkriterien


