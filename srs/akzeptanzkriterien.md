# 14. Akzeptanzkriterien

## 14.1 Grundprinzip

Dieses Kapitel definiert die **verbindlichen Kriterien zur Abnahme des Systems**.

Das System gilt als vollständig implementiert, wenn alle folgenden Kriterien erfüllt sind.

Die Akzeptanz basiert auf:

* funktionaler Korrektheit
* Realtime-Synchronisation
* serverseitiger Autorität
* Stabilität unter Mehrbenutzerbetrieb

---

# 14.2 Grundlegende Systemanforderungen

## 14.2.1 Vollständige WebSocket-Kommunikation

✔ Alle Interaktionen erfolgen ausschließlich über WebSockets
✔ Keine Spiellogik über HTTP
✔ Keine Datenbank-abhängigen Spielzustände

---

## 14.2.2 Server als Single Source of Truth

✔ Der Server entscheidet über alle Spielzustände
✔ Clients können keine Spiellogik beeinflussen
✔ Punkte, Bewertungen und Zustände sind serverseitig berechnet

---

## 14.2.3 Zustandsmaschine

✔ Alle Zustände existieren exakt wie definiert
✔ Zustandsübergänge sind strikt eingehalten
✔ Ungültige Übergänge sind unmöglich oder werden blockiert

---

# 14.3 Lobby-System

## 14.3.1 Erstellung und Beitritt

✔ Lobby kann mit Namen erstellt werden
✔ Lobbycode besteht aus genau 6 Ziffern
✔ Beitritt über Code oder Link funktioniert
✔ QR-Code führt zur korrekten Lobby

---

## 14.3.2 Spielerverwaltung

✔ Spieler haben eindeutige Namen (max. 20 Zeichen)
✔ Host wird korrekt zugewiesen
✔ Spieler können Lobby verlassen
✔ Kick durch Host funktioniert vor Spielstart

---

## 14.3.3 Reconnect

✔ Spieler können jederzeit über Session-ID reconnecten
✔ Zustand wird vollständig wiederhergestellt
✔ Antworten und Spielstatus bleiben erhalten

---

# 14.4 Spielmechanik

## 14.4.1 Rundenlogik

✔ Jede Runde verwendet genau einen Buchstaben (A–Z)
✔ Kein Buchstabe wird doppelt verwendet
✔ Spiel endet nach vollständigem Alphabet

---

## 14.4.2 Eingaben

✔ Antworten müssen mit aktuellem Buchstaben beginnen
✔ Normalisierung erfolgt serverseitig korrekt
✔ Maximale Länge: 30 Zeichen
✔ Leere Antworten sind ungültig

---

## 14.4.3 Buzz-System

✔ Buzz funktioniert nur bei vollständigen Antworten
✔ Erste gültige Buzz-Aktion gewinnt
✔ Runde endet sofort nach Buzz oder Zeitablauf

---

# 14.5 Bewertungssystem

## 14.5.1 Host Review

✔ Nur Host kann Bewertungen durchführen
✔ Alle Spieler sehen identische Bewertung
✔ Navigation zwischen Kategorien funktioniert korrekt

---

## 14.5.2 Validierung

✔ Antworten können als gültig/ungültig markiert werden
✔ Merge von Antworten funktioniert korrekt
✔ Unmerge stellt Originalzustand wieder her

---

## 14.5.3 Punkteberechnung

✔ 0 Punkte für ungültige Antworten
✔ 5 Punkte für gültige, nicht einzigartige Antworten
✔ 10 Punkte für einzigartige gültige Antworten
✔ 20 Punkte für einzige gültige Antwort einer Kategorie

✔ Punkte werden pro Runde korrekt addiert
✔ Gesamtranking wird korrekt berechnet

---

# 14.6 Synchronisation

## 14.6.1 Echtzeit-Updates

✔ Alle Clients sehen identische Zustände
✔ Änderungen werden sofort synchronisiert
✔ Kein Client weicht vom Serverzustand ab

---

## 14.6.2 Reconnect-Sicherheit

✔ Nach Reconnect identischer Zustand wie zuvor
✔ Keine Datenverluste innerhalb einer Runde
✔ UI wird vollständig rekonstruiert

---

# 14.7 Spielende

## 14.7.1 Endbedingungen

✔ Spiel endet bei:

* vollständigem Alphabet
* Host beendet Spiel
* Host-Disconnect > 30 Sekunden

---

## 14.7.2 Ergebnisanzeige

✔ Finales Ranking wird korrekt angezeigt
✔ Gleichstände werden korrekt behandelt
✔ Alphabetische Sortierung bei Gleichstand funktioniert

---

# 14.8 UI & UX

## 14.8.1 Responsiveness

✔ Desktop Layout korrekt (Tabellenstruktur)
✔ Mobile Layout korrekt (vertikal)
✔ Eingaben funktionieren auf Touch-Geräten

---

## 14.8.2 Theme System

✔ Light/Dark Mode funktioniert
✔ Systempräferenz wird berücksichtigt
✔ Einstellung wird gespeichert

---

# 14.9 Stabilität

## 14.9.1 Mehrbenutzerbetrieb

✔ Mehrere Lobbies parallel möglich
✔ Keine Cross-Lobby Interferenzen
✔ Server bleibt stabil unter Last

---

## 14.9.2 Disconnect Handling

✔ Spieler-Disconnect wird korrekt dargestellt
✔ Host-Disconnect führt zu definierter Eskalation
✔ Spiel bleibt konsistent

---

# 14.10 Sicherheit

✔ Keine clientseitige Manipulation möglich
✔ Server validiert alle Eingaben
✔ Ungültige Events verändern keinen Zustand
✔ Host-Rechte sind strikt geprüft

---

# 14.11 Performance

✔ Realtime Latenz < 150 ms im Normalbetrieb
✔ State Updates effizient verteilt
✔ Keine unnötigen Re-Renders durch redundante Events

---

# 14.12 Infrastruktur

✔ Docker Build funktioniert
✔ CI/CD Pipeline erzeugt Images automatisch
✔ Entwicklungsumgebung reproduzierbar (Nix Flakes)

---

# 14.13 Gesamtabnahme

Das System gilt als vollständig akzeptiert, wenn:

* alle Kapitel 14.2 bis 14.12 erfüllt sind
* keine kritischen Bugs in Multiplayer-Flow existieren
* alle Zustände der Zustandsmaschine korrekt durchlaufen werden
* Reconnect, Buzz und Review fehlerfrei funktionieren

---

# 14.14 Abschluss

Mit diesem Kapitel ist die Spezifikation vollständig abgeschlossen.

Das System ist damit vollständig definiert für:

* Implementierung (Frontend + Backend)
* Testautomatisierung
* CI/CD Pipeline Aufbau
* produktionsnahe Umsetzung

