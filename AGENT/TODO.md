# TODO

- **Sprint mode** (from playtest of `AGENT/engagement-lab/v2`, mode "Sprint"; play it there for reference). New lobby setting `mode: classic | sprint`, solo and multiplayer.
  - Server-authoritative timer, host picks 45 s (default), 75 s or no limit.
  - One prompt at a time: current letter + one category. Categories cycle in lobby order; after one word per category the letter changes (same letter sequence for all players).
  - Enter submits the word, a skip button moves to the next category. A word already played for the same letter and category is refused ("Schon gespielt") and not counted.
  - Live word counter, last words as chips, all-clear effect when a letter's categories are all filled.
  - Answers are validated with the same rules as classic (`engine.go` / `answerValidation.ts`, keep in sync).
  - End of sprint goes to review: all words of all players at once, grouped by letter and category, tap to toggle valid. Scoring per letter+category with the classic rules (unique / shared / only answer).
  - Then the usual round result and game over; "Nochmal" starts a new sprint.
