# Layer 2 Design Notes — Grouping, Aggregation & Block Philosophy

**Created:** March 30, 2026
**Context:** Conversation between Daniel and Claude about Layer 2 priorities, informed by observing Layer 1 behavior with real City View data and a broader rethinking of how blocks relate to the schedule.
**Design doc:** `docs/user-flows/admin-calendar-redesign-design-doc.md` (Layer 2 is described there at a high level; this doc expands on scope, rationale, and implementation guidance)
**Companion specs:** `layer-0-build-spec.md`, `layer-1-build-spec.md`

---

## What This Document Covers

1. **Time-slot clustering** — fixing how null-block activities group in the calendar view (immediate Layer 2 work)
2. **Aggregate card expansion** — making aggregate cards interactive (immediate Layer 2 work)
3. **Blocks as attendance overlay** — a conceptual reframe that should inform implementation decisions now, even though the full build-out is future work
4. **Layer 2 scope boundaries** — what's in, what's explicitly out

---

## 1. Time-Slot Clustering for Visual Grouping

### The Problem

`groupActivitiesByBlock` in `src/components/agenda/agendaUtils.js` groups activities by their `block` field. Activities with `block === null` all land in a single `'null'` group. When 4+ null-block activities exist on the same day — even if they're spread across completely different time ranges — they aggregate into one giant card spanning from the earliest start to the latest end.

**Real example from City View data:** On a Tuesday with 9 null-block activities (some 7:30–9:00, some 9:55–10:40, some 12:20–2:20), the calendar shows a single "9 activities / 17 students" aggregate card stretching from 7:30am to 2:20pm. This is visually meaningless — it obscures the actual schedule structure.

### The Fix: Cluster by Time Overlap

For activities without a block assignment, group them by overlapping (or nearly-overlapping) time ranges instead of lumping them all together.

**Algorithm — merge-based clustering:**

1. Take all activities in the null-block group for a given day.
2. Sort by `default_start_time`.
3. Initialize the first activity as a cluster: `clusterStart = activity.start`, `clusterEnd = activity.end`.
4. For each subsequent activity:
   - If `activity.start <= clusterEnd + GAP_TOLERANCE_MINUTES`: merge into current cluster (extend `clusterEnd` if needed).
   - Otherwise: finalize the current cluster, start a new one.
5. Each cluster becomes its own group for density/aggregation purposes.

**Gap tolerance:** 15 minutes. Two activities are considered "together" if they overlap or are separated by ≤ 15 minutes. This matches the grid snap interval and reflects how school schedules work (a 5-minute passing period between 9:50 and 9:55 shouldn't split a group).

**Where this logic lives:** The clustering should happen inside `groupActivitiesByBlock` (or a renamed version of it — see note below). Activities with a non-null `block` continue to group by block. Activities with `block === null` go through time-slot clustering. The output is the same shape: a `Map` of group keys to activity arrays, where null-block clusters get synthetic keys (e.g., `'time-0'`, `'time-1'`).

**Naming consideration:** After this change, `groupActivitiesByBlock` is no longer grouping only by block. Consider renaming to `groupActivitiesForLayout` or similar. Claude Code should decide based on what reads cleanest in context.

### Impact on CalendarDayColumn

`CalendarDayColumn.jsx` iterates over the groups returned by `groupActivitiesByBlock` and applies density logic (single / few / aggregate) per group. No changes needed to that iteration pattern — the fix is entirely in the grouping function. Each time-cluster will be evaluated independently for density, so a day with 3 activities at 9:00–10:00 and 6 activities at 12:00–2:00 would render the first group as "few" (side-by-side cards) and the second as an aggregate card — which is correct.

### Edge Cases

- **Activity with no times:** Activities missing `default_start_time` or `default_end_time` are already filtered out in `CalendarDayColumn` before grouping (the `activityMeetsToday` + time check). No change needed.
- **Activity with block AND times:** Groups by block as before. Time-clustering only applies to the null-block group.
- **Single null-block activity:** Cluster of one → renders as a single card. No aggregation.
- **All null-block activities overlap:** They form one cluster → aggregated if ≥ 4. This is correct (they genuinely compete for the same visual space).

---

## 2. Aggregate Card Expansion

### Current State

Aggregate cards (`mode="aggregate"` in `CalendarEventCard`) display a count ("9 activities") and total enrollment, with a `title` attribute showing activity names on hover. Click handler is stubbed: `onClick={() => {}}` in `CalendarDayColumn`. The cards are at `zIndex: 1` (behind individual cards at `zIndex: 2`) so they don't block clicks on overlapping individual cards.

### Proposed Interaction: Popover List

Clicking an aggregate card opens a popover (or small modal) listing the aggregated activities. Each item in the list is clickable to open the full activity detail (via the existing `onActivityClick` → `CalendarEventPopover` flow).

**Why a popover, not inline expansion:** Inline expansion (stretching the aggregate card to show individual cards) would require reflowing the layout of overlapping cards in the same column, which is complex and potentially disorienting. A popover is lightweight, familiar (Google Calendar uses "+N more" → popover), and doesn't require changes to the layout engine.

**Popover contents per activity:**
- Activity name
- Calendar color indicator
- Time range
- Teacher name (if assigned)
- Enrollment count

**Implementation notes:**
- The aggregate card already receives `aggregateData.activities` — the full list is available.
- Wire up `onClick` on the aggregate card in `CalendarDayColumn` to pass the aggregate data to a handler (e.g., `onAggregateClick(aggregateData, position)`).
- The popover can reuse patterns from `CalendarEventPopover` or be a simpler standalone component.
- Consider the z-index situation: the aggregate card is at `zIndex: 1`. The click target works as long as no individual card is covering the exact click point. With time-clustering in place, aggregates will be smaller and more focused, reducing overlap issues. But if needed, the aggregate card could have a small visible "badge" area (the count label) that's guaranteed to be unobstructed.

---

## 3. Blocks as Attendance Overlay — Design Principle

### Context

This section documents a conceptual shift in how we think about blocks. It is NOT a Layer 2 deliverable — the implementation is future work. But it should inform Layer 2 decisions so we don't tighten coupling that we'll later need to loosen.

### The Reframe

**Current model:** Blocks are a property of activities. An activity "is in" Block 2. Grouping, layout, and (eventually) attendance reporting key off this assignment.

**Evolved model:** Blocks are time windows that overlay the schedule. An activity has times. A block defines a time range. The relationship between them is computed: "which activities fall within this block's time window?" The `block` field on activities becomes optional metadata (useful as an explicit override, especially for IC alignment) rather than a required organizational key.

### Why This Matters

City View's block structure is dictated by Infinite Campus attendance reporting requirements, not by pedagogical logic. The actual schedule has a simpler structure:

1. **Immovable commitments:** College courses (Kirkwood), external HS courses (Kennedy, Washington). City View has no attendance responsibility for these — students are either excluded from the relevant IC block or marked "released."
2. **In-person City View classes:** Bio 2, Geometry, Advisory, etc. These have teachers, times, and real attendance.
3. **Everything else:** The remaining time is flexible — independent study, online coursework, freeform blocks. Currently, students are assigned to "Hub Monitor" groups for these slots because IC requires them to be placed somewhere. But the reality is this is just "what's left" after commitments are placed.

The insight: if City View could define attendance reporting blocks more freely (e.g., fewer blocks, or blocks sized to match their actual needs), the app should support that. An attendance report should be able to answer "what happened during this time window?" by querying which activities fall within it, not by requiring every activity to be pre-tagged with a block number.

### Implications for Layer 2 and Beyond

**For the time-clustering work (Layer 2):** The fact that we're building time-based grouping for null-block activities is already moving in the right direction. Activities group visually by when they happen, not by which block they're tagged with.

**For the block overlay component:** `AgendaBlockOverlay` currently renders alternating background bands based on block definitions from the schedule template. This visual is already "overlay-like" — it shows where blocks fall on the time grid independently of activity placement. No changes needed now, but when we build the admin attendance view, the overlay concept becomes functional: a block's time window defines a query ("show me attendance for everything in this window").

**For the `block` field on activities:** Don't remove it or deprecate it. It's still useful for explicit IC alignment and as a grouping hint. But avoid making it more central than it already is. Specifically:
- Don't gate new features on block assignment.
- Don't use `activity.block` as the primary key for attendance reporting (when we build that). Use time-window containment instead, with `activity.block` as an optional override.
- Continue supporting activities with no block — they should be fully functional in every view.

**For future attendance reporting (NOT Layer 2):** The admin attendance view would let the admin define reporting "chunks" (which may or may not correspond to schedule template blocks). Each chunk is a time window. The report shows: for each student, for each chunk, what activities were they enrolled in, and what's their attendance status? Activities are matched to chunks by time containment (majority-overlap rule if an activity spans a chunk boundary). The `block` field could serve as an override: "this activity counts toward Block 1 regardless of its time."

---

## 4. Layer 2 Scope

### In Scope

| Item | Description | Complexity |
|------|-------------|------------|
| Time-slot clustering | Fix `groupActivitiesByBlock` to cluster null-block activities by time overlap | Medium — algorithm change in one utility function, no component changes needed |
| Aggregate card expansion | Clicking an aggregate card opens a popover listing individual activities | Medium — new click handler plumbing, small popover component |
| Filter bar implementation | The `CalendarFilterBar` component exists as a placeholder; give it basic functionality (text search across activity names, teacher names) | Medium |
| Recurrence-aware conflict detection | `couldMeetOnSameDay` in enrollment validation should account for `recurrence_interval` differences | Small — logic refinement in `enrollmentValidation.js` |

### Explicitly Out of Scope

These are documented here so Claude Code doesn't try to build them as part of Layer 2:

- **Attendance reporting / admin attendance view** — future feature, informed by the "blocks as overlay" principle above
- **Draggable/adjustable block overlays** — future UX for redefining block time windows
- **Month view** — mentioned in the design doc, not prioritized
- **Drag-to-create events** — no drag infrastructure exists, not worth building yet
- **Calendar settings UI** — term associations, external-org flags, etc.
- **Per-day recurrence splitting** — e.g., MWF but Friday is every other week
- **Multi-student overlay/comparison** — future filter enhancement
- **Full block-decoupling migration** — removing or restructuring `activity.block` as a field
- **"Create instance for selected" split convenience** — the activity-splitting workflow for per-student exceptions

---

## File References

| File | Relevance |
|------|-----------|
| `src/components/agenda/agendaUtils.js` | `groupActivitiesByBlock` — the function that needs time-clustering logic |
| `src/components/schedule-calendar/CalendarDayColumn.jsx` | Consumes grouping output, renders density modes, needs aggregate click handler |
| `src/components/schedule-calendar/CalendarEventCard.jsx` | Aggregate mode rendering, currently has no click wired up |
| `src/components/schedule-calendar/CalendarView.jsx` | Top-level state management, `handleActivityClick` pattern to extend for aggregates |
| `src/components/schedule-calendar/CalendarFilterBar.jsx` | Placeholder component, needs implementation |
| `src/components/schedule-calendar/CalendarEventPopover.jsx` | Existing popover pattern, reference for aggregate popover |
| `src/lib/enrollmentValidation.js` | `couldMeetOnSameDay` — needs recurrence interval awareness |
| `src/components/agenda/AgendaBlockOverlay.jsx` | Block overlay component — no changes now, but conceptually relevant to "blocks as overlay" |
| `docs/user-flows/admin-calendar-redesign-design-doc.md` | Parent design doc — Layer 2 high-level description |
