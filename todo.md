sec-1 nur wenn es dann noch mit localhost und ip, etc. funktinoiert,
wenn ja dann implementieren

sec-2 auch wenn noch nicht prod schadet es wahrscheinlich nicht

sec-3 neuer sechstelliger code soll a-z und 0-9 sein, also buchstaben und
zahlen gemischt, dass es mehr möglichkeiten gibt. außerdem rate limiting
für join (nicht zu streng) und backoff (nicht zu streng) implementieren

bug-1 *bool verwenden

bug-2 fixen

bug-3 es sollte möglich sein alle kategorien zu löschen, es muss nur eine
vorhanden sein um die runde zu starten

ux-1 kleine dismissable fehler anzeige

a11y-1 fixen

ux-2 fixen

ux-3 rote border wenn es falsch ist, aber erst wenn man weggeklickt
hat, also nicht von anfang an oder so

ux-4 fixen (ich denke es funktioniert das clipboard bei mir aber gerade
sschon)

a11y-2 fixen

cq-1 verwende überall biome als linter und in ci aufnehmen

cq-2 ignorieren

cq-3 nur das laden was gebraucht wird um fcp zu minimieren

5. performance fixen, dass es besser funktioniert

test-1 test commiten und in ci aufnehmen

test-2 bei ci go und ts code linten

7. doc das gesamte readme auf den neuesten stand updaten
