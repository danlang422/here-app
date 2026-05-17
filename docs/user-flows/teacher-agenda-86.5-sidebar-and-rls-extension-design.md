# Teacher Agenda 86.5 — Sidebar + RLS Extension (Design Doc)

**Date:** May 18, 2026
**Status:** Design — input to a Claude Code build spec
**Issue:** Sub-area of #86. Depends on `visible_to_all_staff` flag (already shipped via prep work).
**Related:** `teacher-agenda-design-direction.md` (parent — the sidebar section is the primary reference), `visible-to-all-staff-flag-build-spec.md` (the data foundation), `teacher-agenda-86.2-dashboard-and-clustering-design.md` (the cluster popover pattern this borrows)

---

## Purpose

Add a sidebar to the teacher agenda that surfaces all activities marked `visible_to_all_staff` in the viewer's org for the current day. This is the situational-awareness surface — answering "what else is happening in the building right now" — distinct from the agenda's "what am I responsible for" framing.

Also: extend RLS so a teacher can read enrollments and attendance state for visible-to-all activities they aren't staffed on. The flag alone enables the sidebar to *exist*; the RLS extension enables it to *show useful content*.

---

## Design intent

The sidebar serves a question the main agenda doesn't answer: **what's happening in the school right now, beyond what I'm staffing?** City View's culture is built around mutual awareness — the whole school is essentially one big room, and teachers benefit from knowing where students are even when they're not personally responsible for them.

Three principles:

1. **The sidebar is awareness, not work.** It surfaces information for context, not for action. Teachers shouldn't feel obligated to interact with sidebar items the way they do with agenda cards. Visual treatment should communicate "this is FYI."
2. **The sidebar reflects all visible-to-all activities, not just others'.** A viewer's own visible-to-all activities appear in both surfaces — the agenda (as their responsibility) and the sidebar (as part of the school's awareness fabric). The two surfaces serve different cognitive frames.
3. **Bulk-action surface for monitor-like work.** The sidebar's popover is the right venue for "take attendance for all the visible-to-all activities in this group" — a pattern from the v1 demos where monitor staff swept attendance across loose collections. This is where the agenda cluster popover diverges from the sidebar popover (agenda clusters are per-activity work; sidebar clusters can be bulk work).

---

## Sidebar structure

### Layout position

Right-hand side of the agenda surface. Roughly 25–30% of the viewport width on desktop, with the agenda taking the remaining ~70%. Vertical scrolling within the sidebar handles overflow.

The sidebar is **always present** on the teacher agenda when the viewer has access to at least one visible-to-all activity for the day (their own or others'). If no visible-to-all activities exist for the day, the sidebar can either render with an empty state or be hidden entirely — implementer's call. I lean toward "render with subtle empty state" because the absence of the sidebar is a more jarring visual change day-to-day than the presence of an empty one.

Mobile/narrow viewport: out of scope per the parent direction doc.

### Two sections

1. **Visible to all · you're assigned** — visible-to-all activities where the viewer is on the staff list.
2. **Visible to all · others'** — visible-to-all activities where the viewer is *not* on the staff list.

Section order: "yours" on top, "others'" below. Section headers visible and distinct from item content.

If a section has zero items, hide it entirely (don't show an empty section header). When both sections are empty, the sidebar shows a single subtle empty state.

### Sidebar items

Each sidebar item displays:

- **Activity title.**
- **Time range** for the activity (or the aggregated group, see below).
- **Role badge** (the viewer's role on the activity, if any — solo items in the "others'" section won't have a viewer-role; they get a neutral badge or no badge).
- **YOURS badge** on items in the "yours" section. Per design direction, this is redundant with the section header but does color-distinguishing work and is retained.
- **Late-arrival chip** (if applicable, same chip from 86.3) — visible-to-all activities can have late arrivers too, and the chip surfaces that here just like on the agenda.
- **Visual treatment** distinct from agenda cards. Smaller, more compact, "this is context" reading.

### Aggregation in the sidebar

Group sidebar items by `(role, start_time, end_time)`. Three items sharing exactly that triple collapse into a single sidebar row labeled "N activities · time range."

**This is the same aggregation key as the agenda's cluster cards**, deliberately. The mental model carries: same conditions produce a cluster in both places.

**Items that share role and title but differ in time do NOT aggregate.** Three Independent Study slots at distinct times render as three separate sidebar rows. Aggregation is conservative — preserving time-structure matters more than compactness.

Within each section, items sort by start time ascending.

### Item interactions

Sidebar item behavior:

- **Solo item, viewer is assigned** (item in "yours" section, ungrouped) → opens that activity's roster modal directly. Same as agenda card behavior.
- **Solo item, viewer is NOT assigned** (item in "others'" section, ungrouped) → opens that activity's roster modal directly. **Same modal, but reached via the RLS-extended path** (see RLS section below).
- **Aggregated item** (group of N ≥ 2) → opens a popover anchored to the sidebar item.

---

## The sidebar popover

Triggered by clicking an aggregated sidebar item. Visually similar to the agenda cluster popover (86.2), but with two key differences:

### Difference 1: Members

The popover shows each member activity as a small card in side-by-side columns within the popover. Same layout pattern as the agenda cluster popover. Each member card shows: title, time range, role badge, late-arrival chip if applicable.

Clicking a member card opens that activity's roster modal.

### Difference 2: "Take attendance for all" footer action

The sidebar popover has a footer with a **"Take attendance for all"** button. Clicking it opens a **combined roster modal** scoped to all the activities in the popover.

This is the divergence point from the agenda cluster popover. The reasoning, restated:

- **Agenda clusters represent the viewer's concurrent responsibilities.** Each activity is its own teaching context; bulk attendance across them would mix contexts. The agenda cluster popover deliberately omits this action.
- **Sidebar groups represent loosely-related visible-to-all items.** These are often the same kind of activity (e.g. multiple Independent Studies at the same time, each with a different teacher), and the monitor-style workflow of sweeping attendance across them is real. The sidebar popover supports this.

The combined roster from "Take attendance for all" is the same combined-roster pattern from 86.4 (per-activity sections, sub-headers, on-time/arriving-later split per section). It just gets invoked from a different entry point.

### Positioning, dismissal, identity

Same patterns as the agenda cluster popover (86.2): positioned above by default, flips below when there's no room, dismissed by click-outside or Escape, header and footer echo the source item's identity.

---

## What goes in the sidebar — the data path

The sidebar needs to fetch, for the viewer's org and the current day, all activities where `visible_to_all_staff = true`, along with their enrollments and attendance state (so chips and combined-roster work).

For activities the viewer is assigned to: this data is already fetched by the existing teacher agenda data path. No new query needed for these; just filter the cached set.

For activities the viewer is NOT assigned to: this data is **not** fetched today, and the existing RLS prevents the viewer from reading it directly. This is where the RLS extension is required (next section).

The build spec resolves the query shape: probably a new fetcher (`getVisibleToAllForDate` or similar) that fetches all visible-to-all activities for the org and day, joined with their enrollments and attendance records. The sidebar consumes its result. The fetcher uses the existing tables; the access is gated by the new RLS policies.

---

## RLS extension

This is the architecturally consequential part of 86.5. It widens read access on three tables for teachers, specifically for activities marked `visible_to_all_staff`.

### Current state (recap)

Existing teacher RLS policies (from `docs/schema/10-rls-policies.md`):

- **`activities`** — teachers can SELECT all activities in their org. *Already covers reading visible-to-all activities they aren't on; no change needed.*
- **`enrollments`** — teachers can SELECT enrollments only where they're on the activity_staff (today: `teacher_id` or `monitor_id` matches). *This is the blocker.*
- **`activity_instances`** — same gating as enrollments. *Also blocked.*
- **`attendance_records`** — same gating. *Also blocked.*

For the sidebar's "others'" section, a teacher needs read access to enrollments, instances, and attendance records for activities they're *not* on, gated on the `visible_to_all_staff` flag.

### The extension

Add a permissive read clause to the teacher SELECT policies on `enrollments`, `activity_instances`, and `attendance_records`. Each clause is roughly: "OR the row's parent activity has `visible_to_all_staff = true`."

The exact SQL is the build spec's territory, but the shape per table:

```sql
-- enrollments SELECT (teacher) -- extension clause
OR EXISTS (
  SELECT 1 FROM activities a
  WHERE a.id = enrollments.activity_id
    AND a.visible_to_all_staff = true
    AND a.organization_id = my_org()
)
```

(Plus the existing org-scope and role checks.)

Same shape applies to `activity_instances` and `attendance_records` — they all have an `activity_id` (directly or via join), and the existence check on the parent activity's flag is the gating condition.

### What this widens

Teachers gain read-only access to:
- Enrollment rows for visible-to-all activities they aren't on. (Who's enrolled.)
- Activity instance rows for the same. (Daily schedule state.)
- Attendance records for the same. (Who's been marked what.)

Teachers do **not** gain:
- Write access. Marking attendance on a visible-to-all activity they aren't on requires being on the staff. The sidebar's "Take attendance for all" implies write access — see "Write access decision" below.
- Access to activities not marked visible-to-all. The widening is gated strictly on the flag.
- Access outside their org. All clauses preserve `organization_id` scoping.

### Write access decision

The sidebar popover's "Take attendance for all" footer opens a combined roster with attendance controls. **Can a teacher actually mark attendance on visible-to-all activities they aren't staff on?**

Two paths:

**Path A: Yes, widen write access too.** The same RLS extension applies to UPDATE on `attendance_records`. The sidebar's bulk-attendance action just works. Pro: matches the v1 demos' monitor sweep pattern, which staff requested. Con: cross-staff attendance writes mean a teacher could mark attendance on another teacher's activity, which has trust implications.

**Path B: No, write access stays restricted.** Teachers can *view* the combined roster but can't actually mark — the action is read-only. Pro: preserves the trust model. Con: defeats the purpose of the sidebar's bulk-action — what would "Take attendance for all" do if it can't write?

**Path C: Conditional widening.** Write access for visible-to-all activities is granted ONLY to users with a certain role (e.g. an admin, or a hypothetical "all-staff" role). Pro: best of both worlds. Con: introduces a new role concept that doesn't exist today.

**My read:** Path A is what staff actually asked for and what the parent design direction implies. The trust concern is real but bounded — visible-to-all is an opt-in flag set by admins on activities where mutual coverage is intended. By marking an activity `visible_to_all_staff`, the admin is implicitly saying "any teacher can engage with this." Write access follows that intent.

That said, Path A's trust implication is consequential enough that **the build spec should make this decision explicit and pass it back for confirmation before implementing.** It's not a design call to make unilaterally.

For the design doc's recommendation: **proceed with Path A** (widen write access for visible-to-all activities), with the understanding that this will get an explicit confirmation pass before RLS migration writes go to production.

### Functions and policy structure

Existing RLS uses helper functions (`is_role()`, `is_teacher_or_monitor_of()`, `my_org()`). The extension may benefit from a new helper like `activity_is_visible_to_all(activity_id)` to keep policies readable. Build spec's call on factoring.

### Audit / logging

The visible-to-all path enables a teacher to write attendance on activities they aren't on staff. The audit-log table (per `docs/schema/08-audit-log.md`) should capture these writes — but the audit log probably already captures all attendance writes via a trigger or similar mechanism. Build spec verifies that the new access path doesn't bypass logging.

---

## TanStack Query / cache

The sidebar's data path is a second query alongside the existing teacher agenda data. Cache keys should be distinct (e.g. `['agenda', 'visible-to-all', orgId, date]` vs. `['agenda', 'teacher', viewerId, date]`).

Invalidation: when attendance is marked from the sidebar's combined roster, both queries should invalidate (because the same activity may appear in both — viewer's own visible-to-all activities show in both the agenda and the sidebar's "yours" section).

Same applies to enrollment overrides: an admin setting `start_time_override` on a student in a visible-to-all activity should propagate to the sidebar's late-arrival chip and the sidebar popover's combined roster — same invalidation pattern.

---

## Edge cases

**A day with no visible-to-all activities.** Sidebar renders with subtle empty state ("No school-wide activities to show today" or similar minimal phrasing).

**A teacher who has no agenda activities but has visible-to-all activities to see.** The agenda surface shows its existing empty state; the sidebar is populated and serves as their primary view of the day. This is unusual but possible (e.g. a substitute teacher on a day they aren't assigned anywhere).

**An activity marked visible-to-all but with zero enrollments.** It still appears in the sidebar (the flag is independent of enrollment). The roster modal would show an empty roster; the combined roster would have an empty section. Implementer should verify empty rendering is graceful.

**An activity marked visible-to-all by an admin who later unmarked it.** It drops out of the sidebar on next data refresh. No stale rendering — the data path filters on the current flag value.

**A viewer who is on staff of one visible-to-all activity and not on others'.** The first appears in "yours" section; the second appears in "others'" section. Two sections, both populated.

**A cluster of 5 Independent Studies (5 different teachers, same time, all visible-to-all).** Sidebar shows them aggregated under the "others'" section as a group of 5. Click the group → popover → 5 member cards in side-by-side columns. Popover footer "Take attendance for all" → combined roster modal with 5 sections, one per teacher's IS.

**A cluster where ONE member is in "yours" and FOUR are in "others'."** Tricky. The aggregation key is `(role, start_time, end_time)`, so they could theoretically share a key — but the section boundary splits them. **Sidebar aggregation happens within sections, not across them.** So this case produces: one solo item in "yours" section, one group of 4 in "others'" section. Two sidebar entries, not one. This is the right behavior — section identity is part of the implicit aggregation key.

**Late-arrival chip on a sidebar item where the viewer can't read enrollment overrides.** Requires the RLS extension to read enrollment data. Already covered by the extension above.

**Attendance progress indicator on a sidebar item.** Same — requires RLS-extended read access to attendance_records. Covered.

---

## Acceptance criteria for the build spec to translate

- Sidebar renders on the teacher agenda when at least one visible-to-all activity exists for the day.
- Sidebar has two sections: "yours" (assigned) and "others'" (not assigned), in that order.
- Empty sections are hidden; both-empty shows a single subtle empty state.
- Sidebar items aggregate by `(role, start_time, end_time)` within their section. Cross-section aggregation does not occur.
- Items sort by start time within each section.
- "YOURS" badge appears on items in the "yours" section.
- Late-arrival chips appear on sidebar items per the same rule as agenda cards.
- Solo sidebar items open the activity's roster modal directly.
- Aggregated sidebar items open a popover with member cards in side-by-side columns.
- Sidebar popover footer has a "Take attendance for all" action that opens the combined roster modal scoped to the group's activities.
- Agenda cluster popovers do NOT have this action (it's sidebar-only).
- RLS extended on `enrollments`, `activity_instances`, `attendance_records` to permit teacher reads when the parent activity is visible-to-all.
- RLS extended for write on `attendance_records` for the same condition. (Pending explicit confirmation per the design doc — build spec flags this.)
- Audit logging continues to capture all attendance writes via the existing mechanism (verify, don't reimplement).
- TanStack Query: sidebar uses a distinct query key; attendance writes invalidate both sidebar and agenda queries when applicable.
- Mobile / narrow viewport behavior: explicitly out of scope.

---

## Open questions

- **Write access scope** (Paths A / B / C above). Recommendation: Path A, but build spec confirms before RLS migration writes ship.
- **Empty-day sidebar treatment.** Render with subtle empty state, or hide? Recommendation: render with empty state. Implementer can adjust based on visual feel.
- **Sidebar item visual treatment.** Compact card form, list-row form, something else? Build spec / design system territory.

---

## What this doc does *not* address

- The agenda surface itself (86.1, 86.2).
- The late-arrival chip semantics (owned by 86.3; used here).
- The combined roster modal shape (owned by 86.4; reused here as the "Take attendance for all" target).
- Mobile sidebar behavior.
- Multi-day sidebar views.

---

## Relationship to other 86 sub-designs

- **#86.1** — no direct relationship. Sidebar lives outside the time-axis primitive.
- **#86.2** — borrows the cluster popover pattern. The sidebar popover is essentially the agenda cluster popover + a "Take attendance for all" footer.
- **#86.3** — chip pattern composes into sidebar items unchanged.
- **#86.4** — combined roster from 86.4 is the target of "Take attendance for all." Same modal, different entry point.
