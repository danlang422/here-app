# Session 37 — May 13, 2026

## Teacher UI concepting (#85) — completion

**What happened:** Closed out #85, the pre-phase 1 concepting work for the teacher agenda epic (#84). Produced the design direction document and a v2 reference demo, both committed to `docs/user-flows/`.

This session was a design conversation, not implementation. No application code changed. The deliverables are the doc, the demo, and the issue-tracking updates.

---

## Going in

Two HTML demos existed from the April 2026 staff feedback sessions (Kali Wednesday, Terry Thursday). Both shared an architecture: fixed left/right lanes (teacher = left, monitor = right), compact/expanded toggle, time-positioned cards. The demos worked for the simple cases but broke when the right lane was crowded — Terry's Thursday has five concurrent internship monitorings that, in expanded mode, squashed into ~56px each on a laptop screen.

Staff feedback (Terry's, mostly, since his schedule is denser):
- Block-based attendance buttons useful, but he wants them along the left side, not the bottom (we landed on top).
- Compact/expanded toggle worked.
- Sidebar wording: "Title + N others" reads as N total, not N+1; switch to just "N activities."
- Per-teacher attendance default (P-default vs A-default) was raised but explicitly out of scope.

The unresolved structural questions going in were: (1) the right-lane width problem; (2) what to do about late-arriving students from Iowa BIG who appear partway through an activity; (3) whether to keep the spatial left/right split at all.

---

## Where we landed (summary — the design direction doc is authoritative)

**Layout:** Time is the primary axis. No fixed lanes. Within any group of concurrent activities, cards fill the row in role-ordered priority (teacher → prep → monitor), each card getting an equal share of available width. Interval-graph greedy coloring assigns columns so time-disjoint same-role units can share a column (e.g. IS-Block-4 and IS-Block-5 share the leftmost column rather than each consuming one).

**Aggregation key changed.** Originally was time-only. Changed to `(start_time, end_time, role)` — all three must match. This is the rule that:
- Prevents an IS at 12:15–1:15 (teacher) from aggregating with a one-block internship at 12:15–1:15 (monitor) even though times match.
- Prevents a one-block internship at 12:15–1:15 (monitor) from aggregating with the multi-block internship cluster at 12:15–2:20 (monitor) because end times differ.

**Clusters open popovers.** When 2+ activities aggregate, they render as a single cluster card on the agenda. Click → popover anchored to the cluster card, showing members side-by-side. Above by default, flips below if early in the day. Popover footer carries the cluster's identity ("5 Internships · 5 students") so it reads as the card opened up.

**Compact/expanded toggle removed.** With clustering as the density mechanism, the toggle was redundant. One render mode.

**Late arrivers (#87 UI side):** in-card chip beside the role badge ("↩ 2 arr 11:00 am"), plus a separate "Arriving later" section in the roster modal. Not a separate card.

**Sidebar:** split into two sections, "Visible to all · you're assigned" and "Visible to all · others'." Aggregation rule: `(role, start_time, end_time)` only — same-title-but-different-time items do NOT aggregate. Three IS slots at different times = three rows.

**Block attendance buttons** move from bottom to top of the agenda.

---

## Conversation arc and the corrections made along the way

The conversation went through several reframings worth noting because they each represent a moment when the direction changed.

1. **The width-imbalance observation.** Initial thinking was "make the right lane wider." Daniel noticed that the proportions were inverse to cognitive load — IS with 11 students taking 72% of the width, 5 internships at 1 student each squashed into 28%. That made it obvious the fixed-lane approach was wrong, not just badly tuned.

2. **The here/elsewhere distinction.** I argued for collapsing the spatial separation entirely (role becomes just a color). Daniel pushed back that some positional convention helps intuition, and we landed on "fill the row in role order, no fixed boundary" — which keeps the reading habit without enforcing the budget. Better framing than either pure-fixed or pure-unified.

3. **The picture-in-picture popover.** Daniel proposed it. I had initially reached for a side-panel detail view, which would have required ~800px of horizontal space to hold 5 cards side-by-side and would have just been "another column with extra steps." The popover is a much better fit — gives the cluster its own canvas without permanently consuming agenda real estate.

4. **The aggregation rule correction.** Daniel caught that a one-block internship at the same time as an IS would aggregate under pure time-matching, which is semantically wrong. Aggregation key extended to include role.

5. **Three demo iterations.** Built the first version of v2 with Playwright sanity-checks. Two real bugs emerged from looking at the screenshots: the late-arrival strip clipping on the 45-minute Algebra 2 card (fixed by moving the indicator to an inline chip beside the role badge), and the column-assignment treating time-disjoint same-role units as needing separate columns (fixed by implementing interval-graph coloring). The third iteration was correcting an over-aggressive sidebar two-pass aggregation that collapsed three IS slots by title even though Daniel had specifically said the sidebar should keep them separate.

The Playwright-screenshot-loop turned out to be very effective for catching layout issues that wouldn't have been obvious from reading the code. Worth keeping that pattern available for future visual work.

---

## Open questions named in the design direction doc

These are not decisions to make in this session — they're the items the doc explicitly hands off to #86's spec phase:

1. Cluster card title generation rule (when to use longest common prefix vs. generic "N activities").
2. Visible-to-all icon on agenda cards (deferred until `visible_to_all_staff` toggle exists per #70).
3. Whether to keep the "YOURS" badge in the sidebar (currently retained; re-evaluate after real teacher use).
4. Shape of the combined-roster modal triggered by sidebar-popover "Take attendance for all" (precedent in v1 demos; whether to lift as-is or redesign).
5. Whether to keep the cluster card's peek text (member name preview redundant with popover content).

---

## Deliverables (committed in this session)

- `docs/user-flows/teacher-agenda-design-direction.md` — new
- `docs/user-flows/teacher-agenda-demo-v2.html` — new (interactive reference artifact)
- `docs/user-flows/kali-wednesday-demo.html` — moved from Daniel's downloads (v1 reference, retained for the combined-roster pattern)
- `docs/user-flows/terry-thursday-demo.html` — moved from Daniel's downloads (v1 reference)
- `STATUS.md` — updated to reflect #85 closed, #86 as next priority, design direction doc added to user flow docs table
- GitHub: #85 closed with summary comment; #86 commented with handoff to spec phase

---

## What's next

The next concrete action is writing the build spec for #86, against the design direction doc. That spec translates the layout rules into changes to:

- `src/pages/teacher/Dashboard.jsx` — replace block-based grouping with the cluster-and-row-fill approach
- `src/components/agenda/SingleDayAgenda.jsx` — add interval-graph coloring for column assignment (this is #88's algorithm)
- `src/components/agenda/agendaUtils.js` — replace `groupActivitiesForLayout` with the (time, role) cluster pass
- `src/components/agenda/RosterModal` (or wherever it lives) — add the "Arriving later" section
- New popover component for cluster expansion and sidebar item expansion (single component, two callsites)
- Top-of-agenda placement for block attendance buttons (relocate the existing strip)

The spec should resolve the five open questions named in the design direction doc rather than carrying them forward as TBDs.

#88's acceptance criteria are absorbed into #86 — the algorithm specified in the design direction doc IS the overlap-resolution implementation. They effectively merge.

#87 (per-enrollment arrival time override) is independent on the data side and should be sequenced to land before or alongside the UI side described in the design direction doc.
