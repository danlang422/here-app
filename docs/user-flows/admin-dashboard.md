# Admin Dashboard — Schedule-Building Workspace

**Created:** March 3, 2026
**Status:** Planning — capturing vision and design decisions before implementation

---

## Core Concept

The admin dashboard is a **schedule-building workspace**, not a summary/stats page. It's the control hub where the three primary admin actions — creating activities, managing users, and enrolling students — converge around a visual schedule. The admin should be able to stay on one screen and iteratively build out a school's schedule: create activity buckets, place them in the week, enroll students, spot conflicts, and adjust — all without navigating to separate management pages.

The Activity Management and User Management pages still exist as full-featured CRUD interfaces. The dashboard surfaces **streamlined versions** of those same components, optimized for speed and context. Because ActivityForm and UserForm were built container-agnostic, they can be restyled and collapsed for dashboard use.

---

## Layout Zones

The dashboard has at least two functional zones. Exact layout is TBD — options include sidebar, below-the-agenda panel, or floating/collapsible overlays.

### Zone 1: Week/Agenda View (Primary)

The visual schedule. Shows activities that have been **placed** — meaning they have a block and/or day assignment. This is the centerpiece of the dashboard, likely positioned prominently at the top below a header.

Displays a week grid with **hours on the vertical axis** and days on the horizontal axis. Activities appear as cards positioned by their scheduled time. Once blocks are defined (via Calendar Management), block boundaries appear as labeled horizontal bands overlaying the time grid — but **time is the primary axis, blocks are an overlay**.

This means activity cards are placed based on clock time, not block assignment. A card's vertical position and height reflect when it actually runs. Block bands provide context ("this is Block 0 time") but don't control card placement.

**Open design challenge:** Activities assigned to a block but not fully contained within that block's time range (e.g., Kennedy Band is "Block 0" but runs 8:00–8:45 while Block 0 is 7:30–9:00) need to visually indicate their block association even though their card doesn't fill the block band. The inverse case — an activity spanning block boundaries — also needs consideration. Activities assigned to a block but with no time set yet are another edge case. Deferred to detailed agenda view design.

Card content adapts based on density and active filters (see View Modes below).

### Zone 2: Unplaced Activities

Activities that exist but haven't been assigned a block, days, or times yet — the "buckets." These are activities created via quick-create or full creation that the admin hasn't scheduled. They might also include activities that have some scheduling info but aren't fully placed (e.g., has a block but no days).

**Layout options under consideration:**
- Sidebar (always visible, scrollable list)
- Panel below the agenda view
- Floating/collapsible modal or drawer

The unplaced zone serves as a staging area. Activities here are ready to be scheduled (dragged or assigned to a block/day) and can have students enrolled in them even before placement.

### Quick-Create UI

Both activities and users can be created directly from the dashboard. The creation UI should be a **collapsed/quick version** of the full form — showing only essential fields by default, expandable to the full form if the admin wants to fill in details immediately.

**Quick-create activity (bucket mode):** Name and type are the minimum. Block, days, times, staff assignment, and all other fields are optional — consistent with progressive setup. The created activity lands in the Unplaced zone.

**Quick-create user:** Name and role at minimum. Email/password and other details can be filled in later.

These quick versions are restyled variants of ActivityForm and UserForm, not separate components. The forms already support being rendered in different containers; the dashboard just provides a more compact container with a collapsed default state.

---

## Agenda View Modes

The week/agenda view supports multiple levels of detail. These aren't explicitly toggled modes with buttons — the view **adapts based on what's being displayed**, driven by filters and the density of activities in each cell.

### Overview Mode (Default)

All activities visible, no filters active. Cards are **aggregated** by cell (block × day). A cell might show: "4 activities · 47 students" rather than individual activity details. Hover or click to expand and see the activity names.

This is the "how full is my schedule" view. Useful for getting a big-picture sense of where capacity exists and where things are crowded.

### Focus Mode (Filtered)

The admin has narrowed the view — by toggling specific activities on/off, by filtering to a derived group (e.g., "show me what 10th graders are in"), or by selecting a specific activity to place. Now the cells contain fewer activities, so the cards can show more detail: activity name, enrollment count, teacher, maybe a snippet of schedule info.

The card content scales with density:
- **Many activities in a cell** → aggregated summary (count, total students)
- **A few (2–3) activities** → individual titles and enrollment counts
- **One activity** → full detail card (name, teacher, enrollment, type badge, times)

This adaptive density is the key UX principle — the cards aren't fixed templates, they respond to how much room they have and how much context the admin needs.

### Conflict Mode (Active Placement)

Triggered when the admin is actively trying to place an activity — dragging from unplaced, or using the enrollment flow and looking for available slots. The view filters to show **only activities that would conflict** with the one being placed, and highlights the overlapping cells.

This may not be a separate mode so much as what Focus mode becomes during a placement action. The point is that conflict highlighting isn't just a color overlay on a busy schedule — it's a **filtered view** that strips away everything irrelevant so the admin can see exactly what's in the way.

Conflict detection here uses both systems:
- **Block-based conflicts** (hard gate): "This block/day is occupied"
- **Time-based conflicts** (informational): "This activity overlaps by 15 minutes with the adjacent block"

---

## Filtering and Display

### Filter Types

**Activity-level filters:**
- Show/hide individual activities (toggle switches or checkboxes)
- Filter by activity type (regular_class, college_course, etc.)
- Filter by staff/teacher assignment

**Enrollment-derived filters (important design note):**
- Filter by grade level — derived from enrolled students, not an activity property. "Show 10th grade activities" means "show activities where enrolled students are predominantly/entirely in 10th grade."
- Potentially filter by student count ranges, enrollment status, etc.

The most useful filters may end up being **enrollment-derived** rather than activity-property-based. This is worth keeping in mind architecturally — these filters require joining through enrollments to student profiles, which is a different query pattern than filtering on activity columns directly.

### Card Content Responds to Filters

The filter state doesn't just hide/show cards — it changes what the visible cards display. In overview (unfiltered), cards are summaries. As filters narrow the view, cards expand to show more detail because there's more room and more reason to show specifics.

This means the card component needs to accept a "density" or "detail level" prop (or compute it from sibling count) and render accordingly.

---

## Enrollment on the Dashboard

Enrollment can be initiated from the dashboard in addition to the Activity Management page. Two interaction patterns:

### Pattern 1: Direct Manipulation (Drag-to-Enroll)

The admin multi-selects students (from a student list/panel, or from an activity's enrollment roster), then drags the selection onto an activity card — either in the week/agenda view (placed activity) or in the unplaced activities zone. The system validates for conflicts and enrolls on drop, or shows conflict details if validation fails.

**Open questions for drag-to-enroll:**
- Where does the student list live? A third zone/panel? A popover from an activity card?
- How does multi-select work? Checkboxes? Shift-click? Lasso?
- What's the visual feedback during drag? Ghost cards? Highlight valid drop targets?
- How do we handle validation failures on drop? Inline error? Toast? Modal with conflict details?

### Pattern 2: Two-Panel Flow (Modal/Slide-Over)

When drag-to-enroll isn't practical (no good drag target visible, complex enrollment involving many students, need to see conflict details before committing), the admin falls back to the composable two-panel enrollment flow:

1. **Panel 1 — Student Selection:** Multi-select students with search/filter. May be pre-populated if initiated from an activity's roster.
2. **Panel 2 — Activity Target:** Pick the activity to enroll selected students in. Shows conflict validation results per student. May be pre-filled if initiated from a specific activity.

This is the same StudentSelector → ActivitySelector → validate → enroll workflow described in CLAUDE.md, surfaced as a slide-over or modal on the dashboard. It's the reliable fallback that works in every context.

**The two patterns complement each other:** drag-to-enroll is fast for simple cases (a few students, obvious target). The two-panel flow handles complex cases with full visibility into conflicts.

---

## New Fields to Consider

### `activities.duration_minutes` (nullable integer)

How long the activity runs, in minutes. Independent of block assignment — a 55-minute Geometry class might be assigned to a 90-minute block, or might not be assigned to a block at all yet.

**Why:** Enables proportional card sizing in the Unplaced activities zone. If Geometry is 55 minutes and Band is 90 minutes, their unplaced cards can be visually sized to reflect how much schedule space they'll occupy. This helps the admin see at a glance whether an unplaced activity will fit in a gap.

**Progressive:** Nullable, never required. Activities without a duration just get a default-sized card.

**Interaction with block times:** When an activity with a known duration is dragged toward the week view, the system could show "this fits" or "this is 15 minutes longer than the block" — using the time-based conflict detection that already exists.

### Grade-level as derived data

Grade level is **not** a property of activities. It's derived from enrolled students. An activity's "grade" is really "what grade(s) are the students in this activity?"

For filtering purposes, this could be:
- Computed on the fly (join enrollments → student profiles → aggregate grade)
- Cached/denormalized as a derived badge on activity cards (updated when enrollment changes)

The caching approach is probably necessary for performance if the agenda view needs to filter by grade without loading all enrollment data on every render. But this is an implementation decision that can be deferred — the important design decision is that grade lives on students, not activities.

---

## Relationship to Other Pages

**Activity Management (`/admin/activities`):** Full CRUD with table view, filters, and the "Enroll Students" action per activity. The enrollment flow here uses the same composable pieces as the dashboard. The dashboard's quick-create is a streamlined version of this page's creation flow.

**User Management (`/admin/users`):** Full CRUD with modal-based create/edit. The dashboard's quick-create user is a streamlined version.

**Calendar Management (not yet built):** Term CRUD, school day generation, schedule template editor, "assign blocks" mapping. Interacts heavily with the dashboard — template changes affect block times displayed in the agenda view.

---

## Open Questions

1. **Unplaced zone layout:** Sidebar vs. below-agenda vs. floating/collapsible. Each has tradeoffs for screen real estate and drag ergonomics. Sidebar keeps it always visible but narrows the agenda. Below-agenda is spacious but requires scrolling. Floating is flexible but adds UI complexity with multiple draggable surfaces.

2. **Drag-to-enroll student source:** Where do students "come from" in the drag interaction? An activity's current roster? A global student list panel? A search result? This affects where the student selection UI lives on the dashboard.

3. **Conflict mode trigger:** Is it automatic (entering drag mode filters the view) or manual (admin clicks "show conflicts for this activity")? Automatic is slicker but might be disorienting if the view changes dramatically mid-drag.

4. **Mobile/tablet dashboard:** The drag-heavy interaction model is desktop-oriented. What does the dashboard look like on a tablet? Likely a simplified version — maybe the two-panel enrollment flow only, no drag-to-enroll. Worth considering but not a blocker for initial implementation.

5. **Grade-level computation performance:** How expensive is the enrollment-derived grade filter? If every agenda render needs to join through enrollments, this could be slow with many activities. May need a denormalized `primary_grades` field or a materialized view. Defer until we see real performance.

6. **"Assign blocks" interaction:** When Calendar Management is built, the dashboard will need a mode for assigning block boundaries to existing activities. This is related to but separate from the enrollment workflow. How does this interact with the existing block assignment on the activity form? Defer until Calendar Management is the active layer.

7. **Schedule template awareness:** The agenda view should eventually reflect schedule template variations (2-hour delay days, early dismissal). But for initial implementation, showing the default template is fine. Note this for later.

8. **Quick-create expandability:** When the admin expands a quick-create form to the full version, does it transform in-place? Open in a modal? Navigate to the full management page? In-place transformation is smoothest but requires careful layout handling.

---

## Build Order Considerations

The enrollment UI is the next implementation target, designed as composable pieces:
- **StudentSelector** — multi-select with search/filter, works in modal/panel/page
- **ActivitySelector** — pick target activity, shows conflict validation
- **EnrollmentFlow** — orchestrator connecting the two, manages validation and commit

These pieces get built and wired into Activity Management first ("Enroll Students" per activity), then adapted for the dashboard context when the dashboard is built. The dashboard itself is a later layer that composes these pieces alongside the agenda view and quick-create forms.

**Sequence:**
1. Enrollment UI components (standalone, wired into Activity Management)
2. Agenda/week view component (standalone, can be tested outside the dashboard)
3. Dashboard page (composes agenda view, quick-create, enrollment, unplaced zone)
4. Calendar Management (terms, templates, block assignment — feeds into dashboard)
