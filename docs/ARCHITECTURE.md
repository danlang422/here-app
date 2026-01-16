# Architecture

## System Overview

Here App is a student check-in/check-out system for remote work and internships. Students see their full schedule but can only check in/out of remote and internship sections. The check-in flow captures location (for internships), plans via prompts, and timestamps. The check-out flow captures progress and timestamps.

**Core User Flow:**
1. Student views their schedule (all sections visible)
2. Remote/internship sections show check-in/check-out options
3. Check-in: Capture geolocation (internships only) → Prompt for plans → Submit with timestamp
4. Check-out: Prompt for progress → Submit with timestamp

**Teacher/Admin/Mentor Flow:**
- View student check-in/check-out data with responses to prompts
- Comment on student responses (conversational feedback)
- Use data to manually mark attendance in SIS (Student Information System)
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
- **Attendance Events**: Check-in/out records with timestamps and location data
- **Interactions**: Unified table for prompt responses, comments, and future messages
- Threading via `parent_id` creates conversational structure

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
│   ├── (student)/         # Student-facing pages
│   │   ├── agenda/        # Daily schedule view
│   │   ├── history/       # Check-in history
│   │   └── profile/       # Student settings
│   ├── (teacher)/         # Teacher-facing pages
│   │   ├── students/      # Student list and detail views
│   │   └── sections/      # Section management
│   ├── (admin)/           # Admin-facing pages
│   │   ├── sections/      # Section CRUD + smart form
│   │   ├── city-view/     # People directory + profiles
│   │   ├── calendar/      # A/B day calendar management
│   │   └── users/         # Account management
│   └── api/               # API routes if needed
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

## Admin UI Structure

### Navigation
- **Dashboard** - Overview/stats (future)
- **Sections** - Section management (CRUD + smart create form)
- **[Organization Name]** - People directory (e.g., "City View", pulled from database)
- **Calendar** - School calendar and A/B day management
- **Users** - Account management (create, edit, roles, passwords)

### Key Design Decisions

**Sections vs People:**
- "Sections" = Manage class/internship sections (CRUD operations)
- "[Org Name]" = Browse people, view profiles and schedules
- Separation clarifies purpose: section management vs people lookup

**Profile Pages:**
- Single component at `/admin/city-view/[userId]`
- Dynamically shows role-appropriate tabs:
  - Students: Schedule, Check-ins, Info
  - Teachers: Schedule, Students, Info
  - Admins/Mentors: Info only (for now)
- Schedule builder embedded in Student profile's Schedule tab

**Smart Section Form:**
- "Save & Add Another" primary action (keeps form open)
- Shows "Sections Created This Session" list for confirmation
- Optimized for bulk entry of ~20 in-person sections
- See `DECISIONS.md` and `wip/ADMIN_UI.md` for full reasoning

**Schedule Builder (V1):**
- List-based interface with time filter
- Admin searches for sections in relevant time windows
- Can enroll in existing section OR create new section from profile
- Visual calendar grid deferred to V2

See `wip/ADMIN_UI.md` for detailed UI specifications and build phases.

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

### Database
- Indexes on foreign keys and common query fields
- Composite indexes for multi-column queries (student+date, section+active)
- Denormalized `author_role` in interactions for faster filtering
- See `DATABASE.md` for complete index definitions

### Frontend
- Server components for initial page loads (no client-side data fetching)
- Client components only for interactive features
- Optimistic UI updates (update UI before database confirmation)
- Lazy loading for check-in history (pagination or infinite scroll)

### Caching Strategy
- Student schedules cached per day (invalidate at midnight)
- Section data cached (invalidate on admin changes)
- Geolocation results cached per address (reduce API calls)
- Static organization name cached (rarely changes)

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
Currently single-tenant with organization awareness. To expand to multi-tenant:
1. Add `org_id` to relevant tables (sections, attendance_events, etc.)
2. Update RLS policies to filter by organization
3. Add org selection/switching in UI
4. Implement slug-based routing (`/city-view/admin/...`)

See `DECISIONS.md` for reasoning behind single-tenant V1 approach.

---

## Related Documentation

- **DATABASE.md** - Complete database schema, tables, indexes, RLS policies
- **DECISIONS.md** - Why we made specific technical and product choices
- **DEVELOPMENT.md** - Setup instructions, common tasks, development workflow
- **CHANGELOG.md** - Version history and feature releases
- **wip/ADMIN_UI.md** - Detailed admin UI specifications (temporary, delete when complete)

For questions about "why we did it this way," check `DECISIONS.md` first.
