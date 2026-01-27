# Architecture

## System Overview

Here App is a student check-in/check-out and attendance system for remote work, internships, and in-person sections. Students can optionally "wave" (👋 "I'm here!") at in-person sections for lightweight engagement, must check in/out for remote and internship sections, and see their full schedule. Teachers mark attendance directly in the app, view student check-in/out data with prompt responses, and have tools to manage schedules.

**Core User Flow:**
1. Student views their schedule (all sections visible)
2. In-person sections show optional presence "wave" button (if enabled)
3. Remote/internship sections require check-in/check-out
4. Check-in: Capture geolocation (internships only) → Prompt for plans → Submit with timestamp
5. Check-out: Prompt for progress → Submit with timestamp

**Teacher/Admin/Mentor Flow:**
- Mark attendance for students (present/absent/excused) in sections with attendance enabled
- View student check-in/out data with prompt responses
- See presence waves and mood emojis for engagement tracking
- Comment on student responses (conversational feedback)
- Use data to inform decisions and manually transfer to SIS if needed
- Mentors verify internship check-ins via email links

---

## Technology Stack

### Frontend & Framework
- **Next.js 16** with App Router for server-side rendering and routing
- **React 19** for UI components
- **Tailwind CSS 4** for utility-first styling
- Server components by default, client components only when interactivity is needed

See `DECISIONS.md` for reasoning behind these choices and alternatives considered.

### Backend & Database
- **Supabase** for PostgreSQL database, authentication, and real-time features
- **Row Level Security (RLS)** for database-level authorization
- Server actions for mutations, direct database queries for reads
- TypeScript types auto-generated from database schema

### Maps & Location
- **Leaflet** with OpenStreetMap for geolocation features
- 100-meter geofence verification for internship check-ins
- "Soft verification" (flag but don't block) approach

### Deployment
- **Vercel** for frontend hosting and CI/CD
- **Supabase** for hosted PostgreSQL and auth
- Environment-based configuration (dev, staging, production)

---

## Data Model Overview

### Core Entities

**Users & Roles:**
- Users can have multiple roles simultaneously (student, teacher, admin, mentor)
- `user_roles` many-to-many table enables role overlap common in small schools
- See `DATABASE.md` for complete schema and `DECISIONS.md` for multi-role reasoning

**Schedule Components:**
- **Sections**: Building blocks of schedules (in-person, remote, internship types)
- **Schedule Patterns**: every_day, specific_days, a_days, b_days
- **Calendar Days**: School calendar with A/B day designation support
- Sections map to SIS attendance blocks via simple numeric field

**Internships:**
- **Opportunities**: Catalog of available internships (organization, mentor, location)
- **Sections**: Actual schedule entries linking students to opportunities
- Separation allows opportunity browsing and reusability

**Check-Ins & Interactions:**
- **Attendance Events**: Student-initiated check-in/out records with timestamps and location data
- **Attendance Records**: Teacher-marked attendance (present/absent/excused/tardy) separate from check-ins
- **Interactions**: Unified table for prompt responses, comments, presence waves, and future messages
- Threading via `parent_id` creates conversational structure
- Presence waves (👋) stored as interaction type with optional mood emoji

See `DATABASE.md` for complete table definitions and relationships.

---

## Key Architectural Patterns

### Server-First Architecture
- Server components fetch data and render initial UI
- Client components only for forms, location capture, and interactive features
- Reduces JavaScript bundle size and improves performance

### Database-Level Authorization
All data access enforced via Supabase Row Level Security policies:
- Students: own schedule and check-ins only
- Teachers: students in their sections only
- Mentors: students at their internship locations only
- Admins: full access

No client-side permission checks (they can be bypassed).

### Conversational UI Pattern
Check-in/out prompts and responses presented as conversation:
- Prompts feel like questions from teacher
- Student responses appear as messages
- Teacher comments appear as threaded replies
- Natural threading via `parent_id` relationships

### Email-First Mentor Engagement (V1)
Mentors verify check-ins via email magic links rather than requiring app login:
- Low friction, validates engagement
- Can upgrade to in-app role in V2 based on actual usage
- See `DECISIONS.md` for reasoning

---

## File Organization

```
here-app/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup, password reset)
│   ├── student/         # Student-facing pages
│   │   ├── agenda/        # Daily schedule view
│   │   ├── history/       # Check-in history
│   │   └── profile/       # Student settings
│   ├── teacher/         # Teacher-facing pages
│   │   ├── students/      # Student list and detail views
│   │   └── sections/      # Section management
│   ├── admin/           # Admin-facing pages
│   │   ├── dashboard/     # Overview/stats - future
│   │   ├── sections/      # Section CRUD + smart form
│   │   ├── internships/   # Internship CRUD
│   │   └── users/         # Account management
│   │   └── settings/      # School calendar, A/B Days
│   └── api/             # API routes if needed
│
├── components/            # React components
│   ├── ui/               # Reusable UI (buttons, cards, forms)
│   ├── student/          # Student-specific components
│   ├── teacher/          # Teacher-specific components
│   ├── admin/            # Admin-specific components
│   └── shared/           # Cross-role shared components
│
├── lib/                   # Utility functions and helpers
│   ├── supabase/         # Supabase client utilities
│   │   ├── client.ts     # Browser client
│   │   ├── server.ts     # Server client
│   │   └── rls.ts        # RLS policy helpers
│   ├── auth/             # Auth actions (login, signup, logout)
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # General utilities
│   └── types/            # TypeScript types (including database.ts)
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md   # This file
│   ├── DATABASE.md       # Database schema details
│   ├── DECISIONS.md      # Why we chose specific approaches
│   ├── CHANGELOG.md      # Version history
│   ├── DEVELOPMENT.md    # Development workflow
│   └── wip/              # Temporary planning docs
│
└── public/               # Static assets
```

---

---

## Data Flow Examples

### Student Check-In Flow
1. Student navigates to agenda page
2. **Server component** fetches today's schedule from Supabase
3. **Client component** shows "Check In" button for remote/internship sections
4. Student clicks "Check In"
5. **If internship:** Capture geolocation via browser API, verify against opportunity's geofence
6. Show prompt: "What are your plans for this session?"
7. Student types response, submits form
8. **Server action** creates:
   - `attendance_event` record (type: check_in, timestamp, location)
   - `interaction` record (type: prompt_response, content: plans)
9. **If internship:** Send email to mentor with verification magic link
10. Update UI to "Checked In" state

### Teacher Viewing & Commenting
1. Teacher navigates to students page
2. **Server component** queries:
   - Sections where teacher is assigned
   - Students enrolled in those sections
   - Today's attendance events for those students
   - Prompt responses (interactions) for those events
3. Display list: student name, section, check-in time, plans
4. Teacher clicks to expand student response
5. Teacher types comment in form
6. **Server action** creates `interaction` record (type: comment, parent_id: response)
7. Comment appears threaded under student's response
8. Student sees comment when viewing their check-in history

### Mentor Email Verification
1. Student checks in at internship → `attendance_event` created
2. **Server function** triggers email to mentor containing:
   - Student name and check-in time
   - Location (if captured)
   - Plans response
   - Magic link "Verify" button
3. Mentor clicks verify link
4. Magic link authenticates mentor (creates temporary session)
5. Simple verification page: "Confirm check-in for [Student]?"
6. Mentor clicks confirm
7. **Server action** updates `attendance_events.verified_by` and `verified_at`
8. Optional: Mentor can leave comment via form on same page

---

## UI Structure & Workflows

Each role has distinct interfaces optimized for their primary tasks. See `DECISIONS.md` for reasoning behind specific design patterns.

### Student UI

**Navigation:**
- **Agenda** - Daily schedule view with check-in/check-out buttons
- **History** - Past check-ins with prompt responses
- **Profile** - Student settings and preferences

**Key Features:**
- View full daily schedule (all section types visible)
- Check in/out only for remote and internship sections
- In-person sections shown but no interaction needed
- Check-in flow captures location (internships) and plans
- Check-out flow captures progress updates

### Teacher UI

**Status:** Planned for next major phase

**Navigation:**
- **Agenda** (default) - Today's sections with date navigation and attendance marking
- **Sections** - List of Sections with basic key info
- **Settings** - User settings (password reset, preferences)
- **Global search** - Find students/sections → links to profile pages

**Agenda Page (Primary Workflow):**
- Shows all sections for selected date (default: today)
- Date navigation: ← Previous Day | Today | Next Day →
- Section cards display:
  - Section name, time, type
  - Quick indicators: 👋 presence count, ✓ check-in count, 📝 prompt responses
  - Attendance completion status: ✓ Complete (12/12), ⚠ In Progress (8/15), Not Started (0/23)
- Click section card to expand attendance marking interface

**Attendance Marking Interface:**
- Expandable student rows (progressive disclosure pattern)
- Default view: Student name + visual indicators + attendance checkbox
  - 👋 = Presence wave (optional "I'm here!")
  - ✓ = Geolocation check-in (required for internships/remote)
  - 📝 = Prompt responses submitted
  - 😊 = Mood emoji (if presence_mood_enabled)
- Click student row to expand details:
  - Check-in/out timestamps with location verification status
  - Full prompt responses ("What are your plans?" etc.)
  - Teacher comment box for feedback
  - View full history link
- Quick attendance workflow: Mark all students without expanding
- Detailed review: Expand individual students to verify remote work

**Parent Section Handling:**
- Parent sections (e.g., "Hub Monitor") show aggregated stats
- Clicking parent section shows grouped view:
  - Students organized by child section (Spanish 2, Independent Work, etc.)
  - Per-section completion tracking visible
  - Attendance saved to child sections (where enrollments exist)
  - Optional toggle for unified alphabetical view (all students in one list)
- Teacher assignments automatically copied from parent to children
- Changes to parent teachers cascade to all children
- Child sections can hide assigned teacher and show external instructor name
  - College classes show professor name instead of City View teacher
  - Remote work shows section name only (no teacher)
  - Internships can show mentor name

**Features NOT Built (V1):**
- `/teacher/sections` list page - unclear value beyond Agenda
- `/teacher/students` list page - search + profiles more efficient

**Design Philosophy:**
- Attendance marking at top level (Agenda) minimizes clicks
- Expandable rows provide context when needed without overwhelming
- Visual indicators help teachers quickly identify which students need attention
- Parent sections roll up multiple child sections for unified workflow

### Profile Pages (Role-Agnostic)

**Status:** Planned for V1

**Route:** `/profile/[id]` (not nested under any role-specific directory)

**Access:**
- Global search component in app header/nav (accessible to teachers and admins)
- Search indexes users and sections
- Results link to `/profile/[id]` or `/section/[id]`
- Direct navigation for viewing own profile

**Dynamic Content Based on Viewed User's Role:**
- **Student profiles**: Schedule (with builder), Check-ins, Info tabs
- **Teacher profiles**: Schedule, Students (sections they teach), Info tabs  
- **Admin/Mentor profiles**: Info tab only

**Primary Feature: Schedule Builder**
- Embedded in student/teacher Schedule tab
- List view with time filtering for finding relevant sections
- Add/remove sections from student schedule
- Accessible to teachers and admins for schedule management

**Viewer Permissions:**
- Teachers: Can view/edit students in their sections, view other teachers
- Admins: Can view/edit all users (most admins also have teacher role)
- Students: Can view own profile, possibly peers (TBD)

**Design Philosophy:**
- Role-agnostic route provides flexibility for multi-role access
- Content adapts based on who's being viewed, not who's viewing
- Search-first approach more efficient than directory browsing
- Schedule builder is primary reason these pages exist

### Admin UI

**Status:** Complete and production-ready

**Navigation:**
- **Dashboard** - Overview/stats (future)
- **Sections** - Section management (CRUD + enrollment)
- **Internships** - Internship management (CRUD + geolocation)
- **Users** - Account management (CRUD, roles, passwords)
- **Settings** - School calendar management (CSV import, visual editor)

**Implemented Features:**
- **Smart Section Form**: "Save & Add Another" workflow for bulk entry with session tracking
- **Student Enrollment**: Multi-select enrollment integrated into section creation/editing
- **Parent-Child Sections**: Support for supervision groups (e.g., Hub Monitor duties)
  - Section detail page with "Manage Children" interface
  - Bulk "Link to Parent Section" action on sections list
  - Auto-copy teacher assignments from parent to children
  - Cascade teacher changes from parent to all children
  - Instructor name and teacher visibility controls for college classes
- **User Management**: Create accounts, assign multiple roles, password resets
- **Internship Management**: Full CRUD with Leaflet map integration for geofencing
- **Calendar Management**: CSV import, visual grid editor with A/B day color coding
- **Performance Optimized**: Server component architecture with database views for instant loads

**Design Patterns:**
- Reusable modal components with "Save & Add Another" workflow
- Server-first rendering for optimal performance
- "Created This Session" sidebars for bulk entry visibility
- Consistent server action patterns with type safety
- Bulk operations with confirmation dialogs (section linking, feature toggles)
- Auto-cascading relationships (teacher assignments parent → children)

**Admin Access to Teacher Features:**
- Admins with teacher role can access teacher UI (student search, profiles)
- Admins without teacher role focus on system-wide management
- Role overlap is common in small schools, making this practical

---

## Custom Hooks & Utilities

### Data Fetching Patterns
Consistent hooks for loading common data:
- `useStudentSchedule(date)` - Get student's schedule for specific date
- `useCheckInHistory(studentId)` - Get check-in history with responses
- `useInteractions(attendanceEventId)` - Get threaded comments
- `useUser()` - Get current authenticated user

### Common Utilities
- Date helpers (format times, calculate A/B days, check school days)
- Permission checks (verify user has required role)
- Location helpers (calculate distance, verify geofence)
- Form validation (time ranges, schedule conflicts)

---

## Security & Privacy

### Authentication
- Supabase handles password hashing and session management
- Magic links for mentor verification (time-limited, single-use)
- No passwords stored in public.users (stored in auth.users only)
- HTTP-only cookies for secure sessions

### Authorization
- All data access controlled at database level via RLS policies
- No client-side permission checks (can be bypassed)
- Multi-role users verified against `user_roles` table
- Admin operations require explicit admin role check

### Data Privacy
- Students see only their own schedule and check-ins
- Teachers limited to students in their sections
- Mentors limited to students at their internship locations
- Geolocation only captured for internships (opt-in by enrollment)
- Location data visible only to student, assigned teachers, and mentor

### Input Validation
- Max length limits on text inputs
- XSS sanitization on user content
- Geolocation coordinate validation
- Time input validation against section times
- Conflict detection for schedule overlaps

---

## Performance Optimization

### Server Component Architecture (Added January 2026)

Here App uses Next.js's server-first rendering pattern for optimal performance:

**Pattern:**
- **Server components** fetch data directly and render with data included
- **Client components** receive initial data as props for instant display
- **Interactive features** isolated in client components

**Benefits:**
- No loading spinners - data arrives with HTML
- Smaller JavaScript bundles
- Faster perceived page load times

**Example Implementation:**
```typescript
// Server component (page.tsx)
export default async function SectionsPage() {
  const sections = await getSections()  // Runs on server
  return <SectionsPageClient initialSections={sections} />
}

// Client component (SectionsPageClient.tsx)
'use client'
export default function SectionsPageClient({ initialSections }) {
  const [sections, setSections] = useState(initialSections)
  // Interactive features here
}
```

**Applied to:**
- ✅ Sections page - Server component + client wrapper
- ✅ Users page - Server component + client wrapper
- 🔄 Future pages - Use this pattern from the start

### Database Query Optimization

**N+1 Query Prevention (Implemented January 2026):**

Created `sections_with_enrollment_counts` database view to eliminate N+1 query patterns:

**Before (N+1 Problem):**
```typescript
// 1 query for sections + N queries for counts
const sections = await getSections()  // 1 query
for (const section of sections) {
  const count = await getCount(section.id)  // N queries
}
// Total: N + 1 queries (e.g., 10 sections = 11 queries)
```

**After (Optimized):**
```typescript
// Single query using database view
const sections = await supabase
  .from('sections_with_enrollment_counts')
  .select('*')
// Total: 1 query regardless of section count
```

**View Definition:**
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

**Performance Impact:**
- 10 sections: 11 queries → 1 query (90% reduction)
- 50 sections: 51 queries → 1 query (98% reduction)

### Admin Layout Optimization (Implemented January 2026)

Admin layout queries run in parallel for faster navigation between pages:

**Before (Sequential):**
```typescript
const user = await getUser()           // Query 1
const profile = await getProfile()     // Query 2 (waits for 1)
const roles = await getRoles()         // Query 3 (waits for 2)
```

**After (Parallel):**
```typescript
const [user, profile, roles] = await Promise.all([
  getUser(),      // All queries
  getProfile(),   // run at the
  getRoles()      // same time
])
```

### Database Indexes

All foreign keys indexed for query performance:
- `sections.created_by`
- `section_teachers.section_id`, `section_teachers.teacher_id`
- `section_students.section_id`, `section_students.student_id`
- `attendance_events.section_id`, `attendance_events.student_id`
- `interactions.attendance_event_id`, `interactions.author_id`

Composite indexes for common query patterns:
- `(student_id, date)` on attendance_events
- `(section_id, active)` on section_students

See `DATABASE.md` for complete index definitions.

### Caching Strategy

**Request Memoization (Next.js Built-in):**
- Identical requests within a single render are deduplicated
- `createClient()` calls cached automatically per request
- No additional configuration needed

**Future Considerations:**
- Student schedules: Cache per day (invalidate at midnight)
- Section data: Cache with revalidation on admin changes
- Static content: Leverage Next.js static generation where possible

---

## Deployment & Environments

### Production Architecture
- **Frontend**: Vercel (Next.js deployment, auto-deploy from main branch)
- **Database**: Supabase (hosted PostgreSQL)
- **Auth**: Supabase Auth (magic links, session management)
- **Email**: Supabase (mentor verification emails)
- **Maps**: Leaflet + OpenStreetMap tiles (public CDN)

### Environments
- **Development**: Local Next.js + Supabase local development
- **Staging**: Vercel preview deployments (automatic per PR)
- **Production**: Vercel production + Supabase production database

### CI/CD Pipeline
1. Push to `main` branch or create PR
2. Vercel automatically builds and deploys
3. Preview URL generated for PRs (staging)
4. Database migrations run manually via Supabase CLI
5. Environment variables managed in Vercel dashboard

---

## Testing Strategy (Future)

### Unit Tests
- Utility functions (date helpers, permission checks, location calculations)
- Custom hooks (schedule logic, interaction threading)
- Form validation logic

### Integration Tests
- RLS policies (ensure proper data access control)
- Check-in flow (geolocation, prompt response, database writes)
- Schedule query logic (A/B days, specific days, conflicts)
- Email delivery (mentor verification)

### E2E Tests (Playwright)
- Student check-in/out flow
- Teacher viewing and commenting on responses
- Admin creating sections and enrolling students
- Multi-role user experience

### Manual Testing Focus
- Geolocation accuracy across different devices
- Email delivery and magic link authentication
- Schedule display for various A/B day scenarios
- Multi-role switching in UI

---

## Future Enhancements

### Features Built Into Schema (UI Deferred)
The database schema already supports these features, but UI is planned for V2+:
- **Custom prompts**: `prompts` table exists, admin UI to create them is V2+
- **Direct messaging**: `interactions.type='message'` ready, UI is V2+
- **Opportunity gallery**: Data model ready, browsing/application UI is V2+
- **CSV import**: Schema supports bulk import, UI is V2+
- **Real-time updates**: Supabase subscriptions available, implementation is V2+

### Potential V2+ Features
- Student self-scheduling for remote work blocks
- Photo upload with check-ins (proof of presence)
- Weekly/monthly attendance reports
- SIS API integration (automated attendance posting)
- Mobile app (PWA or native)
- Push notifications for check-in reminders
- In-app mentor dashboard (upgrade from email-only)
- Visual schedule calendar for admin

### Scalability Considerations
- Current design supports 100-500 students easily
- A/B day calendar scales to any number of patterns
- Interactions table will grow large over time (consider archiving after semester)
- Geolocation lookups infrequent (only at check-in), minimal API costs
- RLS policies performant with proper indexes

### Multi-Tenancy Path
Currently single-tenant without organization table. Organizations table and multi-tenancy deferred indefinitely but can be added if needed:
1. Create `organizations` table
2. Add `org_id` to relevant tables (sections, attendance_events, etc.)
3. Update RLS policies to filter by organization
4. Add org selection/switching in UI
5. Implement slug-based routing (`/[org-slug]/admin/...`)

See `DECISIONS.md` for reasoning behind deferral and full context.

---

## Related Documentation

- **DATABASE.md** - Complete database schema, tables, indexes, RLS policies
- **DECISIONS.md** - Why we made specific technical and product choices
- **DEVELOPMENT.md** - Setup instructions, common tasks, development workflow
- **CHANGELOG.md** - Version history and feature releases

For questions about "why we did it this way," check `DECISIONS.md` first.
