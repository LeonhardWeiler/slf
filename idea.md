Stadt-Land-Fluss – Projektbeschreibung

Ziel



Es soll eine moderne Multiplayer-Version von Stadt-Land-Fluss entwickelt werden. Das Spiel besteht aus einem TypeScript-Frontend und einem Go-Backend. Die Kommunikation zwischen Client und Server erfolgt ausschließlich über WebSockets, sodass sämtliche Spielzustände in Echtzeit synchronisiert werden.



Die Anwendung besitzt keine Benutzerkonten und keine Datenbank. Alle Spielzustände werden ausschließlich während der Laufzeit im Arbeitsspeicher des Servers gehalten.



Technologie

Frontend

TypeScript

React

React Router

Vite

TailwindCSS

shadcn/ui

Zustand für State Management

Zod zur Validierung aller WebSocket-Nachrichten

Bun als Paketmanager

Backend

Go

coder/websocket

Air für Hot Reload

Zod-kompatibles WebSocket-Protokoll (Validierung im Frontend)

Entwicklungsumgebung

Nix Flakes

Docker

Docker Compose

CI/CD



Bei jedem Push auf das GitLab-Repository wird automatisch ein Docker-Image erstellt.



Design



Das Design soll minimalistisch sein.



Es existieren zwei Themes:



Hell

Dunkel



Beim ersten Besuch wird automatisch die Systemeinstellung verwendet.



Über einen Toggle kann jederzeit zwischen beiden Themes gewechselt werden.



Die Auswahl wird dauerhaft im LocalStorage gespeichert.



Die gesamte Anwendung soll vollständig responsive sein.



Desktop:



klassisches Stadt-Land-Fluss-Layout

Kategorien nebeneinander



Mobil:



Kategorie und Eingabefeld untereinander

optimiert für Touch-Bedienung

Benutzer



Es existieren keine Accounts.



Beim Erstellen oder Beitreten einer Lobby gibt jeder Benutzer einen Namen ein.



Regeln:



maximal 20 Zeichen

innerhalb einer Lobby eindeutig



Der Ersteller einer Lobby ist automatisch Host.



Startseite



Die Startseite besitzt zwei Möglichkeiten:



Gruppe erstellen



Der Benutzer gibt seinen Namen ein.



Es wird eine Lobby erstellt.



Der Benutzer wird Host.



Gruppe beitreten



Der Benutzer gibt



seinen Namen

den Lobbycode



ein.



Alternativ kann der Beitritt erfolgen über



Einladungslink

QR-Code



Der QR-Code enthält den vollständigen Einladungslink.



Lobby



In der Lobby sieht man



Lobbycode

QR-Code

alle Spieler

Host

Spieloptionen



Nur der Host darf Einstellungen ändern.



Mitspieler sehen diese live.



Spieloptionen



Der Host kann



Kategorien hinzufügen

Kategorien bearbeiten

Kategorien löschen



Außerdem kann eingestellt werden:



Zeitlimit

unbegrenzte Zeit

ob der Buchstabe bereits während des Countdowns sichtbar sein soll oder erst nach dessen Ende

Spielbeginn



Der Host startet die Runde.



Vor jeder Runde erscheint ein Countdown von drei Sekunden.



Danach beginnt das Spiel.



Falls aktiviert, wird der Buchstabe bereits während des Countdowns angezeigt.



Ansonsten erscheint er erst nach Ablauf des Countdowns.



Buchstaben



Verwendet wird ausschließlich das Alphabet



A bis Z



ohne



Ä

Ö

Ü

ß



Jeder Buchstabe darf pro Spiel höchstens einmal vorkommen.



Bereits verwendete Buchstaben werden nicht erneut ausgewählt.



Sind alle Buchstaben gespielt, endet das Spiel automatisch.



Spieloberfläche



Desktop:



Die Kategorien werden als Tabelle dargestellt.



Mobil:



Kategorie und Eingabefeld werden untereinander angezeigt.



Während der Runde sieht jeder Spieler



den aktuellen Buchstaben

eine laufende Zeit



Diese besteht aus



einer Stoppuhr bei unbegrenzter Zeit

einem Countdown bei Zeitlimit

Eingaben



Jede Eingabe muss mit dem aktuellen Buchstaben beginnen.



Vor der Prüfung werden Eingaben automatisch normalisiert.



Dabei wird



führender Leerraum entfernt

nachfolgender Leerraum entfernt

der erste Buchstabe großgeschrieben



Weitere Änderungen erfolgen nicht.



Buzzern



Ein Spieler darf nur buzzern, wenn sämtliche Kategorien ausgefüllt wurden.



Die Runde endet



sobald ein Spieler gebuzzert hat

oder das Zeitlimit abgelaufen ist.



Danach können keine Antworten mehr verändert werden.



Rundenende



Nach Ablauf der Runde erscheint zunächst ein Wartebildschirm.



Punkte werden noch nicht angezeigt.



Alle Spieler warten darauf, dass der Host die Antworten bewertet.



Bewertung



Die Bewertung erfolgt synchron.



Alle Spieler sehen immer dieselbe Kategorie.



Der Host klickt sich Kategorie für Kategorie durch sämtliche Antworten.



Der Host nimmt selbst ebenfalls am Spiel teil.



Für jede Antwort kann der Host



eine Antwort ablehnen

falsch geschriebene Antworten einer anderen Antwort zuordnen



Dadurch erhalten beide Antworten dieselbe Bewertung.



Während der Bewertung sieht jeder Spieler bereits die vergebenen Punkte.



Der Host kann jederzeit zur vorherigen oder nächsten Kategorie wechseln.



Erst nachdem alle Kategorien bewertet wurden, wird die Runde abgeschlossen.



Punkte



Die Punkte werden automatisch berechnet.



Regeln:



Ungültige Antwort:



0 Punkte



Gültige Antwort:



5 Punkte



Einzigartige gültige Antwort:



10 Punkte



Einziger Spieler mit einer gültigen Antwort:



20 Punkte



Die Punkte werden unmittelbar während der Bewertung angezeigt.



Rundenergebnis



Nach Abschluss aller Kategorien erscheint die Rangliste der aktuellen Runde.



Der Host kann anschließend



eine neue Runde starten

oder das Spiel beenden

Spielende



Das Spiel endet



wenn der Host es beendet

oder automatisch nach dem letzten Buchstaben



Danach erscheint die Endtabelle mit der endgültigen Platzierung aller Spieler.



Host



Der Host besitzt zusätzliche Rechte.



Er darf



Spiel starten

Kategorien verwalten

Einstellungen ändern

Antworten bewerten

neue Runde starten

Spiel beenden



Verlässt der Host das Spiel oder verliert dauerhaft die Verbindung, wird das Spiel beendet.



Alle Mitspieler erhalten unmittelbar die zuletzt berechnete Rangliste.



Mitspieler



Mitspieler besitzen einen "Spiel verlassen"-Button.



Der Host besitzt diesen nicht.



Reconnect



Jeder Spieler erhält beim Betreten einer Lobby eine Sitzungs-ID.



Diese wird im LocalStorage gespeichert.



Wird die Seite neu geladen oder die Verbindung kurzzeitig unterbrochen, verbindet sich der Client automatisch erneut.



Dabei werden



Name

Lobby

Spielstatus

bisherige Eingaben



automatisch wiederhergestellt.



Solange die Lobby existiert, kann ein Spieler jederzeit zurückkehren.



Synchronisation



Der Server ist die einzige Quelle der Wahrheit.



Alle Spielzustände werden ausschließlich auf dem Server verwaltet.



Das Frontend stellt lediglich den aktuellen Zustand dar.



Sämtliche Änderungen werden per WebSocket in Echtzeit an alle verbundenen Spieler übertragen.



Alle Clients sehen dadurch jederzeit denselben Spielzustand.
