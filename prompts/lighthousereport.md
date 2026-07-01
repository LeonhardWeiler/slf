# Lighthouse / PageSpeed Insights Report

**Testdatum:** 01.07.2026, 19:27 (GMT+2)
**Lighthouse Version:** 13.4.0

---

# Desktop

## Scores

| Kategorie | Score |
|-----------|------:|
| Performance | **100** |
| Accessibility | **92** |
| Best Practices | **92** |
| SEO | **82** |
| Agentic Browsing | **2/3** |

## Core Performance Metrics

| Metrik | Wert |
|---------|------|
| First Contentful Paint (FCP) | **0.4 s** |
| Largest Contentful Paint (LCP) | **0.4 s** |
| Total Blocking Time (TBT) | **0 ms** |
| Cumulative Layout Shift (CLS) | **0.00** |
| Speed Index | **0.6 s** |

### Testbedingungen

- Emulated Desktop
- Lighthouse 13.4.0
- Initial Page Load
- Custom Throttling
- HeadlessChromium 146.0.7680.177

---

## Performance-Optimierungspotenzial

### Caching

- Use efficient cache lifetimes
- Geschätztes Einsparpotenzial: **127 KiB**

### Render Blocking

- Render-blocking requests vorhanden
- Geschätzte Verbesserung: **80 ms**

### JavaScript

- Reduce unused JavaScript
- Geschätztes Einsparpotenzial: **68 KiB**

### Weitere Hinweise

- Network dependency tree analysieren
- LCP breakdown analysieren

---

## Accessibility

### Probleme

- Hintergrund- und Vordergrundfarben besitzen teilweise keinen ausreichenden Kontrast.
- Das Dokument besitzt kein `<main>`-Landmark.

---

## Best Practices

### Probleme

- Browser-Konsole enthält Fehler.
- Chrome Issues Panel meldet Probleme.
- CSP gegen XSS sollte verbessert werden.
- HSTS-Policy sollte stärker konfiguriert werden.
- COOP (Cross-Origin-Opener-Policy) verbessern.
- Trusted Types gegen DOM-XSS einsetzen.

---

## SEO

### Probleme

- Keine Meta Description vorhanden.
- `robots.txt` ist ungültig (**28 Fehler**).

---

## Agentic Browsing

### Probleme

- `llms.txt` entspricht nicht den empfohlenen Richtlinien.

---

# Mobile

## Scores

| Kategorie | Score |
|-----------|------:|
| Performance | **100** |
| Accessibility | **98** |
| Best Practices | **92** |
| SEO | **82** |
| Agentic Browsing | **2/3** |

## Core Performance Metrics

| Metrik | Wert |
|---------|------|
| First Contentful Paint (FCP) | **1.5 s** |
| Largest Contentful Paint (LCP) | **1.5 s** |
| Total Blocking Time (TBT) | **0 ms** |
| Cumulative Layout Shift (CLS) | **0.00** |
| Speed Index | **1.5 s** |

### Testbedingungen

- Emulated Moto G Power
- Slow 4G
- Lighthouse 13.4.0
- Initial Page Load
- HeadlessChromium 146.0.7680.177

---

## Performance-Optimierungspotenzial

### Caching

- Use efficient cache lifetimes
- Geschätztes Einsparpotenzial: **120 KiB**

### Render Blocking

- Render-blocking requests vorhanden.
- Geschätzte Verbesserung: **300 ms**

### JavaScript

- Reduce unused JavaScript
- Geschätztes Einsparpotenzial: **70 KiB**

### CSS

- Reduce unused CSS
- Geschätztes Einsparpotenzial: **13 KiB**

### Weitere Hinweise

- Network dependency tree analysieren.
- LCP breakdown analysieren.

---

## Accessibility

### Probleme

- Dokument besitzt kein `<main>`-Landmark.

---

## Best Practices

### Probleme

- Browser-Konsole enthält Fehler.
- Chrome Issues Panel meldet Probleme.
- CSP gegen XSS verbessern.
- HSTS-Policy verbessern.
- COOP implementieren.
- Trusted Types gegen DOM-XSS einsetzen.

---

## SEO

### Probleme

- Keine Meta Description vorhanden.
- `robots.txt` ist ungültig (**28 Fehler**).

---

## Agentic Browsing

### Probleme

- `llms.txt` entspricht nicht den empfohlenen Richtlinien.
