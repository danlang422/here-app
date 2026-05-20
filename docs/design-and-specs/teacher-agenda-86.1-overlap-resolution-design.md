# Teacher Agenda 86.1 — `SingleDayAgenda` Overlap Resolution (Design Doc)

**Date:** May 18, 2026
**Status:** Design — input to a Claude Code build spec
**Issue:** Closes #88. Foundational for #86 (this is the layout primitive #86.2 builds on).
**Related:** `teacher-agenda-design-direction.md` (the parent direction; this doc is one of five sub-area designs)

---

## Purpose

`SingleDayAgenda` currently positions cards by time but does not resolve overlaps — every card renders at full column width and overlapping activities stack via z-index, with later-rendered cards visually covering earlier ones. Fix this at the component level so both the student view and the teacher view benefit.

This is the **layout primitive** the rest of #86 depends on. By landing it first, the rest of #86 can be written and built against a `SingleDayAgenda` that already does its job.

---

## Design intent

The component receives a flat list of activities (each with its own `start_time` / `end_time`) and renders each as its own card, positioned by time, with **no visual overlap**. Activities whose time ranges overlap share horizontal space by splitting into columns. Activities whose times don't overlap render at full width as today.

Three principles:

1. **No card ever visually covers another.** This is a stronger guarantee than Google Calendar's "tolerate overlap with z-index." Here doesn't permit ambiguous booking, so the agenda shouldn't pretend it does.
2. **Non-overlapping activities are unaffected.** A day with no time conflicts looks identical to today. Width changes apply only inside concurrency groups.
3. **The primitive is content-agnostic.** It doesn't know about roles, clusters, blocks, prep, or visibility flags. Those are concerns of the layer above it (#86.2). This component just takes a list of cards with `start_time` / `end_time` / a content render slot and lays them out.

This third principle is the load-bearing one. If `SingleDayAgenda` stays content-agnostic, the student view continues using it directly (with student cards as content) and the teacher view wraps it (with cluster-card-or-solo as content). One primitive, two consumers.

---

## Algorithm

Standard interval-graph greedy coloring. For the activities in a given day:

1. Compute the **concurrency groups**: maximal sets of activities connected by transitive time-overlap. (Two activities overlap if `a.start < b.end AND b.start < a.end`. Concurrency groups are the connected components of that relation.)
2. Within each concurrency group:
   - Sort by `(start_time, end_time, id)`.
   - Walk the sorted list. For each activity, assign it the **lowest-indexed column** whose previously-placed activity ends at or before this one's start. If no such column exists, create a new one.
   - The number of columns required is the group's *width*.
3. Compute each card's rendered width as `(available_width − (n_columns − 1) × gap) / n_columns`, where `n_columns` is the width of *its concurrency group*. (Activities in a group of width 1 stay at full width. Activities in a group of width 3 share into thirds.)
4. Position each card at `left = column_index × (card_width + gap)`.

This is O(n log n) for sorting plus O(n × max_columns) for assignment — fine for the sizes we deal with (tens of activities per day per teacher, never more).

Two properties worth being explicit about:

- **Same-column reuse is desired.** Time-disjoint activities in the same group share a column (e.g. a 9:00–10:00 and an 11:00–12:00 within a group that also contains a 9:30–11:30). This is what keeps the column count minimal.
- **Group width is local.** A day with one 3-overlap and several solo activities renders the 3-overlap as thirds and the solos at full width. The thirds don't "leak" into the rest of the day.

---

## Component shape (design level, not API)

The component takes:

- A list of activities with at minimum `start_time`, `end_time`, and a stable `id` (or whatever the existing `SingleDayAgenda` already takes — this doc doesn't redesign the input contract).
- A render function or slot for the card content (so teacher and student views can supply different visuals).
- Whatever existing day-bounds / scale props it already takes for vertical positioning.

It produces a vertically time-scaled column with cards positioned and sized per the algorithm above.

The build spec figures out: existing prop names, whether the render-slot pattern matches the codebase's existing pattern (render prop vs. children vs. card-component prop), where the layout math lives (`agendaUtils.js` likely gets the new computation; `SingleDayAgenda.jsx` consumes its output), and how this composes with `AgendaBlockOverlay`.

---

## Edge cases

**Zero activities.** Renders the empty-day surface as today. No change.

**One activity.** Group of width 1, renders at full width. No change.

**Activities with identical start AND end times.** They form a concurrency group of width N. They get equal-width columns. No special handling — the algorithm naturally produces this. This is also the case the teacher view's clustering layer (#86.2) will *prevent* from reaching `SingleDayAgenda` in practice (because role-aware clustering aggregates them upstream into one cluster card), but the primitive doesn't know that, and it must handle the case correctly because the student view *does* reach it.

**Activities that touch but don't overlap.** `a.end === b.start`. The condition `a.start < b.end AND b.start < a.end` treats this as non-overlapping, which is correct — back-to-back activities should share a column, not split it.

**Very narrow cards.** A concurrency group of width 5+ produces cards in the 50-80px range at typical viewport widths. This is acknowledged ugly but acceptable — the *teacher view* solves this via clustering (#86.2), and the *student view* essentially never hits a 5+ overlap (a single student has a small number of scheduled activities at any one time). If the student view ever does encounter it, the cards squeeze and the user lives with it. We don't need a sophisticated fallback here.

**Multi-block activities.** They have a single `start_time` and `end_time` spanning the full duration. The algorithm doesn't care about block membership. The card renders once at its full time span. (This is also the resolution of the layout side of #69.)

---

## What this doc does *not* address

- **Card visual treatment** — colors, badges, content. The primitive renders whatever the parent supplies. Card design is in #86.2.
- **Cluster cards** — clustering is the teacher view's upstream concern. By the time activities reach `SingleDayAgenda` from the teacher view, clusters are already single cards. From the student view, clusters don't exist.
- **Click handlers, popovers, interactions** — same reason. The primitive renders; the parent decides what cards do.
- **Late-arrival chips** — content concern, #86.3.
- **Block-attendance buttons** — they live *above* the agenda surface, not inside it. #86.4.
- **Performance optimization** — not needed at this scale. If we ever run against a 200-activity day, revisit.

---

## Acceptance criteria for the build spec to translate

These are the criteria the build spec should produce verification steps for; the build spec itself will own the file-by-file change list.

- Overlapping activities render side-by-side, not stacked. Verified visually in both the student view and (post-#86.2) the teacher view.
- Non-overlapping activities render identically to today — no regression in the current student or teacher day-views.
- Cards in a 2-overlap render at half width. Cards in a 3-overlap render at third width. Cards in a 4-overlap render at quarter width.
- Within a concurrency group, time-disjoint activities reuse columns rather than each occupying a new column.
- A day with one concurrency group and several solo activities renders the solos at full width (group width doesn't leak).
- The component's API change (if any) is reflected in both call sites: teacher `Dashboard.jsx` and student `TodayView.jsx`. No third caller exists.
- `#88` closes when this ships.

---

## Open questions

None at the design level. The algorithm is standard, the principle of content-agnosticism is settled, and the parent views' needs are clear enough.

Any implementation-level questions (exact API shape, where the layout math lives in `agendaUtils.js`, how to handle existing prop contracts) are for the build spec to resolve against the actual codebase.

---

## Relationship to other 86 sub-designs

- **#86.2** builds the teacher Dashboard rewrite on top of this. Whatever input contract `SingleDayAgenda` exposes after this work is what #86.2's clustering layer feeds into.
- **#86.3, 86.4, 86.5** don't touch `SingleDayAgenda` directly; they're concerns above the primitive.
- All of them assume this is in place.
