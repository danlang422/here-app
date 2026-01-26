# Database Schema

Complete database schema for Here App, built on PostgreSQL via Supabase.

## Table of Contents
- [Overview](#overview)
- [Schema Diagram](#schema-diagram)
- [Tables](#tables)
- [Relationships](#relationships)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Common Queries](#common-queries)

## Overview

The database is organized around several key concepts:

1. **Users & Roles** - Multi-role support for students, teachers, admins, and mentors
2. **Scheduling** - Sections (schedule blocks), calendar days, A/B day support
3. **Internships** - Separate opportunities catalog linked to schedule sections
4. **Attendance** - Check-in/out events with geolocation tracking
5. **Interactions** - Unified conversational model for prompts, responses, and comments

## Schema Diagram

```
users ──┬─── user_roles ─── roles
        │
        ├─── section_teachers ─── sections ──┬─── section_students
        │                                     │
        ├─── internship_opportunities ────────┘
        │                                     
        └─── attendance_events ──┬─── interactions
                                 │
                                 └─── prompts
```

## Tables

### Users & Authentication

#### users
Core user profiles. Passwords are handled by Supabase `auth.users` table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Matches Supabase auth.users.id |
| email | text | UNIQUE, NOT NULL | User email address |
| primary_role | enum | NOT NULL | Default role for UI (student, teacher, admin, mentor) |
| first_name | text | | User's first name |
| last_name | text | | User's last name |
| phone | text | NULLABLE | Contact phone number |
| created_at | timestamptz | | Account creation timestamp |
| updated_at | timestamptz | | Last profile update |
| last_sign_in_at | timestamptz | | Most recent login |

#### roles
System roles that can be assigned to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Role identifier |
| name | enum | UNIQUE, NOT NULL | student, teacher, admin, mentor |
| description | text | | Human-readable role description |
| created_at | timestamptz | | Role creation timestamp |

**Seeded values:**
```sql
INSERT INTO roles (name, description) VALUES
('student', 'Student user with access to their schedule and check-ins'),
('teacher', 'Teacher with access to student data and attendance'),
('admin', 'Administrator with full system access'),
('mentor', 'Mentor for internship students');
```

#### user_roles
Many-to-many relationship between users and roles. Users can have multiple roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| user_id | uuid | FOREIGN KEY users(id), NOT NULL | |
| role_id | uuid | FOREIGN KEY roles(id), NOT NULL | |
| created_at | timestamptz | | When role was assigned |

**Constraints:** UNIQUE(user_id, role_id)

---

### Calendar & Scheduling

#### calendar_days
School calendar defining which days are school days and A/B day designations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| date | date | UNIQUE, NOT NULL | Calendar date |
| is_school_day | boolean | NOT NULL | Whether school is in session |
| ab_designation | enum | NULLABLE | a_day, b_day, or null for regular days |
| notes | text | NULLABLE | e.g., "Spring Break", "Teacher PD" |
| created_at | timestamptz | | |

**Usage:**
- Most days: `is_school_day = true, ab_designation = null`
- A days: `is_school_day = true, ab_designation = 'a_day'`
- B days: `is_school_day = true, ab_designation = 'b_day'`
- Weekends/holidays: `is_school_day = false`

#### internship_opportunities
Catalog of available internship opportunities (separate from student schedules).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| name | text | NOT NULL | Display name (e.g., "Library Assistant") |
| organization_name | text | NOT NULL | Business/organization name |
| description | text | | Details about the internship |
| location | jsonb | NULLABLE | `{address, lat, lng}` |
| geofence_radius | int | DEFAULT 100 | Meters for location verification |
| mentor_id | uuid | FOREIGN KEY users(id), NULLABLE | Associated mentor |
| contact_phone | text | NULLABLE | Business contact (if no mentor) |
| contact_email | text | NULLABLE | Business contact (if no mentor) |
| available_slots | int | NULLABLE | Number of students (null = unlimited) |
| is_active | boolean | DEFAULT true | Show in opportunity gallery |
| requirements | text | NULLABLE | Prerequisites or requirements |
| created_by | uuid | FOREIGN KEY users(id) | Who created this opportunity |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

**Location JSON format:**
```json
{
  "address": "123 Main St NE, Cedar Rapids, IA 52402",
  "lat": 41.9779,
  "lng": -91.6656
}
```

#### sections
Schedule blocks (classes, remote work sessions, internships).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| name | text | NOT NULL | Display name |
| type | enum | NOT NULL | in_person, remote, internship |
| start_time | time | NOT NULL | Daily start time |
| end_time | time | NOT NULL | Daily end time |
| schedule_pattern | enum | NOT NULL | every_day, specific_days, a_days, b_days |
| days_of_week | jsonb | NULLABLE | `[1,2,3,4,5]` for M-F (only if specific_days) |
| sis_block | int | NULLABLE | SIS/IC attendance block number |
| parent_section_id | uuid | FOREIGN KEY sections(id) ON DELETE SET NULL, NULLABLE | Optional parent section for supervision groups |
| internship_opportunity_id | uuid | FOREIGN KEY internship_opportunities(id), NULLABLE | Linked opportunity (if internship type) |
| expected_location | jsonb | NULLABLE | `{address, lat, lng}` for internships |
| geofence_radius | int | DEFAULT 100 | Meters for location verification |
| attendance_enabled | boolean | DEFAULT false | Whether attendance tracking is enabled for this section |
| presence_enabled | boolean | DEFAULT false | Whether optional presence "waves" are enabled |
| presence_mood_enabled | boolean | DEFAULT false | Whether mood emoji picker is shown after presence wave |
| created_by | uuid | FOREIGN KEY users(id) | Who created this section |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

**Section Types:**
- `in_person`: Traditional classroom, display only, no check-in
- `remote`: Remote work, requires check-in/out with prompts
- `internship`: Off-site work, requires check-in/out with prompts + geolocation

**Schedule Patterns:**
- `every_day`: Appears on all school days
- `specific_days`: Appears on weekdays in `days_of_week` array
- `a_days`: Appears only when calendar has `ab_designation = 'a_day'`
- `b_days`: Appears only when calendar has `ab_designation = 'b_day'`

**Parent-Child Sections (Supervision Groups):**
- Parent sections group multiple student sections under one teacher supervision duty
- Use case: "Hub Monitor" where teacher supervises students in different sections simultaneously
- Students are enrolled in child sections (Spanish 2, Independent Work Time, etc.)
- Teacher sees parent section (Hub Monitor) with aggregated student count from all children
- Parent sections typically have no direct enrollments (students enrolled in children)
- Deleting parent section sets children's `parent_section_id` to null (children remain intact)
- Example: Hub Monitor (parent) ← Spanish 2 Edgenuity (child) + Independent Work Time (child) + CR US Humanities (child)

#### section_teachers
Many-to-many relationship between sections and teachers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| section_id | uuid | FOREIGN KEY sections(id), NOT NULL | |
| teacher_id | uuid | FOREIGN KEY users(id), NOT NULL | |
| is_primary | boolean | DEFAULT false | Primary teacher for section |
| created_at | timestamptz | | |

**Constraints:** UNIQUE(section_id, teacher_id)

**Use Cases:**
- One teacher per section (most common)
- Multiple teachers co-teaching
- Remote/internship sections with multiple supervisors

#### section_students
Many-to-many relationship between sections and students (enrollment).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| student_id | uuid | FOREIGN KEY users(id), NOT NULL | |
| section_id | uuid | FOREIGN KEY sections(id), NOT NULL | |
| enrolled_at | timestamptz | | When student was enrolled |
| active | boolean | DEFAULT true | false = dropped/inactive |
| created_at | timestamptz | | |

**Constraints:** UNIQUE(student_id, section_id)

---

### Attendance & Check-Ins

#### attendance_events
Records of student check-ins and check-outs with timestamps and location data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| student_id | uuid | FOREIGN KEY users(id), NOT NULL | |
| section_id | uuid | FOREIGN KEY sections(id), NOT NULL | |
| event_type | enum | NOT NULL | check_in, check_out |
| timestamp | timestamptz | NOT NULL | When event occurred |
| location | jsonb | NULLABLE | `{lat, lng}` where student checked in |
| location_verified | boolean | DEFAULT true | Auto: within geofence? |
| verified_by | uuid | FOREIGN KEY users(id), NULLABLE | Mentor who verified (manual) |
| verified_at | timestamptz | NULLABLE | When mentor verified |
| created_at | timestamptz | | |

**Location Verification:**
- `location_verified = true`: Student was within geofence (automatic)
- `location_verified = false`: Student was outside geofence (flagged)
- `verified_by` set: Mentor manually verified despite flag (override)

#### attendance_records
Records of teacher-marked attendance (separate from student-initiated check-in events).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| student_id | uuid | FOREIGN KEY users(id), NOT NULL | |
| section_id | uuid | FOREIGN KEY sections(id), NOT NULL | |
| date | date | NOT NULL | Date attendance was marked for |
| status | text | NOT NULL | 'present', 'absent', 'excused', 'tardy' |
| marked_by | uuid | FOREIGN KEY users(id), NOT NULL | Teacher who marked attendance |
| notes | text | NULLABLE | Optional teacher notes |
| created_at | timestamptz | | When record was created |
| updated_at | timestamptz | | Last modification |

**Constraints:** UNIQUE(student_id, section_id, date)

**Attendance vs Check-In Events:**
- `attendance_events`: Student-initiated check-ins/outs with geolocation (for remote/internship sections)
- `attendance_records`: Teacher-marked attendance (for any section with `attendance_enabled = true`)
- These are complementary - check-in data informs attendance marking but doesn't replace it
- Only created for sections where `attendance_enabled = true`

**Status Values:**
- `present`: Student was present for the section
- `absent`: Student was absent (no excuse provided)
- `excused`: Student was absent but excused
- `tardy`: Student arrived late (optional, may be added later)
- `null`: Not yet marked (default state)

**Parent-Child Section Pattern:**
For parent sections (e.g., "Hub Monitor" supervising multiple child sections):
- Attendance records are stored on **child sections** (where student enrollments exist)
- Teacher UI aggregates and displays under parent section
- Query pattern: `WHERE child.parent_section_id = 'parent-id'`
- Student view: Shows attendance under their enrolled child section
- See DECISIONS.md "Parent-Child Section Attendance Pattern" for full details

---

### Prompts & Interactions

#### prompts
Questions/prompts shown to students (e.g., "What are your plans?").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| content | text | NOT NULL | The prompt text |
| trigger_event | enum | NOT NULL | check_in, check_out, custom |
| created_by | uuid | FOREIGN KEY users(id), NULLABLE | null for system prompts |
| is_active | boolean | DEFAULT true | Whether prompt is currently used |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

**System Prompts (V1):**
```sql
INSERT INTO prompts (content, trigger_event, created_by, is_active) VALUES
('What are your plans for this session?', 'check_in', null, true),
('What progress did you make?', 'check_out', null, true);
```

#### interactions
Unified model for all conversational content: responses, comments, messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | |
| type | enum | NOT NULL | prompt_response, comment, message |
| author_id | uuid | FOREIGN KEY users(id), NOT NULL | Who created this |
| author_role | enum | NOT NULL | Denormalized: student, teacher, admin, mentor |
| parent_id | uuid | FOREIGN KEY interactions(id), NULLABLE | For threading/replies |
| prompt_id | uuid | FOREIGN KEY prompts(id), NULLABLE | If responding to prompt |
| attendance_event_id | uuid | FOREIGN KEY attendance_events(id), NULLABLE | Context: linked check-in/out |
| section_id | uuid | FOREIGN KEY sections(id), NULLABLE | Context: section discussion |
| content | text | NOT NULL | The actual text content |
| created_at | timestamptz | | |
| updated_at | timestamptz | | |

**Interaction Types:**
- `prompt_response`: Student answering a prompt at check-in/out
- `comment`: Teacher/mentor commenting on a response
- `message`: Direct messages (future feature)
- `presence`: Student optional "wave" check-in (👋 "I'm here!")

**Denormalization Note:****
`author_role` stores the user's primary role at creation time for query performance. This is intentionally denormalized - if a user's role changes, historical interactions preserve the role they had when creating the content.

---

## Views

### sections_with_enrollment_counts

Pre-computes active student enrollment counts for sections to prevent N+1 queries.

**Definition:**
```sql
CREATE VIEW sections_with_enrollment_counts AS
SELECT
  s.*,
  COALESCE(student_counts.active_student_count, 0) as active_student_count
FROM sections s
LEFT JOIN (
  SELECT section_id, COUNT(*) as active_student_count
  FROM section_students
  WHERE active = true
  GROUP BY section_id
) student_counts ON s.id = student_counts.section_id;
```

**Usage:**
```typescript
const { data } = await supabase
  .from('sections_with_enrollment_counts')
  .select('*')
// Returns sections with active_student_count included
```

**Permissions:**
- Same as sections table
- Read-only (inserts/updates go to base tables)

**Migration:** `003_add_sections_with_counts_view.sql`

---

## Relationships

### User Relationships
- **users** ↔ **user_roles** ↔ **roles**: Many-to-many (users can have multiple roles)
- **users** → **section_teachers**: Users with teacher role assigned to sections
- **users** → **section_students**: Users with student role enrolled in sections
- **users** → **internship_opportunities** (as mentor): Mentors linked to opportunities
- **users** → **attendance_events**: Students create check-in/out events
- **users** → **interactions**: All users create interactions

### Scheduling Relationships
- **sections** → **internship_opportunities**: Internship sections link to opportunities
- **sections** ↔ **section_teachers**: Many-to-many (sections can have multiple teachers)
- **sections** ↔ **section_students**: Many-to-many (students in multiple sections)
- **sections** → **attendance_events**: Check-ins happen in specific sections

### Interaction Relationships
- **attendance_events** → **interactions**: Check-ins trigger prompt responses
- **prompts** → **interactions**: Responses reference which prompt
- **interactions** → **interactions** (parent): Threading for comments/replies

---

## Row Level Security (RLS)

All tables use Supabase RLS for authorization. Key policies:

### Users Table
```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'admin'
  )
);
```

### Attendance Events
```sql
-- Students can view their own check-ins
CREATE POLICY "Students can view own attendance"
ON attendance_events FOR SELECT
USING (student_id = auth.uid());

-- Students can create their own check-ins
CREATE POLICY "Students can create own attendance"
ON attendance_events FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Teachers can view check-ins for their students
CREATE POLICY "Teachers can view student attendance"
ON attendance_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('teacher', 'admin')
  )
  AND EXISTS (
    SELECT 1 FROM section_teachers st
    JOIN section_students ss ON st.section_id = ss.section_id
    WHERE st.teacher_id = auth.uid()
    AND ss.student_id = attendance_events.student_id
  )
);

-- Mentors can view check-ins for their mentees
CREATE POLICY "Mentors can view mentee attendance"
ON attendance_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'mentor'
  )
  AND EXISTS (
    SELECT 1 FROM sections s
    JOIN internship_opportunities io ON s.internship_opportunity_id = io.id
    WHERE s.id = attendance_events.section_id
    AND io.mentor_id = auth.uid()
  )
);

-- Mentors can update verification status
CREATE POLICY "Mentors can verify attendance"
ON attendance_events FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sections s
    JOIN internship_opportunities io ON s.internship_opportunity_id = io.id
    WHERE s.id = attendance_events.section_id
    AND io.mentor_id = auth.uid()
  )
)
WITH CHECK (
  -- Only allow updating verification fields
  verified_by = auth.uid()
);
```

### Interactions
```sql
-- Users can view interactions they authored
CREATE POLICY "Users can view own interactions"
ON interactions FOR SELECT
USING (author_id = auth.uid());

-- Students can view interactions on their attendance events
CREATE POLICY "Students can view interactions on own attendance"
ON interactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM attendance_events ae
    WHERE ae.id = interactions.attendance_event_id
    AND ae.student_id = auth.uid()
  )
);

-- Teachers can view interactions for their students
CREATE POLICY "Teachers can view student interactions"
ON interactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('teacher', 'admin')
  )
  AND (
    -- Interactions on attendance events for their students
    EXISTS (
      SELECT 1 FROM attendance_events ae
      JOIN section_students ss ON ae.student_id = ss.student_id
      JOIN section_teachers st ON ss.section_id = st.section_id
      WHERE ae.id = interactions.attendance_event_id
      AND st.teacher_id = auth.uid()
    )
    OR
    -- Interactions in sections they teach
    EXISTS (
      SELECT 1 FROM section_teachers st
      WHERE st.section_id = interactions.section_id
      AND st.teacher_id = auth.uid()
    )
  )
);
```

---

## Common Queries

### Get Student's Schedule for Today
```sql
SELECT 
  s.*,
  io.name as internship_name,
  io.organization_name,
  cd.ab_designation
FROM sections s
LEFT JOIN internship_opportunities io ON s.internship_opportunity_id = io.id
JOIN section_students ss ON s.id = ss.section_id
JOIN calendar_days cd ON cd.date = CURRENT_DATE
WHERE ss.student_id = $1
AND ss.active = true
AND cd.is_school_day = true
AND (
  s.schedule_pattern = 'every_day'
  OR (s.schedule_pattern = 'specific_days' AND s.days_of_week ? EXTRACT(DOW FROM CURRENT_DATE)::text)
  OR (s.schedule_pattern = 'a_days' AND cd.ab_designation = 'a_day')
  OR (s.schedule_pattern = 'b_days' AND cd.ab_designation = 'b_day')
)
ORDER BY s.start_time;
```

### Get Student Check-In History with Responses
```sql
SELECT 
  ae.*,
  s.name as section_name,
  s.type as section_type,
  i.content as response_content,
  p.content as prompt_content
FROM attendance_events ae
JOIN sections s ON ae.section_id = s.id
LEFT JOIN interactions i ON i.attendance_event_id = ae.id AND i.type = 'prompt_response'
LEFT JOIN prompts p ON i.prompt_id = p.id
WHERE ae.student_id = $1
ORDER BY ae.timestamp DESC
LIMIT 20;
```

### Get All Interactions for an Attendance Event (with threading)
```sql
WITH RECURSIVE interaction_tree AS (
  -- Base case: top-level interactions
  SELECT 
    i.*,
    0 as depth,
    ARRAY[i.created_at] as path
  FROM interactions i
  WHERE i.attendance_event_id = $1
  AND i.parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: replies
  SELECT 
    i.*,
    it.depth + 1,
    it.path || i.created_at
  FROM interactions i
  JOIN interaction_tree it ON i.parent_id = it.id
)
SELECT 
  it.*,
  u.first_name,
  u.last_name,
  u.email
FROM interaction_tree it
JOIN users u ON it.author_id = u.id
ORDER BY it.path;
```

### Get Teacher's Students Needing Attendance Review
```sql
SELECT DISTINCT
  u.id,
  u.first_name,
  u.last_name,
  COUNT(ae.id) as pending_check_ins
FROM users u
JOIN section_students ss ON u.id = ss.student_id
JOIN section_teachers st ON ss.section_id = st.section_id
LEFT JOIN attendance_events ae ON ae.student_id = u.id 
  AND ae.timestamp::date = CURRENT_DATE
  AND ae.verified_by IS NULL
  AND ae.location_verified = false
WHERE st.teacher_id = $1
AND ss.active = true
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(ae.id) > 0;
```

### Get Available Internship Opportunities
```sql
SELECT 
  io.*,
  u.first_name as mentor_first_name,
  u.last_name as mentor_last_name,
  u.email as mentor_email,
  COUNT(DISTINCT ss.student_id) as current_students
FROM internship_opportunities io
LEFT JOIN users u ON io.mentor_id = u.id
LEFT JOIN sections s ON s.internship_opportunity_id = io.id
LEFT JOIN section_students ss ON s.id = ss.section_id AND ss.active = true
WHERE io.is_active = true
GROUP BY io.id, u.first_name, u.last_name, u.email
HAVING 
  io.available_slots IS NULL 
  OR COUNT(DISTINCT ss.student_id) < io.available_slots
ORDER BY io.organization_name;
```

### Get Teacher's Agenda for a Specific Date with Attendance Status
```sql
SELECT 
  s.id,
  s.name,
  s.type,
  s.start_time,
  s.end_time,
  s.attendance_enabled,
  s.presence_enabled,
  COUNT(DISTINCT ss.student_id) as total_students,
  COUNT(DISTINCT ar.student_id) as marked_students,
  COUNT(DISTINCT CASE WHEN i.type = 'presence' THEN i.author_id END) as presence_count,
  COUNT(DISTINCT CASE WHEN ae.event_type = 'check_in' THEN ae.student_id END) as checked_in_count
FROM sections s
JOIN section_teachers st ON s.id = st.section_id
JOIN section_students ss ON s.id = ss.section_id AND ss.active = true
LEFT JOIN attendance_records ar ON 
  ar.section_id = s.id 
  AND ar.date = $2
LEFT JOIN interactions i ON 
  i.section_id = s.id 
  AND i.type = 'presence'
  AND i.created_at::date = $2
LEFT JOIN attendance_events ae ON
  ae.section_id = s.id
  AND ae.timestamp::date = $2
WHERE st.teacher_id = $1
AND (
  s.schedule_pattern = 'every_day'
  OR (s.schedule_pattern = 'specific_days' AND s.days_of_week ? EXTRACT(DOW FROM $2)::text)
  OR (s.schedule_pattern = 'a_days' AND EXISTS (
    SELECT 1 FROM calendar_days cd WHERE cd.date = $2 AND cd.ab_designation = 'a_day'
  ))
  OR (s.schedule_pattern = 'b_days' AND EXISTS (
    SELECT 1 FROM calendar_days cd WHERE cd.date = $2 AND cd.ab_designation = 'b_day'
  ))
)
GROUP BY s.id
ORDER BY s.start_time;
```

### Get Roster for Parent Section with Attendance (Grouped by Child)
```sql
SELECT 
  child.id as section_id,
  child.name as section_name,
  u.id as student_id,
  u.first_name,
  u.last_name,
  ar.status as attendance_status,
  ar.notes as attendance_notes,
  ae_in.timestamp as check_in_time,
  ae_in.location_verified as check_in_verified,
  ae_out.timestamp as check_out_time,
  i_presence.content as presence_mood,
  i_prompt.content as prompt_response
FROM sections parent
JOIN sections child ON child.parent_section_id = parent.id
JOIN section_students ss ON ss.section_id = child.id AND ss.active = true
JOIN users u ON ss.student_id = u.id
LEFT JOIN attendance_records ar ON 
  ar.section_id = child.id 
  AND ar.student_id = u.id 
  AND ar.date = $2
LEFT JOIN attendance_events ae_in ON 
  ae_in.section_id = child.id 
  AND ae_in.student_id = u.id 
  AND ae_in.event_type = 'check_in'
  AND ae_in.timestamp::date = $2
LEFT JOIN attendance_events ae_out ON 
  ae_out.section_id = child.id 
  AND ae_out.student_id = u.id 
  AND ae_out.event_type = 'check_out'
  AND ae_out.timestamp::date = $2
LEFT JOIN interactions i_presence ON
  i_presence.section_id = child.id
  AND i_presence.author_id = u.id
  AND i_presence.type = 'presence'
  AND i_presence.created_at::date = $2
LEFT JOIN interactions i_prompt ON
  i_prompt.attendance_event_id = ae_in.id
  AND i_prompt.type = 'prompt_response'
WHERE parent.id = $1
ORDER BY child.name, u.last_name;
```

### Get Presence Waves for Section
```sql
SELECT 
  i.id,
  i.content as mood_emoji,
  i.created_at,
  u.id as student_id,
  u.first_name,
  u.last_name
FROM interactions i
JOIN users u ON i.author_id = u.id
WHERE i.section_id = $1
AND i.type = 'presence'
AND i.created_at::date = $2
ORDER BY i.created_at DESC;
```

---

## Indexes

Performance indexes for common query patterns:

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_primary_role ON users(primary_role);

-- User Roles
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- Roles
CREATE INDEX idx_roles_name ON roles(name);

-- Calendar
CREATE INDEX idx_calendar_date ON calendar_days(date);
CREATE INDEX idx_calendar_school_days ON calendar_days(is_school_day);
CREATE INDEX idx_calendar_ab ON calendar_days(ab_designation);

-- Internship Opportunities
CREATE INDEX idx_opportunities_active ON internship_opportunities(is_active);
CREATE INDEX idx_opportunities_mentor ON internship_opportunities(mentor_id);

-- Sections
CREATE INDEX idx_sections_type ON sections(type);
CREATE INDEX idx_sections_pattern ON sections(schedule_pattern);
CREATE INDEX idx_sections_opportunity ON sections(internship_opportunity_id);

-- Section Teachers
CREATE INDEX idx_section_teachers_section ON section_teachers(section_id);
CREATE INDEX idx_section_teachers_teacher ON section_teachers(teacher_id);

-- Section Students
CREATE INDEX idx_section_students_student ON section_students(student_id);
CREATE INDEX idx_section_students_section ON section_students(section_id);
CREATE INDEX idx_section_students_active ON section_students(active);

-- Attendance Events
CREATE INDEX idx_attendance_student ON attendance_events(student_id);
CREATE INDEX idx_attendance_section ON attendance_events(section_id);
CREATE INDEX idx_attendance_timestamp ON attendance_events(timestamp);
CREATE INDEX idx_attendance_type ON attendance_events(event_type);
CREATE INDEX idx_attendance_needs_verification 
  ON attendance_events(verified_by) 
  WHERE verified_by IS NULL AND location_verified = false;

-- Attendance Records
CREATE INDEX idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_section ON attendance_records(section_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);
CREATE INDEX idx_attendance_records_marked_by ON attendance_records(marked_by);
CREATE INDEX idx_attendance_records_section_date ON attendance_records(section_id, date);

-- Interactions
CREATE INDEX idx_interactions_author ON interactions(author_id);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_interactions_parent ON interactions(parent_id);
CREATE INDEX idx_interactions_attendance ON interactions(attendance_event_id);
CREATE INDEX idx_interactions_section ON interactions(section_id);
CREATE INDEX idx_interactions_created ON interactions(created_at DESC);

-- Prompts
CREATE INDEX idx_prompts_trigger ON prompts(trigger_event);
CREATE INDEX idx_prompts_active ON prompts(is_active);
```

---

## Migration Notes

### Initial Setup
1. Create tables in order of dependencies (users → roles → sections → etc.)
2. Enable RLS on all tables: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`
3. Create RLS policies for each table
4. Seed roles table with default values
5. Create default prompts for check-in/out

### Future Migrations
- A/B day calendar support is built-in (V1)
- Custom prompts supported (UI deferred to V2)
- Message/DM feature uses existing interactions table (V2+)
- Opportunity gallery uses existing data (UI deferred)
