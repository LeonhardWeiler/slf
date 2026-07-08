1. Beim reload soll nicht immer zuerst "Keine Verbindung zum Server ..." angezeigt werden, obwohl eine verbindung sofort da ist und auch nichts in die console geloggt wird. Diese Schrift verschiebt das layout und macht es einfach weniger schön alles. Vielleicht soll man auch erst überprüfen ob man verbindung zum server hat, wenn man auf join oder create klickt, wenn man am start screen ist
2. Layout was forced before the page was fully loaded. If stylesheets are not yet loaded this may cause a flash of unstyled content. Node.js:416:1
   Source map error: JSON.parse: unexpected character at line 1 column 1 of the JSON data
   Resource URL: https://slf-production-41e3.up.railway.app/%3Canonymous%20code%3E
   Source Map URL: installHook.js.map
   Source map error: can't access property "sources", map is undefined
   Resource URL: https://slf-production-41e3.up.railway.app/%3Canonymous%20code%3E
   Source Map URL: react_devtools_backend_compact.js.map
3. Der lobby code soll immer alles groß sein, auch zum eingeben und in der url
4. Man soll keine runde starten können, wenn keine spieler mehr drinnen sind, wenn alle verlassen haben. Man kann aber dann wieder zurück zum lobby screen menschen her holen.
5. Wenn niemand etwas eingegeben hat und die runde beendet wird, überspringen alle den review screen und sind bei der tabelle. Wenn keine spielende person da ist, dann werden auch die eingaben übersprungen
6. Der join code soll immer unter dem title und nie daneben, wie jetzt angezeigt werden
7. Bei den input eingaben, muss man mindestens 2 zeichen für eine gültige eingabe haben, sonst wird kein grüner haken angezeigt, man kann nicht buzzern, man bekommt 0 punkte, etc.
8. Am start screen, sollen die beiden buttons nur auf mobile schmäler sein, aber auf beidem etwas breiter als gerade
9. Wenn man einen lobby code eintippt, den es nicht gibt, soll die border vom input feld rot werden, wie bei einer nicht richtigen eingabe
10. Wenn ich auf join klicke, einen code eingebe, zurück und dann wieder auf join klicke, soll das input feld wieder leer sein
11. Alle animationen sollen schneller, oder ganz weggemacht werden, je nachdem was besser ist, damit sich die ui schneller anfühlt. Gerade fühlt es sich sehr sluggish an
12. Bei den Kategorien soll Der edit und delete button, auf Der gleichen stell sein wie accept und dismiss, wenn du weißt welche ich meine. Gerade sind sie etwas versetzt
13. Der delete button, bei der kategory, soll nicht die farbe wechseln, bei hover oder klickt, sondern immer rot sein
14. Der edit und delete button, sollen bei hover und click, leicht gedreht werden, damit man eine useraction erkennt
15. Tooltips öffnen sich gerade nur, wenn man ganz genau auf das icon clickt, ich möchte, dass sie sich auch öffnen, wenn man auf den namen daneben klickt, und vielleicht generell die klick area ein wenig größer
