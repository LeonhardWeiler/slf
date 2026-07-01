## D · Optional / Härtung

### D1 — WebSocket-Origin einschränkbar machen 🟢 (LOW)
**Ort:** `client.go` `ServeWS` → `OriginPatterns: []string{"*"}`.
**Problem:** Akzeptiert jede Origin (CSWSH-Fläche). Risiko gering (Auth-Token in
sessionStorage, nicht Cookie), aber unsauber für „echten" Betrieb.
**Fix:** Erlaubte Origins via ENV konfigurierbar; Default fürs LAN weiterhin offen.

### D2 — Graceful Shutdown 🟢 (LOW)
**Ort:** `cmd/server/main.go` → `http.ListenAndServe` ohne Signal-Handling.
**Fix:** `http.Server` + `Shutdown(ctx)` auf SIGINT/SIGTERM (sauberes
`docker stop`). Da State ohnehin im RAM lebt, rein kosmetisch/log-freundlich.
