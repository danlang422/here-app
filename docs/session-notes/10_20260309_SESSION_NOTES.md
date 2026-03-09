# Session 10 — March 9, 2026

## 10.1 — Activity Detail Spec Revisions

Reviewed the activity detail and form redesign spec from session 9.3 and resolved five open questions. No code changes — spec updates only.

### Decisions Made

**1. Enrollment count column placement → after Location (end of row).** Last data column in the activity table. Simple and scannable.

**2. New activity save behavior → switch to view mode.** After creating a new activity, the modal switches to view mode of the newly created activity (rather than closing). This lets the admin immediately see the roster section and hit Enroll — natural flow from "create activity" to "add students."

**3. Close button vs. cancel button distinction.** Two visually distinct X buttons:
- **Modal close:** round `btn-circle btn-sm` on the top-right corner/edge of the modal frame. Always visible. Closes everything. In edit mode, discards unsaved changes without prompting (v1 simplicity).
- **Edit cancel:** inline X icon button next to the Save checkmark in the top bar content area. Only visible in edit mode. Discards edits, returns to view mode. Does NOT close the modal.

**4. Staff rows — role dropdown with context-dependent value field.** Every staff row has the same structure: a role dropdown (Teacher | Monitor | Instructor | Mentor) and a value field. The value field type depends on the selected role:
- Teacher or Monitor → staff user lookup dropdown (from `useStaffUsers`)
- Instructor or Mentor → freeform text input (for external people)
- Switching roles clears the value (prevents stale data crossing input types)

This resolved an earlier attempt to make Teacher a fixed first row with a non-switchable role. That approach didn't simplify anything because Monitor also needs a staff lookup, so the input-type switching was needed regardless. The conditional render is straightforward (`role === 'teacher' || role === 'monitor' ? <Dropdown /> : <TextInput />`).

**5. `is_not_scheduled` moved into the properties tray.** Was previously an inline checkbox at the start of the scheduling row. Reconsidered as a behavior flag — it's a property/setting of the activity, not a scheduling flow control. Now the 7th icon in the properties tray (Calendar-X or clock-off icon). When toggled on, disables all scheduling fields (block, time, duration, days, rotation) in the detail fields below. Analogous to how `is_release` affects `requires_attendance`.

### Artifacts Updated

- **`docs/user-flows/activity-detail-and-form-redesign-spec.md`** — All five decisions applied throughout the spec. Date updated to "March 8, 2026 (revised March 9)."
- **`STATUS.md`** — Updated to session 10.1. Active Decisions section expanded to reflect resolved spec details (7 behavior flags, close/cancel distinction, staff row design, new-activity-save behavior).
