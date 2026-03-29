# Naming & Structure Refactor

**Goal:** Keep the codebase easy to navigate as it grows. Directory and file names should clearly communicate *what domain they belong to* without requiring you to open them to find out. This is especially important because different Claude Code sessions implement different features — without intentional naming, similar concepts accumulate slightly different names over time and it becomes hard to tell what's what or spot duplication.

Apply the changes below and use the naming principles as a guide when creating new files going forward.

---

## Change 1: Rename `components/calendar/` → `components/school-calendar/`

**Why:** Three component directories are all calendar-adjacent: `agenda/`, `calendar/`, and `schedule-calendar/`. The name `calendar/` is too generic — it doesn't distinguish itself from `schedule-calendar/`. The contents of `calendar/` are specifically the *school day management* widget (month view, mark days off, rotation labels), which is different from the activity scheduling calendar.

**Rename:**
```
src/components/calendar/ → src/components/school-calendar/
```

**Update one import** in `src/pages/admin/OrgSettings.jsx`:
```js
// Before
import CalendarGrid from '@/components/calendar/CalendarGrid'

// After
import CalendarGrid from '@/components/school-calendar/CalendarGrid'
```

The internal import inside `CalendarGrid.jsx` (`import DayPopover from './DayPopover'`) is relative and needs no change. No other files import from `components/calendar/`.

**Verify:** Dev server starts, OrgSettings page renders and the school calendar widget functions correctly.

---

## Change 2: Rename `api/calendar.js` → `api/schoolDays.js`

**Why:** The `api/` directory currently has both `calendar.js` and `calendars.js`. These are easy to confuse:

- `calendar.js` — school day CRUD (`school_days` table) and schedule template functions
- `calendars.js` — calendar layer CRUD (`calendars` table, used by the admin week view)

Renaming `calendar.js` to `schoolDays.js` makes the distinction unambiguous and matches the table name it primarily operates on.

**Rename:**
```
src/api/calendar.js → src/api/schoolDays.js
```

**Update all imports.** Search for `from '@/api/calendar'` across `src/` — known consumers to verify:

- `src/pages/admin/OrgSettings.jsx`
- `src/components/school-calendar/CalendarGrid.jsx` (after Change 1 above)
- `src/hooks/useSchoolDays.js`
- `src/hooks/useScheduleTemplate.js`

**Verify:** Dev server starts, school day management and org settings pages work correctly.

---

## Naming principles (for future reference)

These are the patterns that have caused confusion and should be avoided going forward:

**Be specific, not generic.** `calendar.js` could mean anything. `schoolDays.js` tells you exactly what it holds. When in doubt, use the primary table or domain name.

**Match the directory name to the feature, not the UI pattern.** `agenda/` is clear because it names a specific feature. `calendar/` was unclear because "calendar" describes multiple features in this app.

**One domain per API file.** `api/agenda.js` currently handles student/teacher schedule data, check-ins, presence waves, status updates, attendance, and streak-related queries. It doesn't need to be split now, but the natural seams would be `api/attendance.js` and `api/studentActions.js` if it ever gets unwieldy. Don't add new domains to `agenda.js` — create a new file instead.

**Singular vs. plural in API files.** Going forward, use the plural of the primary table name (`schoolDays.js`, `calendars.js`, `users.js`, `terms.js`). This matches the existing plural files and makes it easier to find the right one.
