# PageSpeed Insights - Findings

**URL:** https://slf-production-41e3.up.railway.app  
**Analyzed on:** July 6, 2026, 22:28 GMT+1  
**Tool:** Lighthouse 13.4.0

---

## Scores

| Category            | Mobile | Desktop |
| ------------------- | ------ | ------- |
| Performance         | 100    | 100     |
| Accessibility       | 94     | 94      |
| Best Practices      | 92     | 92      |
| SEO                 | 100    | 100     |
| Agentic Browsing    | 2/3    | 2/3     |

---

## Core Web Vitals

| Metric                         | Mobile | Desktop |
| ------------------------------ | ------ | ------- |
| First Contentful Paint (FCP)   | 1.5 s  | 0.4 s   |
| Largest Contentful Paint (LCP) | 1.5 s  | 0.4 s   |
| Total Blocking Time (TBT)      | 0 ms   | 0 ms    |
| Cumulative Layout Shift (CLS)  | 0      | 0       |
| Speed Index                    | 1.5 s  | 0.4 s   |

**Mobile test conditions:** Moto G Power emulation, 4G (150 ms RTT, 1,638 kb/s), CPU 1.2x throttling, Europe  
**Desktop test conditions:** 1350x940, custom throttling (40 ms RTT, 10,240 kb/s), CPU 1x, Europe

---

## ⚠️ Improvement potential (findings)

### 1. Render-blocking resources

- **Savings:** ~300 ms (mobile)
- **Cause:** the CSS file `/assets/index-CYTPkLhM.css` (8.7 KiB, 160 ms load time) blocks the first render
- **Recommendation:** preload the CSS via `<link rel="preload">` or inline critical CSS; load non-critical CSS asynchronously

### 2. Critical request chain

- **Maximum latency:** 191 ms (mobile), 158 ms (desktop)
- **Chain:**
  1. HTML document: 91 ms, 1.52 KiB
  2. `/assets/index-CzChJ4q7.js`: 191 ms, 136.98 KiB
  3. `/assets/index-CYTPkLhM.css`: 130 ms, 8.66 KiB
- **Recommendation:** shorten the chain, shrink resources or defer non-critical resources

### 3. Unused JavaScript

- **Savings:** ~68 KiB
- **File:** `/assets/index-CzChJ4q7.js` (135.9 KiB transferred, 67.7 KiB unused code)
- **Recommendation:** optimize tree-shaking, code-splitting (dynamic imports), remove unneeded libraries

### 4. LCP delay: element render

- **LCP element:** `<h1 class="text-3xl font-bold tracking-tight">` (text "Stadt Land Fluss")
- **Breakdown:**
  - Time to First Byte: 0 ms ✅
  - Delay rendering the element: 280 ms ⚠️
- **Recommendation:** reduce render-blocking resources that delay the LCP element

### 5. Total network payload

- **Size:** 147 KiB total
  - JS: 137.0 KiB
  - CSS: 8.7 KiB
  - HTML: 1.5 KiB
- **Recommendation:** reduce bundle size, check compression

### 6. Accessibility - color contrast (score deduction)

- **Problem:** the contrast ratio between foreground and background color is insufficient
- **Affected elements:** amber-colored border area (`div.flex.items-center...border-amber-500`) and other UI elements
- **Recommendation:** raise color contrast to at least 4.5:1 (text) or 3:1 (large text)

### 7. Best Practices - WebSocket error in the console (score deduction)

- **Problem:** the WebSocket connection fails according to the Lighthouse console
- **Error message:** `WebSocket connection to 'wss://slf-production-41e3.up.railway.app/ws' failed: Error in connection establishment: net::ERR_NAME_NOT_RESOLVED`
- **Context:** the WS connection works correctly in a real browser. The issue is that the connection takes ~200 ms to establish, but Lighthouse already captures the error UI state on the initial render.
- **Recommendation:** optimistic UI, the app starts with `connected: true` as the default state and shows the error state only when the connection actually fails (not just when it is delayed):

```js
// Instead of waiting for the connection, start optimistically
const [connected, setConnected] = useState(true);

useEffect(() => {
  const ws = new WebSocket("wss://...");
  ws.onopen = () => setConnected(true);
  ws.onerror = () => setConnected(false);
  ws.onclose = () => setConnected(false);
}, []);
```

### 8. Best Practices - missing Content Security Policy (CSP)

- **Problem:** no `Content-Security-Policy` header set
- **Details:**
  - `'unsafe-inline'` present in `script-src` (medium severity)
  - No header for Trusted Types (high severity, XSS risk)
- **Recommendation:** configure a CSP header in the server/Nginx/Vite; add `require-trusted-types-for 'script'`

### 9. Agentic Browsing - llms.txt incomplete

- **Problem:** the `llms.txt` file does not follow the recommendations
- **Details:** the file is missing an H1 heading and contains no links
- **Recommendation:** complete `llms.txt` according to the standard with `# Title` and relevant links

---

## ✅ What already works well

- **Server response time:** 1 ms, very fast
- **Text compression:** active
- **Redirects:** none
- **HTTPS:** active
- **DOM size:** only 33 elements (very small)
- **TBT:** 0 ms, no blocking tasks
- **CLS:** 0, no layout shift
- **JavaScript execution time:** 0.1 s (104 ms total)
- **Viewport for mobile:** configured correctly
- **SEO:** complete (100/100), title, meta description, robots.txt, hreflang all present
- **No deprecated APIs**, no third-party cookies
- **ARIA attributes:** implemented correctly
- **Accessibility tree:** structured and navigable for AI agents

---

## 📋 Prioritized action list

| Priority   | Action                                           | Expected effect             | Status                                                                                                                     |
| ---------- | ------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 🔴 High    | WebSocket optimistic UI (useState default: true) | Best Practices score, UX    | ✅ done (`ws.status`/`lastStatus=true`, `ConnectionBadge` seeds from it)                                                  |
| 🔴 High    | Add CSP header                                   | Security + Best Practices   | ✅ done (`backend/cmd/server/main.go`, even without `'unsafe-inline'` for scripts, sha256 hash)                           |
| 🟡 Medium  | Reduce unused JS (~68 KiB)                        | Bundle size, LCP mobile     | ✅ done (QR libs already lazy; now `Room`+game screens as their own chunk too -> home bundle 459->401 KiB)                |
| 🟡 Medium  | Load CSS non-render-blocking                      | FCP/LCP mobile (-300 ms)    | ⏸️ open, Vite default bundles a single CSS; critical inlining would be a large effort at already 100/100 performance      |
| 🟡 Medium  | Improve color contrast                            | Accessibility score         | ✅ done (`text-amber-700` -> `text-amber-800`, ~4.48:1 -> >6:1)                                                           |
| 🟢 Low     | Complete llms.txt                                 | Agentic Browsing score      | ✅ done (`frontend/public/llms.txt` has H1 + links)                                                                       |
| 🟢 Low     | Set font-display: swap                            | CLS stability               | ➖ not relevant, no web fonts, only a `system-ui` stack                                                                    |
