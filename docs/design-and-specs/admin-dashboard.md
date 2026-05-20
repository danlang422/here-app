# Admin Dashboard — Schedule-Building Workspace (v2)

**Created:** March 5, 2026
**Updated:** March 7, 2026 (session 8.1 — tab concept cut, aggregate card interaction settled)
**Status:** Design — settled. Build from `agenda-view-build-spec.md`.

---

## Core Concept

The admin dashboard is a **schedule-building workspace**. The agenda view is the centerpiece — a time-based weekly visualization of the school schedule. Everything else (activity browsing, enrollment, user lookup, settings) is accessed through **floating panels** summoned from a toolbar without leaving the dashboard.

Activity Management and User Management remain as their own dedicated pages (navigated to from the admin nav). The dashboard does not embed them — floating panels handle the contextual, lightweight work; dedicated pages handle bulk editing and data-dense tasks.

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: [filters] [property toggles] [panel icons]│
├─────────────────────────────────────────────────────┤
│                                                     │
│              Agenda / Week View                     │
│         (time axis + day columns + block overlay)   │
│                                                     │
└─────────────────────────────────────────────────────┘

  Floating panels appear on top of everything,
  summoned from toolbar icons.

  Activity Management and User Management are separate
  pages, navigated to from the admin nav. Not embedded
  in the dashboard. (Tabs concept cut — session 8.1)
```

### Toolbar

A horizontal bar above the agenda containing:

- **Filter controls:** A filter icon/button that opens a popover with all agenda filters (grade level, block, placed/unplaced, etc.) stacked vertically. Keeps the toolbar clean — complexity is one click away. A badge on the icon shows active filter count.
- **Property toggle icons:** Compact icon buttons for filtering by activity properties — attendance required, check-in required, geolocation, presence, freeform. These are preferred over type-based filtering because types are creation-time helpers, while properties reflect actual operational behavior.
- **Panel icons:** Icon buttons that summon floating panels — Activities, Enrollment, Settings/Calendar. Each icon opens its respective panel (or brings it to front if already open). These same icons appear as action buttons on activity cards elsewhere, providing a consistent visual language.

### Agenda View

See dedicated section below.

### Below the Agenda

**Cut (session 8.1).** The plan to embed Activity Management and User Management as tabs below the agenda was dropped — the motivation was filling space rather than a clear workflow need. Full-page layouts with bulk-editing needs are better served as dedicated pages.

The space below the agenda is intentionally open. Useful additions (reporting summaries, comparison views, zoomed drill-down displays) will be determined as real usage patterns emerge.

---

## Floating Panels

Panels are contextual tools that float above the dashboard. They use the existing `FloatingPanel` shell (draggable, minimizable, closable, click-to-front z-index, viewport clamped, no backdrop). See `enrollment-panel-build-spec.md` for the shell's implemented behavior.

### Activity Panel

A **filtered activity browser** — not a dedicated "unplaced activities" zone. Shows all activities with filters to narrow by status (placed/unplaced), block, and other criteria.

**Card display:** Each activity card shows a consistent minimal set:
- Activity name
- Teacher/staff (last name, abbreviated if needed for space)
- Enrollment count

Additional information varies by activity state and is revealed progressively:
- **Unplaced + has duration:** Duration badge (e.g., "55 min"). No time/day info since it isn't placed.
- **Unplaced + no duration:** Minimal card — may need teacher shown via tooltip if the card is too narrow (important for distinguishing multiple activities with the same name, like several "Advisory" entries).
- **Placed:** Time, days, block badge.

**Click → expanded detail modal:** Clicking a card opens a larger modal/overlay showing full activity details (all schedule info, properties, enrolled roster preview, etc.) without navigating away from the dashboard. The modal includes a link/button to "open full details" which navigates to the full-page edit view.

**Action buttons on cards:** Small icon buttons for common actions. Notably, the enrollment icon on an activity card opens the Enrollment Panel with that activity pre-selected (or updates the selection if the panel is already open).

**Filters:** Given the narrow panel width, filters are nested inside a single dropdown/popover rather than laid out as individual dropdowns. Includes: search input, placed/unplaced status, block, property toggles. Filter icon with active-count badge in the panel header.

**Create button:** Panel header includes a "+" button for quick-create (see Quick-Create section below).

### Enrollment Panel

The existing `EnrollmentPanel` component, evolved to support **two entry points**:

**Entry A — Activity-centric (implemented):** Triggered from an activity's enroll action (on activity cards, activity table rows, etc.). Panel opens with the activity pre-selected in the dropdown. Admin stages/unstages students, sees conflict indicators, submits.

**Entry B — Student-centric (not yet built):** Triggered from the toolbar enrollment icon with no activity context. Panel opens with the student list visible and no activity selected. Admin browses/filters students, stages some, then picks an activity target. The activity selector may appear below the staged students once selections are made, or could be always-visible at the top as it is now — exact layout TBD.

Both entry points use the same panel and same component. The difference is initial state: whether `initialActivityId` is provided.

**Relationship to user management:** There is no separate "User Management" floating panel. The enrollment panel *is* the student-facing panel on the dashboard. A standalone floating user list without an enrollment action doesn't serve a clear purpose. General user search/lookup can be served by a search bar in the toolbar (if needed) or by the full User Management tab below the agenda.

### Settings / Calendar Panel(s)

Not yet designed in detail. Org-level configuration — block definitions, term dates, schedule templates, rotation days, and other settings — will be accessible via floating panels summoned from toolbar icons. This avoids building dedicated pages for configuration tasks that are infrequent but need to happen in the context of looking at the schedule.

**Deferred** until Calendar Management becomes the active build layer.

---

## Agenda View

### Structure

A week grid with **time on the vertical axis** (hours) and **days of the week on the horizontal axis**. Activities appear as cards positioned by their scheduled clock time. Card height is proportional to activity duration.

**Block overlay:** Once blocks are defined (via Calendar Management), block boundaries appear as labeled horizontal bands overlaying the time grid. Blocks provide context ("this is Block 1 time") but don't control card placement — time is the primary axis.

**Block labels along the left margin** serve dual purpose: identification and interaction. Clicking a block label filters/zooms the agenda to show just that block's time range. Clicking again restores the full view.

**Day column headers** work the same way — click a day to focus on a single-day view, click again to restore the full week.

**Per-column totals** at the bottom of each day column show activity count and student count, responsive to active filters.

### Adaptive Card Density

Cards are not fixed templates — they respond to how many activities share a cell (block × day intersection).

- **Many activities:** Aggregated summary card — "5 Activities, 13 Students." Click or hover to expand.
- **A few (2–3):** Individual card titles with enrollment counts.
- **One activity:** Full detail — name, teacher, enrollment count, time, type badge.

This density adaptation is the key UX principle. As the admin filters the view down, cards expand because there's more room and more reason to show specifics.

### Fuzzy Time Edges

Activities assigned to a block don't always perfectly match the block's time boundaries (e.g., most Block 1 activities run 7:30–9:00 but one runs 7:00–8:50).

**At the aggregate level:** Ignore it. The aggregated card represents the block slot, not individual times. The block overlay defines the visual container.

**At the detail level** (when zoomed into a block or viewing individual cards): Show actual activity times. The oddball activity's card is positioned/sized by its real clock time, making the discrepancy visible without requiring special notation.

### Filtering

**Filter types:**
- Grade level (derived from enrolled students, not an activity property)
- Block
- Day of week
- Activity properties (attendance, check-in, geolocation, presence, freeform)
- Staff/teacher
- Placed/unplaced status (though unplaced activities don't appear on the agenda itself — this filter is more relevant in the Activity Panel)

**Property-based filtering is preferred over type-based.** Activity types (regular_class, college_course, internship, etc.) are creation-time UI helpers that auto-set properties. The properties themselves (requires attendance, requires check-in, etc.) are what matter operationally and are more useful as filter criteria.

**Grade-level filtering** requires joining through enrollments to student profiles. At City View scale, this can be computed client-side from cached enrollment data. For larger schools, this may need server-side support or denormalization. Not a blocker for initial build.

---

## Quick-Create

Both panels support creating new records without leaving the dashboard.

### Quick-Create Activity

Accessible from the Activity Panel's "+" button. Shows a compact form with essential fields only:
- Name (required)
- Type (drives property defaults)
- Teacher/staff

All other fields (block, days, times, duration, additional staff, properties) are omitted from quick-create. The created activity appears in the Activity Panel as an unplaced/empty activity. The admin can open the expanded detail modal or navigate to the full form to fill in more.

### Quick-Create User

Accessible from wherever user creation is needed (TBD — possibly the Enrollment Panel or the toolbar). Compact form:
- Name (required)
- Role (required)

Email/password and other details filled in later via full User Management.

---

## Conflict Visualization on the Agenda

**Not part of the initial build**, but part of the long-term vision.

When the enrollment panel has an activity selected, the agenda view could highlight cells where conflicts exist — showing visually where enrolled (or staged) students already have commitments. This is faster and more intuitive than reading conflict summary text in the enrollment panel.

Similarly, when placing an unplaced activity (future drag-to-place interaction), the agenda could highlight which slots are clear vs. occupied for the students enrolled in that activity.

The existing conflict detection infrastructure (`enrollmentValidation.js` with both block-based and time-based checks) supports this. The implementation challenge is wiring the enrollment panel's state to the agenda view's rendering — they'd need shared awareness of what's selected and what conflicts exist.

**Deferred** until the base agenda view and enrollment panel are both stable and tested.

---

## Drag-and-Drop Interactions

**Not part of the initial build.**

Two drag interactions have been discussed:

1. **Drag-to-place:** Drag an unplaced activity from the Activity Panel onto the agenda to assign it a time slot. The system would show valid/conflicting drop targets based on enrolled students' existing schedules.

2. **Drag-to-enroll:** Drag students onto an activity card (or vice versa) to enroll. Would need a clear source for the student selection (likely the enrollment panel).

Both are powerful but add significant interaction complexity. The initial build uses explicit actions (buttons, dropdowns, the enrollment panel's click-to-stage flow) for all operations. Drag interactions are a future enhancement layer.

---

## Activity States Reference

Carried forward from `schedule-action-map.md` — these states drive card display, validation requirements, and available actions throughout the dashboard.

| State | Has Schedule? | Has Students? | Example |
|-------|--------------|---------------|---------|
| **Empty** | No | No | Just created, nothing set yet |
| **Bucket** | No | Yes | "Geometry" with 20 students, no time/block |
| **Scheduled** | Yes | No | Block 2, MWF, 9:00–9:50, no students |
| **Live** | Yes | Yes | Fully placed with enrolled students |

---

## Open Questions

1. **Entry B layout for enrollment panel.** When opened student-first (no activity context), where does the activity selector go? Below staged students? Always at top? Does the panel need to be taller to accommodate both the student list and the activity selector without feeling cramped?

2. **Activity card expanded modal.** What does this look like? Is it a true modal (with backdrop) or another floating panel? How much of the activity form does it expose — read-only detail view with an "edit" button, or the form itself in a compact layout?

3. **Block overlay visual treatment.** Colored bands, subtle borders, alternating background shading? Needs visual design exploration. Deferred until block time data exists (Calendar Management).

4. **Toolbar layout and icon design.** The mockup showed placeholder icons. Need to settle on an icon set and visual pattern for the panel-summoning buttons. Deferred to toolbar polish phase.

5. ~~**Tab behavior below the agenda.**~~ **Resolved (session 8.1) — tabs cut.** Activity Management and User Management stay as dedicated pages. No tabs below the agenda.

6. **Universal search.** Is there a search bar in the toolbar that searches across students, activities, and settings? If so, what does selecting a result do — open the relevant panel? Navigate to the entity? Highlight on the agenda?

7. ~~**Aggregate card interaction.**~~ **Resolved (session 8.1).** Hover → tooltip listing activity names + staff (peek, no navigation). Click → filter to block × day (same as clicking block label + day header simultaneously). Zoomed view shows activities side by side with horizontal scroll at high density. Documented in `agenda-view-build-spec.md`.

---

## Build Sequence

Detailed build specs are written per step before implementation. See `agenda-view-build-spec.md` for step 1.

1. **Agenda view + toolbar stub + dashboard rebuild** ← *spec written, ready to build*
   Grid with time axis, day columns, adaptive card density, block/day click-to-zoom, rebuilt Dashboard page with toolbar placeholder. Full detail in `agenda-view-build-spec.md`.

2. **Activity Panel** — Floating panel with filtered activity card list. Reuses activity data from existing hooks. Card display with minimal info + click-to-expand (expanded modal design TBD).

3. **Dashboard composition** — Wire agenda, activity panel, enrollment panel, and toolbar together. Toolbar gets functional panel-summon icons.

4. **Enrollment Panel — Entry B** — Student-centric entry point (open from toolbar, no activity pre-selected). Same component, different initial state.

5. **Quick-create forms** — Compact activity and user creation forms within their respective panels.

6. **Toolbar refinement** — Property toggle filters, filter popover, active filter badges, icon polish.

Steps 1–3 compose the minimum viable dashboard. Steps 4–6 enhance it. Conflict visualization and drag-and-drop are future layers.
