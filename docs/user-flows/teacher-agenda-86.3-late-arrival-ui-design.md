# Teacher Agenda 86.3 — Late-Arrival UI (Design Doc)

**Date:** May 18, 2026
**Status:** Design — input to a Claude Code build spec
**Issue:** UI side of #87. Sub-area of #86. Depends on the enrollment time-overrides prep work (already shipped) for its data.
**Related:** `teacher-agenda-design-direction.md` (parent), `enrollment-time-overrides-build-spec.md` (the data layer), `teacher-agenda-86.2-dashboard-and-clustering-design.md` (the cards and popovers this chip lives on)

---

## Purpose

Surface per-enrollment arrival/departure overrides to teachers in two places: as an inline chip on agenda cards (and cluster cards), and as a dedicated section in the roster modal. This is the user-visible payoff of #87 — the data has been collectible since the prep work shipped, but until 86.3 lands, no teacher can see it.

The driving case: two Iowa BIG students who consistently arrive ~15 minutes into their next class. Today, teachers carry this in their heads. After 86.3, the agenda carries it.

---

## Design intent

Late arrival is **information, not exception**. A student arriving at 11:00 to a 10:45 activity isn't tardy — they're scheduled to arrive at 11:00. Three principles follow:

1. **The override doesn't gate attendance.** Teachers can still mark these students any of P/A/E/T at any time, regardless of clock vs. override time. The UI provides context the teacher would otherwise carry mentally; it doesn't constrain action.
2. **The override is mildly emphasized, not loud.** Amber (warning) palette signals "pay attention," but the chip is small and sits with other metadata. It doesn't dominate the card.
3. **Late arrivers are part of the activity, not separate from it.** They get a section in the roster modal (below the on-time roster), not a separate card on the agenda, and not a separate "late arrivals" view. They're enrolled students who happen to start later.

---

## Where late-arrival shows up

Three surfaces:

1. **Agenda card** (solo or cluster) — the chip beside the role badge.
2. **Cluster popover member card** — same chip pattern, scoped per-member.
3. **Roster modal** — a separate "Arriving later" section below the on-time roster.

The chip is the at-a-glance signal. The roster section is the actionable detail.

---

## The chip

A small inline badge that appears on a card when **at least one enrolled student has a non-null `start_time_override`** for that activity.

**Content:** `↩ N arr H:MM`

- `↩` — a small return/arrival glyph (Phosphor `ArrowUDownLeft` or similar; implementer picks from the existing icon set).
- `N` — count of late-arriving students on this activity (or this cluster's activities — see aggregation rules below).
- `arr` — short for "arrives," to distinguish from a generic time display.
- `H:MM` — the earliest override time among the late arrivers. For the common case (all Iowa BIG students arriving at 11:00), this is unambiguous. For the rare case of staggered arrivals, the chip shows the earliest and the popover/roster shows the full breakdown.

**Style:** Amber palette (warning, not error). Same visual weight as the role badge it sits next to — present but not loud.

**Placement:** Top of the card, next to the role badge. This is the v2 demo's resolved location — earlier iterations put the chip in a bottom strip on the card, which got clipped on short cards (the 45-minute Algebra 2 case). Top-of-card is the resolved location.

**Click behavior:** The chip itself is not separately clickable. Clicking the card (anywhere on it, including the chip) opens the roster modal (for solo) or the cluster popover (for clusters). Once in the roster modal, the "Arriving later" section is where the late-arrival detail lives.

### Aggregation rules

For a **solo card**, the chip's `N` is the count of that activity's enrollments with non-null `start_time_override`. The time is the earliest override across them.

For a **cluster card**, the chip's `N` is the count of late-arriving students across *all* the cluster's activities. The time is the earliest override across all of them. (Example: a cluster of 5 Internships at 12:15–1:15; two students across two of those internships have overrides at 12:30 and 12:45. The cluster chip shows `↩ 2 arr 12:30`.)

For a **cluster popover member card**, the chip is scoped to that one activity — same logic as a solo card.

**Why both aggregate and per-member chips?** The cluster card answers "is there anything to know about late arrivals in this group?" The popover member cards answer "which specific activities are affected?" The roster modal answers "who, exactly, and when?"

### Edge cases

- **`end_time_override` only, no `start_time_override`.** The chip doesn't appear (it's an "arriving later" chip, not a "leaving early" chip). A future spec could add an `↪` early-departure indicator, but it's deliberately out of scope here — staff feedback didn't surface this as a felt need, and adding a second chip variant before there's demand is over-design. The override is still respected in the roster section (see below).
- **An override that's *earlier* than the activity's default start time.** The data model permits this (per the prep spec: "the override's correctness is the admin's judgment call"). If `start_time_override < default_start_time`, the chip and roster section still display the override time. This is unusual but legal — could represent a student doing pre-class prep, or an admin data-entry mistake. The UI displays what the data says.
- **All students on the activity have an override.** N equals the full enrollment count. Chip shows the same way. There's nothing special-case here.
- **An activity with zero non-overridden enrollments and N overridden enrollments.** Identical to the previous case from the chip's perspective. The roster section becomes "the whole roster" rather than "the late portion." UI handles this gracefully — the on-time section is empty, the "Arriving later" section has everyone. Implementer should verify the empty state of the on-time section reads sensibly.

---

## The roster section

When a teacher opens the roster modal for an activity with at least one late-arriving student, the modal now has two sections:

```
[Activity title, time, block label]
─────────────────────────────────
On-time roster
  [student row]
  [student row]
  ...
─────────────────────────────────
Arriving later · from off-campus
  [student row] · arrives 11:00
  [student row] · arrives 11:00
─────────────────────────────────
```

**Section header text:** "Arriving later" is the primary label. "from off-campus" is a soft subtitle that hints at the most common cause (Iowa BIG return, external HS, college course return). Both are static labels — they don't infer the student's actual prior location from the data, because the data doesn't reliably support that inference. The subtitle communicates the *typical* case without claiming to know any specific student's situation.

**Per-row override display:** Each late-arriving student's row shows their override time inline. Recommended format: `arrives H:MM` next to the student's name, in the amber/warning treatment matching the chip. No interactive control — just informational text.

**Attendance controls:** Identical to the on-time roster. P/A/E/T buttons fully functional, same shape, same behavior. The override doesn't disable or modify attendance UI.

**Sort order:** Within the "Arriving later" section, sort by override time ascending, then by student name. Students arriving earliest appear first.

**Section visibility:** The "Arriving later" section is only rendered when there's at least one late arriver. Don't show an empty "Arriving later · 0 students" section.

**`end_time_override`-only students:** Render in the on-time section (because they *are* on time at start), with an additional inline label `leaves H:MM` next to the name. Same amber treatment. This is symmetric handling: starts-later goes in its own section, ends-earlier annotates in place. The asymmetry is justified by the asymmetric workflow — "this student is missing because they haven't arrived yet" is a question that gets asked during the first 20 minutes of class; "this student left early" is a question that gets asked at the end. The first question deserves a dedicated section; the second is fine as an inline note.

**Students with both overrides:** Render in the "Arriving later" section (the late-arrival is the more-immediate concern). The row shows both: `arrives 11:00 · leaves 1:30`.

---

## Combined roster (block-attendance) interaction

86.4 introduces a combined roster modal — one modal that shows the rosters for multiple activities under a single block, with per-activity sub-headers. When that combined roster includes late-arriving students, the same pattern applies *per activity within the combined modal*: each activity's section in the combined roster has its own on-time / arriving-later split.

This means the "Arriving later · from off-campus" sub-section can appear multiple times in a combined roster (once per activity that has late arrivers). That's fine — keeping it scoped per-activity preserves the meaning. Teachers reading a combined roster understand they're seeing per-activity structure.

Detail of the combined roster shape lives in 86.4. This doc just confirms the late-arrival pattern composes cleanly into it.

---

## What this doc does *not* address

- **End-of-day "early departures" view.** Not a felt need today. Deferrable.
- **Notifications when a late arriver is overdue** ("they should be here by now"). Out of scope; this would intersect with #80 (Realtime) and a notifications surface that doesn't exist yet.
- **Edit-from-roster.** A teacher noticing that a student's override is wrong can't fix it from the roster modal. They'd need to go to the admin enrollment editor. This is fine — overrides are admin data, not teacher data. Adding teacher-edit access would change the trust model.
- **The data layer.** Already shipped via the prep work (`start_time_override` and `end_time_override` on enrollments). No schema changes needed here.

---

## Acceptance criteria for the build spec to translate

- Agenda cards with late-arriving enrollments display the chip beside the role badge, with count and earliest time.
- Cluster cards aggregate the chip across all their member activities' late arrivers.
- Cluster popover member cards each show their own per-activity chip.
- Roster modal renders an "Arriving later · from off-campus" section below the on-time roster when applicable.
- Late-arrival rows show `arrives H:MM` inline next to the name in amber treatment.
- Attendance controls (P/A/E/T) work identically in both roster sections.
- The "Arriving later" section is not rendered when empty.
- `end_time_override` students display inline in the on-time section with `leaves H:MM` annotation.
- Students with both overrides render in the "Arriving later" section with both annotations.
- Combined roster (from 86.4) preserves the on-time / arriving-later split per-activity within the combined modal.
- No regression: activities with no overrides on any enrollment render with no chip and a single-section roster, identical to today.
- TanStack Query invalidation: updating an enrollment's override (admin side) propagates to the teacher view's chip count and roster section without manual refresh.

---

## Open questions

None at design level. The chip glyph (`↩` vs. another Phosphor icon) and exact amber shade are implementer choices against the design system.

---

## Relationship to other 86 sub-designs

- **#86.1** — no relationship; this is content for cards, not layout.
- **#86.2** — designs the cards and popovers this chip lives on. The chip placement (next to role badge) is referenced there; this doc owns the chip's semantics.
- **#86.4** — combined roster shares the on-time / arriving-later pattern per-activity. Acknowledged here; designed there.
- **#86.5** — the sidebar's items can also have late-arrival chips (an Independent Study with overridden students would still surface that fact when shown in the sidebar). Same chip pattern; sidebar UI design lives in 86.5.
