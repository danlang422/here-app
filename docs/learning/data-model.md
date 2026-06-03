# Data Model — Learning Reference

This document is a plain-language guide to Here's database. It's not a spec — it's
an explanation. If you want the precise SQL, see `docs/schema/`.

---

## How to Think About This Database

Here is fundamentally about answering two questions:

- **"Who is where right now?"** (Presence/attendance)
- **"Who is supposed to be where, and when?"** (Schedule)

Every table either defines structure (schedule), records something that happened
(attendance, check-ins), or supports one of those two goals. Keep that framing in
mind — it makes the relationships easier to follow.

---

## The Five Layers

Think of the database in five layers, each building on the one above:

```
1. Foundation     →  organizations, user_profiles
2. Calendar       →  academic_terms, schedule_templates, school_days
3. Schedule       →  activities, enrollments, activity_staff
4. Daily record   →  activity_instances
5. What happened  →  attendance_records, check_ins, presence_waves
```

A query for "who attended Bio today" touches all five layers. Most of the complexity
you see in the code is just navigating these joins.

---

## Layer 1: Foundation

### `organizations`

The top-level container for everything. City View Community High School is one
organization. This table exists so the app could theoretically run for multiple
schools — a common pattern called **multi-tenancy**.

Almost every other table has an `organization_id` foreign key. This isn't an
accident; it's the mechanism that keeps one school's data completely separate from
another's. In practice right now, there's only one org, so you can mostly ignore this
column — but it's why it's everywhere.

The interesting part of this table is the `settings` JSONB column. Instead of
adding a new column every time City View wants to configure something (block count,
rotation day names, timezone), those preferences live in a flexible JSON blob. Think
of it like an org-wide config file stored in the database.

### `user_profiles`

All people in the system live here: students, teachers, and admins. This table is
connected to Supabase Auth's internal `auth.users` table via the `id` field — when
someone signs up, Supabase creates an `auth.users` row, and a trigger automatically
creates the matching `user_profiles` row.

**Why two tables?** Supabase Auth (`auth.users`) handles the security side —
password hashing, JWT tokens, sign-in events. `user_profiles` handles the
app-specific side — name, grade level, role, advisor. This separation is a common
pattern: the auth system owns identity; your app owns the profile.

The `roles` field is a **text array** — `['teacher', 'admin']` — not a single value.
A person can be both a teacher and an admin simultaneously. You'd have learned roles
as a single enum value in the bootcamp; arrays are a PostgreSQL feature that makes
this kind of overlap natural to store.

The `advisor_id` is a **self-referential foreign key** — it points back to another
row in the same table. A student's advisor is another user in `user_profiles`.

---

## Layer 2: Calendar

These tables define *when school happens*, not *what activities happen*.

### `academic_terms`

Semesters. "Fall 2025", "Spring 2026". Start and end dates, plus an `is_current`
flag. The unique partial index enforces that only one term can be current at a time —
a database constraint, not application code.

Terms are used primarily as a **filter** — "show me all activities in Spring 2026."
They don't drive scheduling behavior on their own.

### `schedule_templates`

On a normal day, Block 0 runs from 7:30–9:00. But on a 2-hour delay day, all blocks
shift. `schedule_templates` stores named sets of block times. The default template is
the regular schedule; additional templates are for delay/early dismissal variations.

The `block_definitions` field is a JSON array of `{block, start_time, end_time}`
objects. This is why `block_count` lives in `organizations.settings` rather than as a
separate column — the count is implicitly defined by how many entries are in the
template.

### `school_days`

One row per calendar date. This is the authoritative record of "was there school on
this date, and what kind of day was it?"

Each row records:
- `is_school_day` — was there school at all?
- `schedule_template_id` — which block schedule was in effect?
- `rotation_day` — A-day or B-day?
- `override_reason` — why did it deviate from normal? (weather, planned holiday, etc.)

**The A/B rotation is for external courses, not City View itself.** City View doesn't
have A/B days — their classes run the same schedule every day. The rotation calendar
exists because some students take classes at other schools (Kennedy, Washington,
Jefferson) that operate on the district's A/B rotation. Storing the rotation day here
lets the app know "on this date, students at Kennedy are on B-day" without having to
recompute it.

---

## Layer 3: Schedule

These tables define *who does what*.

### `activities`

The central table of the entire app. A class, an internship, an online course, a
freeform study block — all of these are just rows in `activities`, configured through
different field combinations. There is no "type" column.

**Why no type column?** In a typical bootcamp project you'd add a `type` field
(`'class'`, `'internship'`, etc.) and branch on it everywhere. The problem is that
activities don't fit neatly into fixed types — a Kirkwood college course is more like
a class but needs check-in; a freeform block needs check-in but also tagging. Rather
than creating new types every time a new combination appears, Here uses **boolean
behavior flags**:

| Flag | What it means |
|---|---|
| `requires_attendance` | Teacher takes roll; student appears on the roster |
| `requires_checkin` | Student must tap check-in/out (internship, online, freeform) |
| `allows_presence_wave` | Student can send a daily "I'm here" signal |
| `allows_freeform` | Student tags their other activities at check-in |
| `requires_geofence` | GPS location validated on check-in |
| `is_not_scheduled` | No fixed time (online courses that just roll up for tagging) |
| `is_release` | Student is dismissed for this block — no attendance needed |

You combine flags to describe any activity type. An internship gets `requires_checkin`
+ `requires_geofence`. A freeform block gets `requires_checkin` + `allows_freeform`.
A regular class gets `requires_attendance` + `allows_presence_wave`.

**Scheduling fields explained:**

- `block` — which City View period this activity occupies (0–5). Used for conflict
  detection and rollup reporting, not for display timing (actual times come from
  `default_start_time` / `default_end_time`).
- `days_of_week` — an integer array using Sunday=0 through Saturday=6. So Mon–Fri is
  `[1,2,3,4,5]`. This is a PostgreSQL integer array, not a text string.
- `rotation_day_type` — "A" or "B". Set instead of `days_of_week` when an activity
  only occurs on one rotation day (common for external school courses).
- `recurrence_interval` — for every-other-week activities. `1` = weekly (default),
  `2` = every other week. Requires `recurrence_anchor_date` to know which weeks.

### `activity_staff`

A **junction table** linking staff (users) to activities. If you built a many-to-many
relationship in the bootcamp (tags on posts, etc.), this is the same concept.

Each row says: "this user is on this activity in this role." Roles are either
`teacher` (physically present, takes attendance) or `monitor` (responsible but
supervising remotely). One person can only appear once per activity — you can't be
both teacher and monitor of the same class.

**Note:** External people like a Kirkwood professor or an internship mentor aren't in
`user_profiles` at all — they go in `instructor_name` and `mentor_name` as plain text
fields directly on the activity. Only City View staff get junction table rows.

### `enrollments`

A junction table linking students to activities. Every student-activity relationship
lives here, no exceptions — even solo situations like a student's internship that only
they attend.

**Why a junction table for solo relationships?** Consistency. If you query "what
activities is this student enrolled in," the answer is always "look at enrollments."
You never have to check multiple places or special-case solo situations.

The `block` field on enrollments is **denormalized** — it's a copy of the activity's
block, stored here for query performance. If you look up "what does this student have
in Block 3," you query `enrollments` directly without joining to `activities`. The
`trg_activity_block_cascade` trigger keeps this copy in sync automatically whenever
the parent activity's block changes.

The enrollment-level scheduling fields (`days_of_week`, `rotation_day_type`,
`recurrence_interval`, `recurrence_anchor_date`) are all nullable. When null, they
mean "follow the activity's schedule." When set, they narrow a specific student's
participation — for example, a student who only attends on Tuesdays in an
otherwise-MWF class.

---

## Layer 4: The Daily Record

### `activity_instances`

An activity is a *recurring template* ("Bio meets Block 2, Mon–Fri"). An instance is
a *specific occurrence* ("Bio on June 1, 2026"). You need instances because you need
a place to attach things that happen on a specific day: attendance, check-ins, posts.

Instances are created **lazily** — meaning they're not pre-generated for the whole
semester. The first time any user touches an activity on a given date (opens the
roster, marks attendance, etc.), the app does a database upsert: create this instance
if it doesn't already exist. This is different from what you might expect, but it
means you don't waste storage generating thousands of rows for days that never had
any interaction.

The `UNIQUE (activity_id, date)` constraint ensures you can never accidentally create
two instances of the same activity on the same date.

---

## Layer 5: What Happened

These three tables all record something a student did on a specific day, linked to an
`activity_instance_id`.

### `attendance_records`

Teacher-marked. One row per student per instance. Status is an enum: `present`,
`absent`, `excused`, `tardy`. Only exists for activities where `requires_attendance =
true`.

### `check_ins`

Student-initiated. One row per student per instance. Records when they checked in,
when they checked out, and their GPS coordinates at check-in. Only exists for
activities where `requires_checkin = true`.

The key difference from attendance: **attendance is done by the teacher, check-in is
done by the student**. An internship student checks themselves in; the system
validates their location. A regular class student appears on the teacher's roster and
the teacher marks present/absent.

### `presence_waves`

The lightest-weight signal. Just "this student was here today" — no status, no
location, just a timestamp. One wave per student per instance. Used for streak
tracking. Available for activities where `allows_presence_wave = true`.

Think of the three mechanisms as a spectrum of weight:

```
Lightest          →           Heaviest
presence_wave     check_in    attendance_record
(student, 1 tap)  (student,   (teacher, status
                   in+out)     per student)
```

---

## Things That Would Be Unfamiliar From the Bootcamp

**UUIDs as primary keys.** The bootcamp likely used auto-incrementing integers
(`SERIAL`). Here uses `UUID` (`gen_random_uuid()`). UUIDs are larger and harder to
read, but they're globally unique across tables and can be generated client-side
without a round-trip to the database. Supabase defaults to UUIDs.

**Integer arrays.** `days_of_week INTEGER[]` is a PostgreSQL-native array column.
You can query `WHERE 1 = ANY(days_of_week)` to find activities that run on Mondays.
Most databases don't have native array types — this is a Postgres specialty.

**JSONB for flexible config.** The `settings` column on `organizations` and
`block_definitions` on `schedule_templates` are `JSONB` — binary JSON stored natively
in the database. This lets the schema stay stable while allowing flexible, nested
configuration without adding new columns.

**Partial unique indexes.** `CREATE UNIQUE INDEX ... WHERE is_current = true` creates
a uniqueness constraint that only applies to rows matching the condition. This is how
"only one current term" is enforced at the database level, not application level.

**Row-Level Security (RLS).** Supabase adds a security layer directly to the database
that controls what data each user can see or modify, based on their role. A student's
query automatically returns only their own records; a teacher's query returns only
their students' records. This isn't application code — it runs inside PostgreSQL
itself. RLS is covered in more depth in `auth.md`.

**Triggers.** The `trg_activity_block_cascade` trigger is a PostgreSQL function that
runs automatically when a row is updated. When you change an activity's block, the
trigger fires and updates all matching enrollment rows. You never have to remember to
do this in application code — the database handles it.

**Denormalization.** Storing `block` on `enrollments` (a copy of `activities.block`)
is a deliberate trade-off: slightly more storage and the risk of stale data (handled
by the trigger), in exchange for much faster queries. The bootcamp teaches normalization
as the goal; production databases often selectively break normalization rules for
performance.

---

## Key Relationships Summary

```
organizations
  ├── user_profiles (students, teachers, admins)
  ├── academic_terms
  │     └── activity_terms (junction to activities)
  ├── schedule_templates
  ├── school_days
  ├── activities
  │     ├── activity_staff (junction to user_profiles)
  │     ├── enrollments (junction to user_profiles/students)
  │     └── activity_instances (one per date)
  │           ├── attendance_records
  │           ├── check_ins
  │           │     └── checkin_activity_tags
  │           └── presence_waves
  └── internship_opportunities (catalog for internship activities)
```

---

## Questions Worth Sitting With

- Why does an activity exist before any instances? What would break if instances were
  pre-generated?
- What's the difference between a student checking in vs. a teacher marking them
  present? Can both happen for the same student on the same day?
- If an activity changes its `block` field, how do enrollments stay in sync? (Hint:
  look up `trg_activity_block_cascade`.)
- What happens to an activity row when it's "deleted"? (It's not deleted — look at
  `is_active`.)
