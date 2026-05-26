# Build Spec — `activity_staff` Junction Table (#70, Phase 2 / epic #84)

**Status:** Ready for Claude Code
**Issue:** [#70](https://github.com/danlang422/here-app/issues/70)
**Depends on:** nothing (the `visible_to_all_staff` flag half of #70 already shipped — see below)
**Unblocks:** #77 (substitute role), #78 (bulk staff assignment), #79 (monitor UI, Phase 3)

---

## Goal

Replace the two single-value personnel columns on `activities` (`teacher_id`, `monitor_id`) with an `activity_staff` junction table that supports **multiple staff per activity** with a `role` distinction (`teacher` | `monitor`). Migrate existing data, repoint the one RLS DEFINER function that gates all teacher visibility, rework the API/query layer to read staff through the junction, update `getViewerRole`'s internals, and surface the full staff list in **view-mode** UI.

This spec deliberately scopes the **edit-mode multi-staff form to a follow-up** (see [Out of Scope](#out-of-scope--follow-up)). The data model will fully support multiple staff on day one; only the *authoring* UI stays single-staff in the interim.

---

## Important context before you start

### What is already done (do NOT rebuild)

Issue #70 as originally written bundles two features. **One of them already shipped** in session 39:

- `visible_to_all_staff BOOLEAN NOT NULL DEFAULT false` on `activities` — migration `20260514000001_add_visible_to_all_staff.sql`, merged as #91.
- Its RLS extension — migrations `20260520000001_visible_to_all_rls_extension.sql` and `20260520000002_visible_to_all_activities_read.sql`, including the `activity_is_visible_to_all()` DEFINER helper.
- The `visible_to_all_staff` toggle is already wired into `ActivityDetail`'s behavior-flags tray and `buildInitialValues`/`onFormSubmit`.

**Therefore:** this spec does NOT touch the flag, its column, or its RLS. Skip every flag-related acceptance criterion in the issue — those boxes are already checked. This spec is *only* the junction-table half.

### Decisions already settled (do not re-litigate)

These were decided in the design conversation that produced this spec:

1. **Do NOT rename `is_teacher_or_monitor_of` → `is_staff_of`.** The issue text says to rename it. We are consciously diverging. The function is the single DEFINER chokepoint that ~9 downstream policies (enrollments, activity_instances, attendance_records, check_ins, presence_waves, status_updates, posts, post_responses, comments) route through. Renaming forces dropping and recreating every dependent policy — exactly the churn that caused recursion bugs in the session-36 overhaul. Instead, **keep the name and `CREATE OR REPLACE` the body only** to query `activity_staff`. Semantically the function still answers "is the caller staff on this activity," so the name remains accurate enough. Leave a code comment noting the intentional divergence from the issue.

2. **Drop the old columns outright** — no compatibility/dual-write window. But the data copy into `activity_staff` MUST be verified before the drop, within the same migration transaction (see migration section).

3. **`getViewerRole` keeps its exact signature and return type** (`'teacher' | 'monitor' | null`). The `unique_activity_user` constraint guarantees ≤1 row per (activity, viewer), so it's still one role per viewer. Only the *internals* change. A new sibling helper `getActivityStaff(activity)` is added for the "list all staff" need.

4. **Edit-mode multi-staff UI is deferred.** The form continues to author at most one teacher + one monitor (+ instructor/mentor text) in this spec. See Out of Scope.

---

## Database changes

### New migration file

Create a single migration: `supabase/migrations/20260526000001_activity_staff_junction.sql` (adjust the date to the build date if later). It performs all of the following in order, in one transaction.

#### 1. Create the table

```sql
CREATE TABLE activity_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'monitor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_activity_user UNIQUE (activity_id, user_id)
);

CREATE INDEX idx_activity_staff_activity ON activity_staff(activity_id);
CREATE INDEX idx_activity_staff_user ON activity_staff(user_id);
CREATE INDEX idx_activity_staff_user_role ON activity_staff(user_id, role);
```

> **Note on `unique_activity_user`:** the constraint is on `(activity_id, user_id)` *without* `role`. This means one person cannot be listed twice on the same activity, even in different roles. That matches reality — a staff member is either present-with-students (teacher) or supervising-from-elsewhere (monitor) for a given activity, not both. This is also what keeps `getViewerRole` single-valued. Do not add `role` to this constraint.

#### 2. Grants + RLS enable (REQUIRED — new-table policy)

Per CLAUDE.md, tables in `public` are no longer auto-exposed to the Data API. This block is mandatory:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_staff TO authenticated;
GRANT ALL ON public.activity_staff TO service_role;
ALTER TABLE public.activity_staff ENABLE ROW LEVEL SECURITY;
```

#### 3. Migrate existing data

```sql
-- Teachers
INSERT INTO activity_staff (activity_id, user_id, role)
SELECT id, teacher_id, 'teacher'
FROM activities
WHERE teacher_id IS NOT NULL;

-- Monitors
INSERT INTO activity_staff (activity_id, user_id, role)
SELECT id, monitor_id, 'monitor'
FROM activities
WHERE monitor_id IS NOT NULL;
```

> Edge case to be aware of (extremely unlikely given current data, but the copy handles it correctly): if any activity ever had the *same* user as both `teacher_id` and `monitor_id`, the second insert would violate `unique_activity_user`. Current City View data does not have this. If the migration fails here, stop and report — do not silently `ON CONFLICT DO NOTHING`, because that would mean choosing which role to drop, and that's a data decision for Daniel, not the migration.

#### 4. Verify before dropping (safety gate, same transaction)

Add an assertion so the migration aborts (rolls back) rather than dropping columns if the copy didn't capture everything:

```sql
DO $$
DECLARE
  expected INTEGER;
  actual INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM activities WHERE teacher_id IS NOT NULL)
    + (SELECT COUNT(*) FROM activities WHERE monitor_id IS NOT NULL)
  INTO expected;

  SELECT COUNT(*) FROM activity_staff INTO actual;

  IF actual <> expected THEN
    RAISE EXCEPTION 'activity_staff migration mismatch: expected %, got %', expected, actual;
  END IF;
END $$;
```

#### 5. Repoint the RLS DEFINER function (body swap, same name)

```sql
CREATE OR REPLACE FUNCTION public.is_teacher_or_monitor_of(activity_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- NOTE: intentionally NOT renamed to is_staff_of (see #70 build spec).
  -- Body repointed from activities.teacher_id/monitor_id to activity_staff.
  SELECT EXISTS (
    SELECT 1
    FROM activity_staff s
    JOIN user_profiles up ON up.id = auth.uid()
    JOIN activities a ON a.id = s.activity_id
    WHERE s.activity_id = activity_id_param
      AND s.user_id = auth.uid()
      AND a.organization_id = up.organization_id
  );
$$;
```

> Confirm against the existing definition (search migrations `20260513000002` and the comprehensive-policies migration for the current body) that the org-scoping join matches the established pattern. The function must remain `SECURITY DEFINER`, `search_path = public`, and `EXECUTE` granted to `authenticated` only. Because the signature is unchanged, **no dependent policy needs to be touched** — they all keep calling `is_teacher_or_monitor_of(activity_id)` and transparently get junction-backed results.

#### 6. RLS policies on `activity_staff` itself

Follow the junction-table pattern already used elsewhere. Use the DEFINER helpers, not inline subqueries, to avoid recursion:

```sql
-- Students: can read staff rows for activities they're enrolled in
CREATE POLICY "Students read staff of enrolled activities"
  ON activity_staff FOR SELECT
  USING (public.is_enrolled_in(activity_id));

-- Teachers: can read staff rows for activities they are staff on
CREATE POLICY "Teachers read staff of own activities"
  ON activity_staff FOR SELECT
  USING (public.is_teacher_or_monitor_of(activity_id));

-- Teachers: can read staff rows for visible-to-all activities
CREATE POLICY "Teachers read staff of visible-to-all activities"
  ON activity_staff FOR SELECT
  USING (public.activity_is_visible_to_all(activity_id));

-- Admins: full control over staff rows in their org
CREATE POLICY "Admins manage staff in org"
  ON activity_staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE a.id = activity_staff.activity_id
        AND a.organization_id = up.organization_id
        AND 'admin' = ANY(up.roles)
    )
  );
```

> Verify `activity_is_visible_to_all(activity_id)` exists with that exact signature (introduced in `20260520000001`). If the actual name/arg differs, match it. The visible-to-all SELECT policy on `activity_staff` matters so non-assigned teachers can see *who* the nominal owner is on a visible-to-all activity.

#### 7. Drop old columns + indexes

```sql
DROP INDEX IF EXISTS idx_activities_teacher;
DROP INDEX IF EXISTS idx_activities_monitor;

ALTER TABLE activities DROP COLUMN teacher_id;
ALTER TABLE activities DROP COLUMN monitor_id;
```

> Do this LAST, after the verification gate (step 4) and after the function repoint (step 5). Order matters: the function must already query `activity_staff` before the columns vanish, though since it's one transaction the visibility is atomic regardless.

#### 8. Block-trigger / cascade check

There is a `trg_activity_block_cascade` trigger (migration `20260309000001`) that syncs `enrollments.block` on activity edit. Confirm it does **not** reference `teacher_id`/`monitor_id`. It almost certainly only touches `block`, but grep the trigger function body before finalizing — if it selects `*` or references the dropped columns, it will break on the next activity update. Report if so; do not silently rewrite it without flagging.

---

## Application layer changes

### `src/lib/staffRoles.js`

**Update `getViewerRole` internals** (signature and return type unchanged):

```js
export function getViewerRole(activity, viewerId) {
  if (!activity || !viewerId) return null
  const staff = activity.activity_staff ?? []
  const row = staff.find((s) => s.user_id === viewerId)
  return row?.role ?? null
}
```

Update the docstring: remove the "pre-#70 / post-#70" framing and the stale `docs/user-flows/...` path (that directory no longer exists — specs live in `docs/design-and-specs/`). State plainly that role derives from `activity.activity_staff`. Note that callers must ensure the activity object carries an `activity_staff` array (the queries below guarantee this).

**Add a sibling helper `getActivityStaff`:**

```js
/**
 * Return all staff on an activity as a normalized, display-ready list.
 * Teachers first, then monitors; within a role, by the order returned.
 * Does NOT include external instructor_name / mentor_name (those are
 * free-text fields on the activity, not user rows). Callers that show
 * those render them separately from the activity object.
 *
 * @param {object} activity - must include `activity_staff` (each row may
 *   carry a joined `user` profile object for name display).
 * @returns {Array<{ userId, role, user }>}
 */
export function getActivityStaff(activity) {
  const staff = activity?.activity_staff ?? []
  const order = { teacher: 0, monitor: 1 }
  return [...staff]
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .map((s) => ({ userId: s.user_id, role: s.role, user: s.user ?? null }))
}
```

### `src/api/activities.js`

Every place that selects/joins `teacher_id`/`monitor_id` must change. The pattern: embed `activity_staff` and join the profile through it.

- **`getActivity`** — currently `select('*')`. Change to embed staff:
  ```js
  .select(`
    *,
    activity_staff(id, user_id, role, user:user_profiles(id, first_name, last_name, preferred_name))
  `)
  ```
- **`getActivities`** — replace the `teacher:user_profiles!teacher_id(...)` and `monitor:user_profiles!monitor_id(...)` embeds with the single `activity_staff(...)` embed above. Keep the `activity_terms` and `calendar` embeds as-is.
- **`getTeacherActivities`** — currently `.or('teacher_id.eq.X,monitor_id.eq.X')`. This filter is on the *parent* table and can no longer reference dropped columns. Rewrite to filter via the junction. Options, in order of preference:
  1. Query `activity_staff` for the user's rows, collect `activity_id`s, then fetch those activities. Two round-trips but simple and RLS-clean.
  2. Use a PostgREST inner-join filter: embed `activity_staff!inner(...)` and filter `.eq('activity_staff.user_id', teacherId)`. One round-trip. Verify the embedded-filter semantics return the parent rows you expect (PostgREST filters the embed but the `!inner` prunes parents with no matching staff).

  Prefer option 2 if it works cleanly in testing; fall back to option 1 if the embedded filter is fiddly. **Whichever you pick, this function must also continue to include `visible_to_all_staff = true` activities if its callers expect them** — check who calls `getTeacherActivities` before assuming. (Note: the live teacher agenda uses `getTeacherActivitiesForDate` in `agenda.js`, not this function. Confirm whether `getTeacherActivities` is still used anywhere; if it's dead code, flag it rather than over-investing.)
- **`getStudentActivities`** — `select('*')` plus an `enrollments!inner` embed. Add the `activity_staff(...)` embed so student-side views can show staff names. Keep existing enrollment filter logic.
- **`bulkUpdateActivityFields`, `createActivity`, `updateActivity`, `deleteActivity`, `getNeedsScheduling`, `getInternshipOpportunities`** — these don't reference the personnel columns directly, but `createActivity`/`updateActivity` receive a payload object. See the `staffUtils` section: the staff write path no longer lives in the activity payload, so confirm these functions are not passed `teacher_id`/`monitor_id` (they will be, until `staffUtils` is updated — handle in the same change).

### `src/api/agenda.js`

- **`getStudentActivitiesForDate`** — currently flat-maps `[a.teacher_id, a.monitor_id]` to fetch display names via `batchGetProfileDisplayInfo`, then attaches `teacher`/`monitor`. Rework: embed `activity_staff(user_id, role)` on the `activity:activities!inner(...)` select, collect `user_id`s from the staff rows for the batch name fetch, and attach a resolved `activity_staff` array (each row carrying its `user` display info) instead of the `teacher`/`monitor` scalars. The function should return activities whose staff is represented as the junction array, so downstream consumers use `getActivityStaff`.

  > Keep using the `get_profile_display_info` / `batchGetProfileDisplayInfo` DEFINER-RPC pattern for names — do NOT switch to a direct `user_profiles` join here. The comment in this file and the RLS doc both warn that cross-role name joins can trigger recursion; the batch RPC is the established safe path. So: embed `activity_staff(user_id, role)` for the *role/linkage*, but resolve *names* through the batch RPC keyed on the collected `user_id`s.

- **`getTeacherActivitiesForDate`** — currently `.or('teacher_id.eq.X,monitor_id.eq.X')`. This is the **live teacher-agenda query** (used by `useTeacherAgenda`). Rewrite the staff filter to go through `activity_staff`, same approach chosen in `getTeacherActivities` above. It must continue to return the `{ activities, enrollmentsByActivity }` shape unchanged. Each returned activity should carry its `activity_staff` array (with `user_id`, `role`) so `getViewerRole`/`getActivityStaff` work in the agenda. The enrollment-count and late-arrival logic in `useTeacherAgenda` does not depend on staff and should not change.

  > **Visible-to-all interaction:** the agenda separately fetches visible-to-all activities via `getVisibleToAllActivitiesForDate`. Do not fold visible-to-all into this function's staff filter — keep the two paths separate, exactly as they are today. This function returns *activities the viewer is staff on*; visible-to-all is additive and handled elsewhere (and built in #79).

- **`getVisibleToAllActivitiesForDate`** — does not filter by staff, but if its returned activities are rendered with staff names (likely, for the "others' sections" sidebar from 86.5), add the `activity_staff(user_id, role)` embed here too and resolve names via the batch RPC, mirroring `getStudentActivitiesForDate`. Confirm whether the sidebar shows staff names before adding; if it only shows activity names, skip.

### `src/hooks/useTeacherAgenda.js`

No structural change required — it consumes `getTeacherActivitiesForDate`'s `{ activities, enrollmentsByActivity }` and the activities now carry `activity_staff`. Confirm nothing in the hook reads `.teacher_id`/`.monitor_id` (it doesn't in the current version, but verify after edits). Any consumer computing the viewer's role should call `getViewerRole(activity, profileId)`, which now reads the junction.

### Other consumers — grep before finishing

Do a repo-wide search for these tokens and fix every hit (this list is derived from reading the code, but treat it as a starting point, not exhaustive):

- `teacher_id` and `monitor_id` (string literals, `.teacher_id`, `.monitor_id`, PostgREST embed hints `!teacher_id` / `!monitor_id`, `.or('teacher_id...`)
- `activity.teacher` / `activity.monitor` (the joined scalar objects that no longer exist)
- `is_teacher_or_monitor_of` (should remain referenced — confirm no caller expected a renamed `is_staff_of`)

Known component consumers to check: `useTeacherActionSummary` (issue calls it out), anything in `src/components/agenda/` rendering staff (`TeacherActivityCard`, cluster cards from 86.2), `src/components/roster/`, and the student agenda cards.

---

## UI changes (view-mode only this spec)

### `src/components/activities/StaffRows.jsx` — view mode

`StaffViewRows` currently reads `activity.teacher` / `activity.monitor` scalars and pushes Instructor/Mentor from text fields. Rewrite the view branch to:

1. Call `getActivityStaff(activity)` and render one line per staff row: `<role label>: <formatted name>`. Use `formatUserName(row.user)` for the name. Map `role` (`'teacher'`/`'monitor'`) to display labels `Teacher`/`Monitor`.
2. Continue to append `instructor_name` and `mentor_name` lines from the activity's text fields (those are unchanged free-text columns — not part of the junction).
3. Keep the "No staff assigned" empty state when the combined list is empty.

> Edit-mode (`StaffEditRows`) is **unchanged in this spec** — it still authors a single teacher + single monitor through the existing `usedRoles`/`availableToAdd` gating. See Out of Scope.

### `src/components/activities/ActivityDetail.jsx` — view mode

The `StaffRows mode="view"` usage already passes `activity`; once `StaffViewRows` reads the junction, ActivityDetail's view mode shows the full staff list automatically. Confirm the `activity` object reaching ActivityDetail carries `activity_staff` (it comes from `getActivities`/`getActivity`, which now embed it). No other ActivityDetail view-mode change needed.

### `src/components/activities/staffUtils.js` — the read/write seam

This is the interim seam. The flat `{ teacher_id, monitor_id, instructor_name, mentor_name }` shape is gone from `activities`, but the edit form still authors single-staff. Rework as follows:

- **`buildStaffRows(activity)`** — build initial edit rows from the *junction* now, not the dropped columns:
  - Derive Teacher/Monitor rows from `getActivityStaff(activity)` (take the first teacher and first monitor, since the form is single-staff this spec — if multiple exist from a future state, render the first and **do not silently drop the rest**; see note).
  - Keep Instructor/Mentor rows from `activity.instructor_name` / `activity.mentor_name`.
  - Preserve the "at least one empty Teacher row for new activities" behavior.

  > **Interim-state guardrail:** because the data model can hold multiple staff but this form can't yet, there's a real risk of *data loss on save* if an activity somehow has 2 teachers and the form round-trips it down to 1. Mitigation for this spec: in `buildStaffRows`, if `getActivityStaff` returns more than one row of a given role, surface a non-destructive warning in the edit UI ("This activity has multiple staff; the full editor is coming soon — saving here will not remove them") AND make the save path (`staffRowsToFlat` replacement, below) **additive/idempotent** rather than destructive. Simplest safe approach: the write path diffs against existing junction rows and only inserts/updates the single teacher + single monitor the form manages, without deleting other rows it didn't surface. If that diffing proves complex, the acceptable fallback is to **disable staff editing in the form when >1 staff of a role exists**, deferring entirely to the follow-up UI for those activities. Pick the simpler-to-implement of the two and note which in the session notes.

- **Replace `staffRowsToFlat`** with a function that converts edit rows into `activity_staff` operations plus the residual text fields. Suggested shape:
  ```js
  // Returns { staff: [{ user_id, role }], instructor_name, mentor_name }
  export function staffRowsToPayload(rows) { ... }
  ```
  - Teacher/Monitor rows with a selected `value` (a user id) become `{ user_id, role }` entries.
  - Instructor/Mentor rows become the `instructor_name` / `mentor_name` strings (trimmed, or null).

- **New: a write helper in `src/api/` for staff sync.** Add functions to `activities.js` (or a small new `activityStaff.js` — your call, but `activities.js` keeps it discoverable):
  ```js
  // Replace/sync the teacher+monitor rows the single-staff form manages,
  // WITHOUT clobbering additional rows the form didn't surface (see guardrail).
  export async function setActivityStaff(activityId, staffEntries) { ... }
  ```
  Implementation note: since the form manages at most one teacher and one monitor, the safe operation is an upsert keyed on `(activity_id, user_id)` for the entries present, plus a delete of *only* the previously-form-managed rows that were cleared. Given the guardrail above (don't touch rows beyond the single teacher/monitor the form owns), the simplest correct version: delete the existing single teacher row iff the form's teacher changed/cleared, same for monitor, then insert the new ones. Keep it conservative — when in doubt, prefer leaving a row in place over deleting it.

### `ActivityDetail.onFormSubmit` wiring

Currently `onFormSubmit` spreads `staffRowsToFlat(staffRows)` into the activity payload, so `teacher_id`/`monitor_id` ride along in the `createActivity`/`updateActivity` call. That breaks once the columns are dropped. Change:

1. Remove the staff fields from the activity payload entirely. The activity `update`/`create` payload should no longer contain `teacher_id`/`monitor_id`. (It SHOULD still contain `instructor_name`/`mentor_name` — those columns stay.)
2. After the activity is saved (and for new activities, after it has an id), call `setActivityStaff(activityId, payload.staff)` to sync the junction. For new activities this happens in the same post-create flow that already handles `_pendingTerms`. Mirror that pattern: the parent (the page/modal that owns the create mutation) sequences create → then staff sync + term inserts.

   > Find where `_pendingTerms` is consumed post-create (search for `_pendingTerms`) and add the staff sync right beside it, so new-activity staff and terms are handled in the same place with the same sequencing. Do not invent a second post-create code path.

---

## Schema docs to update

After the code lands, update `docs/schema/03-activities.md` and `docs/schema/10-rls-policies.md`:

- `03-activities.md`: remove `teacher_id`/`monitor_id` from the `activities` DDL and the personnel-fields prose; add an `activity_staff` section (DDL + the role semantics from #70: teacher = present-with-students, monitor = responsible-for-students-elsewhere); update the "Teacher view query logic" paragraph to describe the junction + visible-to-all path; remove the two dropped indexes from the index list.
- `10-rls-policies.md`: update the `is_teacher_or_monitor_of` helper description to say it queries `activity_staff` (keep the name); add the `activity_staff` table to the Policy Summary; note the conscious decision not to rename.
- `docs/schema/11-indexes.md`: add the three `idx_activity_staff_*` indexes, remove `idx_activities_teacher`/`idx_activities_monitor`.

Update `CLAUDE.md`'s migration list and the design-and-specs table (add this spec, status **Implemented** once built). Update `STATUS.md`: mark #70 done, note Phase 2 progress, and that #77/#78 are now unblocked.

---

## Out of scope / follow-up

The following are **explicitly deferred** to a separate spec/issue (the multi-staff authoring UI). The data model fully supports all of it on day one, so the follow-up carries **zero migration risk** — it is purely additive UI:

- **Multi-staff editing in `StaffRows` edit mode.** Drop the single-of-each-role gating (`usedRoles` / `availableToAdd` currently prevent two Teacher rows). Allow adding multiple Teacher and multiple Monitor rows, each a user-lookup dropdown. Instructor/Mentor remain free-text (and may stay single, or also go multiple — decide in that spec).
- **`visible_to_all_staff` toggle in ActivityForm** — already done (session 39); not part of either spec.
- **Role badges / richer staff display** beyond the simple labeled list — if desired, design in the follow-up.
- The interim guardrail (warning or disabled-edit when >1 staff of a role exists) is removed once the multi-staff editor exists.

When you pick the follow-up up, the seam is: `staffRowsToPayload` already emits a `staff: [{user_id, role}]` array, and `setActivityStaff` already syncs a list — so the follow-up is mostly (a) letting the form produce more than two entries and (b) upgrading `setActivityStaff` from conservative single-row sync to a full set-reconciliation (delete-missing, insert-new, keep-existing).

---

## Acceptance criteria (this spec)

- [ ] `activity_staff` table created with indexes, grants, RLS enabled
- [ ] Existing `teacher_id`/`monitor_id` data copied to `activity_staff`, verified by the in-transaction count gate
- [ ] `teacher_id`, `monitor_id` columns and their two indexes dropped from `activities`
- [ ] `is_teacher_or_monitor_of` body repointed to `activity_staff`, **same name**, signature unchanged, no dependent policy modified
- [ ] RLS policies on `activity_staff` (student / teacher / visible-to-all / admin) in place
- [ ] `getViewerRole` internals updated; signature + return type unchanged; all #86 agenda consumers still resolve the viewer's role
- [ ] `getActivityStaff` helper added
- [ ] All API/query functions reading staff go through the junction; live teacher agenda (`getTeacherActivitiesForDate`) and student agenda (`getStudentActivitiesForDate`) work, with names resolved via the batch DEFINER RPC
- [ ] ActivityDetail **view mode** shows the full staff list (multiple names if present) with role labels, plus instructor/mentor text
- [ ] Edit form still authors single teacher + single monitor, writing through `setActivityStaff`; no `teacher_id`/`monitor_id` in the activity payload
- [ ] Interim data-loss guardrail implemented (warning OR disabled-edit when >1 staff of a role) — note which approach was chosen
- [ ] `trg_activity_block_cascade` confirmed not to reference dropped columns
- [ ] Repo-wide grep for `teacher_id`/`monitor_id`/`.teacher`/`.monitor` comes back clean (except intended residuals: `instructor_name`, `mentor_name`)
- [ ] Schema docs, CLAUDE.md, STATUS.md updated
- [ ] `npm run lint` clean; manual smoke test: load admin activity detail (staff list renders), load teacher agenda (own activities appear, attendance marks), load a student agenda (staff names show)

---

## Suggested commit / PR shape

One migration commit, then code, then docs — but a single PR is fine given it's one logical change. Recommended internal ordering so you can verify incrementally:

1. Migration (table, grants, RLS, data copy, verify gate, function repoint, policy set, column drop).
2. `staffRoles.js` (helpers) + `staffUtils.js` + `setActivityStaff` API.
3. Query layer (`activities.js`, `agenda.js`).
4. View-mode UI (`StaffRows`, `ActivityDetail` submit wiring) + guardrail.
5. Docs.

After step 1, the app's existing reads will break (columns gone) — so don't deploy between steps; this is a single-PR migration. If you want a checkpoint where the app still runs, you can temporarily keep the columns and add the table first, but given the verify-then-drop gate is in one transaction and you're the only user, the clean cut is fine.
