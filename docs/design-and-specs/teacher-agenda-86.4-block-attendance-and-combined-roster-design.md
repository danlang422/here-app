# Teacher Agenda 86.4 — Block-Attendance Affordance + Combined Roster (Design Doc)

**Date:** May 18, 2026
**Status:** Design — input to a Claude Code build spec
**Issue:** Sub-area of #86. Replaces the "click aggregate card to take attendance for the block" workflow that the block-aggregation rewrite (86.2) removes.
**Related:** `teacher-agenda-design-direction.md` (parent), `teacher-agenda-86.2-dashboard-and-clustering-design.md` (the agenda surface this sits on top of), `teacher-agenda-86.3-late-arrival-ui-design.md` (roster pattern this composes with), v1 demos (combined-roster pattern precedent)

---

## Purpose

Preserve the "take attendance by block" workflow under the new agenda layout. Under the current Dashboard, clicking a block-aggregate card opens a roster scoped to that block's activities — a useful workflow because teachers often think in blocks ("did everyone show up for block 2?") even when activities don't align to block boundaries.

86.2 removes block-aggregate cards (replacing them with time-positioned individual cards), which removes the entry point for that workflow. 86.4 puts it back, deliberately, as a row of buttons at the top of the agenda — surfacing block-thinking as an *affordance the teacher reaches for* rather than the *default presentation* of their day.

---

## Design intent

Two surfaces, designed together:

1. **A row of block buttons** at the top of the teacher's agenda. One button per block the viewer has activities in. Clicking opens a combined roster scoped to that block.
2. **A combined roster modal** showing the rosters for all the viewer's activities in that block, with per-activity sub-headers.

Three principles:

1. **Block-thinking is a tool, not a frame.** The buttons exist because block-thinking is sometimes the right tool for the job — but they're an affordance, not the structure of the agenda itself. The agenda remains time-axis-primary; the buttons are a side channel.
2. **The combined roster is one workflow, not a new model.** It composes the same per-activity roster blocks teachers already see, stacked with sub-headers. No new attendance logic, no special "block" attendance state — just the existing per-activity attendance work, accessible from one modal.
3. **Scope is the viewer's responsibilities.** A block button shows the viewer's activities in that block. It doesn't show the whole school's activities or other teachers' activities. Bulk-attendance for the school is an admin function (#66 rollup), not a teacher's agenda affordance.

---

## The button row

### Location

Above the time-axis agenda surface, below the day header / date navigation. Horizontally laid out, occupying the full agenda width.

### Population

One button per block where the viewer has at least one activity today. If the viewer has activities in blocks 1, 3, and 5 today, three buttons. If a block has none of the viewer's activities, no button for that block.

This is deliberate. Showing a button for a block the viewer has nothing in would be misleading clutter — the button suggests "click here for the block's attendance," and if the answer is "you have nothing to take attendance for," the button shouldn't be there. Other rationales (browse the school's block activity) belong elsewhere.

### Button content

Each button displays:

- **Block label.** "Block 2," "Block 4," etc.
- **Time range for that block** (the org's configured block start/end, *not* the viewer's activities' span). Small, secondary. Helps teachers map "Block 2" to "10:30–11:30" without mental translation.
- **Optional: activity count.** "Block 2 · 3 activities." Helps the teacher gauge what they're opening before they click. Implementer's call whether to include this based on visual density — if buttons get crowded, drop it.

### Button order

Sorted by block number ascending. Standard.

### Visual treatment

Buttons should read as **action affordances**, distinct from the agenda cards below. They're not part of the agenda content — they're tools for working on the agenda. Visual differentiation (different shape, different color treatment, different elevation) matters here so the eye doesn't conflate them with cards.

Implementer's call on exact treatment against the design system. The principle is: buttons read as buttons, not as a second row of cards.

### Edge cases

- **A block with one activity** still gets a button. Clicking opens the combined roster, which in this case has a single-activity section. Slightly redundant with clicking the card itself, but consistency matters more than the rare case — teachers shouldn't have to learn "buttons only appear for 2+ activities."
- **A block with no activities for the viewer** gets no button. Standard.
- **A day with zero activities for the viewer.** No button row at all (rather than an empty row). The agenda surface shows its existing empty state.
- **Multi-block activities.** An activity in blocks 1 *and* 2 should appear in *both* block buttons' combined rosters when clicked. The activity is genuinely scheduled in both blocks; both block-attendance workflows include it. (The attendance state itself isn't double-counted — it's the same `activity_instance`, just reachable from two entry points.)

---

## The combined roster modal

### Structure

A modal that contains one section per activity in the block, with a clear visual divider between sections. Each section has:

- **A sub-header** for the activity: title, time range, role badge, block label(s).
- The activity's roster, exactly as it would appear in that activity's standalone roster modal.

Sections stack vertically. Internal scroll within the modal handles overflow.

```
[Modal header: "Block 2 attendance · 10:30–11:30"]
───────────────────────────────────────────
Algebra 2 · 10:30–11:30 · [teacher badge]
  On-time roster
    [student row]
    [student row]
  ─────────────
  (No "Arriving later" section if empty)
───────────────────────────────────────────
Internship @ Mercy · 10:30–11:30 · [monitor badge]
  On-time roster
    [student row]
  Arriving later · from off-campus
    [student row] · arrives 10:45
───────────────────────────────────────────
[etc.]
```

The per-activity sections compose the on-time / arriving-later pattern from 86.3 — each section can have its own "Arriving later" sub-section if applicable. The pattern from 86.3 carries through unchanged.

### Sub-header content

Each per-activity sub-header shows:

- Activity title.
- Time range (the *activity's* range, not the block's).
- Role badge (the viewer's role on this activity — teacher / monitor / prep).
- Block label(s) — usually redundant with the modal header but worth showing per-section because of the multi-block case (an activity spanning blocks 1–2 shown in the Block 1 combined roster carries a "Blocks 1, 2" badge to make the multi-block fact visible).

### Section order

Within the combined roster, order activities by:

1. **Role priority** (teacher → prep → monitor) — same priority as the agenda's column ordering. Teachers see their own "here" activities first.
2. **Then by start time** ascending.
3. **Then by id** for stability.

### Modal header

- Title: "Block N attendance · time range." (e.g. "Block 2 attendance · 10:30–11:30")
- A subtle indicator of how many activities are included ("3 activities" or just visible in the section count).
- Standard close affordance.

### Student appearing in multiple activities within the block

Rare but real: a student might be enrolled in two of the viewer's activities that share a block (e.g. some Independent Study + supplemental tutoring). Each activity's roster lists them independently. Marking them present in one doesn't auto-mark them in the other — they're two enrollments, two attendance decisions, two records.

The teacher *sees them twice* in the combined roster. That's correct: the teacher has two attendance decisions to make for that student-block intersection. The UI doesn't need to deduplicate or warn — the per-activity context makes the duplication legible (different sub-headers, different activities).

If this becomes a felt problem in real teacher use, revisit. For now: trust the structure, don't hide the duplication.

### Attendance behavior

Identical to standalone roster modals. P/A/E/T buttons, with **"Mark all P" available per-activity-section** (matching today's per-roster bulk action behavior), and the same TanStack Query invalidation. The combined roster is a presentation composition, not a new attendance pathway.

**No modal-level "Mark all P"** that sweeps across all activities. Crossing activity boundaries with a single bulk action is too easy to misuse — a teacher who clicks it absentmindedly has no way to remember which sections they'd actually verified. Per-section is the right scope.

**Interim note:** "Mark all P" is the right tool for the current attendance model (where attendance state exists because someone affirmatively clicked it). A separate future feature — per-teacher default attendance mode (mark-all-P-by-default vs. mark-all-A-by-default) — will reduce the need for this button significantly. When that ships, "Mark all P" visibility may become conditional on the user's setting (e.g., hidden for teachers on default-P mode since their rosters open pre-filled). For now, the button stays as designed.

### Cluster activities in a combined roster

If an activity is part of a cluster on the agenda, it still appears as **its own section** in the combined roster — the combined roster doesn't preserve clustering. Block-attendance is per-activity work, even when the agenda groups activities visually.

This is a deliberate divergence between the two surfaces: the agenda clusters for visual density; the combined roster un-clusters for actionable clarity. Both serve their purpose.

### Empty state

If a block has activities but none of them have any enrollments (unlikely but possible — e.g. all activities in that block are prep-detected), the combined roster shows the sections with empty rosters. The sub-headers still render. A "no students to mark" empty state within each section is fine.

### Late-arrival pattern (from 86.3)

Confirmed composes cleanly. Each section in the combined roster carries its own on-time / arriving-later split, with its own "Arriving later · from off-campus" sub-section where applicable. The pattern repeats per-section, scoped per-activity.

---

## Interaction with the agenda cards

Block buttons and agenda cards are **independent entry points** to the same underlying data:

- Click an agenda card (solo) → that activity's roster modal.
- Click a cluster card → cluster popover → click a member → that activity's roster modal.
- Click a block button → combined roster modal scoped to that block.

All three paths reach the same per-activity attendance work. The combined roster is the only one that shows multiple activities in one modal.

This is intentional: each surface answers a different question. The cards answer "what's happening now," the cluster popover answers "what's in this group," the combined roster answers "what's in this block." Same data, different framing.

---

## Data fetching

The teacher agenda already fetches the viewer's activities for the day with their rosters. The combined roster reuses that data — no new query needed at the modal-open moment, the data's already in the cache.

What the build spec verifies:
- The cache contains rosters for all the viewer's activities (not just those displayed on the agenda surface).
- Block filtering happens client-side from the cached data.
- Cache invalidation after attendance marking refreshes the combined roster (same pattern as standalone roster modals).

---

## Edge cases

**A block button clicked for a block with one activity.** Combined roster opens with one section. Functions correctly. Visually redundant with clicking the card, but consistent with the affordance.

**An activity included in two block buttons** (multi-block). Clicking either button includes that activity in the resulting combined roster. Both paths reach the same activity_instance — attendance marked from either modal updates the same record.

**A teacher who has no role on any activity in the block** (shouldn't happen because the button is populated from "blocks where the viewer has activities," but defensive thinking). No button, no problem.

**A very tall combined roster** (many activities, large enrollments). The modal scrolls internally. The sub-headers stay visible at the top of their section but don't sticky — keeping sticky behavior simple here. If real use surfaces a sticky-header need, revisit.

**A teacher who navigates from the combined roster to a single activity's roster** (e.g. clicks an "open standalone" affordance). Not designed for. The combined roster is a working surface, not a navigation hub. If a teacher wants the standalone view, close the modal and click the card. Don't build cross-modal navigation.

---

## Acceptance criteria for the build spec to translate

- A row of block buttons appears above the agenda surface when the viewer has activities for the day.
- One button per block where the viewer has at least one activity. Blocks with no activities for the viewer don't get a button.
- Buttons show block label, block time range, and optionally activity count.
- Clicking a block button opens a combined roster modal.
- The combined roster contains one section per activity in that block, ordered by role priority then start time.
- Each section has a sub-header (activity title, time range, role badge, block label).
- Each section's roster composes the on-time / arriving-later pattern from 86.3.
- Multi-block activities appear in the combined roster of every block they span.
- A student enrolled in multiple of the viewer's activities in the same block appears in each relevant section — not deduplicated.
- Attendance marking works identically to standalone roster modals (P/A/E/T, bulk actions, TanStack Query invalidation).
- The button row is visually distinct from the agenda cards (reads as actions, not as content).
- No new attendance logic — the combined roster is presentation only.
- No regression on standalone roster modals (still reachable via card clicks).

---

## Open questions

- **Block button activity count display.** Include or not? Implementer can default to including; trim if buttons get crowded.

---

## What this doc does *not* address

- The agenda layout itself (86.1, 86.2).
- The late-arrival pattern within rosters (86.3 owns this; this doc composes it).
- The sidebar (86.5) — visible-to-all activities have no relationship to the block buttons.
- Cross-day combined views ("show me Block 2 attendance for the week"). Out of scope; this is today-focused.

---

## Relationship to other 86 sub-designs

- **#86.1** — no direct relationship. Block buttons live above the time-axis surface that 86.1 lays out.
- **#86.2** — the block-aggregation logic 86.2 removes is what created the *implicit* "click for block attendance" workflow under the old design. 86.4 makes that workflow *explicit* via the button row.
- **#86.3** — the combined roster's per-activity sections each carry 86.3's on-time / arriving-later pattern. Clean composition.
- **#86.5** — the sidebar's visible-to-all items aren't part of the block-attendance workflow (they belong to other teachers; this viewer isn't responsible for their attendance). No interaction.
