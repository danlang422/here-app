# Teacher Agenda — Design Direction

**Date:** May 13, 2026
**Status:** Current — input to #86 (Phase 1 agenda layout rewrite)
**Source:** Output of #85 (pre-phase 1 concepting). Synthesizes feedback on the April 2026 staff demos (Kali, Terry) and the May 2026 design discussion that resolved the open layout questions.
**Reference artifact:** `teacher-agenda-demo-v2.html` in this directory.

---

## Purpose of this doc

This is not a build spec. It is the design direction that the build spec for #86 should be written against. It captures the layout rules we landed on, the principles behind them, what the demo confirmed and what it changed, and the open questions that remain — so that the next person (or Claude) writing #86's spec doesn't have to reconstruct the reasoning.

The visual reference for everything in this doc is the v2 demo HTML in this directory. Read it alongside this doc.

---

## Principles we landed on

**Time is the primary axis.** The agenda lays activities out by their actual `default_start_time` / `default_end_time`. Block numbers are metadata, not layout drivers. This was the original architectural bet in CLAUDE.md ("blocks are reporting labels, not scheduling units") and the staff demos confirmed it survives contact with real teachers — Kali and Terry both reasoned about their day in time, not in blocks.

**Role is a visual treatment, not a layout split.** Earlier demos used a fixed left lane (teacher / "here") and a fixed right lane (monitor / "elsewhere"). That separation was doing useful cognitive work, but it imposed a width budget that broke down whenever the elsewhere side was crowded — the five concurrent internships getting squashed into ~56px each on a laptop screen is the canonical failure case. The v2 demo replaces fixed lanes with **role-ordered row-fill**: within any group of concurrent activities, cards are placed left-to-right in role order (teacher → prep → monitor), each card getting an equal share of the available width. The visual "here is on the left, elsewhere is on the right" reading habit is preserved, but the width allocation responds to content rather than being pre-budgeted.

**Cards never visually overlap.** Distinct activities each get their own column slot. The agenda reflects the resolved schedule, not the soup of partial overlaps. This is a stronger guarantee than what Google Calendar makes — GCal tolerates overlap because users can book freely; Here doesn't have that constraint and shouldn't pretend it does.

**Density is managed via clustering, not subdivision.** When N concurrent activities of the same role would otherwise force narrow columns, they aggregate into a single cluster card. The cluster opens a popover with the members in clean side-by-side columns. This is the escape valve that lets us hold the "no overlap, every activity gets its own column" rule even when N is large.

**No compact/expanded toggle.** The original demos had a user-toggleable density. With clustering as the density mechanism, the toggle becomes redundant — there is one render mode, which always shows the appropriate level of detail. Drop it.

---

## Layout rules

### Aggregation key

Two activities aggregate into a cluster if and only if they share **all three** of:

- identical `start_time`
- identical `end_time`
- identical `role` (`teacher` / `monitor` / `prep`)

This is the rule that prevents Independent Study (teacher, 12:15–1:15) from aggregating with a one-block Internship (monitor, 12:15–1:15) even though their times match. It also prevents a one-block Internship (monitor, 12:15–1:15) from aggregating with the multi-block internship cluster (monitor, 12:15–2:20) because their end times differ. Both of these "should not aggregate" cases were validated against the v2 demo.

### Column assignment within a concurrency group

A concurrency group is the transitive closure of time-overlap relationships across all renderable units (each unit being either a solo activity or a cluster). Within a concurrency group:

1. Sort units by `(role priority, start_time, end_time, id)`.
2. Walk the sorted list. For each unit, assign it the lowest-indexed column whose previously-placed unit ends at or before this unit's start. Otherwise create a new column.
3. Compute card width as `(available_width − (n_columns − 1) × gap) / n_columns`.

This is standard interval-graph greedy coloring. It minimizes the column count and lets time-disjoint same-role units (e.g. Independent Study at 12:15–1:15 and Independent Study at 1:20–2:20) reuse the same column. Verified in the v2 demo — IS-B4 and IS-B5 share the leftmost column rather than each occupying their own.

### Role priorities

Teacher = 0, Prep = 1, Monitor = 2. Cards render left-to-right in priority order. This produces the "your stuff first, then elsewhere stuff" reading without enforcing a hard boundary.

### Cluster card display

The cluster card shows: a role badge with a "cluster" qualifier, the count and kind ("5 Internships"), the time range, an optional peek list of member names truncated with "+N more," and a hint that the card is expandable. The cluster card's title is open — see open questions below.

### Cluster popover

Triggered by clicking the cluster card. Renders as a floating popover anchored to the cluster card, positioned above by default and flipped below if there isn't enough room above (e.g. for clusters early in the day). Click-outside dismisses. Each member renders as a smaller card in equal side-by-side columns within the popover. Clicking a member card opens that member's roster modal.

**Identity continuity:** The popover's title and footer echo the cluster card's identity ("5 Internships"). The popover reads as the cluster card opened up, not as a new entity.

### Late-arrival treatment

Per-enrollment `start_time_override` (see #87) is represented in two places:

- **On the agenda card:** an inline amber chip beside the role badge, formatted as "↩ N arr H:MM" (e.g. "↩ 2 arr 11:00 am"). The chip sits with the badges at the top of the card to avoid getting clipped on short cards. This was the v2 demo's final treatment after an earlier bottom-strip approach got clipped on the 45-minute Algebra 2 card.
- **In the roster modal:** late-arriving students appear in a separate "Arriving later · from off-campus" section below the on-time roster, with their arrival time displayed and attendance controls fully active (the override is informational, not a constraint).

Late arrivers do **not** get a separate card on the agenda. They are a state of their parent activity, not a distinct activity.

### Block attendance affordance

The "Take attendance by block" buttons stay, but live at the **top** of the agenda surface, not the bottom. Block buttons opening a per-block roster is preserved behavior from the previous teacher agenda — see existing `teacher-agenda-build-spec.md` for the per-block roster pattern, which still applies under the new layout.

---

## Sidebar (visible-to-all)

The sidebar surfaces activities marked `visible_to_all_staff` for situational awareness. It is **not** filtered by whether the current user owns the activity — every visible-to-all activity in the org for today appears in the sidebar, including ones the user is assigned to.

### Sections

The sidebar splits into two sections:

1. **Visible to all · you're assigned** — visible-to-all activities where the current user is on the activity_staff list (in either teacher or monitor role).
2. **Visible to all · others'** — visible-to-all activities the current user is not assigned to.

The "yours" section uses a `YOURS` badge on each item. Even though the section header already communicates this, the per-item badge does color-distinguishing work and was retained. This may be revisited after real staff use.

### Sidebar aggregation rule

Group items by `(role, start_time, end_time)`. Three items sharing exactly that triple collapse into a single row labeled "N activities · time range." Items that share a role and title but differ in time do **not** aggregate — three Independent Study slots at distinct times render as three sidebar rows. Aggregation is conservative; the sidebar prefers showing structure over over-compressing.

This is different from an earlier (richer) two-pass aggregation that also collapsed across time by title. We decided against it: collapsing three distinct-time slots of the same title obscures information teachers actually want, and the savings in compactness aren't worth it.

### Sidebar item interactions

Sidebar items are clickable. The interaction is **the same popover pattern** the cluster cards use:

- Solo sidebar items (one activity in the group) → open that activity's roster directly.
- Aggregated sidebar items (multiple activities) → open a popover anchored to the sidebar item, showing the members side-by-side. Each member card in the popover opens its own roster.

The popover's footer should include a **"Take attendance for all"** action that opens a combined roster modal — this is necessary because there are workflows (the prior monitor-aggregate roster in the v1 demos is the precedent) where staff want to mark attendance across all members at once rather than navigating into each. The exact shape of the combined roster carries over from the v1 demos.

---

## Agenda surface treatment for visible-to-all

The current v2 demo does **not** render any visual cue on the agenda itself when an activity is marked visible-to-all (the cue only appears in the sidebar). This is a gap. When `visible_to_all_staff` ships (#70), we want a small icon or border accent on the agenda card to signal "this is visible to all" so the teacher knows their card is also being seen by others. Icon TBD — defer until the toggle exists.

---

## Color palette (informational, not binding)

The v2 demo uses three card themes:

- **Teacher:** blue family (`--blue-bg`, `--blue-border`, etc.) — here, you're with them
- **Monitor:** purple family — elsewhere
- **Prep:** gray family — your time

The two role colors (blue and purple) are clearly distinct from each other rather than being subtle variations of one hue. Since color is now the primary signal for the here/elsewhere distinction (no spatial separation), the contrast has to be visible at a glance. Final palette choices to be confirmed against the design system in the implementation phase.

---

## Open questions

These were named during the design discussion and remain unresolved. They should be answered during #86's spec, not assumed.

1. **Cluster card title generation.** The v2 demo titles the internship cluster "5 Internships," which works because all members share the "Internship @" prefix. For a hypothetical cluster of heterogeneous activities, the same logic would produce "5 Activities," which is less informative. Rule needed: when do we use the longest common prefix vs. a generic "N activities"? Possibly: if all members share a prefix of ≥ 3 words, use it; otherwise fall back to generic.

2. **Visible-to-all icon on agenda cards.** Discussed above. Decision deferred until the `visible_to_all_staff` toggle (#70) is implemented.

3. **"YOURS" badge in the sidebar.** Functionally redundant with the section header. Kept for now because the color does additional work. Re-evaluate after real teacher use.

4. **Combined-roster modal shape.** Referenced as a sidebar-popover footer action. The v1 demos contained a draft pattern for this. Whether to lift that pattern as-is or redesign it is open.

5. **Cluster card peek text.** The v2 demo shows the first three member names plus "+N more" on the cluster card. This is information that the popover redundantly shows in full. Could be dropped to give the card more breathing room. Worth A/B with real teachers.

---

## What this direction does *not* address

- **Mobile / narrow viewport behavior.** The v2 demo was tested at 1366×820 and 1680×920. Mobile is out of scope for #86 and a separate concern.
- **Multi-day or week views.** The teacher agenda remains today-focused with day navigation; week view is not in this direction.
- **Performance at scale.** The clustering and column-assignment passes are O(n²) over the activities for a given day. For n ≤ 20 (City View's case) this is fine. If the app ever runs against schools with hundreds of concurrent activities per teacher, revisit.

---

## Relationship to other issues

- **#85** — this is the output. With this doc and the v2 demo committed, #85's acceptance criteria are satisfied and the issue closes.
- **#86** — this is the input. The build spec for #86 should pull layout rules from this doc and translate them into concrete changes to `Dashboard.jsx`, `SingleDayAgenda`, `agendaUtils.js`, and the roster modal.
- **#88** — overlap resolution in `SingleDayAgenda` is implied by the layout rules here. #88's algorithm (interval-graph coloring) is the one this doc specifies. #88 and #86 effectively merge in implementation.
- **#87** — late-arrival treatment described above is the UI side of #87. The data side (per-enrollment `start_time_override`) is independent and should be built first or alongside.
- **#69** — multi-block activities. Already handled by the v2 demo's "use the activity's own start/end" rule; this doc just inherits the principle.
- **#70** — `activity_staff` and `visible_to_all_staff`. The sidebar logic in this doc depends on `visible_to_all_staff` existing.
- **#79** — Monitor UI for elsewhere students. Phase 3 of the epic. This doc covers the layout; #79 covers the deeper UX of the monitor relationship once Phase 1 and 2 are in place.

---

## A note on what was learned vs. assumed

The v2 demo went through three rendering iterations during the design discussion before reaching the version this doc references. Two corrections were significant enough to call out so future spec work doesn't repeat them:

- **The cluster's popover position must flip.** "Above the source" is a good default but breaks for activities early in the day. Always provide a "below" fallback.
- **Aggregation is on (time, role), not just on time.** A pure time-window aggregation collapses semantically distinct activities (a teacher's IS and a monitor's internship at the same time) and is wrong. Role is part of the aggregation identity.

These felt obvious in retrospect. They were not obvious in advance.
