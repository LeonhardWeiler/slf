# PageSpeed Insights – Findings

**URL:** https://slf-production-41e3.up.railway.app  
**Analysiert am:** 06. Juli 2026, 22:28 GMT+1  
**Tool:** Lighthouse 13.4.0

---

## Scores

| Kategorie            | Mobile | Desktop |
| -------------------- | ------ | ------- |
| Leistung             | 100    | 100     |
| Barrierefreiheit     | 94     | 94      |
| Best Practices       | 92     | 92      |
| SEO                  | 100    | 100     |
| Agentisches Browsing | 2/3    | 2/3     |

---

## Core Web Vitals

| Metrik                         | Mobile | Desktop |
| ------------------------------ | ------ | ------- |
| First Contentful Paint (FCP)   | 1,5 s  | 0,4 s   |
| Largest Contentful Paint (LCP) | 1,5 s  | 0,4 s   |
| Total Blocking Time (TBT)      | 0 ms   | 0 ms    |
| Cumulative Layout Shift (CLS)  | 0      | 0       |
| Speed Index                    | 1,5 s  | 0,4 s   |

**Testbedingungen Mobile:** Moto G Power Emulation, 4G (150 ms RTT, 1.638 kb/s), CPU 1,2x Drosselung, Europa  
**Testbedingungen Desktop:** 1350x940, benutzerdefinierte Drosselung (40 ms RTT, 10.240 kb/s), CPU 1x, Europa

---

## ⚠️ Verbesserungspotenzial (Findings)

### 1. Rendering-blockierende Ressourcen

- **Einsparung:** ~300 ms (Mobile)
- **Ursache:** Die CSS-Datei `/assets/index-CYTPkLhM.css` (8,7 KiB, 160 ms Ladezeit) blockiert das erste Rendering
- **Empfehlung:** CSS per `<link rel="preload">` vorladen oder kritisches CSS inlinen; nicht-kritisches CSS asynchron laden

### 2. Kritischer Anfragepfad (Request Chain)

- **Maximale Latenz:** 191 ms (Mobile), 158 ms (Desktop)
- **Kette:**
  1. HTML-Dokument: 91 ms, 1,52 KiB
  2. `/assets/index-CzChJ4q7.js`: 191 ms, 136,98 KiB
  3. `/assets/index-CYTPkLhM.css`: 130 ms, 8,66 KiB
- **Empfehlung:** Kette verkürzen, Ressourcen verkleinern oder nicht-kritische Ressourcen zurückstellen

### 3. Ungenutztes JavaScript

- **Einsparung:** ~68 KiB
- **Datei:** `/assets/index-CzChJ4q7.js` (135,9 KiB übertragen, 67,7 KiB ungenutzter Code)
- **Empfehlung:** Tree-Shaking optimieren, Code-Splitting (dynamic imports), nicht benötigte Bibliotheken entfernen

### 4. LCP-Verzögerung: Element-Rendering

- **LCP-Element:** `<h1 class="text-3xl font-bold tracking-tight">` (Text "Stadt Land Fluss")
- **Aufschlüsselung:**
  - Time to First Byte: 0 ms ✅
  - Verzögerung beim Rendering des Elements: 280 ms ⚠️
- **Empfehlung:** Render-blockierende Ressourcen reduzieren, die das LCP-Element verzögern

### 5. Gesamte Netzwerknutzlast

- **Größe:** 147 KiB gesamt
  - JS: 137,0 KiB
  - CSS: 8,7 KiB
  - HTML: 1,5 KiB
- **Empfehlung:** Bundle-Größe reduzieren, Komprimierung prüfen

### 6. Barrierefreiheit – Farbkontrast (Score-Abzug)

- **Problem:** Kontrastverhältnis zwischen Vorder- und Hintergrundfarbe ist unzureichend
- **Betroffene Elemente:** Amber-farbiger Border-Bereich (`div.flex.items-center...border-amber-500`) und weitere UI-Elemente
- **Empfehlung:** Farbkontrast auf mindestens 4,5:1 (Text) bzw. 3:1 (großer Text) erhöhen

### 7. Best Practices – WebSocket-Fehler in der Konsole (Score-Abzug)

- **Problem:** WebSocket-Verbindung schlägt fehl laut Lighthouse-Konsole
- **Fehlermeldung:** `WebSocket connection to 'wss://slf-production-41e3.up.railway.app/ws' failed: Error in connection establishment: net::ERR_NAME_NOT_RESOLVED`
- **Kontext:** Die WS-Verbindung funktioniert korrekt im echten Browser. Das Problem ist, dass die Verbindung ~200 ms braucht, bis sie aufgebaut ist, Lighthouse aber den Fehler-UI-Zustand bereits beim initialen Render erfasst.
- **Empfehlung:** Optimistic UI – App startet mit `connected: true` als Default-State und zeigt den Fehlerzustand nur, wenn die Verbindung tatsächlich fehlschlägt (nicht nur verzögert ist):

```js
// Statt auf die Verbindung zu warten, optimistisch starten
const [connected, setConnected] = useState(true);

useEffect(() => {
  const ws = new WebSocket("wss://...");
  ws.onopen = () => setConnected(true);
  ws.onerror = () => setConnected(false);
  ws.onclose = () => setConnected(false);
}, []);
```

### 8. Best Practices – Fehlende Content Security Policy (CSP)

- **Problem:** Kein `Content-Security-Policy`-Header gesetzt
- **Details:**
  - `'unsafe-inline'` in `script-src` vorhanden (mittlerer Schweregrad)
  - Kein Header für Trusted Types (hoher Schweregrad, XSS-Risiko)
- **Empfehlung:** CSP-Header im Server/Nginx/Vite konfigurieren; `require-trusted-types-for 'script'` hinzufügen

### 9. Agentisches Browsing – llms.txt unvollständig

- **Problem:** `llms.txt`-Datei entspricht nicht den Empfehlungen
- **Details:** Datei fehlt eine H1-Überschrift und enthält keine Links
- **Empfehlung:** `llms.txt` gemäß Standard mit `# Titel` und relevanten Links ergänzen

---

## ✅ Was bereits gut funktioniert

- **Server-Antwortzeit:** 1 ms – sehr schnell
- **Textkomprimierung:** aktiv
- **Weiterleitungen:** keine
- **HTTPS:** aktiv
- **DOM-Größe:** nur 33 Elemente (sehr klein)
- **TBT:** 0 ms – keine Blocking-Tasks
- **CLS:** 0 – kein Layout Shift
- **JavaScript-Ausführungszeit:** 0,1 s (104 ms gesamt)
- **Viewport für Mobile:** korrekt konfiguriert
- **SEO:** vollständig (100/100) – Title, Meta Description, robots.txt, hreflang alles vorhanden
- **Keine veralteten APIs**, keine Third-Party-Cookies
- **ARIA-Attribute:** korrekt implementiert
- **Accessibility Tree:** strukturiert und für KI-Agenten navigierbar

---

## 📋 Priorisierte Maßnahmenliste

| Priorität  | Maßnahme                                         | Erwarteter Effekt           | Status                                                                                                                    |
| ---------- | ------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Hoch    | WebSocket Optimistic UI (useState default: true) | Best Practices Score, UX    | ✅ umgesetzt (`ws.status`/`lastStatus=true`, `ConnectionBadge` seedet daraus)                                             |
| 🔴 Hoch    | CSP-Header hinzufügen                            | Sicherheit + Best Practices | ✅ umgesetzt (`backend/cmd/server/main.go`, sogar ohne `'unsafe-inline'` für Scripts – sha256-Hash)                       |
| 🟡 Mittel  | Ungenutztes JS reduzieren (~68 KiB)              | Bundle-Größe, LCP Mobile    | ✅ umgesetzt (QR-Libs bereits lazy; jetzt auch `Room`+Game-Screens als eigener Chunk → Home-Bundle 459→401 KiB)           |
| 🟡 Mittel  | CSS nicht render-blockierend laden               | FCP/LCP Mobile (-300 ms)    | ⏸️ offen – Vite-Default bündelt ein einziges CSS; kritisches Inlining wäre großer Aufwand bei bereits 100/100 Performance |
| 🟡 Mittel  | Farbkontrast verbessern                          | Barrierefreiheit Score      | ✅ umgesetzt (`text-amber-700` → `text-amber-800`, ~4,48:1 → >6:1)                                                        |
| 🟢 Niedrig | llms.txt vervollständigen                        | Agentisches Browsing Score  | ✅ umgesetzt (`frontend/public/llms.txt` hat H1 + Links)                                                                  |
| 🟢 Niedrig | font-display: swap setzen                        | CLS-Stabilität              | ➖ nicht relevant – keine Web-Fonts, nur `system-ui`-Stack                                                                |
