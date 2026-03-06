# Session 7 — March 5, 2026

---

## 7.1 — Dashboard Mockup Review & Design Consolidation

Design session working from a hand-built mockup of the admin dashboard. Reviewed against existing documentation (`admin-dashboard.md` from session 5), identified what had been resolved by the mockup and the enrollment panel implementation (session 6.4), and consolidated decisions into a new design document.

### Key Design Decisions

**Dashboard layout: agenda + toolbar + floating panels + tabs.**
- Agenda view is the centerpiece — time-based week grid, always visible.
- Toolbar above the agenda with filter controls, property toggle icons, and panel-summoning icon buttons.
- Floating panels (using the existing FloatingPanel shell) for contextual work: Activity browser, Enrollment, Settings/Calendar.
- Full-page Activity Management and User Management available as tabs below the agenda — not replaced by panels, coexisting as the "spreadsheet view" for bulk work and data entry. Tab implementation deferred but directionally settled.

**Activity Panel replaces the "unplaced activities zone" concept.** Instead of a dedicated staging area for unplaced activities, there's a general-purpose activity browser panel with filters including placed/unplaced status. Unplaced activities are a filter state, not a separate UI region.

**No separate User Management floating panel.** A floating user list without an enrollment action doesn't serve a purpose. The enrollment panel *is* the student-facing tool on the dashboard. General user lookup handled by the full User Management tab or a future toolbar search bar.

**Enrollment panel gets student-centric entry (Entry B).** The existing enrollment panel (activity-centric, Entry A) will be extended with a second entry point: open from toolbar with no activity context, browse/filter students first, then pick an activity target. Same component, different initial state. Exact layout for Entry B (where the activity selector goes relative to the student list) is an open question.

**Activity card progressive disclosure: card → expanded modal → full page.** Panel cards show minimal info (name, teacher, enrollment count). Clicking opens an expanded detail modal on the dashboard. The modal has a link to the full-page edit view for when you need the complete form.

**Enrollment icon as consistent action.** The same icon used in the toolbar to summon the enrollment panel also appears as an action button on activity cards. Clicking it on a card opens the enrollment panel with that activity pre-selected (or updates the selection if already open). No overloading "click" or "select" with implicit enrollment behavior.

**Property-based filtering preferred over type-based.** Activity types are creation-time UI helpers. Properties (requires attendance, check-in, geolocation, presence, freeform) are operationally meaningful and serve as the primary filter mechanism — rendered as compact icon toggles in the toolbar.

**Filters condensed into popovers.** Both the toolbar and the narrow activity panel use a filter-icon-with-popover pattern rather than multiple visible dropdowns. Keeps the UI clean; all filter options one click away.

**Block labels and day headers are clickable filters on the agenda.** Click a block label to zoom into that block's time range. Click a day header to focus on a single-day view. Click again to restore. Simple, discoverable, no extra UI chrome.

**Fuzzy time edges: ignore at aggregate, reveal at detail.** When most Block 1 activities run 7:30–9:00 but one runs 7:00–8:50, the aggregate card doesn't try to represent the outlier. Drilling into the block (via label click) shows individual activity times, making the discrepancy visible naturally.

**Quick-create for activities and users.** Compact forms in panels capturing essentials only (activity: name, type, teacher; user: name, role). Created records appear immediately in their respective panels. Full details filled in later via expanded modal or full-page form. The existing activity form needs a compact/quick-create variant — separate design task.

### Agenda View Decisions (Carried Forward + Refined)

These were already directionally settled in the original dashboard doc but are now more concrete:

- Time is the primary axis; blocks are an overlay (unchanged).
- Adaptive card density: many activities → aggregated summary, few → individual titles, one → full detail (unchanged).
- Grade level derived from enrollment, not activity properties (unchanged).
- Per-column totals (activity count, student count) at the bottom of each day column, responsive to active filters (new).

### Documentation Changes

- **Created `admin-dashboard-v2.md`** — new consolidated design doc superseding the original `admin-dashboard.md`. Captures all settled decisions from today, open questions collected in one section, and a rough build sequence. Written to be extractable into build specs later.
- **Updated `STATUS.md`** — reflects new dashboard direction, updated build order, updated doc references.
- **Original `admin-dashboard.md`** — to be deleted by Daniel after reviewing v2.

### What the Original Dashboard Doc Got Right
- Core concept (schedule-building workspace)
- Time-as-primary-axis with block overlay
- Adaptive card density
- Grade-level derived from enrollment
- Progressive/optional setup philosophy

### What Changed from the Original Doc
- Layout zones (fixed Zone 1 / Zone 2) → toolbar + agenda + floating panels + tabs
- Two enrollment patterns (drag-to-enroll + two-panel flow) → single enrollment panel with two entry points
- Unplaced activities as a dedicated zone → filter state in the Activity Panel
- Conflict Mode as a drag-triggered view → deferred; conflict visualization is a future layer
- Build order updated to reflect panel-based architecture

### Open Questions (Documented in v2)
- Entry B layout in the enrollment panel
- Activity card expanded modal design (modal vs. panel, read-only vs. editable)
- Block overlay visual treatment (colors, borders, shading)
- Toolbar icon design and layout
- Tab behavior below the agenda (lazy loading, split view, scroll interaction)
- Universal search behavior
- Aggregate card drill-down interaction

### Deferred (Unchanged)
- Conflict visualization on the agenda (visual highlighting of conflicts driven by enrollment panel state)
- Drag-to-place (unplaced activities onto the agenda)
- Drag-to-enroll (students onto activity cards)
- Scenario B (placement check on activity schedule edit)
- Mobile/tablet dashboard adaptation

### Next Up
- Delete original `admin-dashboard.md` after review
- Begin drilling into build specs for agenda view component (Layer 2, Step 1 of build sequence)
- Enrollment panel Entry B design (can be spec'd independently of the agenda view)
