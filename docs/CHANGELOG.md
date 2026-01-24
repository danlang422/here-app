# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Up Next
- Teacher UI - Schedule & Students
  - Teacher schedule view (sections they teach)
  - Student roster for each section
  - Profile pages (role-aware with dynamic tabs)
  - Student search functionality (replaces people directory approach)
- Connect student agenda page to real Supabase data
- Implement check-in flow with geolocation for internships
- Implement check-out flow with progress prompts

### Admin UI Completed (2026-01-23)

All core admin functionality has been implemented and is production-ready:

**Sections Management:**
- Sections list page with search and type filters
- Smart create section form with "Save & Add Another" workflow
- Section detail page showing schedule, teacher, location info
- Edit section via reusable modal component
- Server actions for CRUD operations on sections
- "Sections Created This Session" list displayed in modal sidebar
- Student enrollment integrated into section form
- Parent-child section relationship for supervision groups (e.g., Hub Monitor duties)

**Users Management:**
- Users list page with search and role filters
- Create user form with "Save & Add Another" workflow
- Edit user and manage multiple roles
- Password reset functionality
- Delete user functionality with confirmation
- Server actions for all CRUD operations
- "Users Created This Session" list in modal sidebar
- Multi-role support with auto-checking of primary role

**Internships Management:**
- Internships list page with search and status filters
- Create/edit internship form with "Save & Add Another" workflow
- Mentor assignment dropdown
- Contact information and requirements fields
- Available slots tracking
- Active/inactive status management
- Leaflet integration for location search and geofence visualization
- Delete with validation (prevents deletion if sections exist)

**Calendar Management:**
- Calendar grid view displaying A/B days and days off
- CSV import for bulk calendar setup
- Click day to add day off (with confirmation)
- Visual color coding: A days (blue), B days (green), days off (red)
- Implemented in Settings page (`/admin/settings`)

**Performance Optimizations:**
- Server component architecture for instant page loads
- Database view (`sections_with_enrollment_counts`) eliminates N+1 queries
- Parallel queries in admin layout
- Proper indexing on all foreign keys

**Design Patterns Established:**
- Reusable modal components for create/edit workflows
- "Save & Add Another" pattern for bulk data entry
- Server-first rendering with client components for interactivity
- Consistent server action patterns with type safety

### Profile Pages & Teacher UI Planning (2026-01-23)

**Architectural Decision:**
Profile pages and schedule builder moved from Admin UI to Teacher UI phase:

**Reasoning:**
- Teachers are primary users who need to look up students and manage schedules
- Search-based access more efficient than directory listing
- Admin users needing this functionality typically already have teacher role (small school context)
- Schedule visualization and builder are teacher tools

**Planned Implementation:**
- User profile pages at `/teacher/students/[userId]`
- Student search replaces people directory concept
- Dynamic tabs based on viewed user's role:
  - Students: Schedule, Check-ins, Info
  - Teachers: Schedule, Students, Info
  - Admins/Mentors: Info only
- Schedule builder embedded in student Schedule tab
- Teacher can view and adjust which sections student is enrolled in

### Multi-Tenancy & Organizations Table (2026-01-23)

**Status:** Deferred indefinitely

**Background:**
Originally planned to create `organizations` table to support:
- Dynamic organization name in people directory navigation
- Future multi-tenancy support

**Decision:**
Table creation deferred because:
- People directory feature moved to Teacher UI as search-based access (no need for dynamic org naming)
- Multi-tenancy not needed for V1 single-school deployment
- Schema can be added when/if multi-tenancy becomes necessary
- Minimal overhead to add `org_id` foreign keys at that time

**Future Path:**
If multi-tenancy is needed later:
1. Create `organizations` table
2. Add `org_id` to relevant tables (sections, attendance_events, etc.)
3. Update RLS policies to filter by organization
4. Add org selection/switching in UI
5. Implement slug-based routing (`/[org-slug]/admin/...`)

See `DECISIONS.md` for full reasoning.

### Authentication System Completed (2026-01-13)

**Server Infrastructure:**
- Created server actions for auth operations (`lib/auth/actions.ts`):
  - Login with email/password
  - Signup with automatic user profile creation
  - Logout with session cleanup
  - Password reset email flow
  - Password update after reset
- Implemented Next.js middleware for automatic route protection
- Public routes (login, signup, reset) accessible to unauthenticated users
- Protected routes automatically redirect to login
- Authenticated users redirected away from auth pages

**Client Components:**
- Created login page (`app/login/page.tsx`)
- Created signup page with password confirmation (`app/signup/page.tsx`)
- Created password reset request page (`app/reset-password/page.tsx`)
- Created password update page (`app/auth/update-password/page.tsx`)
- Added `useUser` hook for client-side auth state (`lib/hooks/useUser.ts`)
- Fixed redirect error flashes by handling Next.js redirect exceptions

**User Experience:**
- Seamless authentication flow with no loading states (server-side rendering)
- Automatic user profile creation on signup (via database trigger)
- New users default to student role
- HTTP-only cookies for secure session management
- Email confirmation disabled for development (can be enabled in production)

**Integration:**
- Updated home page to display authenticated user info
- Added logout functionality
- Configured site URL for password reset emails

### Supabase Integration Completed (2026-01-13)

**Infrastructure Setup:**
- Installed Supabase CLI as dev dependency
- Linked project to Supabase instance
- Generated TypeScript types from database schema (`lib/types/database.ts`)
- Created Supabase client utilities:
  - `lib/supabase/client.ts` - Browser-side client
  - `lib/supabase/server.ts` - Server-side client with cookie handling
- Installed required packages: `@supabase/supabase-js`, `@supabase/ssr`
- Added database connection test page (`app/test/page.tsx`)
- Updated `.gitignore` to exclude Supabase temp files

**Benefits:**
- Full TypeScript autocomplete for database queries
- Type-safe database operations throughout the app
- Proper Next.js App Router integration with SSR support
- Ready for authentication implementation

### Schema Design Completed (2026-01-13)

**Core Tables:**
- `users` - User profiles with multi-role support
- `roles` - System roles (student, teacher, admin, mentor)
- `user_roles` - Many-to-many user-role assignments
- `calendar_days` - School calendar with A/B day support
- `sections` - Schedule blocks (in-person, remote, internship)
- `section_teachers` - Teacher assignments to sections
- `section_students` - Student enrollment in sections
- `internship_opportunities` - Catalog of available internships
- `attendance_events` - Check-in/out records with geolocation
- `prompts` - Questions for students (plans, progress)
- `interactions` - Unified conversational model (responses, comments, messages)

**Key Features Supported:**
- Multi-role users (teacher AND mentor, admin AND teacher, etc.)
- A/B day schedules for students at other schools
- Geolocation with soft verification (flag but don't block)
- Email-based mentor verification with upgrade path to in-app
- Threaded comments on student responses
- Future-ready for custom prompts, direct messaging, opportunity gallery
- Parent-child section relationships for supervision groups

### Architectural Decisions Made (2026-01-13)

**1. Multi-Role Authentication**
- Users can have multiple roles simultaneously
- Prevents "fake account" workarounds
- `user_roles` many-to-many table with `primary_role` for UI default

**2. Internship Opportunities as Separate Entity**
- Opportunities catalog distinct from schedule sections
- Enables opportunity browsing, application workflows
- Sections link to opportunities, inherit location data

**3. Unified Interactions Model**
- Single table for prompt responses, comments, and messages
- Natural threading via `parent_id`
- Future-proof for messaging features

**4. A/B Day Calendar Support**
- Built-in from V1 via `calendar_days` table
- Sections can specify `a_days` or `b_days` schedule pattern
- UI contextually shows A/B designation only when relevant

**5. Section-Based Schedule Model**
- Three section types: in_person (display only), remote, internship
- Four schedule patterns: every_day, specific_days, a_days, b_days
- Simple SIS block mapping for attendance correlation

**6. Email-Based Mentor Engagement (V1)**
- Mentors verify via magic link emails
- Low friction, validates engagement before building full UI
- In-app mentor role possible in V2

**7. Admin-Only Schedule Building (V1)**
- Simplifies permissions for initial launch
- Can expand to teacher permissions later

**8. Geolocation with Leaflet**
- Free, open-source mapping
- 100m geofence for soft verification
- Sufficient for V1 needs

**9. Parent-Child Section Relationships (2026-01-23)**
- Sections can have parent sections via `parent_section_id`
- Enables supervision group scenarios (e.g., Hub Monitor overseeing multiple student sections)
- Teacher sees aggregated view, students see their actual section names
- Cascade behavior: deleting parent doesn't delete children

### Future Considerations

**Features Built Into Schema But UI Deferred:**
- Custom prompts (table exists, admin UI is V2+)
- Direct messaging (interactions.type='message' ready, UI is V2+)
- Opportunity gallery (data model ready, browsing UI is V2+)
- CSV import for users (schema supports it, UI is V2+)

**Potential V2+ Features:**
- Student self-scheduling for remote work blocks
- Photo upload with check-ins
- Weekly/monthly attendance reports
- SIS API integration (automated attendance posting)
- Mobile app (PWA or native)
- Push notifications for check-in reminders
- In-app mentor dashboard

### Database Changes
- Complete schema designed (see DATABASE.md)
- RLS policies defined for all tables
- Indexes planned for performance
- Common queries documented
- Database view for optimized section queries

### Technical Debt
- None yet (greenfield project)

### Infrastructure Completed (2026-01-14)

**Supabase Setup:**
- Supabase project initialized and connected
- Database migrations created and applied:
  - `001_initial_schema.sql`: Complete database schema with all tables, indexes, RLS policies
  - `002_auto_create_user_profile.sql`: Automatic user profile creation trigger
  - `003_sections_with_enrollment_view.sql`: Optimized view for section queries
  - `004_add_parent_section_relationship.sql`: Parent-child section support
- TypeScript database types generated
- Supabase client utilities configured (client-side and server-side)

**Next.js Project Setup:**
- Next.js 16 with App Router configured
- Tailwind CSS 4 integrated
- TypeScript configured
- Project structure established (app/, lib/, docs/)
- Demo student agenda page created (visual prototype)

### Known Issues
- Parent sections list does not load newly created sections until page refresh

---

## [0.1.0] - 2026-01-11

### Added
- Initial project structure and documentation
- README with project overview and tech stack
- ARCHITECTURE.md documenting key technical decisions
- DEVELOPMENT.md with setup and common tasks
- This CHANGELOG to track project progress
- Demo UI for student agenda page (visual prototype)

### Notes
- Project is in planning phase
- Visual designs established via demo components
- Ready to begin implementation once schema is in place
