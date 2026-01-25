# Decisions Log

This document captures important technical and product decisions made during development. Each decision includes the reasoning, alternatives considered, and trade-offs accepted.

---

## Architecture & Infrastructure

### Next.js App Router (2026-01-11)

**Decision:** Use Next.js 14+ with App Router

**Reasoning:**
- Server components reduce client-side JavaScript
- Built-in routing simplifies navigation
- Excellent Vercel deployment integration
- Successful experience from InternTracker

**Alternatives Considered:**
- Pages Router (older, more familiar but less performant)
- Create React App (no SSR, worse SEO)
- Remix (interesting but less mature ecosystem)

**Trade-offs:** Steeper learning curve than Pages Router, but better performance and cleaner architecture

---

### Supabase for Backend (2026-01-11)

**Decision:** Use Supabase for database, authentication, and real-time features

**Reasoning:**
- Eliminates need for custom backend API
- Built-in Row Level Security (RLS) for data access control
- Real-time subscriptions could enable live check-in status
- Successful experience from InternTracker
- "Magical" developer experience

**Alternatives Considered:**
- Firebase (vendor lock-in, less PostgreSQL power)
- Custom Node.js API (more control but much more work)
- Prisma + custom auth (flexible but reinventing wheels)

**Trade-offs:** Vendor lock-in, but the productivity gains are worth it

---

### Tailwind CSS (2026-01-11)

**Decision:** Use Tailwind for styling

**Reasoning:**
- Utility-first approach keeps styles co-located with components
- Consistency through design system (spacing, colors)
- No CSS naming overhead
- Responsive design is intuitive
- Smaller production CSS bundle

**Alternatives Considered:**
- CSS Modules (requires more naming decisions)
- Styled Components (runtime overhead)
- Plain CSS (harder to maintain consistency)

**Trade-offs:** Can look cluttered inline, but helps with visibility of dynamic UI states

---

## Data Model

### Section-Based Schedule Model (2026-01-13)

**Decision:** Use "sections" as building blocks for student schedules

**Reasoning:**
- Flexible enough to handle various class types (in-person, internship, remote work)
- Simpler than InternTracker's full block schedule system
- Sections map directly to SIS attendance blocks via simple numeric field
- Can accommodate A/B day schedules at other schools

**Alternatives Considered:**
- Bell schedule blocks (too rigid, not every school has fixed blocks)
- Free-form calendar events (too flexible, harder to query)
- Copy InternTracker's block system (overkill for this use case)

**Trade-offs:** Less automated than complex schedule correlation, but significantly simpler to implement and maintain

---

### Multi-Role Authentication (2026-01-13)

**Decision:** Users can have multiple roles simultaneously (student, teacher, admin, mentor)

**Reasoning:**
- Small school environment means role overlap is common (teacher who also mentors, admin who also teaches)
- Avoids need for "fake accounts" to access different features
- More accurate representation of actual user permissions
- Built with many-to-many `user_roles` table

**Alternatives Considered:**
- Single role per user (requires fake accounts or role switching)
- Role hierarchy (too rigid for real-world overlap)
- Permission-based system (overly complex for this scale)

**Trade-offs:** More complex permission checks and RLS policies, but necessary for real-world use cases

---

### Internship Opportunities as Separate Entity (2026-01-13)

**Decision:** Internship opportunities exist separately from schedule sections

**Reasoning:**
- Opportunities are catalog items (browseable, searchable)
- Sections are schedule entries (specific student, specific times)
- Same opportunity can spawn multiple sections over time
- Enables future features like application workflows
- Cleaner separation of concerns

**Alternatives Considered:**
- Opportunities are just internship-type sections (conflates catalog with schedule)
- No opportunities table, just freeform location data (loses reusability)

**Trade-offs:** More tables and relationships, but better data model

---

### Unified Interactions Model (2026-01-13)

**Decision:** Use single `interactions` table for all conversational content (prompt responses, comments, messages)

**Reasoning:**
- Reduces table proliferation (no separate tables for responses, comments, DMs)
- Natural threading via `parent_id` foreign key
- Enables future messaging features without schema changes
- Simpler activity feed queries
- Matches modern chat/collaboration app patterns

**Alternatives Considered:**
- Separate tables for each interaction type (more tables to maintain)
- Generic "content" table (too abstract)
- No threading support (limits conversational features)

**Trade-offs:** More abstract than separate tables, requires `type` enum to distinguish content

---

### A/B Day Calendar Support (2026-01-13)

**Decision:** Built into database from V1 via `calendar_days` table

**Reasoning:**
- City View students attend classes at other schools with A/B day schedules
- Calendar marks which dates are A days vs B days
- Sections can specify they occur on "A days only" or "B days only"
- Most sections ignore A/B designation (every_day pattern)

**Alternatives Considered:**
- Add A/B support later (harder to retrofit)
- Let users handle A/B logic themselves (poor UX)
- Don't support A/B days (excludes real use cases)

**Trade-offs:** Additional complexity in schedule logic, but essential for multi-school students

---

## Features & UX

### Email-Based Mentor Engagement (V1) (2026-01-13)

**Decision:** Mentors verify check-ins via email links, with option for in-app access later

**Reasoning:**
- Low friction for mentors (no required login)
- Validates whether mentors actually engage before building full UI
- Magic link authentication allows future login without separate credentials
- Can upgrade to in-app role in V2 if engagement is high

**Alternatives Considered:**
- Force mentors to use app (higher friction, might reduce engagement)
- No mentor verification (loses accountability feature)
- Text message verification (more expensive, less detailed)

**Trade-offs:** Less rich interaction than in-app, but appropriate for V1 validation

---

### Admin-Only Schedule Building (V1) (2026-01-13)

**Decision:** Only admins can create sections and enroll students

**Reasoning:**
- Simplifies permissions for initial launch
- Matches current City View workflow (Dennis/Amanda build schedules)
- Can expand to teacher permissions later if needed

**Alternatives Considered:**
- Teacher self-service (more complex, not needed at launch)
- Student self-enrollment (too open for this context)

**Trade-offs:** Less distributed control, but appropriate for small school

---

### Geolocation with Leaflet (2026-01-13)

**Decision:** Use Leaflet + OpenStreetMap for geolocation features

**Reasoning:**
- Free and open-source (no ongoing costs)
- Sufficient accuracy for 100m geofence verification
- Privacy-friendly (no Google tracking)

**Alternatives Considered:**
- Google Maps (better geocoding but costs money and tracks users)
- Mapbox (good but has usage costs)
- No maps (lose visual confirmation of location)

**Trade-offs:** Less robust geocoding than Google Maps, but acceptable for V1

---

## Admin UI

### Organization Awareness for Future Multi-Tenancy (2026-01-14, Updated 2026-01-23)

**Decision:** Organizations table deferred indefinitely

**Reasoning:**
- Originally planned to create `organizations` table for dynamic org name in people directory navigation
- People directory feature was moved to Teacher UI as search-based access (no directory listing)
- Search-based approach eliminates need for dynamic organization naming in navigation
- Multi-tenancy not needed for V1 single-school deployment
- Schema can be added when/if multi-tenancy becomes necessary
- Minimal overhead to add `org_id` foreign keys at that time

**Alternatives Considered:**
- Full multi-tenancy from day one (overkill for launch)
- No organization concept (harder to retrofit later)
- Implement table now (no immediate benefit)

**Trade-offs:** Will require migration work if multi-tenancy is needed later, but avoids premature complexity

**Future Path:**
If multi-tenancy becomes necessary:
1. Create `organizations` table
2. Add `org_id` to relevant tables (sections, attendance_events, etc.)
3. Update RLS policies to filter by organization
4. Add org selection/switching in UI
5. Implement slug-based routing (`/[org-slug]/admin/...`)

**Update (2026-01-23):** Table creation deferred indefinitely since people directory feature was eliminated in favor of search-based access in Teacher UI

---

### Profile Pages as Teacher Feature (2026-01-23)

**Decision:** User profile pages located in teacher UI (`/teacher/students/[userId]`), accessed via search rather than directory listing

**Status:** Planned for Teacher UI phase (after Admin UI completion)

**Reasoning:**
- Teachers are primary users who need to look up individual students and view/manage their schedules
- Schedule visualization and builder are teacher tools (help teachers understand student availability)
- Admin users who need this functionality likely already have teacher role (small school, role overlap is common)
- Search function is more efficient than browsing a directory for finding specific students
- Avoids building a "people directory" that doesn't provide much value

**Profile Page Design:**
- Single dynamic component shows role-appropriate tabs:
  - Students: Schedule, Check-ins, Info
  - Teachers: Schedule, Students (sections they teach), Info
  - Admins/Mentors: Info only (no schedule/student tabs)
- Schedule builder embedded in student profile's Schedule tab
- Teachers can view which sections student is enrolled in and make adjustments

**Alternatives Considered:**
- Admin-only profiles (limits access unnecessarily)
- Directory listing page (search is more efficient)
- Separate profile components per role (duplicates code)
- No profile pages (loses valuable schedule visualization)

**Trade-offs:** Admin users without teacher role can't access profiles, but this is acceptable given role overlap at small schools

---

### Smart Section Creation Form (2026-01-14)

**Decision:** "Save & Add Another" workflow for bulk section entry

**Reasoning:**
- ~20 in-person sections need to be created at once
- CSV import is overkill for this volume
- Duplicate function doesn't help (sections rarely identical)
- Form that stays open and clears after each save is fastest

**Alternatives Considered:**
- Traditional form (redirect after each save = too many clicks)
- Duplicate button (doesn't help when sections are different)
- CSV import (overengineered for 20 items)
- Visual schedule grid (great for V2, too much for V1)

**Trade-offs:** Not as powerful as CSV import, but much simpler to build and use

---

### List-Based Schedule Builder (V1) (2026-01-14)

**Decision:** Use list view with time filter for adding sections to student schedules

**Reasoning:**
- City View doesn't have fixed bell schedule blocks
- Time filter lets admin search for sections in relevant windows
- Can search existing sections OR create new section from profile
- Visual calendar is more work and assumes fixed block structure

**Alternatives Considered:**
- Visual drag-and-drop calendar (impressive but complex, V2 feature)
- Copy InternTracker's block system (doesn't fit City View's model)
- No filtering (overwhelming with 20+ sections)

**Trade-offs:** Not as visually intuitive as calendar, but practical for variable schedules

---

### Parent-Child Section Relationship for Supervision Groups (2026-01-23)

**Decision:** Add `parent_section_id` foreign key to sections table to enable grouping student sections under teacher supervision sections

**Reasoning:**
- City View has "Hub Monitor" duties where one teacher supervises multiple student sections simultaneously
- Students are in distinct sections (Spanish 2, Independent Work Time, etc.) with different content/rosters
- Teacher needs a single "Hub Monitor" entry on their schedule that aggregates all supervised sections
- Parent-child relationship makes the hierarchy explicit and manageable
- Admin workflow: create parent section (Hub Monitor) → create student sections → link child to parent
- Teacher view shows parent section with aggregated student count from all children
- Student view shows their actual section name (unaffected by parent relationship)

**Alternatives Considered:**
- `supervision_group` text field for tagging: simpler schema but opaque setup workflow, no single place to manage the grouping, prone to typos
- Separate `supervision_duties` table: most "proper" relational design but overkill for this use case, adds significant complexity
- No grouping: forces teachers to see 5 separate entries instead of 1 aggregated view

**Trade-offs:** Adds one nullable foreign key column and slightly more complex queries for teacher schedules, but creates clear hierarchy and natural admin workflow. Parent sections have no direct enrollments but aggregate students from children.

**Implementation Notes:**
- Parent section dropdown shows sections that overlap in time (helpful suggestion)
- But allows any section to be selected as parent (covers edge cases like remote students with slightly different timing)
- Teacher schedule view aggregates: "Hub Monitor → 13 students across 3 sections"
- Cascade behavior: `ON DELETE SET NULL` (deleting parent doesn't delete children)

---

### Keeping Parent-Child Sections vs Attendance Blocks Model (2026-01-25)

**Decision:** Continue using parent-child section relationship rather than refactoring to separate attendance blocks table

**Context:**
- Considered creating dedicated `attendance_blocks` table to mirror SIS periods ("Period 1", "Period 2")
- This would separate time slots (WHEN) from student placements (WHAT) from teacher assignments (WHO)
- More "correct" relational model but significant refactoring

**Reasoning:**
- Current parent-child model can handle the workflow, even if a bit awkward in some flows
- School hasn't requested attendance features yet - solving a problem we don't have
- Can build UI helpers to smooth over awkwardness (e.g., "Add section for Tyler" auto-suggests parents)
- Attendance blocks model only worth complexity if building full SIS integration
- Better to wait for real requirements before major refactoring

**When to Revisit:**
1. School explicitly requests attendance features (creates real requirements)
2. Parent-child pattern becomes genuinely painful in daily use
3. Full SIS integration becomes necessary

**Possible Compromise:**
- Could add `attendance_block` string field to sections without schema overhaul
- Gives grouping capability for attendance
- Can migrate to full attendance_blocks table later if justified

**Trade-offs:** Some UI flows (like creating individual sections) require finding/selecting parent section, but this is manageable with good UI design

---

### Simplified Attendance Model vs InternTracker (2026-01-25)

**Decision:** Section-level attendance marked by teachers, block-level reporting is read-only rollup

**Context:**
- InternTracker had complex attendance with auto-suggestions, rollup logic, override capabilities
- Teachers still using spreadsheets despite having SIS access
- Need to bring check-ins, attendance marking, and reporting into one place

**Reasoning:**
- Teachers mark attendance at section level (the actual classes/sessions)
- Attendance reporter views rollup by reporting block (for SIS transfer)
- Reporter doesn't edit in Here app - just views and manually transfers to SIS
- No automation of attendance code suggestions
- No complex override system
- Manual `reporting_block` field on sections - admin chooses which block it counts for

**Lessons from InternTracker:**
- Tried to automate too much (attendance code suggestions, overlap calculations)
- Complex rollup logic was hard to maintain and understand
- Simpler "human makes the judgment call" approach is more maintainable

**Data Model:**
```sql
-- Section-level attendance (what teachers mark)
section_attendance (
  section_id,
  student_id, 
  attendance_date,
  status, -- present/absent/tardy/excused
  marked_by -- teacher_id
)

-- Block rollup is just a query, not a table:
SELECT reporting_block, student_id, status
FROM section_attendance
JOIN sections USING (section_id)
WHERE reporting_block = X AND date = today
```

**Trade-offs:** Less automated than InternTracker, but much simpler to implement and maintain. Appropriate for small school scale.

---

### Attendance as Optional Section Property (2026-01-25)

**Decision:** Attendance tracking is toggleable per section via `attendance_enabled` boolean

**Reasoning:**
- No one has explicitly requested attendance features yet
- School may prefer existing spreadsheet workflow for some section types
- Allows gradual adoption - can enable for internships/remote first, add in-person later
- Some section types genuinely don't need formal attendance (parent supervision sections)
- Reduces pressure to "get attendance right" in V1

**Implementation:**
- Add `attendance_enabled` boolean to sections (defaults to false)
- Admin UI: checkbox in section form - "Enable attendance tracking"
- Teacher UI: "Mark Attendance" button only appears for enabled sections
- Reporter UI: only shows sections with attendance enabled in rollup

**Alternatives Considered:**
- Attendance always on (forces adoption before validation)
- Attendance always off until V2 (misses opportunity to test with willing adopters)
- Per-user preference (too granular, confusing)

**Trade-offs:** Additional field and conditional logic, but provides flexibility for gradual rollout and validates feature value before full commitment

---

## Notes

- This log focuses on **why** decisions were made, not just **what** was decided
- Captures alternatives considered to help future us understand the thinking
- If we reverse a decision later, we'll add a note explaining why
