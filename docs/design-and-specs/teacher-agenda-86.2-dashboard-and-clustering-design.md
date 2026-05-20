# Teacher Agenda 86.2 — Dashboard Rewrite, Cluster Cards, Cluster Popover (Design Doc)

**Date:** May 18, 2026
**Status:** Design — input to a Claude Code build spec
**Issue:** Core of #86. Depends on #86.1 (overlap-resolving `SingleDayAgenda`).
**Related:** `teacher-agenda-design-direction.md` (parent), `teacher-agenda-86.1-overlap-resolution-design.md` (the primitive this builds on), `teacher-agenda-demo-v2.html` (visual reference)

---

## Purpose

Replace block-based aggregation in the teacher `Dashboard.jsx` with role-aware time clustering, and introduce the cluster card + popover pattern that handles density. This is the central rewrite of #86.

Where 86.1 makes `SingleDayAgenda` a content-agnostic primitive that renders cards side-by-side, this doc designs the teacher-specific layer that sits above it: how individual activities get clustered into cluster cards, how those cards behave, what their popover looks like, and how the existing `Dashboard.jsx` block-aggregation logic gets replaced.

---

## Design intent

The teacher's agenda answers, at a glance: *what's happening for me right now, where are my responsibilities, who's where.* Today's `Dashboard.jsx` answers that through block-shaped aggregate cards that mask real structure. The rewrite answers it through **time-positioned individual activities, clustered when density demands it**.

Four principles:

1. **Time is the primary axis.** Block numbers are metadata on cards, not layout drivers. (This is the architectural principle from CLAUDE.md, finally honored in the teacher view.)
2. **Role drives visual treatment and column ordering, not lane assignment.** A teacher's "here" stuff renders left, "elsewhere" stuff renders right, but the width allocation responds to content. No fixed lanes, no width budget.
3. **Clustering is the density mechanism.** When N concurrent same-role same-time activities would force narrow columns, they aggregate into a single cluster card whose popover unpacks them. This holds the "no overlap, every activity gets a column" rule even when N is large.
4. **The clustering layer is a transformation, not a renderer.** It takes activities, produces cards-or-clusters (each with a time range and a content slot), hands those to `SingleDayAgenda`. The renderer doesn't know which is which.

---

## The transformation: activities → renderable units

A **renderable unit** is what gets handed to `SingleDayAgenda`. Each unit has `start_time`, `end_time`, and a content payload (either a single activity, or a cluster of activities sharing the aggregation key).

The transformation:

1. **Compute viewer role per activity.** Use the `getViewerRole(activity, viewerId)` helper from the prep work. For each activity the viewer staffs, this returns `'teacher'` or `'monitor'`. Activities the viewer doesn't staff — i.e. those that come in via the sidebar's "others'" section, see #86.5 — are not part of this transformation; they live in the sidebar, not the agenda.
2. **Apply prep detection.** For each activity where the role is `'teacher'` AND the enrollment count is zero, override the role to `'prep'`. This is the computed-prep rule from session 38 — prep is presentation, not relationship.
3. **Group by `(start_time, end_time, role)`.** Activities sharing all three become candidates for clustering.
4. **Apply the clustering rule.** A group of size 1 → solo renderable unit (single activity). A group of size 2+ → cluster renderable unit.
5. **Hand the resulting flat list of renderable units to `SingleDayAgenda`.** The primitive does its overlap-resolving layout from there.

This transformation lives in (or near) `agendaUtils.js`. The teacher `Dashboard.jsx` calls it, hands the result to `SingleDayAgenda`, and renders whatever cards `SingleDayAgenda` positions.

---

## What gets gutted

The existing `Dashboard.jsx` machinery to remove:

- **`groupActivitiesByBlock`** and the block-keyed aggregation it produces.
- **The `displayItems` memo** in `Dashboard.jsx` that produces block-aggregate cards with min-start / max-end bounds.
- **Any code that derives a card's title from its block label** — block labels become metadata badges on individual cards (or on cluster cards), not titles.

The existing `TeacherActivityCard` likely survives in some form for the solo-card case but needs adaptation for the new card shape (badges, role color, late-arrival chip placement, etc.). The build spec figures out whether it's modifiable in place or wants a new sibling component.

---

## Card design (solo activities)

Each solo card displays:

- **Role badge** — colored chip indicating `teacher` (blue), `prep` (gray), or `monitor` (purple). Color is the primary signal for the here/elsewhere distinction.
- **Activity title.**
- **Time range** — small, secondary.
- **Block label(s)** — metadata badge(s) showing which block(s) this activity falls in. For multi-block activities (#69) all blocks are listed. For activities with no block (rare but legal in the data model), no badge.
- **Late-arrival chip** (if any enrollments have `start_time_override`) — see #86.3, just acknowledging it lives here.
- **Visibility cue** (if `visible_to_all_staff = true`) — small icon or border accent indicating "this is visible to all staff." Treatment deferred per the design direction doc. Acknowledged here; resolved when 86.5's sidebar ships.

Clicking a solo card opens the roster modal for that activity, same as today.

---

## Card design (clusters)

Each cluster card displays:

- **Role badge with cluster qualifier** — same color as a solo card of that role, plus a visual hint that it's a cluster (could be a small stack icon, a "×N" pill, or similar — implementer's call against the design system).
- **Cluster title** (see below for title rules).
- **Time range.**
- **Member count + kind** ("5 Internships", "3 activities") — the same string used in the title slot, repeated or replacing the title depending on title rules. *See below.*
- **Block label(s)** — the union of block labels across all members. For clusters whose members share a block, one badge. For clusters whose members span different blocks (rare but possible), multiple badges.
- **Late-arrival chip** — aggregate across members. If 2 students arrive late within the cluster's activities, the chip shows "↩ 2." Click → popover → individual cards show their own per-member chips. (#86.3 detail.)
- **Click hint** — a chevron, expand icon, or similar visual cue that the card is expandable.

**No member peek text.** The v2 demo showed "first 3 names + N more" on the cluster card. Drop this. The peek redundantly previews what the popover shows in full, and removing it gives the card more breathing room. The popover is one click away — that's close enough.

Clicking a cluster card opens its popover (next section).

### Cluster title generation

Two cases:

1. **Homogeneous cluster** — all members share a longest common prefix of ≥ 2 words after normalizing whitespace and stripping the leading "Independent Study" (which appears as a structural-not-semantic prefix in City View data). Use the prefix, pluralized: "5 Internships," "3 Algebras." This handles the common case cleanly.
2. **Heterogeneous cluster** — anything else. Use the generic form: "3 activities." Less informative but honest.

The 2-word minimum prevents accidental titles like "5 Internships" collapsing to "5 The" when names start with a common article. Strip stopwords (the, a, an) before computing the prefix. The build spec can define the exact prefix-extraction function; the design rule is: use semantic prefix when one clearly exists, fall back to generic when it doesn't.

This rule resolves open question 1 from the design direction doc.

---

## Cluster popover

Triggered by clicking a cluster card. Renders as a floating popover anchored to the source card.

**Positioning:**
- **Above the source by default.** The cluster card stays visible; the popover floats up over earlier hours of the agenda (which the user has already moved past visually).
- **Flips below if there's not enough room above** — e.g. clusters early in the day. The flip logic checks available space, not card position; the source-of-truth is "did the popover fit above without clipping at the top of the viewport."
- **Click-outside dismisses.** Pressing Escape also dismisses. Tabbing through focusable elements stays within the popover until dismissed.

**Layout:**
- Members render as smaller cards in **equal side-by-side columns** within the popover. Width per column = `(popover_width − (n − 1) × gap) / n` with `n` = member count.
- Each member card shows: activity title, time range, block label(s), late-arrival chip if applicable.
- Members are sorted by their own `id` (or any stable order) — they all share `(start_time, end_time, role)` by construction, so there's no obvious secondary sort. Stability matters more than the specific order.

**Identity continuity:**
- The popover's **header** echoes the cluster card's identity: title ("5 Internships"), time range, role badge.
- The popover's **footer** shows the same identity again in summary form ("5 Internships · 5 students") — this is the v2 demo's pattern, and it reinforces the "this is the card opened up" reading.

**Interactions:**
- **Clicking a member card** in the popover opens *that activity's* roster modal. The popover may either dismiss before the modal opens, or remain open behind it — implementer's call based on what feels natural with the existing modal pattern. Probably dismiss-then-open.
- **No popover-level "take attendance for all" action** for the agenda-cluster popover. (This action *does* exist for the sidebar popover — see #86.5. The difference: the sidebar popover represents loosely-grouped visible-to-all items where bulk action makes sense; the agenda cluster represents the viewer's own concurrent responsibilities, where per-activity attendance is the workflow.)

**Width:**
- The popover is wider than the source card. A 3-member cluster card might be ~200px wide on a normal day; its popover should be wide enough to render 3 readable member cards side-by-side, so probably ~600px. The exact width is the build spec's call against the design system.
- Maximum width capped by viewport / readability — for 5+ members, member cards in the popover get narrower rather than the popover getting unboundedly wide.

---

## Roster modal — small change required

The roster modal already exists. It's reached by clicking a card, and it currently shows the roster for that card's activity. Under the rewrite, the modal opens from either:

- A solo card → roster for that one activity (today's behavior, unchanged).
- A member card *within a cluster popover* → roster for that one activity (same behavior; the modal doesn't know it was reached via popover).

This means the modal's interaction model doesn't change. What does change:

- **Block label display in the roster modal header.** Today, the modal title may use the block label as a context cue. Going forward, block labels are metadata, not titles — the modal header should show activity title + time range + block label(s) as separate fields, not derive the title from the block.
- **Late-arrival roster section** — see #86.3. Mentioned here for completeness; the design lives in 86.3's doc.

No new "combined roster" workflow lives here. The combined roster (multi-activity in one modal) is the block-attendance affordance from #86.4, reached from the block buttons at the top of the agenda, not from a card.

---

## Data fetching

The teacher agenda data path today is roughly: `useTeacherAgenda` → `getTeacherActivitiesForDate` → activities with their enrollments. The rewrite consumes the same data, so no API change is required for the agenda surface itself.

**But** — the enrollment count needed for prep detection must be available at the clustering step. If `getTeacherActivitiesForDate` returns enrollments alongside activities (current behavior, verified in session 38 notes), this works. If it doesn't, the clustering layer either needs a separate enrollment-count query (adds round-trip, bad) or the existing query needs an enrollment count joined in (better).

The build spec verifies the current shape and either confirms no change or specs the count-join.

---

## TanStack Query / cache behavior

A teacher opens a cluster popover, navigates into a member's roster modal, marks attendance, closes the modal. The agenda card's late-arrival chip count, attendance-progress indicator, etc., need to reflect the change. Today's invalidation pattern (`useUpdateAttendance` invalidates the relevant queries) should already cover this — but the new card shape may surface visual states (e.g. attendance progress) that need cache-derived data. The build spec verifies query invalidation reaches the new card.

The session 38 enrollment-time-override bug ("hitting DB but UI not updating") is a recent reminder that this is easy to get wrong. Worth a deliberate check.

---

## Edge cases

**A cluster of 1 doesn't exist.** A group of size 1 from the clustering step renders as a solo card. The "cluster" path is only taken at size ≥ 2.

**A teacher with no activities today.** Empty state same as today's `Dashboard.jsx` empty state. No new design needed.

**An activity with multiple staff** (post-#70). The viewer sees it from their own perspective: their role on it, via `getViewerRole`. Other staff on the activity don't affect the viewer's clustering — they're not part of *this viewer's* agenda decisions. (They may be relevant to the *sidebar*, see #86.5, but that's a separate concern.)

**An activity where the viewer is both teacher AND monitor on the same activity.** The data model prevents this via UNIQUE `(activity_id, user_id)` on `activity_staff`. The helper's post-#70 implementation should still defensively handle a multi-row case (logging plus a fallback) — teacher-over-monitor is a reasonable default since teacher represents the more-engaged relationship. Not a design concern for 86.2.

**Multi-block activities** spanning blocks 1–2 and blocks 3–4 on the same day. They have one `start_time` and `end_time`. They cluster (or don't) based on those, not on block. The block badges on the card show both blocks. (Already-resolved by #69 + 86.1, just confirming the case is handled.)

**Late-arrival overrides inside a cluster.** Two students with `start_time_override` are part of the same Internship cluster of 5. The cluster card's chip says "↩ 2." The popover's individual member cards each show their own per-member chip ("↩ 1") on the activities the late students are enrolled in. The roster modals (reached from member cards) show the "Arriving later" section per-activity. (Detail in 86.3.)

---

## Acceptance criteria for the build spec to translate

- Block-based aggregation in `Dashboard.jsx` is replaced with role-aware time clustering.
- Activities position by their own start/end times, never by block-union times.
- Concurrent same-role same-time activities cluster into a single cluster card.
- Concurrent different-role or different-time activities do *not* cluster — they share columns via 86.1's overlap resolution, but each renders as its own card.
- Solo cards open the roster modal directly, as today.
- Cluster cards open a popover anchored to the source, positioned above by default and flipped below when there's no room above, dismissed on click-outside / Escape.
- Cluster popover renders members in equal side-by-side columns with header + footer identity continuity.
- Clicking a member card in the popover opens that activity's roster modal.
- No "take attendance for all" action in the agenda-cluster popover. (Sidebar popover gets it — see 86.5.)
- Block labels appear as metadata badges on cards (and on cluster cards), not as card titles.
- Prep is detected as "teacher role + zero enrollments" and gets gray treatment with prep-role column priority.
- Cluster title uses the homogeneous-prefix rule when applicable, generic form otherwise.
- No regression in the student `TodayView` (it doesn't use the clustering layer; it consumes 86.1's primitive directly).
- TanStack Query invalidation correctly refreshes new card visual states after attendance / enrollment changes.

---

## Open questions

These are flagged for the build spec or for a follow-up decision after real teacher use, not for resolution in this design doc.

- **Cluster card stack-icon vs. ×N pill vs. something else** for the "this is a cluster" visual cue. Implementer's call against the design system; not a load-bearing decision.
- **Popover width specifics.** A range is given above; exact pixel choice is a build/visual decision.
- **Visible-to-all-staff agenda-card cue.** Acknowledged here; resolved in 86.5.

---

## What this doc does *not* address

- The overlap-resolving primitive — that's 86.1.
- Late-arrival UI specifics — that's 86.3 (mentioned where it intersects with cards/popovers/modals here, but its design lives there).
- Block-attendance affordance and combined roster — that's 86.4.
- Sidebar, RLS extension — that's 86.5.

---

## Relationship to other 86 sub-designs

- **#86.1** is the layout primitive this layer feeds. The clustering transformation produces renderable units; 86.1 lays them out.
- **#86.3** adds the late-arrival chip to the cards designed here.
- **#86.4** adds block-attendance buttons *above* the agenda surface — they coexist with the cards designed here but don't intersect.
- **#86.5** designs the sidebar that surfaces visible-to-all activities *not* covered by this layer (since this layer is about the viewer's own staffed activities). The visible-to-all cue on the viewer's own agenda cards is acknowledged here but designed in 86.5.
