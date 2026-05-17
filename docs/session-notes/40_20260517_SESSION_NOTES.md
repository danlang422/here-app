# Session 40 — May 17, 2026

## Five sub-area design docs for #86 — teacher agenda Phase 1 rewrite

**What happened:** Broke #86 (Phase 1 teacher agenda layout rewrite) into five sub-areas and wrote a design doc for each. No build specs — that's Claude Code's job from here, working off these design docs with codebase access. No code changes; deliverables are five new docs in `docs/user-flows/`.

This session continues the #86 design conversation from session 38, now with the three prep features built and merged (session 39). The agenda redesign can be written against real interfaces rather than hypothetical ones.

---

## Going in

Session 38 landed several #86 structural decisions and produced three prep build specs. Session 39 shipped those prep features. So going into session 40, the relevant prep was in place:

- `getViewerRole(activity, viewerId)` helper lives in `src/lib/staffRoles.js` — agenda layer can derive role per (activity, viewer) cleanly.
- `visible_to_all_staff BOOLEAN` exists on `activities` with admin UI for setting it via the `BEHAVIOR_FLAGS` icon row in `ActivityDetail`.
- `start_time_override` / `end_time_override` (nullable `TIME`) exist on `enrollments` with admin UI for setting them via the enrollment schedule editor.

The session-38 plan was to write a single #86 build spec next. The session-40 conversation revised that plan.

---

## The two structural decisions this session

### 1. Five sub-areas, not one mega-spec

#86 covers enough surface area that one document would be unwieldy and hard for Claude Code to consume in one context window. Split into five sub-areas with clear seams:

- **86.1** — `SingleDayAgenda` overlap resolution (the layout primitive; also closes #88)
- **86.2** — Dashboard rewrite, cluster cards, cluster popover (the core)
- **86.3** — Late-arrival UI (chip + roster section)
- **86.4** — Block-attendance affordance + combined roster
- **86.5** — Sidebar + RLS extension

Dependency order: **86.1 → 86.2 → (86.3, 86.4, 86.5 in any order)**.

GitHub stays single-issue. #86 remains the umbrella; sub-specs are tracked as referenced documents, not split into sub-issues. Five GitHub issues for one feature is overkill at this app's scale.

### 2. Design docs from us, build specs from Claude Code

Rather than producing build specs ourselves, we write *design docs* — the *what* and *why* (layout rules, data shapes, interaction model, edge cases, open questions resolved) — and Claude Code translates each into a build spec using its full codebase access. This plays to each tool's strengths: design thinking without needing the codebase in front of us, build instructions written by the tool that can actually read the files.

This is also the existing pattern: `teacher-agenda-design-direction.md` from session 37 was a design doc, not a build spec. Session 40 makes that pattern deliberate for every sub-area.

---

## Where we landed — the five design docs

### 86.1 — Overlap resolution (`teacher-agenda-86.1-overlap-resolution-design.md`)

Implements interval-graph greedy coloring inside `SingleDayAgenda` so overlapping cards render side-by-side rather than stacking. **Content-agnostic primitive** — knows nothing about roles, clusters, or blocks. The student `TodayView` keeps using it directly; the teacher Dashboard wraps it with role-aware logic. Closes #88. ~140 lines, design-only.

### 86.2 — Dashboard rewrite, cluster cards, cluster popover (`teacher-agenda-86.2-dashboard-and-clustering-design.md`)

The core of #86. Replaces block-aggregation in `Dashboard.jsx` with role-aware time clustering. Designs the cluster card, the cluster popover (positioned above by default, flips below, click-outside dismisses), the solo card, and the transformation pipeline (activities → role-aware renderable units → 86.1's primitive). Resolves two design-direction open questions: cluster title generation (homogeneous-prefix rule with stopword stripping, generic "N activities" fallback) and cluster peek text (dropped — popover is one click away). ~280 lines.

### 86.3 — Late-arrival UI (`teacher-agenda-86.3-late-arrival-ui-design.md`)

Amber chip on cards/clusters/popover-member-cards, "Arriving later · from off-campus" section in the roster modal below the on-time roster. `end_time_override` students render inline in the on-time section with `leaves H:MM` annotation rather than getting their own section — asymmetric handling justified by asymmetric cognitive workflow. ~190 lines.

### 86.4 — Block-attendance affordance + combined roster (`teacher-agenda-86.4-block-attendance-and-combined-roster-design.md`)

Restores the "take attendance by block" workflow that 86.2's block-aggregation rewrite removes — but as an explicit affordance (button row at top of agenda) rather than an implicit one. Combined roster modal composes per-activity sections each with the 86.3 on-time/arriving-later split. **Cluster activities are un-clustered in the combined roster** — block-attendance is per-activity work even when the agenda groups for density. "Mark all P" stays at the per-activity-section level, flagged as interim pending a future default-attendance-mode feature. ~240 lines.

### 86.5 — Sidebar + RLS extension (`teacher-agenda-86.5-sidebar-and-rls-extension-design.md`)

Sidebar surfaces all visible-to-all activities for situational awareness in two sections (yours / others'). Aggregation by `(role, start_time, end_time)` within each section — same key as agenda clusters, but cross-section aggregation does not occur. Sidebar popover mirrors the agenda cluster popover but adds a "Take attendance for all" footer action (the divergence point: sidebar = bulk monitor-style work, agenda = per-activity teaching work). Designs the RLS extension on `enrollments`, `activity_instances`, `attendance_records` to permit teacher reads when the parent activity is `visible_to_all_staff`. ~340 lines.

---

## Decisions worth carrying forward

A few calls made during the design conversation that aren't obvious from the docs alone:

- **Path A on write access (with confirmation gate).** The sidebar's "Take attendance for all" implies write access on attendance records for activities the viewer isn't on staff of. Three paths considered: (A) widen write too, (B) read-only sidebar, (C) conditional-by-role widening. Settled on Path A — admins opting an activity into visible-to-all implies "any teacher can engage," and the v1 demos' monitor-sweep pattern is what staff actually asked for. **But:** the trust implication is consequential enough that 86.5's build spec is required to surface this decision explicitly before the RLS migration ships. Not a unilateral design call.

- **"Mark all P" stays per-activity-section, no modal-level bulk.** Cross-activity bulk attendance is too easy to misuse — a teacher who clicks it absentmindedly can't remember which sections they'd verified. Also flagged as interim: Terry's suggestion of a per-teacher default-attendance-mode (mark-all-P vs. mark-all-A by default) will eventually reduce the need for the button significantly, at which point the button's visibility may become conditional on the user's setting. Default-attendance-mode is a real future feature, parked for now.

- **Cross-section sidebar aggregation does not occur.** A cluster spanning the yours/others' boundary produces two sidebar entries (a solo in "yours" + a group in "others'"), not one combined entry. Section identity is part of the aggregation key. Matches the principle that the two sections serve different cognitive frames.

- **`end_time_override` is inline-annotation, not a section.** Late-arrival gets its own section; early-departure gets a `leaves H:MM` note next to the name. Asymmetry justified by attention asymmetry: "why isn't this student here?" is a forward-looking, in-class question; "they left at 1:30" is a fact about how the day went.

- **"from off-campus" subtitle on the late-arrival section** — kept the section header simple ("Arriving later"). Daniel flagged the subtitle as accurate but not necessary information; small build-spec tweak for Claude Code.

---

## What's outstanding

- Five design docs ready to hand off to Claude Code, one at a time, for build-spec writing.
- 86.1 is the natural first hand-off — foundational, scoped, closes #88 cleanly on its own.
- Path A write-access confirmation is the load-bearing open question for 86.5 — gets resolved when its build spec drafts.

---

## Future-feature pin

**Default attendance mode** (per-teacher: mark-all-P-default vs. mark-all-A-default). Discussed in the context of "Mark all P" scoping for the combined roster. Most SIS platforms default to mark-all-P; Terry has suggested supporting mark-all-A as a variation for certain users/scenarios. Probable shape: a per-user preference, applied when the roster opens, with the teacher only intervening on exceptions. Touches user_preferences (new table likely), settings UI, attendance auto-application semantics, and the "did the teacher actually take attendance?" question (becomes fuzzier when "no interaction" counts as "all present"). Not in #86 scope. Worth its own design doc + issue when prioritized.

---

## Files added

- `docs/user-flows/teacher-agenda-86.1-overlap-resolution-design.md`
- `docs/user-flows/teacher-agenda-86.2-dashboard-and-clustering-design.md`
- `docs/user-flows/teacher-agenda-86.3-late-arrival-ui-design.md`
- `docs/user-flows/teacher-agenda-86.4-block-attendance-and-combined-roster-design.md`
- `docs/user-flows/teacher-agenda-86.5-sidebar-and-rls-extension-design.md`

## Files modified

- `STATUS.md` (#86 sub-area structure noted; next-steps updated to reflect design-then-build flow for the five sub-areas)
