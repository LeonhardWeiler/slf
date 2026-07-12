# UI/UX, Performance & Bugfixes

## 1. Server Connection & Start Screen

- Do **not** show the "Keine Verbindung zum Server ..." message immediately after a page reload if the connection is still being established. It currently flashes briefly even when the connection succeeds instantly, causing unnecessary layout shifts.
- While the user is on the start screen, defer the server connectivity check until they actually click **Join** or **Create Lobby** (unless there is a strong technical reason not to).

---

## 2. Console Warnings

Investigate and fix the following console warnings/errors if they originate from the application:

- `Layout was forced before the page was fully loaded...`
- Source map errors (`installHook.js.map`, `react_devtools_backend_compact.js.map`, etc.)

Ignore warnings originating solely from browser extensions or React DevTools.

---

## 3. Lobby Code Consistency

- Lobby codes should always be uppercase:
  - when displayed
  - while typing
  - when pasted
  - in the URL
- Automatically normalize lowercase input to uppercase.

---

## 4. Starting a Round

Prevent starting a new round if there are no players left in the lobby (everyone disconnected). The lobby should remain usable so new players can join later.

---

## 5. Empty Round Handling

If a round ends:

- and **no active player submitted an answer**, skip the review screen entirely and go directly to the scoreboard.
- Ignore players who already left the game when determining whether submissions exist.

---

## 6. Lobby Code Placement

The join/lobby code should always be displayed **below the title**, never beside it, regardless of available screen width.

---

## 7. Minimum Input Length

Require at least **2 characters** for a valid answer.
Inputs shorter than 2 characters should:

- not receive the green validation check,
- not allow buzzing/submission (where applicable),
- score 0 points,
- be treated as invalid everywhere.

---

## 8. Start Screen Buttons

Increase the width of the **Join** and **Create Lobby** buttons slightly overall.
On mobile, keep them narrower than on desktop, but still wider than they currently are.

---

## 9. Invalid Lobby Code Feedback

If a user attempts to join a lobby that does not exist, highlight the lobby code input with the same red error border used for invalid inputs.

---

## 10. Reset Join Input

If the user:

1. Opens the Join screen,
2. Enters a lobby code,
3. Goes back,
4. Opens Join again,

the input field should be empty.

---

## 11. UI Responsiveness

Make the interface feel faster by reducing or removing unnecessary animations/transitions.
Prefer responsiveness over visual effects wherever appropriate.

---

## 12. Category Action Button Alignment

Align the **Edit** and **Delete** buttons exactly like the **Accept** and **Dismiss** buttons. They should occupy the same visual position and spacing.

---

## 13. Delete Button Color

Keep the Delete button red at all times.
Hover and active states should not change its color.

---

## 14. Edit/Delete Interaction Feedback

Add subtle interaction feedback:

- slight rotation on hover,
- slight rotation (or a slightly stronger one) on click/press.

The goal is to improve perceived interactivity without slowing the UI.

---

## 15. Tooltip Usability

Increase the clickable area for tooltips.
Clicking either:

- the icon,
- or the adjacent label/text

should open the tooltip. In general, make the interaction target more forgiving.

---

## 16. Performance Audit

Continuously watch for potential performance regressions while implementing these changes.

Also generate a `performance-report.html` containing:

- identified bottlenecks,
- expensive renders,
- unnecessary re-renders,
- slow animations/transitions,
- bundle/loading observations,
- concrete optimization suggestions,
- implemented performance improvements.

The report should summarize both findings and actions taken.

---

## 17. Errors on Home screen

At the home screen the error like no connection should have the same with as the join and create buttons
