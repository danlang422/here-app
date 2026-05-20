# Teacher Agenda 86.1 — `SingleDayAgenda` Overlap Resolution (Build Spec)

**Date:** May 20, 2026
**Status:** Implemented
**Issue:** Closes #88. Foundational for #86.
**Design doc:** `teacher-agenda-86.1-overlap-resolution-design.md`
**Depends on:** Nothing. This is the first piece.

---

## What this changes

`SingleDayAgenda` currently positions every card with `className="absolute left-2 right-5"` — full column width, stacked via z-index. This spec adds an overlap algorithm so concurrent activities split into side-by-side columns instead.

**Also included:** `PX_PER_HOUR` bumped from 100 → 200. At 100px/hour the grid was too compact for side-by-side cards to be readable; 200px/hour is the baseline going forward. Both call sites inherit this automatically.

**Not addressed here:** `max-w-2xl mx-auto` in `Dashboard.jsx` and `TodayView.jsx` leaves excess horizontal whitespace. Addressed in 86.2, which redesigns the teacher layout and naturally widens the container (and 86.5 adds a sidebar).

No change to the component's external API (`activities`, `gridStartMinutes`, `gridEndMinutes`, `renderCard`). Both call sites (`Dashboard.jsx`, `TodayView.jsx`) pass activities unchanged.

---

## Codebase context

- `src/components/agenda/SingleDayAgenda.jsx` — primary change target. Already uses `renderCard(activity)` render prop.
- `src/components/agenda/agendaUtils.js` — gets the new overlap algorithm as a new exported function. Existing helpers (`activityTop`, `activityHeight`, `minutesToPx`, etc.) are unchanged.
- `src/pages/teacher/Dashboard.jsx:244` — call site, no change.
- `src/pages/student/TodayView.jsx:420` — call site, no change.

### Layout constants to add to `agendaUtils.js`

```js
export const CARD_PAD_LEFT = 8    // px — matches current left-2 (0.5rem)
export const CARD_PAD_RIGHT = 20  // px — matches current right-5 (1.25rem); preserves space for StudentActivityCard edge buttons
export const CARD_OVERLAP_GAP = 4 // px — gap between concurrent columns
```

These replace the hardcoded `left-2 right-5` Tailwind classes on the card div inside `SingleDayAgenda`.

---

## Algorithm — `computeOverlapLayout`

Add this exported function to `agendaUtils.js`:

```js
// Returns an array of layout descriptors, one per activity, in the same order.
// Each descriptor: { activity, columnIndex, nColumns }
// nColumns is the width of the activity's concurrency group (1 = solo, renders at full width).
export function computeOverlapLayout(activities) {
  if (activities.length === 0) return []

  const n = activities.length

  // Build adjacency list: two activities overlap if a.start < b.end AND b.start < a.end
  const adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = activities[i], b = activities[j]
      if (!a.default_start_time || !a.default_end_time || !b.default_start_time || !b.default_end_time) continue
      const aStart = timeToMinutes(a.default_start_time)
      const aEnd = timeToMinutes(a.default_end_time)
      const bStart = timeToMinutes(b.default_start_time)
      const bEnd = timeToMinutes(b.default_end_time)
      if (aStart < bEnd && bStart < aEnd) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  // Find connected components via BFS — these are the concurrency groups
  const visited = new Array(n).fill(false)
  const groups = []
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    const group = []
    const queue = [i]
    visited[i] = true
    while (queue.length > 0) {
      const curr = queue.shift()
      group.push(curr)
      for (const nb of adj[curr]) {
        if (!visited[nb]) {
          visited[nb] = true
          queue.push(nb)
        }
      }
    }
    groups.push(group)
  }

  // Greedy column assignment within each group
  const colIdx = new Array(n).fill(0)
  const nCols = new Array(n).fill(1)

  for (const group of groups) {
    if (group.length === 1) continue  // solo — defaults are correct

    // Sort by (start_time, end_time, id) for deterministic assignment
    const sorted = [...group].sort((ai, bi) => {
      const a = activities[ai], b = activities[bi]
      if (a.default_start_time !== b.default_start_time)
        return a.default_start_time.localeCompare(b.default_start_time)
      if (a.default_end_time !== b.default_end_time)
        return a.default_end_time.localeCompare(b.default_end_time)
      return String(a.id).localeCompare(String(b.id))
    })

    const colEnds = []  // colEnds[c] = end_time of last activity placed in column c

    for (const idx of sorted) {
      const start = activities[idx].default_start_time
      let assigned = colEnds.findIndex((end) => end <= start)
      if (assigned === -1) {
        assigned = colEnds.length
        colEnds.push(activities[idx].default_end_time)
      } else {
        colEnds[assigned] = activities[idx].default_end_time
      }
      colIdx[idx] = assigned
    }

    for (const idx of group) {
      nCols[idx] = colEnds.length
    }
  }

  return activities.map((activity, i) => ({
    activity,
    columnIndex: colIdx[i],
    nColumns: nCols[i],
  }))
}
```

---

## File changes

### `src/components/agenda/agendaUtils.js`

1. Add three constants after the existing constants block:
   ```js
   export const CARD_PAD_LEFT = 8
   export const CARD_PAD_RIGHT = 20
   export const CARD_OVERLAP_GAP = 4
   ```

2. Add `computeOverlapLayout` (full function above) at the end of the file.

No other changes to `agendaUtils.js` in this spec. `groupActivitiesForLayout`, `DENSITY_FEW_MAX`, and `DENSITY_AGG_MIN` are dead code but are cleaned up in 86.2, not here.

---

### `src/components/agenda/SingleDayAgenda.jsx`

**Imports:** Add `computeOverlapLayout`, `CARD_PAD_LEFT`, `CARD_PAD_RIGHT`, `CARD_OVERLAP_GAP` to the existing import from `./agendaUtils`.

**Replace** the `{activities.map((activity, idx) => (...))}` block with the overlap-aware version:

```jsx
{computeOverlapLayout(activities).map(({ activity, columnIndex, nColumns }, idx) => {
  const top = activityTop(activity, gridStartMinutes) + GRID_PAD_Y
  const height = activityHeight(activity)

  let posStyle
  if (nColumns === 1) {
    posStyle = { left: CARD_PAD_LEFT, right: CARD_PAD_RIGHT, top, height }
  } else {
    const reserved = CARD_PAD_LEFT + CARD_PAD_RIGHT
    const gaps = (nColumns - 1) * CARD_OVERLAP_GAP
    const widthCalc = `calc((100% - ${reserved + gaps}px) / ${nColumns})`
    const leftCalc =
      columnIndex === 0
        ? `${CARD_PAD_LEFT}px`
        : `calc(${CARD_PAD_LEFT}px + ${columnIndex} * ((100% - ${reserved + gaps}px) / ${nColumns} + ${CARD_OVERLAP_GAP}px))`
    posStyle = { left: leftCalc, width: widthCalc, top, height }
  }

  return (
    <div
      key={activity.id}
      className="absolute"
      style={{
        ...posStyle,
        zIndex: 10,
        animation: 'fade-up 0.3s ease both',
        animationDelay: `${idx * 80}ms`,
      }}
    >
      {renderCard(activity)}
    </div>
  )
})}
```

The only other change in `SingleDayAgenda.jsx` is removing `left-2 right-5` from the `className` of the card div (replaced by inline `posStyle`).

---

## Edge cases handled by the algorithm

- **Zero or one activity:** `computeOverlapLayout` returns the activity with `columnIndex: 0, nColumns: 1` — rendered at full width, identical to today.
- **Activities that touch but don't overlap** (`a.end === b.start`): the strict `aStart < bEnd && bStart < aEnd` condition treats them as non-overlapping. They may share a column.
- **Activities with missing times:** guarded by the null check; they'll be treated as non-overlapping and render at full width.
- **Identical start + end times:** form a concurrency group of width N, split into N equal columns.

---

## What `nColumns === 1` preserves

Single-column cards use `left: CARD_PAD_LEFT, right: CARD_PAD_RIGHT` — numerically identical to the current `left-2 right-5` (8px / 20px). No visual change for non-overlapping days.

For multi-column cards, `CARD_PAD_RIGHT` is factored into the shared width calculation, so the rightmost card in a group still ends ~20px from the container's right edge. `StudentActivityCard`'s edge-bleed buttons (`right: -18px` from the card edge) continue to work on the rightmost column. Non-rightmost columns' buttons may visually overlap neighboring cards at 3+ overlaps — accepted per the design doc.

---

## Verification

1. **No regression — non-overlapping day:** Open the student TodayView on a day where activities don't overlap. Verify all cards render at full width (visually identical to pre-change).

2. **2-overlap:** Arrange or find a day where exactly 2 activities overlap in time. Verify they render side-by-side, each at ~half the column width.

3. **3-overlap:** Same for 3 concurrent activities — each at ~one-third width.

4. **Same-column reuse:** In a group where activity A (9–10a) and activity B (9:30–11:30a) and activity C (11–12p) overlap transitively (A overlaps B, B overlaps C, but A and C don't overlap) — A and C should share column 0, B takes column 1. Group width = 2, not 3.

5. **Group isolation:** A day with one 2-overlap group plus several solo activities. The solos render at full width; the 2-overlap cards render at half width. Width doesn't "leak" to solos.

6. **Teacher view non-regression:** Open the teacher Dashboard on a normal day. Verify it looks correct (Dashboard currently passes `displayItems` which may include aggregate items — `computeOverlapLayout` handles them the same way since it only reads `id`, `default_start_time`, `default_end_time`).

7. **Activities with `block` as array:** No change — the algorithm only reads `id` and time fields. Multi-block activities render as a single card spanning their full time range.
