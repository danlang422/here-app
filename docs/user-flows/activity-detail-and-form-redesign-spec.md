# Activity Detail Modal & Form Redesign — Build Spec

**Date:** March 8, 2026 (revised March 9)  
**Context:** Activity Management page redesign. Three connected changes: (1) activity detail modal with view/edit toggle and enrollment roster, (2) unified activity layout that serves as both view and form, (3) activity table simplification (clickable rows, enrollment count, no action buttons).

**Design principle:** Design the *view* first. The edit state is the same layout with fields made editable. No layout shift between modes.

---

## 1. Activity Table Changes

### Current state
- Table rows show: Name, Staff, Block, Days/Rotation, Time, Location, [Enroll] [Edit] buttons
- Rows are not clickable; actions are via the two text buttons

### New behavior
- **Remove the action button column entirely.** No Enroll/Edit buttons on the row.
- **Add an enrollment count column after Location** (last data column). Display as a simple number, or "—" if zero. Data source: `getOrgEnrollments` aggregated into a `Map<activity_id, count>` (same pattern already used in `Dashboard.jsx`).
- **Entire row is clickable.** Click opens the Activity Detail Modal for that activity. Add `cursor-pointer` and a hover state to signal interactivity. Optional: subtle right chevron at the row edge.
- Component: `ActivityTable.jsx`. Props change: remove `onEdit` and `onEnroll`, add `onSelect(activity)`. Add `enrollmentCounts` prop (Map or object).

---

## 2. Activity Detail View — Unified Layout

The core idea: one component (`ActivityDetail`) renders an activity's information. It accepts a `mode` prop (`'view'` | `'edit'`). In view mode, fields render as formatted text. In edit mode, the same fields render as inputs — in the same positions, same layout, same visual weight. The transition between modes is seamless: labels stay put, values become editable, and nothing moves.

This component is container-agnostic. It can live inside a DaisyUI modal today and a FloatingPanel on the dashboard later.

### Layout (top to bottom)

#### Top bar
- **Activity name** — left-aligned, large/bold text.
  - View mode: plain text.
  - Edit mode: text input (same size/weight, looks like the text just became editable).
- **Action buttons** — right-aligned, icon buttons. These are *actions on* the activity.
  - **Edit/Save toggle:**
    - View mode: pencil icon → switches to edit mode.
    - Edit mode: replaced by Save (checkmark) and Cancel (X) icon buttons. The Cancel X discards edits and returns to view mode — it does NOT close the modal.
  - **Enroll:** person-plus icon → opens the Enrollment FloatingPanel. Always visible in both modes.
- **Modal close button** — a round `btn-circle btn-sm` X positioned on the top-right corner/edge of the modal frame. Always visible. This closes the entire modal. Visually and positionally distinct from the inline Cancel X in the top bar content area.

#### Properties tray
A visually distinct strip below the top bar — subtle background color (`bg-base-200` or a bordered inset region) that reads as "these are properties OF this activity." Contains the behavior flag icons.

- **Behavior flag icons** — 7 icons in a horizontal row within the tray.
  - View mode: static. Active flags are filled/colored, inactive are muted/outline.
  - Edit mode: icons become clickable toggles. Same visual treatment, but with hover/click states.
  - The tray's visual container separates these from the action buttons above (actions ON the activity) and the detail fields below (scheduling/configuration data).

Flags:

| Flag | Suggested Icon | Tooltip |
|------|---------------|---------|
| `requires_attendance` | Clipboard/checklist | "Requires attendance" |
| `requires_checkin` | Clock or badge-tap | "Requires check-in" |
| `allows_presence_wave` | Hand wave | "Allows presence wave" |
| `allows_freeform` | Tag/shuffle | "Allows freeform tagging" |
| `requires_geofence` | Map pin / location | "Requires geofence" |
| `is_release` | Open door / exit arrow | "Release (no attendance)" |
| `is_not_scheduled` | Calendar-X or clock-off | "Not scheduled" |

Special interactions:
- `is_release` ON → auto-clears `requires_attendance`. `requires_attendance` ON → auto-clears `is_release`. Mutually exclusive.
- `is_not_scheduled` ON → disables all scheduling fields (block, time, duration, days, rotation) in the detail fields below. Analogous to how `is_release` affects `requires_attendance` — a flag that controls other parts of the form.

#### Detail fields
Below the properties tray. These are the activity's configuration. Laid out as a compact grid — same positions in view and edit mode.

**Staff row(s):**
- View mode: "Teacher: Trevor Templeman" (or "Monitor: Jane Smith", etc.). Multiple staff shown as stacked lines. If no staff: "No staff assigned" in muted text.
- Edit mode: Each staff entry is a row with a **role dropdown** (Teacher | Monitor | Instructor | Mentor) and a **value field**. The value field type depends on the selected role:
  - **Teacher or Monitor** → staff user lookup dropdown (from `useStaffUsers` data).
  - **Instructor or Mentor** → freeform text input (for external people not in the system).
  - Switching the role dropdown clears the current value (prevents stale data crossing input types).
- "+ Staff" link adds a row. Each role can appear only once (used roles disabled in subsequent dropdowns).
- Default for new activity: one row with role = Teacher, value = empty.

**Scheduling — Block / Time / Duration (one row):**
- View mode: "Block 2 · 9:00a–10:30a · 90 min" as formatted text. Missing values omitted naturally. If `is_not_scheduled` is on, this row shows "Not scheduled" in muted text.
- Edit mode: Block dropdown, Start Time input, End Time input, Duration input — all on one row. Disabled when `is_not_scheduled` is toggled on in the properties tray.

**Scheduling — Days + Rotation (one row):**
- View mode: Day pills (M Tu W Th F) as small badges, or rotation badge ("A Day"), or "Not scheduled" if `is_not_scheduled` is on.
- Edit mode: Day-of-week toggle buttons on the left, Rotation day dropdown on the right. Disabled when `is_not_scheduled` is toggled on in the properties tray.
- **Mutual exclusion:** Selecting any day button disables and clears the rotation dropdown. Selecting a rotation day disables and clears all day buttons. Clearing the active selection re-enables the other. The disabled state is the visual indicator.

**Dates + Location (one row):**
- View mode: "Mar 2 – Jun 5, 2026 · Trevor's Hub" as formatted text.
- Edit mode: Start Date input, End Date input, Location text input — three-column grid.

**Description (conditional):**
- View mode: If the activity has a description, show it as a quiet text block below the other fields. If no description, this area is simply absent.
- Edit mode: If description exists, show it as an editable textarea (compact, 1-2 rows). If no description, show a "+ Description" link that expands a textarea on click.

#### Roster section
Always visible below the detail fields, unchanged between view and edit mode. Editing the activity's properties doesn't affect the roster display.

- **Header:** "Enrolled Students" with count badge, e.g., "Enrolled Students (12)"
- **List:** Fetched via `getActivityEnrollments(activityId)`. Students sorted by last name. Each row: student name (last, first — or preferred name if set), grade level.
- **Empty state:** "No students enrolled" with a subtle prompt — person-plus icon or "Enroll students" link that triggers the enrollment panel.
- **Read-only for now.** Unenrolling happens via the enrollment panel.

---

## 3. Modal Container

The `ActivityDetail` component is wrapped in a DaisyUI modal for the Activity Management page.

- Trigger: clicking a row in `ActivityTable` sets `selectedActivity` in `ActivityManagement.jsx`, which opens the modal.
- Modal size: `modal-lg` or wider — enough for the compact grid layout without cramping.
- **Close button:** Round `btn-circle btn-sm` X on the top-right corner/edge of the modal frame. Click outside, Escape, or this button all close the modal. If in edit mode, closing discards unsaved changes without prompting (v1 simplicity).
- The modal simply wraps `<ActivityDetail activity={selectedActivity} mode={mode} ... />`.

### Data flow
- `ActivityManagement.jsx` manages `selectedActivity` and `isEditing` state.
- Row click → `setSelectedActivity(activity)`, `setIsEditing(false)`.
- Edit icon → `setIsEditing(true)`.
- Cancel → `setIsEditing(false)` (discard changes).
- Save → `useUpdateActivity` mutation → on success, update the activity in the TanStack Query cache, `setIsEditing(false)`.
- Enroll icon → sets `enrollingActivity` state, which mounts the existing `<FloatingPanel><EnrollmentPanel /></FloatingPanel>`.
- Roster data: `useActivityEnrollments(selectedActivity?.id)` — new hook wrapping `getActivityEnrollments` with TanStack Query, or inline `useQuery` call.

---

## 4. New Activity Creation

The "+ New Activity" button on the Activity Management page opens the same modal, but with:
- `activity` = null (empty defaults)
- `mode` = `'edit'` (starts in edit mode since there's nothing to view yet)
- Roster section hidden (no activity ID to query enrollments for)
- Save → `useCreateActivity` mutation → on success, switch to view mode of the newly created activity (set `selectedActivity` to the returned activity, `isEditing` to false). This allows the admin to immediately see the roster section and hit Enroll.

### Default values (new activity)
- `requires_attendance: true` — most common case
- All other behavior flags: `false`
- Staff: one empty Teacher row
- Everything else: empty/null
- `type`: silently set to `'regular_class'` on save (DB constraint workaround until migration)

---

## 5. Type Removal

- **Form:** No type selector. No type-based field visibility. No type-based defaults (behavior flag defaults are now universal — see Section 4 above).
- **On save:** Silently set `type` to `'regular_class'` so the DB CHECK constraint doesn't break.
- **Existing data:** Untouched. Activities that already have a type keep it. Nothing reads it in the UI anymore.
- **Constants:** `ACTIVITY_TYPE_DEFAULTS` and `TYPE_FIELD_VISIBILITY` in `constants.js` can be removed or left as dead code. `ACTIVITY_TYPES` and `ACTIVITY_TYPE_LABELS` may still be used by the table filter — if so, we should remove that filter too (or replace it with behavior flag filters, which is a future enhancement).
- **Future:** Migration to drop the `type` column and CHECK constraint from the schema. Not part of this build.

---

## 6. Block Cascade (Separate Task)

When an activity's `block` field is updated via `useUpdateActivity`, cascade the change to all active enrollments for that activity. After the activity update succeeds, update `block` on all enrollments where `activity_id = X` and `is_active = true`.

Small, independent task. Can be done before or after the UI changes.

---

## 7. Component Structure

### New components

**`ActivityDetail.jsx`** — the unified view/edit component.
- Props: `activity` (object or null for new), `mode` ('view' | 'edit'), `onSave`, `onCancel`, `onEditClick`, `onEnrollClick`, `enrollments`, `orgSettings`
- Uses React Hook Form internally (initialized from `activity` prop, reset on activity change).
- Renders the full layout described in Section 2.
- `BehaviorFlagToggles` is either a sub-component or inline — a row of icon buttons that read from form state (edit mode) or activity props (view mode).

**`StaffRows.jsx`** — the flexible staff row sub-component.
- Manages an array of `{ role, value }` entries.
- In view mode: renders formatted text per entry ("Role: Name").
- In edit mode: renders role dropdown + value field per entry, with "+ Staff" to add rows. Value field is a staff user lookup dropdown when role is Teacher or Monitor, and a text input when role is Instructor or Mentor. Switching roles clears the current value.
- Enforces one-per-role constraint (disables used roles in subsequent dropdowns).

**`ActivityDetailModal.jsx`** — thin modal wrapper.
- Mounts the DaisyUI modal and renders `<ActivityDetail />` inside it.
- Manages open/close state. Could be a controlled component (open when `selectedActivity` is truthy).

### Modified components

| File | Changes |
|------|---------|
| `ActivityTable.jsx` | Remove action buttons, add `onSelect` prop, add enrollment count column, make rows clickable |
| `ActivityManagement.jsx` | Add `selectedActivity` / `isEditing` state, mount `ActivityDetailModal`, fetch enrollment counts via `useOrgEnrollments`, replace current inline edit card and form with modal flow, replace current FloatingPanel enrollment trigger |
| `constants.js` | Remove or deprecate `ACTIVITY_TYPES`, `ACTIVITY_TYPE_LABELS`, `ACTIVITY_TYPE_DEFAULTS`, and `TYPE_FIELD_VISIBILITY` |

### Removed / replaced

| File | Disposition |
|------|-------------|
| `ActivityForm.jsx` | Replaced by `ActivityDetail.jsx` (the edit mode of the unified component). Can be deleted once the new component is built and verified. |

### New or updated hooks

| Hook | Notes |
|------|-------|
| `useActivityEnrollments(activityId)` | New hook (or addition to `useEnrollments.js`) wrapping `getActivityEnrollments` with `useQuery`. Enabled only when `activityId` is truthy. |

---

## 8. What This Spec Does NOT Cover

- Activity Panel (floating panel on dashboard) — separate spec. The `ActivityDetail` component is designed to be droppable into a FloatingPanel when that spec is built.
- Enrollment Panel Entry B (student-centric) — separate spec
- Org settings / block configuration UI — separate spec
- Bulk activity entry — separate spec
- Quick-create compact form — may be a minimal version of `ActivityDetail` in edit mode with fewer visible fields, separate design task
- Removal of `type` from the database schema — future migration
- Behavior flag filters on the activity table — future enhancement replacing the current type filter
