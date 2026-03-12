# Student & Teacher Agenda Views — Build Spec

**Date:** March 11, 2026
**Status:** First draft — ready to review before build

**Context:** The admin agenda view is built and working. This spec builds the equivalent views for the student (`TodayView`) and teacher (`Dashboard`) roles. Both are today-focused agenda views of the user's own schedule. They share layout DNA with the admin agenda but differ in purpose: students see their own schedule and have actions to take; teachers see their activities and rosters to manage.

**Design principle:** Build the views first, interactions second. This spec covers read display and the roster modal. Check-in flows, status updates, and posts are separate features to be layered on afterward.

---

## Shared Concepts

### Layout

Both views use the same time-based grid layout as the admin agenda:

- Vertical time axis (7 AM – 4 PM default, expanding to fit actual activity times)
- Cards positioned by `default_start_time` / `default_end_time`
- Block overlay strips (from `AgendaBlockOverlay`) as visual reference bands
- `AgendaGrid`, `AgendaDayColumn`, and `agendaUtils` are reused directly — no forking

Both views are **today-first** with `<` `>` date navigation. Date state is local to each page (not Zustand — it's view-local and shouldn't persist across sessions).

### Instance Upsert

Both views trigger lazy instance creation on render. When a view loads activities for a given date, it upserts `activity_instances` rows for any activity scheduled on that date (INSERT ... ON CONFLICT DO NOTHING). This is the standard lazy creation pattern — it ensures instances exist before any interaction can occur. A shared utility function `ensureActivityInstances(activityIds, date)` handles this, calling the Supabase API in a single batch upsert.

### Block Overlay

The existing `AgendaBlockOverlay` component is reused as-is. It renders horizontal reference bands for each block's defined time range. No changes needed.

---

## Student Agenda (`TodayView`)

**Route:** `/student` (existing)
**File:** `src/pages/student/TodayView.jsx` (replace placeholder)

### Data

New hook: `useStudentAgenda(studentId, date)`

Fetches all activities the student is enrolled in that meet on the given date, using the `activityMeetsToday` logic from business logic docs. Joins:

- `enrollments` → `activities`
- `activities.teacher_id` → `user_profiles` (for teacher name)
- `org settings` (for block definitions, block count)

Returns activities filtered to those scheduled on the given date (respecting `days_of_week`, `rotation_day_type`, `is_not_scheduled`, term dates, etc.).

Also fetches the school day record for the given date (to determine rotation day type for `rotation_day_type` matching).

### Layout

```
┌──────────────────────────────────────────────┐
│  ← Today, March 11 →                         │  ← date nav header
├──────────────────────────────────────────────┤
│                                              │
│  [Block overlay strips]                      │
│                                              │
│  [Activity cards, time-positioned]           │
│                                              │
└──────────────────────────────────────────────┘
```

Date header format: arrow buttons flanking the date label. "Today" label when viewing current date; full date otherwise (e.g. "Mon, Mar 11").

### Student Activity Card

Cards are positioned and sized by time, same as admin. No density/aggregate logic needed — a student will never have two activities in the same block (enrollment validation prevents it). Each card is always a single-card display.

**Card content:**

```
┌─────────────────────────────────────────────┐
│ Activity Name                    [action btn]│
│ Instructor Name (or Teacher)                │
│ 7:30a – 9:00a  ·  Block 0  ·  Room 204     │
│ 🌐  ◻  ✓                                   │  ← property icons
└─────────────────────────────────────────────┘
```

**Staff display rule:** Show `instructor_name` if set; otherwise show `teacher_id`'s last name; otherwise omit. This gives students the name of whoever is actually running the class — the external professor, the cooperating teacher, or the City View teacher.

**Property icons (informational, no click action):**
- Location: shown inline in the time/block row as text if `location` is set
- Geolocation icon (e.g. `FaLocationDot`): shown in property row if `requires_geofence = true`
- Freeform icon (e.g. `FaListCheck` or similar): shown if `allows_freeform = true`
- Attendance icon (e.g. `FaClipboardList`): shown if `requires_attendance = true`

Property icons are small, muted (60% opacity), and grouped together in a row below the time/block line. They are visual indicators only — no tooltips required for MVP.

**Action button:** A single button in the top-right of the card, icon-only, rendered conditionally:
- If `requires_checkin = true`: check-in/out button (implementation deferred to check-in spec)
- Else if `allows_presence_wave = true`: presence wave button (implementation deferred)
- Otherwise: no action button

For this spec, render the button as a visible placeholder (correct icon, disabled or non-functional) so the card layout is accurate and the check-in spec can build on top of it without changing the card structure.

**Status updates button:** A message/comment icon (e.g. `FaComment`) always shown if the activity has an instance for today. Tapping opens a status update panel (deferred — render as placeholder for now).

**No card click interaction.** Cards are not clickable beyond their buttons.

---

## Teacher Agenda (`Dashboard`)

**Route:** `/teacher` (existing)
**File:** `src/pages/teacher/Dashboard.jsx` (replace placeholder)

### Data

New hook: `useTeacherAgenda(teacherId, date)`

Fetches all activities where `teacher_id = teacherId OR monitor_id = teacherId` that meet on the given date. Same date-matching logic as student hook. Joins enrollment counts per activity.

### Layout

Same grid structure as student view. Same date navigation header.

### Teacher Activity Cards

Teacher cards follow the same time-based positioning. Unlike the student view, a teacher can have multiple activities in the same block (monitoring groups), so **density logic applies** — reusing the same thresholds as the admin agenda (`DENSITY_FEW_MAX = 3`, `DENSITY_AGG_MIN = 4`).

#### Single card (1 activity in block)

```
┌─────────────────────────────────────────────┐
│ Activity Name                               │
│ 7:30a – 9:00a  ·  Block 0                  │
│ 📍 Room 204                                 │
│ 18 students                                 │
└─────────────────────────────────────────────┘
```

#### Few cards (2–3 activities in same block)

Side-by-side, same as admin. Each card shows: name, enrollment count. Times omitted at this density (grid position communicates time).

#### Aggregate card (4+ activities in same block)

```
┌─────────────────────────────────────────────┐
│  ⊞  Block 4                                 │  ← stack icon + block label as title
│  8 activities  ·  24 students               │
│  12:15p – 1:15p                             │  ← earliest start – latest end
└─────────────────────────────────────────────┘
```

- Title: stack/grid icon (e.g. `FaLayerGroup`) + block label (e.g. "Block 4"). No freeform name.
- Time display: `earliestStart – latestEnd` across all activities in the group. This is already how the card is *positioned* by `AgendaDayColumn` — the label just makes it explicit.
- Activity count + student count (total across all activities).
- Card style: `bg-base-200` to visually distinguish from single cards.

**Aggregate card click** opens the roster modal for that block group (see below).

#### Single/few card click

Any card with `requires_attendance = true` opens the roster modal on click. Cards without attendance (e.g. a release period) are non-clickable.

### Roster Modal

A standard DaisyUI modal (not a floating panel — teachers don't need to drag it around). Opens on activity card click.

**Header:** Activity name for single cards. Block label + stack icon for aggregate cards (matching the card title).

**Roster rows:**

```
┌────────────────────────────────────────────────────────────┐
│ Alex Johnson    Biology (Rm 204)    [Present][Absent][Excused][Tardy] │
│ Maya Patel      Chemistry           [Present][Absent][Excused][Tardy] │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘
```

- **Student name** — full name, normal weight
- **Activity label** — shown for aggregate rosters only (students in different activities). Lighter weight / italicized. Format: `activity name · location` if location is set, else just `activity name`.
- **Attendance buttons** — four states matching `attendance_status` enum: Present, Absent, Excused, Tardy. Small button group, active state highlighted.

For single-activity rosters, the activity label column is omitted.

**Roster data:** Fetch all active enrollments for the activity (or activities in the block group), joined with student profiles. Order by last name.

**Attendance state:** Load existing `attendance_records` for the activity instance + date on modal open. Clicking a button upserts the record (INSERT ... ON CONFLICT DO UPDATE). Optimistic update on the button — no explicit save step.

**Footer:** Close button. No bulk actions for MVP.

---

## New Hooks

### `useStudentAgenda(studentId, date)`
`src/hooks/useStudentAgenda.js`
- Fetches enrollments + activities for student filtered to given date
- Includes teacher profile join for staff display
- Returns `{ activities, isLoading, error }`

### `useTeacherAgenda(teacherId, date)`
`src/hooks/useTeacherAgenda.js`
- Fetches activities where `teacher_id = teacherId OR monitor_id = teacherId`, meeting on `date`
- Includes enrollment counts per activity
- Returns `{ activities, enrollmentCounts, isLoading, error }`

### `useRoster(activityIds, date)`
`src/hooks/useRoster.js` (or inline in modal component)
- Fetches active enrollments + student profiles for given activity IDs
- Fetches existing attendance records for those activity instances on that date
- Returns `{ students, attendanceByStudent, isLoading }`

---

## New API Functions

`src/api/agenda.js` (new file)

- `getStudentActivitiesForDate(studentId, date, orgId)` — enrollment join query
- `getTeacherActivitiesForDate(teacherId, date, orgId)` — teacher/monitor query
- `ensureActivityInstances(activityIds, date, orgId)` — batch upsert instances
- `getRosterForActivities(activityIds)` — enrollment + student profile join
- `getAttendanceForInstances(instanceIds)` — attendance records for given instances
- `upsertAttendanceRecord(instanceId, studentId, status, markedById)` — single upsert

---

## Files Created / Modified

| File | Action |
|------|--------|
| `src/pages/student/TodayView.jsx` | Replace placeholder |
| `src/pages/teacher/Dashboard.jsx` | Replace placeholder |
| `src/hooks/useStudentAgenda.js` | New |
| `src/hooks/useTeacherAgenda.js` | New |
| `src/hooks/useRoster.js` | New |
| `src/api/agenda.js` | New |
| `src/components/agenda/StudentActivityCard.jsx` | New |
| `src/components/agenda/TeacherActivityCard.jsx` | New |
| `src/components/roster/RosterModal.jsx` | New |

**Note on AgendaCard:** The existing `AgendaCard` is admin-specific in its content. Rather than adding role-specific props, create `StudentActivityCard` and `TeacherActivityCard` as separate components. They share grid positioning logic (via `agendaUtils`) but have independent content layouts.

---

## Out of Scope (deferred)

- Check-in / check-out flow (button is a placeholder in this build)
- Presence wave interaction
- Status updates panel
- Posts and post responses
- Geolocation validation
- Freeform block tagging
- Real-time attendance updates (Supabase Realtime)
- Streak tracking display
- Mobile-optimized layout

---

## Open Questions

1. **Date navigation + school day awareness.** Should the date nav skip non-school days, or allow navigating to any calendar date (showing an empty agenda on weekends/holidays)? For MVP, allow any date and show an empty state — simpler than requiring school day lookups for navigation.

2. **Teacher card click on "few" density.** Clicking one of two side-by-side cards opens the roster for that specific activity only — not the combined block roster. Confirm this is the right behavior.

3. **Attendance button layout at small sizes.** Four buttons (Present / Absent / Excused / Tardy) may be tight on narrow screens. Options: abbreviate to P/A/E/T, use icons, or use a dropdown. Defer to build — see how it looks.

4. **`activityMeetsToday` implementation.** Confirm `docs/business-logic/01-schedule-and-calendar.md` is current before implementing the hooks — this is the most complex part of the data layer.
