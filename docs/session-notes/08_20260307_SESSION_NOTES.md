# Session 8 — March 7, 2026

---

## 8.1 — Agenda View Design Session & Build Spec

Review session starting from the current project state. Identified the agenda view as the clearest next build target, resolved the remaining open design questions, and wrote the implementation spec.

### Project State Review

- Enrollment panel (Entry A) implemented and functional
- Admin dashboard is still a placeholder nav grid
- `admin-dashboard.md` (formerly v2) has the design settled but several open questions remained
- Agenda view identified as the first step; "build spec to be written before implementation" (per STATUS.md)

### Design Decisions Made

**Aggregate card interaction (settled):**
- **Hover** → tooltip listing activity names + staff for each activity in the group. No navigation, no zoom — just a peek at what's in the cell.
- **Click** → filter to that block × day simultaneously (shortcut for clicking both the block label and day header). Same behavior, faster path.
- **Zoomed view:** Activities displayed side by side within the focused column. Horizontal scroll when density is high (>6 cards). Each card shows `single`-density content (full detail) since there's space.
- This is consistent with the block label / day header click model already in the design.

**Tabs below the agenda — cut:**
- The plan to embed Activity Management and User Management as tabs below the agenda was dropped.
- Motivation: filling space rather than a clear workflow need. Full-page layouts with bulk-editing needs are better as dedicated pages.
- Floating panels handle contextual, lightweight work. Dedicated pages handle heads-down bulk editing.
- The space below the agenda is intentionally open — useful content will emerge from real usage.
- Activity and User Management remain as their own pages navigated from the existing admin nav.

**Conflict visualization — deferred:**
- Discussed explicitly. Decision: build the agenda framework first, defer conflict visualization.
- Reasoning: conflict visualization is additive (doesn't change core architecture), and we'll make better design decisions after seeing real data in the working agenda.
- Hook-in point noted in the spec: `agendaConflictState` in `uiStore` as a comment stub.

**Filter/focus state location:**
- Agenda filter state (`agendaFocusedBlock`, `agendaFocusedDay`) lives in `uiStore`, not local component state. Rationale: the enrollment panel and toolbar will eventually need to read/write the same state (conflict visualization, coordinated filtering).

**Time as the positioning axis (confirmed):**
- Activities positioned by `default_start_time`/`default_end_time`. Block assignment is an overlay label, not a positioning control.
- Only activities with explicit times appear on the agenda. Unplaced activities (null `default_start_time`) are excluded from the grid in v1.
- Block-derived times (from schedule templates) deferred until Calendar Management.

**Existing hooks confirmed — no new hooks needed for v1:**
- `useActivities(orgId)` — already joins teacher/monitor profiles
- `useOrgEnrollments(orgId)` — enrollment counts derived client-side from the org cache (same pattern as EnrollmentPanel)
- `useOrgSettings(orgId)` — supplies `block_count` via `settings?.block_count`
- `orgId` sourced via `useAuthStore((s) => s.profile?.organization_id)` — established pattern

### Documentation Created / Updated

- **Created `docs/user-flows/agenda-view-build-spec.md`** — Full implementation spec: component structure, grid positioning math, density logic, interaction model, uiStore additions, Dashboard page rebuild, build sequence, deferred items.
- **Updated `docs/user-flows/admin-dashboard.md`** — Tabs section rewritten to reflect cut decision. Open questions 5 (tab behavior) and 7 (aggregate card interaction) marked as resolved. Build sequence updated.
- **Updated `STATUS.md`** — Last updated date, documentation section, key architectural decisions, active decisions (dashboard architecture + build order), next steps, and user flow docs table.

### Build Sequence (from spec)

1. `agendaUtils.js` — pure helpers (timeToMinutes, minutesToPx, groupActivitiesByBlock, etc.)
2. `uiStore.js` — add focus state fields
3. `AgendaCard.jsx` — three density variants
4. `AgendaDayColumn.jsx` — absolute card positioning
5. `AgendaBlockOverlay.jsx` — stub
6. `AgendaGrid.jsx` — composes time axis + columns + overlay
7. `AgendaView.jsx` — top-level, derives grid bounds, applies focus
8. `Dashboard.jsx` — rebuild with toolbar stub + AgendaView

### What's Deferred from This Build

- Activity card click → expanded detail modal
- Toolbar functionality beyond stub (panel icons, filter popover, property toggles)
- Block overlay visual rendering (needs Calendar Management)
- Conflict visualization
- Grade-level filter
- A/B day rotation handling
- Per-column totals
- Mobile layout

### Next Up

- Build the agenda view per `agenda-view-build-spec.md`
- Enrollment panel Entry B can be spec'd and built independently (low-effort, same component different initial state)

---

## 8.2 — Agenda View Build

Implemented the agenda view per `agenda-view-build-spec.md`, following the spec's build sequence exactly. Bottom-up build so each piece was testable before wiring in the next.

### What Was Built

**New files (6) in `src/components/agenda/`:**

1. **`agendaUtils.js`** — Pure utility module. Grid layout constants (`PX_PER_HOUR`, `TIME_COL_WIDTH`, `DAY_COL_MIN_WIDTH`), density thresholds (`DENSITY_FEW_MAX`, `DENSITY_AGG_MIN`), time helpers (`timeToMinutes`, `minutesToPx`, `activityTop`, `activityHeight`), grid bound helpers (`floorToHour`, `ceilToHour`), and grouping/filtering (`groupActivitiesByBlock`, `activityMeetsDay`).

2. **`AgendaCard.jsx`** — Three density variants in a single component:
   - `single`: name, teacher last name, enrollment count, time range, block badge
   - `few`: name + enrollment count (compact for side-by-side)
   - `aggregate`: "N Activities · M Students" with DaisyUI tooltip on hover listing all activities, click sets both `agendaFocusedBlock` and `agendaFocusedDay` in uiStore

3. **`AgendaDayColumn.jsx`** — Groups activities by block via `groupActivitiesByBlock`, applies density logic per group, positions cards absolutely using `activityTop`/`activityHeight`. Few-density cards divide column width equally (Google Calendar simultaneous-event pattern). When a block is focused, aggregates expand to individual side-by-side cards.

4. **`AgendaBlockOverlay.jsx`** — Stub component. Renders `null` but exists in the tree with `blockCount` and `gridStartMinutes` props for future Calendar Management.

5. **`AgendaGrid.jsx`** — Full grid composition: fixed-width time axis with hour labels, flex day columns (each wrapping an `AgendaDayColumn`), hour grid lines, block label buttons below the grid, `AgendaBlockOverlay` in the tree. Day headers and block labels are interactive buttons — clicking toggles focus state in `uiStore`. Handles focused-day column collapse (shows only the focused day's column when `agendaFocusedDay` is set).

6. **`AgendaView.jsx`** — Top-level agenda component. Derives grid bounds from activity data (floors earliest start, ceils latest end, defaults to 07:00–16:00 when empty). Renders empty state when no scheduled activities exist. Passes derived props down to `AgendaGrid`.

**Modified files (2):**

- **`src/store/uiStore.js`** — Added `agendaFocusedBlock` (integer | null), `agendaFocusedDay` (1–5 | null), `setAgendaFocusedBlock`, `setAgendaFocusedDay`, `clearAgendaFocus`. Conflict state comment stub for future enrollment panel integration.

- **`src/pages/admin/Dashboard.jsx`** — Replaced the nav grid entirely. New structure: `DashboardToolbar` stub (title, "Clear filters" button visible when focus active, disabled panel icon buttons for Activities/Enrollment/Settings) + `AgendaView`. Data wired through `useActivities`, `useOrgEnrollments`, `useOrgSettings` with `orgId` from `useAuthStore`. Derives `enrollmentCountByActivity` (Map) and `scheduledActivities` (filtered for `is_active`, `!is_not_scheduled`, has start/end times).

### Implementation Notes

- **No new hooks or queries.** All data sourced from existing `useActivities`, `useOrgEnrollments`, `useOrgSettings`. Enrollment counts derived client-side with `useMemo`.
- **`orgId` from `useAuthStore((s) => s.profile?.organization_id)`** — matches every other admin page.
- **`WEEKDAYS`, `getBlocks()`, `getBlockLabel()`** from `src/lib/constants.js` — no hardcoded block numbers or day arrays.
- **DaisyUI classes as baseline**, extended with Tailwind utilities — consistent with all other components.
- **Lint clean** — zero new errors (6 pre-existing errors in other files unchanged).
- **Build clean** — Vite production build succeeds (pre-existing chunk size warning unchanged).

### Stubs (Intentional Placeholders)

- **`DashboardToolbar`**: Title + clear filters + disabled panel icon buttons. No filter popover, no property toggles, no panel launch functionality. These come with Dashboard composition (Layer 2).
- **`AgendaBlockOverlay`**: Renders `null`. Block band overlays require schedule template data from Calendar Management. Block labels are functional as filter buttons in the grid footer.

### What's Next

- Styling refinement on the agenda (card sizing, spacing, color treatment)
- Activity Panel spec and build (floating panel for browsing/searching activities)
- Dashboard composition — wire agenda, activity panel, enrollment panel, and toolbar together
- Enrollment Panel Entry B (student-centric, independent of agenda)
