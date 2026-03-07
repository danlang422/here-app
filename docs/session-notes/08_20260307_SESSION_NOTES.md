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
