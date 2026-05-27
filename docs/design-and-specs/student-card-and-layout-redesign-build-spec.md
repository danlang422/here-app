# Student Card & Layout Redesign — Build Spec

**Status:** Ready to build
**GitHub issue:** (layout polish — no dedicated issue; part of Iteration 8 prep)
**Session:** 44

---

## Overview

Three related improvements to the student TodayView:

1. **StudentActivityCard layout** — restructure from cramped 2-line summary to a hierarchy-first 3-line layout with an icon-based metadata row at the bottom
2. **Calendar color on student cards** — wire the missing `calendar:calendar_id(color)` join so the left-border accent actually renders
3. **Mobile tap-to-open overlay** — make cards tappable on small screens; opens a bottom sheet with full details and full-size action buttons

A fourth improvement is also scoped here:
4. **Date navigation arrow fix** — both pages, plus visual button upgrade using `CaretCircleLeft` / `CaretCircleRight`

Teacher-side layout changes (max-width expansion, sidebar layout) are deferred — noted at the bottom.

---

## 1. StudentActivityCard Layout Redesign

### Current layout

```
[Title (truncated)    Time]
[Block · Location · Staff · 🔥streak]
```

One problem: title truncates before anything else. On mobile, "Independent Study" becomes "Independ...". Staff and room compete with block for the same line.

### New layout

```
Line 1: Title (wraps, no truncation)
Line 2: Time range
Line 3: Location (or staff if no location; truncate here is fine)
Footer: [■4] [🔥3] [⊞] ...icon chips
```

**Rules:**
- Title: `font-medium`, no `truncate`, wraps naturally. On very tall cards this is fine — card height is determined by activity duration, not content.
- Time: `text-sm text-base-content/60`
- Location line: `text-sm text-base-content/60`, `truncate` — losing the end of a room name is acceptable; losing the activity name is not. If `activity.location` is null/empty, fall back to `staffDisplayName` (same truncate treatment).
- Footer icon chips: small, low-contrast, left-aligned, `flex-wrap gap-1`

### Footer icon chips

Render only when the value exists / flag is true.

| Chip | Condition | Icon | Display |
|---|---|---|---|
| Block | `blockLabel` is set | `NumberSquareOne`–`NumberSquareFour` etc. (dynamic, see below) | block number square icon only — no text label needed |
| Streak | `streak > 0` | `Flame weight="fill"` | count number next to icon |
| Freeform | `activity.allows_freeform` | `Sliders` (same as admin settings) | icon only |

**Block icon mapping:** Import the numbered Phosphor icons dynamically. Phosphor exports `NumberSquareZero` through `NumberSquareNine`. Build a lookup:

```js
import {
  NumberSquareZero, NumberSquareOne, NumberSquareTwo, NumberSquareThree,
  NumberSquareFour, NumberSquareFive, NumberSquareSix, NumberSquareSeven,
  NumberSquareEight, NumberSquareNine,
} from '@phosphor-icons/react'

const BLOCK_SQUARE_ICONS = [
  NumberSquareZero, NumberSquareOne, NumberSquareTwo, NumberSquareThree,
  NumberSquareFour, NumberSquareFive, NumberSquareSix, NumberSquareSeven,
  NumberSquareEight, NumberSquareNine,
]
```

Activities can have multiple blocks (`activity.block` is `INTEGER[]`). Render one icon per block number. If `block` is a single-element array, render one icon. If multi-block, render each. Use `size={14}` and `className="text-base-content/40"`.

Streak chip: keep existing amber/muted coloring logic (`streak >= 5` → amber, else muted). Size 13, same as before.

Freeform chip: `Sliders size={13}`, `text-base-content/40`.

### Action buttons — desktop vs. mobile

The buttons stay as-is on desktop: absolute-positioned, `right: -18px`, overlapping the card edge. This is intentional and distinctive.

On mobile (`< sm` breakpoint, i.e. `< 640px`), the absolute-positioned buttons will clip against the viewport. Two options were considered:

- Move buttons inside the card on mobile (bottom-right corner)
- Remove from card entirely on mobile; accessible only via tap-to-open overlay

**Decision: move inside the card on mobile.** Students shouldn't be forced to tap twice for a primary action they use constantly. On `< sm`, render the button stack in a `relative` position inside the card's content area (bottom-right), no negative offset. Button size can stay `w-9 h-9`.

Implementation: use a responsive wrapper. Inside `StudentActivityCard`, render two button containers — one for desktop (the existing absolute overlay) and one for mobile (inline, bottom-right):

```jsx
{/* Desktop buttons — absolute, overhanging */}
<div className="hidden sm:flex absolute flex-col gap-1.5 items-center" style={{ right: '-18px', ... }}>
  {buttons}
</div>

{/* Mobile buttons — inline, inside card */}
<div className="flex sm:hidden flex-col gap-1.5 items-end absolute bottom-3 right-3">
  {buttons}
</div>
```

The card's `pr-7` padding (which reserves space for the desktop overhang) should become `pr-3` on mobile. Use `pr-3 sm:pr-7`.

---

## 2. Calendar Color — Wire the Missing Join

### Problem

`getStudentActivitiesForDate` in `src/api/agenda.js` selects:

```js
activity:activities!inner(*, activity_staff(user_id, role))
```

`*` on `activities` does not traverse relations — `calendar` is a FK, not auto-joined. `activity.calendar` is always `undefined`, so `calendarColor` passed to the card is always `undefined`, so the left border accent never renders (falls back to `border-base-300`).

### Fix

Add `calendar:calendar_id(color)` to the select:

```js
activity:activities!inner(
  *,
  activity_staff(user_id, role),
  calendar:calendar_id(color)
)
```

No other changes needed — the card already consumes `activity.calendar?.color` and passes it as `calendarColor`. The left-border accent will start rendering automatically once the data arrives.

No RLS changes required — students can read calendars in their org (policy already exists).

---

## 3. Mobile Tap-to-Open Overlay

### Trigger

Card is tappable on all screen sizes (using a wrapping `button` or `onClick` on the card div). On desktop, tapping the card body (not the action buttons) opens the overlay. On mobile, tapping anywhere opens it.

### What it shows

A bottom sheet (slides up from bottom, `fixed inset-x-0 bottom-0`, rounded-t-2xl, `max-h-[85vh] overflow-y-auto`). Content:

```
[Activity name — full, wrapping]
[Time range]
[Block label(s)]
[Location]
[Staff display name]
[Calendar color swatch + calendar name, if color is set]

[Action buttons — full-size, horizontal row or 2-column grid]
  [Wave / Check-in]  [Status Update]

[Streak count if > 0]
[Freeform tags from today's check-in, if any]
```

On desktop, use a centered modal instead (same content, standard DaisyUI modal pattern). The existing `StatusUpdateModal` and `FreeformTagSelector` modals already use this pattern.

### Implementation notes

- The bottom sheet should close on backdrop tap and on a close button (X in top-right)
- Action button clicks inside the overlay behave identically to the floating card buttons — same handlers, same state
- Don't re-fetch data; the overlay receives props from the card (same `checkIn`, `wave`, `statusCount`, `hasInstance`, `streak` already available)
- Component name: `ActivityDetailSheet` in `src/components/student/`

---

## 4. Date Navigation Arrow Fix

### Problem (teacher page)

`Dashboard.jsx` wraps the full `max-w-5xl` container in a `flex items-center justify-between` for the date header. The right arrow sits at the far right of the full container width — visually over the top of the sidebar, not aligned with the agenda column. It reads as a sidebar toggle.

### Fix

Scope the date header to the agenda column only. Move the `<div className="flex items-center justify-between mb-4">` and its arrows inside `<div className="flex-1 min-w-0">` (the agenda column), not outside the two-column flex layout.

Same change on the student page for consistency (less critical there since there's no sidebar, but the `max-w-2xl` centering makes it look fine either way).

### Visual upgrade

Replace `CaretLeft` / `CaretRight` with `CaretCircleLeft` / `CaretCircleRight` on both pages. These read unambiguously as navigation buttons rather than generic directional affordances.

```jsx
import { CaretCircleLeft, CaretCircleRight } from '@phosphor-icons/react'
```

Size 20, `btn-ghost btn-sm btn-circle` — same container, different icon.

---

## Files to Change

| File | Change |
|---|---|
| `src/components/agenda/StudentActivityCard.jsx` | Full layout restructure (lines 1–3 + footer chips + responsive button placement) |
| `src/components/student/ActionButton.jsx` | No changes needed |
| `src/api/agenda.js` | Add `calendar:calendar_id(color)` to `getStudentActivitiesForDate` select |
| `src/pages/student/TodayView.jsx` | Import `CaretCircleLeft/Right`; move date nav inside agenda column (minor) |
| `src/pages/teacher/Dashboard.jsx` | Move date nav inside `flex-1` agenda column; import `CaretCircleLeft/Right` |
| `src/components/student/ActivityDetailSheet.jsx` | **New file** — bottom sheet / modal overlay |

---

## Max-Width Expansion (Deferred)

Expanding `max-w-2xl` → `max-w-3xl` on student and `max-w-5xl` → `max-w-6xl` on teacher is a one-line change each and can be done in the same session. Noting here so it's not forgotten, but it's not blocking anything and can be tacked on at the end of the session or its own small commit.

---

## Not In Scope

- Teacher mobile layout (deferred; staff are primarily on desktop/Chromebook)
- History feed / sidebar (issue #71 — separate spec)
- Block button icon update on teacher page to match `NumberSquare*` icons (good idea; park for #71 or a separate polish pass)
