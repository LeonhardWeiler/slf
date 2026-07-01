# Agent-TODO — Mobile-Verbesserungen (aus todo.md)

## Punkt 1 — Viewport-Höhe (Adressleiste verursacht Scrollen)
**Problem:** `min-h-screen` (= `100vh`) rechnet auf Mobile mit ausgeblendeter
Adressleiste (large viewport). Ist die Leiste sichtbar, ist der Container höher
als der sichtbare Bereich → man kann ein Stück scrollen.

**Fix:** `min-h-screen` → `min-h-svh` (small viewport height, passt immer).
Betroffene Dateien/Stellen:
- `pages/Home.tsx:123`
- `pages/Lobby.tsx:138`
- `pages/game/GameScreen.tsx:178, 208`
- `pages/game/ReviewScreen.tsx:57, 87`
- `pages/game/GameOverScreen.tsx:29`
- `pages/game/RoundResultScreen.tsx:32, 50`

→ Commit "Mobile: svh statt vh gegen Adressleisten-Scroll"

## Punkt 2 — Touch-Feedback (Hover funktioniert auf Mobile nicht)
**Problem:** Buttons haben nur `hover:`-Styles. Auf Touch gibt es kein Hover →
z.B. „Verlassen" (variant `ghost`) bekommt beim Antippen nie den grauen BG.

**Fix:** In `components/ui/button.tsx` jede Variante um ein spiegelndes
`active:`-Styling ergänzen (greift beim Antippen auf Touch UND Klick am Desktop).
Zusätzlich die wichtigsten Roh-Buttons/Klick-Targets:
- Lobby: Buchstaben-Toggle `bg-background hover:bg-muted` (Lobby.tsx:389) → `active:bg-muted`
- Lobby: Code-Kopieren (`group-hover:opacity-80`, :171) → `active:` / `group-active:`
- Lobby: Link-Kopieren (:217), QrScanner-Button (:77): `hover:text-foreground` → `active:text-foreground`

→ Commit "Mobile: active-States für Touch-Feedback"

## Vorgehen
- Nach jedem Punkt committen.
- Bei Unklarheit nachfragen.
