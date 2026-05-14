# Role Derivation Helper — Build Spec

**Date:** May 14, 2026
**Status:** Ready to build
**Related:** #86 (teacher agenda layout rewrite — primary consumer), #70 (`activity_staff` junction table — future swap target), `teacher-agenda-design-direction.md`

---

## Purpose

Establish a single utility that answers the question: **"What is this viewer's role on this activity?"**

The teacher agenda redesign (#86) needs to make many decisions based on the current user's relationship to each activity — aggregation key, card color theme, column ordering, sidebar section placement. Today, that relationship is determined by comparing the viewer's `id` against `activities.teacher_id` and `activities.monitor_id`. When #70 lands and replaces those columns with the `activity_staff` junction table, the underlying check changes form but the *answer* the rest of the app needs is identical.

By introducing this helper now, #86 can consume a stable interface from day one. When #70 ships, the internals of this helper change in one place, and nothing downstream has to be touched.

---

## Scope

**In scope:**
- A new module `src/lib/staffRoles.js`
- A pure function `getViewerRole(activity, viewerId)` returning `'teacher' | 'monitor' | null`
- JSDoc comments documenting the post-#70 migration plan
- Unit-style usage examples in the module's header comment

**Out of scope:**
- Prep detection. Prep is a presentation-layer concern computed from enrollment count, not a property of the staff relationship. The teacher Dashboard layers prep detection on top of this helper's output where the enrollment count is already in scope. See `teacher-agenda-design-direction.md` and the #86 spec for the prep-detection pattern.
- Any consumer-side refactoring. This spec only adds the helper. Replacing existing `teacher_id === viewerId` comparisons throughout the codebase is out of scope; consumers can adopt the helper opportunistically (and #86 will adopt it as a baseline).
- Any RLS or backend changes. The helper is purely client-side derivation over data already returned by existing queries.

---

## API

```js
/**
 * Derive the viewer's role on a given activity.
 *
 * Today, role is determined by comparing the viewer's id against
 * `activities.teacher_id` and `activities.monitor_id`. When #70 lands
 * and replaces those columns with the `activity_staff` junction table,
 * the body of this function changes to look up the viewer's row in
 * `activity.activity_staff` and return its `role` field. The function
 * signature and return type stay the same.
 *
 * @param {object} activity - An activity record. Must include `teacher_id`
 *   and `monitor_id` fields (pre-#70). Post-#70, must include
 *   `activity_staff` array.
 * @param {string} viewerId - The current user's profile id.
 * @returns {'teacher' | 'monitor' | null}
 *   - `'teacher'` if the viewer is listed as the activity's teacher
 *   - `'monitor'` if the viewer is listed as the activity's monitor
 *   - `null` if the viewer has no staff role on this activity
 *     (e.g. viewing a visible-to-all activity they're not assigned to)
 *
 * @example
 *   const role = getViewerRole(activity, profile.id)
 *   if (role === 'teacher') { ... }
 */
export function getViewerRole(activity, viewerId)
```

---

## Implementation (current — pre-#70)

```js
export function getViewerRole(activity, viewerId) {
  if (!activity || !viewerId) return null
  if (activity.teacher_id === viewerId) return 'teacher'
  if (activity.monitor_id === viewerId) return 'monitor'
  return null
}
```

That's the whole function. The complexity is in what comes later.

---

## Implementation (post-#70 — for reference)

When #70 lands, the function body changes to read from the junction table. The expected shape:

```js
export function getViewerRole(activity, viewerId) {
  if (!activity || !viewerId) return null
  const staffRow = activity.activity_staff?.find(
    (row) => row.user_id === viewerId
  )
  return staffRow?.role ?? null
}
```

This requires that callers fetch activities with `activity_staff` joined in. The query change is part of #70's scope, not this helper's.

**Do not implement this version now.** This is documentation of the future state. The current implementation is the only thing to ship.

---

## Module header

The file should open with a comment block summarizing the function's purpose, the pre-#70 / post-#70 distinction, and a pointer to this spec and to #70. This is the kind of seam that benefits from a clear "if you're here because of #70, this is the file to edit" signpost.

Suggested header:

```js
/**
 * Staff role derivation utilities.
 *
 * Single source of truth for answering: "what is this viewer's role on
 * this activity?" Consumers should never compare viewer ids against
 * `teacher_id` / `monitor_id` directly — always go through these helpers.
 *
 * Pre-#70 (current): role is derived from `activities.teacher_id` and
 * `activities.monitor_id` columns.
 *
 * Post-#70: role is derived from the `activity_staff` junction table.
 * When that migration lands, update this file's internals only. The
 * exported function signatures stay the same.
 *
 * See: docs/user-flows/role-derivation-helper-build-spec.md
 * See: GitHub #70 (activity_staff junction table)
 */
```

---

## Tests

No automated tests are required for this initial implementation — the function is three lines, has no side effects, and is covered transitively by any consumer that uses it correctly. When #70 lands and the body grows in complexity, a small Vitest suite covering the four cases (teacher match, monitor match, no match, null inputs) becomes worth writing.

---

## Acceptance criteria

- [ ] `src/lib/staffRoles.js` exists
- [ ] Exports `getViewerRole(activity, viewerId)` returning `'teacher' | 'monitor' | null`
- [ ] Implementation matches the pre-#70 version above (three-line body)
- [ ] Module header documents the pre-#70 / post-#70 split and references #70
- [ ] JSDoc on the function describes the contract, parameter shape requirements (now and future), and return type

---

## What this is *not*

It's worth being explicit: this helper is a **seam**, not an abstraction. It does not hide a complex computation, it does not coordinate state, it does not abstract over a runtime decision. It exists for one reason: when #70 lands, we want exactly one file to change. Treat it as a marker, not as machinery.
