- A1 soll so gelassen werden (sessionStorage statt localStorage)
- A2 soll so gelassen werden (antwortfelder einspaltig)
- A3 soll so gelassen werden (buchstaben auswählen)

- B1 soll so gelassen werden (lobby geht sofort zu)
- B2 soll so gelassen werden (der lobbycode kann weiterverwendet
werden)
- B3 evaluiere selbst ob diese SRS Punkte einen Vorteil bringen würden.
  Implementiere wenn Ja und ignoriere, wenn Nein (zustand versionierung
und resync handshake)

- C1 evaluiere selbst, ob das zu implementieren ist (meine meinung ja)
(client validiert server nachrichten mit zod)
- C2 implementiere die Fehlercods
- C3 implementiere die eine stateVersion für Nachrichten
- C4 evaluiere selbst ob es ein Vorteil ist es wie im SRS zu benennen, wenn
  Ja implementiere, wenn Nein ignoriere
- C5 evaluiere selbst ob es ein Vorteil ist es wie im SRS zu benennen, wenn
  Ja implementiere, wenn Nein ignoriere
- C6 ignoriere, es passt so wie es ist
- C7 füge das reson feld hinzu
- C8 ignoriere, es passt so wie es ist

- D1 Der Server muss auch den Buzz überprüfen. implementiere das
- D2 Der Server muss hier ebenso den Buzz (hier die Länge) überprüfen.
implementiere das
- D3 das passt so wie es ist solange gamestart bei < 1 verhindert ist

- E1 evaluiere selbst und implementiere die Felder die du für
implemenetierungswürdig findest

- F1 Mach eine Gitlab CI/CD Pipeline die nach commit ein dockerfile
erstellt, dass ich dann über ein einfaches docker-compose.yml file bekommen
kann und den gesamten server backend + frontend mit einem docker compose
up starten kann. Ich denke ich muss auch z.b. in dem gitlab repository was
ändern, wenn etwas manuell von mir zu machen ist, dann sage mir das. Ich
hab auf dockerhub mein repo unter weilerleonhard/slf erstellt. mein gitlab
ci/cd hat die variablen DOCKERHUB_TOKEN und
DOCKERHUB_USERNAME.
- F2 erledigt sich eh mit F1

- G1 ich möchte wenn möglich die performance messen, dafür möglichst
isoliert
- G2 Der Server soll logging option haben, wenn dafür daten in eine log datei
  geschrieben werden, muss das bei docker als volume mitgedacht
werden
