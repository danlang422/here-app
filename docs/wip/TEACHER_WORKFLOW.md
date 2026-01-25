# Teacher Workflow Design

**Status:** In Design  
**Created:** 2026-01-25  
**Purpose:** Define teacher-facing UI structure, navigation, and attendance workflows

---

## Overview

Teachers need a streamlined interface to:
1. Monitor today's sections and see who's checked in/out
2. Mark attendance for their sections
3. Manage their sections and view student rosters
4. Review student reflections (plans/progress from prompts)

This document outlines the teacher workflow design decisions and implementation plan.

---

## Navigation Structure

### Teacher App Tabs

```
┌─────────┬──────────┬──────────┬─────────┐
│ Agenda  │ Sections │ Students │ Profile │
└─────────┴──────────┴──────────┴─────────┘
```

**1. Agenda (Default)**
- Shows today's sections
- Live check-in/out status
- Quick access to mark attendance
- Primary daily workflow view

**2. Sections**
- All sections (not just today's)
- Search/filter by type, day, location
- Management view for less frequent tasks
- Links to section detail pages

**3. Students**
- All students across teacher's sections
- Searchable roster
- Links to student profile pages
- Useful for "Find Sarah's check-ins from last week"

**4. Profile**
- Teacher's own profile information
- Settings and preferences

---

## Agenda Page Design

### Structure

**Section Cards** - One card per section scheduled today:

```
┌─────────────────────────────────────────────┐
│ Section Name - Time - Location             │
│ 12 students enrolled                        │
│                                             │
│ [Status indicators based on section type]   │
│                                             │
│ [Click to see details →]                    │
└─────────────────────────────────────────────┘
```

### Status Indicators by Section Type

**In-Person Sections:**
```
👋 8 students here!   [😊😊😊😁😁🤔😴😊]
```
- Shows count of students who clicked "I'm here!"
- Optional mood emoji display (Phase 2 feature)

**Remote/Internship Sections:**
```
✅ 3 checked in  |  ⏱️ 1 in progress  |  ⬜ 1 not yet
[Needs review: Tyler's check-in]
```
- Check-in/out status counts
- Flags for items needing teacher attention

### Clicking a Section Card

Navigates to **Section Detail Page** (see below).

### Date Navigation

- **Phase 1:** Agenda shows "Today" only
- **Future:** Add ability to view yesterday/tomorrow
- Historical data accessible via Sections → Section Detail

---

## Section Detail Page

URL: `/teacher/sections/[id]`  
Also accessible from: Sections tab, student profiles

### Contents

**1. Section Header**
- Section name, type, schedule
- Teacher assignment, location
- Enrollment count

**2. Student Roster**
- List of enrolled students
- Links to student profiles
- Shows check-in status for today (if applicable)

**3. Check-In/Out Timeline** (for remote/internship sections)
- Chronological feed of check-ins and check-outs
- Student prompt responses (plans/progress)
- Geolocation data (internships)
- Mentor verification status (internships)

**4. Attendance Marking Interface**
- "Mark Attendance" button
- Opens modal/inline form
- Shows roster with quick-mark options
- Default: all present (or unmarked)
- Click to mark absent/tardy/excused

**5. Teacher Actions** (Phase 2)
- React to student posts with emojis (💯 🎉 ⭐ 👏)
- Leave comments on check-ins/reflections
- Flag items for follow-up

---

## Attendance System Design

### Two Types of Attendance

**1. Simple Presence (In-Person & Some Remote)**
- Action: 👋 "I'm here!" button
- Data: Timestamp, optional mood emoji
- No checkout required
- Optional, casual, engaging
- Teacher sees: Count + mood grid

**2. Full Check-In/Out (Internships, Some Remote)**
- Action: Check-in with prompts (plans)
- Data: Location, prompt responses, mentor verification
- Later: Check-out with reflection (progress)
- Teacher sees: Full timeline with responses
- Required, structured, documented

### Attendance Marking Workflow

#### Teacher Marks Section Attendance

**When:** Throughout the day, as sections meet  
**Where:** Section Detail page → "Mark Attendance" button

**UI:**
- Modal or inline form showing roster
- Each student has quick-mark options:
  - ✅ Present (default)
  - ❌ Absent
  - ⏰ Tardy
  - 📝 Excused
- Optional notes field
- "Save" creates records in `section_attendance` table

**Data Model:**
```sql
section_attendance (
  section_id,
  student_id,
  attendance_date,
  status, -- present/absent/tardy/excused
  marked_by, -- teacher_id
  notes
)
```

#### Attendance Reporter Views Rollup

**Who:** Secretary/Dennis/whoever marks SIS  
**When:** End of day or periodic intervals  
**Where:** New "Attendance" page (admin or teacher area?)

**UI:**
- Shows reporting blocks for today
- "Block 1" → expands to show all students with sections in Block 1
- Displays attendance already marked by teachers
- **Read-only** - just for reference while marking in SIS
- Shows which sections rolled up into which block

**Data Source:**
```sql
-- Not a table, just a query:
SELECT 
  sections.reporting_block,
  student_id,
  section_attendance.status
FROM section_attendance
JOIN sections ON sections.id = section_attendance.section_id
WHERE sections.reporting_block = 1
  AND attendance_date = today
  AND sections.attendance_enabled = true
```

**Reporter Action:**
- Views rollup in Here app
- Manually transfers absences to SIS
- No editing/overriding in Here app

---

## Attendance as Optional Feature

### Design Decision

Not all sections need attendance tracking. Make it **toggleable per section**.

**Why:**
- School may prefer spreadsheet for some workflows
- Not all section types need formal attendance
- Allows gradual adoption of attendance features
- In-person classes may not need digital attendance

### Implementation

Add `attendance_enabled` boolean to sections table (defaults to false).

**Admin UI:**
- Checkbox in section create/edit form: "Enable attendance tracking"
- Explains: "Teachers can mark attendance for this section. Appears in attendance rollup."

**Teacher UI:**
- Only sections with `attendance_enabled = true` show "Mark Attendance" button
- Sections without it just show check-in/out data (if applicable)

**Reporter UI:**
- Only includes sections with `attendance_enabled = true` in rollup
- Filters out sections that don't need reporting

---

## Schema Implications

### New Table: section_attendance

```sql
CREATE TABLE section_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id),
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'tardy', 'excused')),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(section_id, student_id, attendance_date)
);

CREATE INDEX idx_section_attendance_section ON section_attendance(section_id);
CREATE INDEX idx_section_attendance_student ON section_attendance(student_id);
CREATE INDEX idx_section_attendance_date ON section_attendance(attendance_date);
```

### Modify sections table

Add `attendance_enabled` column:

```sql
ALTER TABLE sections 
ADD COLUMN attendance_enabled BOOLEAN DEFAULT false;
```

### Existing attendance_events table

This table handles check-in/out events (timestamps, geolocation, etc.)

**Relationship:**
- `attendance_events` = what students do (check in/out)
- `section_attendance` = what teachers mark (present/absent)
- They're related but separate concepts

---

## Future Features (Phase 2+)

### Presence Feature: "I'm Here!" 👋

**Concept:**
- Simple button for students to indicate presence
- Available for ALL section types, even in-person
- Optional, casual, engaging
- Captures timestamp + optional mood emoji

**Why Defer:**
- Need to add new `event_type` to attendance_events
- Need mood emoji field
- Need UI for students to select mood
- Teacher agenda needs mood grid display
- Not critical for V1 - can add later

**Schema Change:**
```sql
-- Add to attendance_events table:
ALTER TABLE attendance_events
ADD COLUMN event_type TEXT CHECK (event_type IN ('check_in', 'check_out', 'presence'));

ALTER TABLE attendance_events
ADD COLUMN mood_emoji TEXT;
```

### Emoji Reactions

**Concept:**
- Teachers react to student check-ins/reflections with emojis
- Quick acknowledgment without full comments
- Students get notifications: "Ms. Johnson gave you a 💯!"

**Schema:**
```sql
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), -- who reacted
  target_type TEXT NOT NULL, -- 'attendance_event', 'interaction'
  target_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Comments on Check-Ins

**Concept:**
- Teachers leave text comments on student posts
- Richer feedback than reactions
- Both reactions AND comments available (spectrum of engagement)

**Note:** Comments might use existing `interactions` table or need new structure.

### Social Feed / Sharing

**Concept:**
- Curated highlights from check-ins/reflections
- Teacher suggests share → student approves → appears in feed
- Community can react
- Builds culture and engagement

**Why V2+:**
- Needs privacy/permissions layer
- Needs moderation workflow
- Needs feed infrastructure
- Cool but not essential for V1

---

## Open Questions

1. **Where does attendance reporter page live?**
   - In teacher area? (Teachers could mark their own attendance)
   - In admin area? (Only designated person marks)
   - Separate role? (Create "attendance_reporter" role)

2. **Can teachers see other teachers' sections?**
   - Probably not for privacy
   - But attendance reporter needs to see all
   - Role-based access needed

3. **Student called out all day - how handled?**
   - Teachers mark absent in their sections as usual
   - No override needed in Here app
   - Reporter just sees absent across all blocks

4. **Multiple sections in one reporting block?**
   - Shouldn't happen normally (scheduling conflict)
   - If it does: both sections show in rollup
   - SIS reporter sees duplicate student, uses judgment

---

## Implementation Phases

### Phase 1: Core Teacher Agenda (This Sprint)
- [ ] Teacher directory structure (`/app/teacher/...`)
- [ ] Agenda page with section cards
- [ ] Section detail page
- [ ] Basic check-in/out display
- [ ] Attendance marking UI
- [ ] section_attendance table migration
- [ ] Reporter rollup view

### Phase 2: Enhanced Engagement (Future)
- [ ] Presence feature (👋 "I'm here!")
- [ ] Mood emoji selection
- [ ] Emoji reactions
- [ ] Comments on check-ins
- [ ] Notifications for reactions

### Phase 3: Social Features (V2+)
- [ ] Sharing workflow
- [ ] Community feed
- [ ] Feed reactions
- [ ] Privacy controls

---

## Related Documentation

- `/docs/DATABASE.md` - Schema details
- `/docs/DECISIONS.md` - Architecture decisions
- `/docs/wip/ADMIN_UI.md` - Admin interface patterns
- `/docs/ARCHITECTURE.md` - Overall system design
