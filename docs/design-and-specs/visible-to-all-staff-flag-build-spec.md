# `visible_to_all_staff` Flag — Build Spec

**Date:** May 14, 2026
**Status:** Ready to build
**Related:** #86 (teacher agenda layout rewrite — sidebar consumer), #70 (`activity_staff` junction table — full staff model overhaul), `teacher-agenda-design-direction.md`

---

## Purpose

Add an explicit boolean flag on activities to mark them as **visible to all staff**. This flag is the trigger for an activity to appear in the teacher agenda's sidebar (built in #86) regardless of whether the viewer is on its staff list.

The concept was originally part of #70's scope — it emerged from the April 2026 staff conversation alongside the multi-staff-per-activity work. We're pulling it out of #70 and shipping it standalone so the teacher agenda redesign (#86) can deliver its sidebar without waiting for the full `activity_staff` junction-table migration.

City View's culture is "the whole school is essentially one big room and everyone is collectively aware of where students are." The flag exists for activities that fit that pattern — typically open independent study blocks where students are dispersed across the building — so that all teachers can see them at a glance even when not personally assigned.

---

## Scope

**In scope:**
- Migration adding `visible_to_all_staff BOOLEAN NOT NULL DEFAULT false` to `activities`
- New icon button in the `ActivityDetail` behavior-flag row (admin) for toggling the flag
- The same icon button visible in `ActivityDetail`'s view mode with its active/inactive treatment communicating the flag's state
- No behavioral change to any agenda surface — the flag is data-only until #86 consumes it

**Explicitly out of scope:**
- The teacher agenda sidebar — that's #86
- The agenda-card visual cue (small icon or border accent on the card itself when set) — that's #86, deferred per `teacher-agenda-design-direction.md`'s open question #2
- RLS changes on dependent tables (`enrollments`, `activity_instances`, etc.) needed for non-assigned teachers to read enrollments/instances of visible-to-all activities. *This is the actual sidebar prerequisite and lives in #86 because the policy shape is tied to what the sidebar fetches.*
- Migration of `teacher_id`/`monitor_id` to `activity_staff` — that stays in #70's scope

**Note for #70:** When #70 ships, the migration there should be aware that this column already exists. #70's scope is now: junction table + role refactor only. No new `visible_to_all_staff` work.

---

## Database changes

### Migration

```sql
-- File: supabase/migrations/[next-timestamp]_add_visible_to_all_staff.sql

ALTER TABLE activities
  ADD COLUMN visible_to_all_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN activities.visible_to_all_staff IS
  'When true, this activity surfaces in every teacher''s agenda sidebar for situational awareness, regardless of staff assignment. Used for open/independent study blocks where students are dispersed across the building.';
```

No data migration is required — the default `false` is correct for all existing activities (admins will opt activities into the flag selectively).

No index is required at this time. Sidebar queries that filter on this column will run against a single-org activity set (tens to low hundreds of rows). If query plans show a sequential scan becoming a problem at scale, add a partial index then:

```sql
-- Future, if needed:
CREATE INDEX idx_activities_visible_to_all
  ON activities (organization_id)
  WHERE visible_to_all_staff = true;
```

### RLS

No new RLS policy is required to read or write this column. Existing activities policies cover it:

- **Teachers** already have `SELECT` on all activities in their org (`organization_id = my_org AND is_role('teacher')`), so they can read the flag's value on any activity.
- **Admins** already have `ALL` on activities in their org, so they can toggle the flag.
- **Students** read activities via `is_enrolled_in(id)`. The flag is irrelevant to students.

The flag does *not* in itself widen access to enrollments, instances, or attendance for visible-to-all activities. That widening — the actual sidebar enabler — is RLS work that belongs to #86.

---

## UI changes

### `ActivityDetail` behavior-flag row (admin)

The top of `ActivityDetail` renders a row of circular icon buttons — the “properties tray” driven by the `BEHAVIOR_FLAGS` array. Each entry is `{ field, icon, tooltip }` and renders as a `btn btn-sm btn-circle` with active (`btn-primary`) or inactive (`btn-ghost text-base-content/30`) treatment, switchable in edit mode and read-only-styled in view mode. This is the existing pattern; the new flag follows it exactly.

Add one entry to `BEHAVIOR_FLAGS`:

```js
{ field: 'visible_to_all_staff', icon: UsersThree, tooltip: 'Visible to all staff' },
```

- **Icon:** `UsersThree` from `@phosphor-icons/react`. (Open to reconsideration — final choice noted in conversation. `Eye` and `Broadcast` were considered; `UsersThree` was chosen because the flag's meaning is “this is for all staff,” which the three-people icon expresses directly without leaning on a visibility metaphor that points the wrong way.)
- **Placement in the row:** appended to the end of `BEHAVIOR_FLAGS`. The existing flags are roughly grouped from “attendance behavior” through “location behavior” through “schedule behavior”; appending to the end keeps that progression intact.
- **Tooltip:** `"Visible to all staff"` — matches the terse style of the other tooltips. No help text or descriptive paragraph; the tooltip is the entire explanation in this UI.
- **Active treatment:** `btn-primary` (matches all other active flags). No special color; this flag isn't more important than the others.
- **Mutual exclusion / interaction logic:** none. Unlike `is_release ↔ requires_attendance` and `allows_presence_wave ↔ requires_checkin`, this flag is fully independent. The existing `handleFlagToggle` function will handle it correctly without modification — it falls into the default “just toggle” path.

### `DEFAULT_VALUES` and `buildInitialValues`

Add `visible_to_all_staff: false` to `DEFAULT_VALUES` and `buildInitialValues` (mirroring the existing pattern for other boolean flags like `is_release`, `is_not_scheduled`). React Hook Form integration: `register('visible_to_all_staff')` if needed, or whatever pattern the existing flags use — just match the existing conventions.

### `onFormSubmit`

Add `visible_to_all_staff: formValues.visible_to_all_staff` to the `data` object built in `onFormSubmit`. Pattern matches every other boolean flag in that object.

### View mode

No additional view-mode treatment is needed beyond what the icon row already provides. In view mode the same row renders, with the icon in its active or inactive state and the tooltip available on hover. That's the entire visible-state signal — no badge, no labeled row, no separate metadata indicator. Visual parity with the other behavior flags is the whole point.

---

## API changes

None of the existing API functions need changes. `getActivities`, `createActivity`, `updateActivity`, etc., all use `select('*')` and pass through whatever columns exist on the table. The new column flows through transparently.

Activity hooks (`useActivities`, etc.) similarly pass the column through without code change.

---

## Acceptance criteria

- [ ] Migration adds `visible_to_all_staff BOOLEAN NOT NULL DEFAULT false` to `activities`
- [ ] Column has a `COMMENT` documenting its purpose
- [ ] No new RLS policy required (existing policies cover the column)
- [ ] `BEHAVIOR_FLAGS` array in `ActivityDetail.jsx` includes the new entry with `UsersThree` icon and `"Visible to all staff"` tooltip
- [ ] `DEFAULT_VALUES` and `buildInitialValues` initialize the field; `onFormSubmit` persists it
- [ ] Icon appears in both edit and view modes with appropriate active/inactive treatment and is toggleable in edit mode
- [ ] Form correctly defaults to `false` for new activities and to the persisted value for edits
- [ ] No regression in existing activity create/edit/read flows or in other behavior flags
- [ ] No agenda surface changes (the flag is dormant data until #86)

---

## Test scenarios for the implementer

1. Create a new activity with the icon left inactive → `false` is persisted.
2. Create a new activity with the icon toggled active → `true` is persisted.
3. Edit an existing activity, toggle the icon active, save → value updates.
4. Edit an existing activity, toggle the icon inactive, save → value updates.
5. View an activity with the flag on → icon renders in active state in the behavior row.
6. View an activity with the flag off → icon renders in inactive state in the behavior row.
7. Confirm existing activities (all of which will have `visible_to_all_staff = false` after the migration) continue to load and render with no errors, and that the icon shows inactive for all of them.

---

## What this is *not*

Two things worth being explicit about so they don't accidentally get pulled in:

1. **This is not the sidebar.** The sidebar is in #86. Without #86, this flag has no user-visible behavior beyond "icon in admin form, icon state in detail view." That's expected and correct.

2. **This is not a permissions widening.** Teachers do not gain new access by virtue of an activity being marked visible-to-all. The flag is presentational metadata for the agenda layer to read. Granting non-assigned teachers visibility into enrollments and instances of these activities — the *actual* mechanism that makes the sidebar work — is RLS work scoped to #86, not here.
