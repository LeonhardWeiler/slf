# 13. Nichtfunktionale Anforderungen

## 13.1 Grundprinzip

Dieses Kapitel definiert alle Anforderungen, die nicht die Spiellogik selbst betreffen, sondern die **Qualität, Stabilität, Performance, Skalierbarkeit und Betrieb des Systems**.

Das System ist eine **Realtime-Multiplayer-WebSocket-Anwendung** und muss daher besonders strenge Anforderungen an Synchronität, Latenz und Konsistenz erfüllen.

Der Server ist jederzeit die einzige autoritative Instanz.

---

# 13.2 Performance

## 13.2.1 Latenz

* Ziel: **< 80 ms durchschnittliche Roundtrip-Zeit (EU-Region)**
* Maximum: **< 150 ms tolerierbar**

Gilt insbesondere für:

* answerUpdate
* buzz
* reviewActions
* state broadcasts

---

## 13.2.2 Event-Verarbeitung

* Events werden **sequenziell pro Lobby verarbeitet**
* keine parallele Mutation eines GameStates
* deterministische Verarbeitung garantiert

---

## 13.2.3 Skalierung pro Instanz

Eine Serverinstanz muss unterstützen:

* mindestens 500 gleichzeitige Spieler
* mehrere parallele Lobbies
* isolierte In-Memory States pro Lobby

---

## 13.2.4 Broadcast-Verhalten

* vollständige State-Broadcasts nur bei Zustandswechseln
* inkrementelle Updates bei Review-Phase erlaubt
* keine redundanten Updates im Playing-State

---

# 13.3 Skalierbarkeit

## 13.3.1 Architekturprinzip

Das System ist:

* vollständig RAM-basiert
* horizontal skalierbar (mehrere Instanzen möglich)
* zustandsisoliert pro Lobby

---

## 13.3.2 Isolation

Jede Lobby enthält:

* eigene Game-Instanz
* eigene Session-Zuordnung
* eigene State-Maschine

Es existiert keine globale Spielkopplung.

---

## 13.3.3 Einschränkung

* keine Datenbank
* kein Persistenzlayer
* kein Recovery nach Server-Restart

---

# 13.4 Zuverlässigkeit

## 13.4.1 Reconnect-Fähigkeit

System muss garantieren:

* Reconnect innerhalb von **30 Sekunden möglich**
* vollständige Wiederherstellung des Spielzustands
* keine Datenverluste innerhalb einer laufenden Runde

---

## 13.4.2 Host-Ausfall

Wenn Host die Verbindung verliert:

* HostDisconnected State wird aktiviert
* 30 Sekunden Grace Period
* danach automatisches GameOver

---

## 13.4.3 Session-Stabilität

* SessionId bleibt browsergebunden persistent
* mehrfacher Reconnect möglich
* Session bleibt gültig solange Lobby existiert

---

# 13.5 Sicherheit

## 13.5.1 Server Authority

Der Server entscheidet über:

* Punkte
* Validität von Antworten
* Buzz-Rechte
* Host-Rechte
* Zustandsübergänge

---

## 13.5.2 Manipulationsschutz

Der Server ignoriert:

* manipulierte Client States
* gefälschte Scores
* unautorisierte Host-Aktionen
* ungültige WebSocket Events

---

## 13.5.3 Validierung

Alle Eingaben werden doppelt validiert:

* Frontend (Zod, UX)
* Backend (finale Validierung)

Backend ist immer maßgeblich.

---

# 13.6 UX Anforderungen

## 13.6.1 Reaktionsverhalten

* Eingaben müssen sofort im UI sichtbar sein
* Server-Updates überschreiben lokale Zustände nur bei Bedarf
* keine spürbaren Verzögerungen im Gameplay

---

## 13.6.2 Konsistenz

Alle Clients sehen:

* identische Spielzustände
* identische Bewertungen
* identische Punktestände
* identische Ranglisten

---

## 13.6.3 Responsiveness

* Desktop: Tabellenlayout (Kategorie-Spalten)
* Mobile: vertikale Eingabeansicht
* vollständige Touch-Unterstützung

---

## 13.6.4 Theme-System

* Light / Dark Mode
* initial basierend auf Systempräferenz
* Speicherung im LocalStorage
* jederzeit umschaltbar

---

# 13.7 Infrastruktur

## 13.7.1 Containerisierung

* Backend läuft in Docker
* Docker Compose für Gesamtsetup

---

## 13.7.2 CI/CD

Bei jedem Push:

* Build Pipeline wird ausgeführt
* Docker Image wird erstellt
* optional Deployment Trigger

---

## 13.7.3 Hot Reload

* Backend: Air (Go)
* Frontend: Vite Dev Server

---

# 13.8 Entwicklungsumgebung

## 13.8.1 Reproduzierbarkeit

* Nix Flakes für identische Entwicklungsumgebungen

---

## 13.8.2 Paketmanagement

* Frontend: Bun

---

# 13.9 Client Architektur

## 13.9.1 Tab = Player Modell

* jeder Browser Tab = ein Spieler
* mehrere Tabs = mehrere Spieler möglich

---

## 13.9.2 LocalStorage Nutzung

Gespeichert werden:

* SessionId
* Theme
* temporäre Eingaben (nur laufende Runde)

---

# 13.10 WebSocket Stabilität

## 13.10.1 Reconnect

* automatische Wiederverbindung
* vollständiger State Sync nach Reconnect
* kein Benutzer-Interaktionsbedarf

---

## 13.10.2 Fallback

Wenn Reconnect fehlschlägt:

* Rückkehr zum Startscreen
* erneuter Lobby-Beitritt erforderlich

---

# 13.11 Datenhaltung

## 13.11.1 In-Memory Prinzip

* keine Datenbank
* kein Persistenzlayer
* kompletter Zustand im RAM

---

## 13.11.2 Konsequenz

* sehr hohe Geschwindigkeit
* einfache Architektur
* aber volatile Daten (kein Restart-Save)

---

# 13.12 Konsistenzmodell

## 13.12.1 Single Source of Truth

Der Server ist:

* einzige Wahrheit
* einzige Berechnungsinstanz
* einzige Entscheidungsinstanz

---

## 13.12.2 Client Konsistenz

Clients sind:

* rein darstellend
* immer eventual consistent
* abhängig von Server-Events

---

# 13.13 Abschluss der Nichtfunktionalen Anforderungen

Dieses Kapitel stellt sicher:

* stabile Echtzeitperformance
* klare Skalierungsgrenzen
* robuste Reconnect-Mechanik
* sichere Server-Authority
* konsistente UX über alle Geräte

---

# 13.14 Status der Spezifikation

Damit sind alle technischen Hauptkapitel abgeschlossen:

* WebSocket-Protokoll ✔
* Datenmodelle ✔
* Zustandsmaschine ✔
* Fehlerbehandlung ✔
* Nichtfunktionale Anforderungen ✔

---

# 13.15 Übergang zum letzten Kapitel

Der letzte verbleibende Teil der SRS ist:

> **14. Akzeptanzkriterien**

Dort wird definiert, wann das System als vollständig korrekt implementiert gilt (Test- und Abnahmekriterien).

