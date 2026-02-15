# Here App - Database Schema Documentation
**Date**: February 2026  
**Database**: PostgreSQL (via Supabase)  
**Status**: Design complete, ready for implementation

## Overview

This schema supports City View Community High School's attendance tracking system with:
- Complex scheduling (A/B rotations, off-campus courses, internships)
- Multi-role users (students, teachers, admins, mentors)
- Flexible daily schedules (delays, early dismissal, alternate block structures)
- Remote work check-in/out with geolocation
- Teacher-student interactions and status updates
- Multi-tenancy foundation (single org for MVP, expandable later)

## Design Principles

1. **Separation of concerns**: Sessions (supervision) vs StudentActivities (actual work)
2. **Accept messy reality**: Allow overlapping schedules, handle conflicts in application layer
3. **Soft deletes**: Use `is_active` flags to preserve history
4. **Flexible configuration**: Use JSONB for settings that may evolve
5. **Audit trails**: Timestamp everything, link related records

---

## Core Tables

### user_profiles
Extends Supabase's `auth.users` with application-specific profile data.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}', 
  -- Possible values: 'student', 'teacher', 'admin', 'mentor'
  -- Users can have multiple roles (e.g., ['teacher', 'admin'])
  grade_level TEXT, -- for students only
  advisor_id UUID REFERENCES user_profiles(id), -- for students only
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_roles ON user_profiles USING GIN(roles);
CREATE INDEX idx_user_profiles_advisor ON user_profiles(advisor_id);
```

**Notes:**
- Multi-role support within single organization
- Role switching handled in application UI
- `advisor_id` creates mentor/advisee relationships

### organizations
Multi-tenancy foundation. City View only for MVP.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{
    "timezone": "America/Chicago",
    "uses_rotation_schedule": false,
    "rotation_day_names": ["A", "B"],
    "rotation_mode": "continue"
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);
```

**Settings schema:**
```json
{
  "timezone": "America/Chicago",
  "uses_rotation_schedule": true|false,
  "rotation_day_names": ["A", "B"], // customizable (e.g., ["Red", "Gold"])
  "rotation_mode": "continue"|"repeat"
  // "continue" = skip cancelled day in rotation
  // "repeat" = cancelled A day means next school day is also A
}
```

---

## Academic Calendar System

### academic_terms
Semesters or terms within a school year.

```sql
CREATE TABLE academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Fall 2025", "Spring 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_terms_org ON academic_terms(organization_id);
CREATE INDEX idx_academic_terms_current ON academic_terms(organization_id, is_current) 
  WHERE is_current = true;
```

**Usage:**
- Sessions and StudentActivities can reference term for default date ranges
- Only one term should have `is_current = true` at a time

### schedule_templates
Reusable block schedule definitions (regular, delay, early dismissal, etc.).

```sql
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Regular", "2hr Delay", "MWF Schedule", "TuTh Schedule"
  is_default BOOLEAN DEFAULT false,
  block_definitions JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_templates_org ON schedule_templates(organization_id);
CREATE INDEX idx_schedule_templates_default ON schedule_templates(organization_id, is_default)
  WHERE is_default = true;
```

**block_definitions schema:**
```json
[
  {"block": 0, "start_time": "07:30", "end_time": "09:00"},
  {"block": 1, "start_time": "09:05", "end_time": "09:50"},
  {"block": 2, "start_time": "09:55", "end_time": "10:40"},
  {"block": 3, "start_time": "10:45", "end_time": "11:30"},
  {"block": 4, "start_time": "12:15", "end_time": "13:15"},
  {"block": 5, "start_time": "13:20", "end_time": "14:20"}
]
```

**Usage:**
- One template marked `is_default = true` (the regular schedule)
- Additional templates for variations (delays, alternate day structures)
- SchoolDay references template to use for that specific day

### school_days
Daily calendar with schedule, rotation status, and exceptions.

```sql
CREATE TABLE school_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_school_day BOOLEAN DEFAULT true,
  schedule_template_id UUID REFERENCES schedule_templates(id),
  rotation_day TEXT, -- "A", "B", or null (based on org's rotation_day_names)
  override_reason TEXT, -- null, "weather", "planned_holiday", "emergency"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_org_date UNIQUE (organization_id, date)
);

CREATE INDEX idx_school_days_org_date ON school_days(organization_id, date);
CREATE INDEX idx_school_days_is_school_day ON school_days(organization_id, is_school_day);
```

**Workflow:**
1. When term is created, auto-generate SchoolDay records for all M-F dates
2. Apply default schedule_template to all days
3. Admin marks exceptions (holidays, rotation patterns, special schedules)
4. Day-of overrides possible (weather cancellations, emergency schedule changes)

**Rotation calculation:**
- System calculates rotation_day for school days based on organization settings
- Cancelled days affect rotation based on `rotation_mode` setting

---

## Activity & Schedule Structure

### activity_types
Catalog of reusable activities (courses, study sessions, internships).

```sql
CREATE TABLE activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Biology 2", "Independent Study", "Internship"
  category TEXT, -- 'class', 'internship', 'independent_study', 'monitoring'
  default_requires_checkin BOOLEAN DEFAULT false,
  default_allows_remote BOOLEAN DEFAULT false,
  default_requires_geofence BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_types_org ON activity_types(organization_id);
CREATE INDEX idx_activity_types_category ON activity_types(organization_id, category);
```

**Purpose:**
- Provides naming consistency
- Enables bulk operations ("assign 5 students to Independent Study")
- Supports reporting ("show all students doing internships")
- ~271 unique activities identified in City View data - manageable catalog

**Notes:**
- Location NOT part of ActivityType (same activity in different rooms)
- These are templates/names only, no scheduling information

### internship_opportunities
Catalog of available internship placements.

```sql
CREATE TABLE internship_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Data Entry Assistant"
  organization_name TEXT NOT NULL, -- "Cedar Rapids City Hall"
  description TEXT,
  location_address TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  geofence_radius NUMERIC(10, 2) DEFAULT 100.00, -- meters
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  slots_available INTEGER,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_internship_opps_org ON internship_opportunities(organization_id);
CREATE INDEX idx_internship_opps_available ON internship_opportunities(organization_id, is_available)
  WHERE is_available = true;
```

**Usage:**
- StudentActivity can reference an InternshipOpportunity (auto-fills location/geofence)
- OR StudentActivity can have custom internship details
- Future: Catalog UI for students to browse/request placements

### sessions
Teacher supervision blocks - the organizational container.

```sql
CREATE TYPE session_type AS ENUM ('standard_class', 'monitoring');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Biology 2, Block 1" or "Hub Monitor, Block 4"
  teacher_id UUID NOT NULL REFERENCES user_profiles(id),
  session_type session_type NOT NULL,
  block INTEGER NOT NULL, -- 0-5
  days_of_week TEXT[] NOT NULL, -- ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  default_start_time TIME NOT NULL,
  default_end_time TIME NOT NULL,
  location TEXT, -- "Rm 208", "Hub"
  academic_term_id UUID REFERENCES academic_terms(id),
  start_date DATE,
  end_date DATE,
  honors_rotation BOOLEAN DEFAULT false, -- only meets on A or B days
  rotation_day_type TEXT, -- "A", "B", or null
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_block CHECK (block >= 0 AND block <= 5),
  CONSTRAINT valid_time_range CHECK (default_end_time > default_start_time)
);

CREATE INDEX idx_sessions_org ON sessions(organization_id);
CREATE INDEX idx_sessions_teacher ON sessions(teacher_id);
CREATE INDEX idx_sessions_term ON sessions(academic_term_id);
CREATE INDEX idx_sessions_block ON sessions(organization_id, block);
```

**Two session types:**

**standard_class:**
- Session IS the activity
- Everyone enrolled does the same thing (taking this class)
- Example: "Biology 2, Block 1, M/W/F, Teacher: Smith"

**monitoring:**
- Session is supervision only
- Students do VARIOUS activities
- Example: "Hub Monitor, Block 4, M-F, Teacher: Jones"
  - Students might do: Independent Study, Physics Online, Internships, etc.

**Schedule timing:**
- `default_start_time`/`default_end_time`: Regular schedule
- Actual times on a given day come from SchoolDay's schedule_template
- Application merges these for display

### enrollments
Student-to-session supervision relationships.

```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  days_active TEXT[], -- subset of session's days if needed
  notes TEXT, -- "Off campus on B days", etc.
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_student_session UNIQUE (student_id, session_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_session ON enrollments(session_id);
CREATE INDEX idx_enrollments_active ON enrollments(session_id, is_active) WHERE is_active = true;
```

**Purpose:**
- Establishes accountability ("who is responsible for this student")
- For standard classes, enrollment might be sufficient (no StudentActivity needed)
- For monitoring, enrollment + StudentActivity shows full picture

**Data model approach:**
- **Standard classes:** Enrollment only (session IS the activity)
  - Exception: If student has conflict with off-campus activity, that activity exists separately
- **Monitoring sessions:** Always create StudentActivities (shows what students are doing)
  - Each student has activity record describing their work
  - Activities may be on-campus (session_id set) or off-campus (session_id null)
- **Three-layer system:**
  1. Enrollments = Roster/accountability ("Trevor is responsible for Allison during Block 0")
  2. Student_activities = Actual work ("Allison does Kennedy Band on B days")
  3. Enrollment_overrides = Exceptions ("Don't expect Allison at Advisory on B days")

### student_activities
What students actually do - their work/tasks.

```sql
CREATE TABLE student_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id),
  session_id UUID REFERENCES sessions(id), -- nullable for off-campus
  internship_opportunity_id UUID REFERENCES internship_opportunities(id),
  
  -- Custom fields (when not using internship_opportunity)
  custom_name TEXT,
  custom_location TEXT,
  custom_location_lat NUMERIC(10, 7),
  custom_location_lng NUMERIC(10, 7),
  custom_geofence_radius NUMERIC(10, 2),
  
  block INTEGER NOT NULL,
  days_of_week TEXT[] NOT NULL,
  start_date DATE,
  end_date DATE,
  
  requires_checkin BOOLEAN DEFAULT false,
  allows_presence_wave BOOLEAN DEFAULT false,
  allows_status_updates BOOLEAN DEFAULT true,
  requires_geofence BOOLEAN DEFAULT false,
  allows_remote BOOLEAN DEFAULT false,
  conflict_priority INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_block CHECK (block >= 0 AND block <= 5)
);

CREATE INDEX idx_student_activities_student ON student_activities(student_id);
CREATE INDEX idx_student_activities_session ON student_activities(session_id);
CREATE INDEX idx_student_activities_block ON student_activities(student_id, block);
CREATE INDEX idx_student_activities_internship ON student_activities(internship_opportunity_id);
```

**New fields:**
- `allows_presence_wave`: Enables optional "👋 Say hey!" one-time wave per day with streak tracking
- `allows_status_updates`: Allows students to add Plans/Progress/Reflection updates (default true)
- `conflict_priority`: Higher number = higher priority when schedule conflicts occur (e.g., Kennedy Band = 10, Hub Monitor = 0)

**When StudentActivities are created:**
- Monitoring sessions: Always (shows what student is doing)
- Standard classes: Optional for MVP (can derive from Enrollment)
- Off-campus: Always (session_id is null)
- Internships: Always (needs location/check-in rules)

**Location handling:**
- If `internship_opportunity_id` is set: Use opportunity's location
- Otherwise: Use custom_location fields

**Engagement options (not mutually exclusive):**
- `requires_checkin = true`: Full check-in/out with location validation
- `allows_presence_wave = true`: One-time daily wave, builds streak
- `allows_status_updates = true`: Can add Plans/Progress/Reflection updates
- Any combination allowed, or none (just shows on calendar)

---

## Attendance & Interaction

### check_ins
Required check-in/out tracking for remote work and internships.

```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  
  check_in_location_lat NUMERIC(10, 7),
  check_in_location_lng NUMERIC(10, 7),
  geofence_validated BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_checkout_time CHECK (
    checked_out_at IS NULL OR checked_out_at > checked_in_at
  ),
  CONSTRAINT unique_checkin_per_day UNIQUE (student_id, student_activity_id, date)
);

CREATE INDEX idx_check_ins_student ON check_ins(student_id);
CREATE INDEX idx_check_ins_activity_date ON check_ins(student_activity_id, date);
```

**Purpose:** Track when students check in/out of remote activities.

**Workflow:**
1. Student checks in (enabled ~10 min before session start)
2. For geofenced activities: Validates location, stores coordinates
3. Prompted to add status update (Plans) - see status_updates table
4. At end of session: Student checks out
5. Prompted to add status update (Progress) - see status_updates table
6. Check-out enabled until day rollover (midnight)

**Geofence validation:**
- For activities with `requires_geofence = true`
- If student not in radius: Allow check-in but set `geofence_validated = false`
- Student sees warning, teacher sees location issue indicator

**Note:** Plans and progress are now stored separately in status_updates table, not here.

### status_updates
Student-authored updates about their work (plans, progress, reflections).

```sql
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id),
  date DATE NOT NULL,
  
  status_type TEXT NOT NULL CHECK (status_type IN ('plans', 'progress', 'reflection')),
  content TEXT NOT NULL,
  
  -- Context: Was this created during check-in/out flow?
  created_during_checkin BOOLEAN DEFAULT false,
  related_checkin_id UUID REFERENCES check_ins(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_updates_student ON status_updates(student_id);
CREATE INDEX idx_status_updates_activity_date ON status_updates(student_activity_id, date);
CREATE INDEX idx_status_updates_checkin ON status_updates(related_checkin_id);
CREATE INDEX idx_status_updates_type ON status_updates(student_activity_id, status_type);
```

**Purpose:** Students share what they're doing, what they've accomplished, and their reflections.

**Status types:**
- **plans**: What student is working on ("Data entry for permit applications")
- **progress**: What student accomplished ("Entered 23 permits, organized filing")
- **reflection**: Thoughts, questions, observations ("Learned about city planning process")

**Usage patterns:**

**Required during check-in/out:**
- Check-in flow prompts for Plans (auto-selected, can change type)
- Check-out flow prompts for Progress (auto-selected, can change type)
- These updates have `created_during_checkin = true` and `related_checkin_id` set

**Optional anytime:**
- Student can add status updates throughout session
- Can have multiple updates per day
- Updates show timeline of student's work

**Display:**
- Most recent of each type shown on activity card
- Full timeline available in expanded view
- Teachers can comment on specific updates (see interactions)

### presence_waves
Optional daily engagement indicator with streak tracking.

```sql
CREATE TABLE presence_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id),
  date DATE NOT NULL,
  waved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_wave_per_day UNIQUE (student_id, student_activity_id, date)
);

CREATE INDEX idx_presence_waves_student ON presence_waves(student_id);
CREATE INDEX idx_presence_waves_activity_date ON presence_waves(student_activity_id, date);
CREATE INDEX idx_presence_waves_streak ON presence_waves(student_id, student_activity_id, date);
```

**Purpose:** Simple "I'm here!" indicator for activities that don't require full check-in.

**Rules:**
- One wave per activity per day
- Available ~10 min before session, stays available all day
- After waving, button disabled with timestamp shown
- Builds consecutive day streak for gamification

**Streak calculation:**
- Count consecutive school days with waves
- Displayed to student: "🔥 5 day streak"
- Resets if student misses a day
- Encourages consistent engagement

**Use case:**
- Advisory, monitoring sessions, independent study
- Low-pressure engagement tracking
- Can be combined with status_updates

### attendance_records
Official teacher-marked attendance.

```sql
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused', 'tardy');

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  notes TEXT, -- "arrived 10 min late but not marking tardy"
  marked_by_teacher_id UUID NOT NULL REFERENCES user_profiles(id),
  related_checkin_id UUID REFERENCES check_ins(id), -- audit trail
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_student_session_date UNIQUE (student_id, session_id, date)
);

CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_date ON attendance_records(session_id, date);
CREATE INDEX idx_attendance_teacher ON attendance_records(marked_by_teacher_id);
```

**Purpose:**
- One record per student per session per day
- Teacher manually marks (no auto-suggestion in MVP)
- Links to CheckIn for context but independent

**Statuses:**
- `present`: Student was there
- `absent`: Student not there, no excuse
- `excused`: Legitimate absence
- `tardy`: Late arrival

### interactions
Comments and reactions on student work and engagement.

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- What this interaction is about (one of these should be set)
  related_status_update_id UUID REFERENCES status_updates(id),
  related_checkin_id UUID REFERENCES check_ins(id),
  related_attendance_id UUID REFERENCES attendance_records(id),
  related_presence_wave_id UUID REFERENCES presence_waves(id),
  
  parent_interaction_id UUID REFERENCES interactions(id), -- for threading (future)
  
  content_text TEXT,
  emoji_reaction TEXT, -- for acknowledgments: "ðŸ‘", "ðŸ‘", etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT has_content CHECK (
    content_text IS NOT NULL OR emoji_reaction IS NOT NULL
  )
);

CREATE INDEX idx_interactions_author ON interactions(author_id);
CREATE INDEX idx_interactions_status ON interactions(related_status_update_id);
CREATE INDEX idx_interactions_checkin ON interactions(related_checkin_id);
CREATE INDEX idx_interactions_attendance ON interactions(related_attendance_id);
CREATE INDEX idx_interactions_presence ON interactions(related_presence_wave_id);
CREATE INDEX idx_interactions_parent ON interactions(parent_interaction_id);
CREATE INDEX idx_interactions_created ON interactions(created_at DESC);
```

**Purpose:** Teacher (and eventually student) comments and reactions on student engagement.

**What can be commented on:**
- **Status updates:** Comment on specific plans/progress/reflection
- **Check-ins:** General comment on check-in/out
- **Presence waves:** Acknowledge student's presence
- **Attendance records:** Add context to attendance marking

**Interaction types:**
- **Text comment:** `content_text` is set
- **Emoji reaction:** `emoji_reaction` is set (👍 👏 ✨ 💯)
- Can have both (emoji + text)

**Usage (MVP - flat comments):**
- Teacher views student's status update
- Can add comment: "Great progress today!"
- Can react with emoji: 👍
- Student receives notification
- Displays under relevant item

**Future (threaded):**
- Use `parent_interaction_id` to create conversation threads
- Student can reply to teacher comment
- Multi-turn discussions

**Visibility:**
- All teachers can see all interactions (small staff, collaborative)
- Students see interactions on their own work
- Future: Student-to-student visibility possible

### enrollment_overrides
Manages schedule conflicts by indicating when students won't attend enrolled sessions.

```sql
CREATE TABLE enrollment_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN 
    ('rotation_days',      -- Hide on specific rotation days (A or B)
     'days_of_week',       -- Hide on specific weekdays (Tue/Thu)
     'specific_dates',     -- Hide on specific calendar dates
     'always_if_conflict'  -- Always hide when ANY conflict exists
    )),
  
  -- Conditional fields based on override_type
  applies_to_rotation_days TEXT[], -- ['A'], ['B'], or null
  applies_to_days_of_week TEXT[],  -- ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], or null
  override_dates DATE[],            -- [date1, date2, ...], or null
  
  reason TEXT NOT NULL, -- "Kennedy Band", "Kirkwood English 101"
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'teacher', 'student')),
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollment_overrides_enrollment ON enrollment_overrides(enrollment_id);
CREATE INDEX idx_enrollment_overrides_active ON enrollment_overrides(enrollment_id, is_active) 
  WHERE is_active = true;
```

**Purpose:** Handles schedule conflicts elegantly without deleting enrollments.

**Use cases:**
- Student goes to Kennedy Band on B days instead of Advisory
- Student attends Kirkwood college class on Tue/Thu instead of Hub Monitor
- One-time override for special event or circumstance

**Multi-level control:**
- Admins set defaults when configuring sessions (via conflict_priority)
- Teachers adjust for individual students
- Students can create temporary overrides

**How it works:**
1. Student enrolled in Advisory (M-F)
2. Also has Kennedy Band activity (B days, higher priority)
3. Override created on Advisory enrollment: `applies_to_rotation_days = ['B']`
4. Student's calendar shows Band on B days, Advisory on A days
5. Teacher sees student grayed out on B days with reason "Kennedy Band"

### notifications
Real-time notifications for important events.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'teacher_comment',      -- Teacher commented on student's check-in
    'student_response',     -- Student responded to teacher
    'checkin_reminder',     -- Reminder to check in/out
    'schedule_change',      -- Admin changed schedule
    'attendance_marked'     -- Teacher marked attendance
  )),
  
  related_interaction_id UUID REFERENCES interactions(id),
  related_checkin_id UUID REFERENCES check_ins(id),
  related_attendance_id UUID REFERENCES attendance_records(id),
  
  message TEXT NOT NULL,  -- Human-readable notification text
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
```

**Notification triggers:**
- Teacher adds comment → notify student
- Student checks in late → notify teacher (optional)
- Student forgets to check out → reminder notification
- Schedule changes → notify affected students/teachers

**Implementation:**
- Created via database triggers or application logic
- Supabase realtime subscriptions push to clients
- Mark as read when user views

### audit_log
Tracks changes to critical records for accountability and troubleshooting.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'soft_deleted')),
  changed_by UUID REFERENCES user_profiles(id),
  change_summary TEXT, -- Human-readable: "Moved from Biology Sec 1 to Sec 2"
  changes JSONB,       -- Detailed old/new values: {"old": {...}, "new": {...}}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

**Tracked tables:**
- `enrollments` - When students are added/removed from sessions
- `student_activities` - When activities are created/modified
- `sessions` - When session details change (time, location, teacher)
- `school_days` - When calendar is modified

**Use cases:**
- "Why isn't Sarah in my Block 2 anymore?" → Check audit_log for her enrollment
- "When did this session time change?" → View session modification history
- Troubleshooting data issues
- Compliance/accountability

**Implementation via triggers:**
```sql
CREATE OR REPLACE FUNCTION audit_enrollment_changes()
RETURNS TRIGGER AS $
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, changed_by, change_summary, changes)
    VALUES (
      'enrollments',
      NEW.id,
      'updated',
      current_setting('app.user_id', true)::UUID,
      format('Updated enrollment for student %s', NEW.student_id),
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER audit_enrollments
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION audit_enrollment_changes();
```

---

## Helper Functions & Utilities

### get_schedule_for_date
Returns the effective schedule template for a given date.

```sql
CREATE OR REPLACE FUNCTION get_schedule_for_date(
  org_id UUID,
  check_date DATE
) RETURNS UUID AS $$
DECLARE
  template_id UUID;
BEGIN
  -- Check for specific schedule override
  SELECT schedule_template_id INTO template_id
  FROM school_days
  WHERE organization_id = org_id 
    AND date = check_date;
  
  IF template_id IS NOT NULL THEN
    RETURN template_id;
  END IF;
  
  -- Fall back to default schedule
  SELECT id INTO template_id
  FROM schedule_templates
  WHERE organization_id = org_id
    AND is_default = true
  LIMIT 1;
  
  RETURN template_id;
END;
$$ LANGUAGE plpgsql;
```

### get_student_schedule (placeholder)
Would return student's complete schedule for a day/block.

```sql
CREATE OR REPLACE FUNCTION get_student_schedule(
  p_student_id UUID,
  p_date DATE,
  p_block INTEGER
) RETURNS TABLE (
  source TEXT, -- 'enrollment' or 'activity'
  name TEXT,
  location TEXT,
  teacher_name TEXT,
  requires_checkin BOOLEAN
) AS $$
BEGIN
  -- Logic to combine Enrollments and StudentActivities
  -- Implemented in application layer initially
  RETURN QUERY SELECT 'enrollment'::TEXT, 'placeholder'::TEXT, 
    'placeholder'::TEXT, 'placeholder'::TEXT, false;
END;
$$ LANGUAGE plpgsql;
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

### Users can view profiles in their org
```sql
CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

### Students: Read/write own data
```sql
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students create own check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (student_id = auth.uid());
```

### Teachers: Read all, write attendance/comments
```sql
CREATE POLICY "Teachers read all sessions"
  ON sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
  );

CREATE POLICY "Teachers manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
  );
```

### Admins: Full access to org data
```sql
CREATE POLICY "Admins full access"
  ON organizations FOR ALL
  USING (
    id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );
```

**Note:** Complete RLS policies for all tables follow similar patterns based on role and data ownership.

---

## Performance Indexes

### Composite indexes for common queries
```sql
-- Student schedule lookup
CREATE INDEX idx_student_schedule_lookup 
  ON student_activities(student_id, block, is_active) 
  WHERE is_active = true;

-- Teacher roster lookup
CREATE INDEX idx_teacher_roster_lookup
  ON enrollments(session_id, is_active)
  WHERE is_active = true;

-- Daily attendance
CREATE INDEX idx_daily_attendance_lookup
  ON attendance_records(session_id, date);

-- Check-in status
CREATE INDEX idx_checkin_status_lookup
  ON check_ins(student_id, date, checked_in_at, checked_out_at);
```

### GIN indexes for array columns
```sql
CREATE INDEX idx_sessions_days_gin ON sessions USING GIN(days_of_week);
CREATE INDEX idx_student_activities_days_gin ON student_activities USING GIN(days_of_week);
CREATE INDEX idx_user_roles_gin ON user_profiles USING GIN(roles);
```

---

## Migration Strategy

### Phase 1: Core structure
1. Organizations, users, roles
2. Academic calendar (terms, templates, school days)
3. Activity types, sessions

### Phase 2: Student scheduling
1. Enrollments
2. Student activities
3. Internship opportunities

### Phase 3: Attendance & interaction
1. Check-ins
2. Attendance records
3. Interactions

### Seed Data for City View
- Organization record for "City View Community High School"
- Default schedule template (regular block times)
- Current academic term
- Initial school days calendar
- Core activity types from CSV analysis (~271 items)

---

## Future Considerations

### Tables not yet implemented
- **system_messages**: Announcements, alerts, schedule change notifications
- **file_attachments**: Student work submissions, teacher resources
- **reporting_views**: Materialized views for analytics

### Features requiring schema updates
- **Direct messaging**: Expand interactions to support private messages
- **Student work submissions**: New table linking to StudentActivity
- **Parent/guardian access**: New role, relationship to students
- **Multi-school coordination**: Enhanced for shared students/courses

### Performance optimizations
- Materialized views for complex calendar queries
- Partitioning for historical attendance data
- BRIN indexes for date-based queries at scale

---

## Development Notes

### Supabase-specific considerations
- Use Supabase realtime subscriptions for live attendance updates
- Leverage Supabase Storage for future file attachments
- Use Supabase Edge Functions for complex business logic (geofence validation, etc.)

### Testing data
- Seed script should create realistic test data:
  - 5 teachers (mix of single-role and multi-role)
  - 100+ students across grades 9-12
  - 30-50 sessions (standard classes and monitoring)
  - Full school year calendar with exceptions
  - Sample check-ins and attendance records

### Data integrity
- Foreign key constraints ensure referential integrity
- Check constraints validate data ranges (blocks 0-5, valid date ranges)
- Unique constraints prevent duplicate enrollments, attendance records
- Soft deletes (`is_active`) preserve history while hiding inactive records

---

## Quick Reference

### Key relationships
- User â†’ Organization (one-to-one for MVP)
- User â†’ Roles (one-to-many via array)
- Session â†’ Teacher (many-to-one)
- Enrollment â†’ Student + Session (many-to-many)
- StudentActivity â†’ Student + ActivityType + Session (many-to-many)
- CheckIn â†’ StudentActivity (many-to-one)
- AttendanceRecord â†’ Session (many-to-one)
- Interaction â†’ CheckIn or AttendanceRecord (many-to-one)

### Daily workflow queries
```sql
-- What's today's schedule template?
SELECT schedule_template_id FROM school_days 
WHERE organization_id = ? AND date = CURRENT_DATE;

-- Who's in my Block 4 monitoring session today?
SELECT e.student_id, sa.activity_type_id, ci.checked_in_at
FROM enrollments e
LEFT JOIN student_activities sa ON sa.student_id = e.student_id AND sa.block = 4
LEFT JOIN check_ins ci ON ci.student_activity_id = sa.id AND ci.date = CURRENT_DATE
WHERE e.session_id = ? AND e.is_active = true;

-- What's on my calendar for Monday Block 2?
SELECT s.name, s.location, s.teacher_id
FROM enrollments e
JOIN sessions s ON s.id = e.session_id
WHERE e.student_id = ? 
  AND s.block = 2 
  AND 'Mon' = ANY(s.days_of_week)
  AND e.is_active = true;
```