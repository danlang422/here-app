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

## Key Technical Decisions

### Next.js App Router
**Decision:** Use Next.js 14+ with App Router  
**Reasoning:** 
- Server components reduce client-side JavaScript
- Built-in routing simplifies navigation
- Excellent Vercel deployment integration
- Successful experience from InternTracker
**Trade-offs:** Steeper learning curve than Pages Router, but better performance and cleaner architecture  
**Date:** January 2026

---

### Supabase for Backend
**Decision:** Use Supabase for database, authentication, and real-time features  
**Reasoning:**
- Eliminates need for custom backend API
- Built-in Row Level Security (RLS) for data access control
- Real-time subscriptions could enable live check-in status
- Successful experience from InternTracker
**Trade-offs:** Vendor lock-in, but the productivity gains and "magical" developer experience are worth it  
**Date:** January 2026

---

### Tailwind CSS
**Decision:** Use Tailwind for styling  
**Reasoning:**
- Utility-first approach keeps styles co-located with components
- Consistency through design system (spacing, colors)
- No CSS naming overhead
- Responsive design is intuitive
- Smaller production CSS bundle
**Trade-offs:** Can look cluttered inline, but helps with visibility of dynamic UI states  
**Date:** January 2026

---

### Section-Based Schedule Model
**Decision:** Use "sections" as building blocks for student schedules  
**Reasoning:**
- Flexible enough to handle various class types (in-person, internship, remote work)
- Simpler than InternTracker's full block schedule system
- Sections map directly to SIS attendance blocks via simple numeric field
- Can accommodate A/B day schedules at other schools
**Trade-offs:** Less automated than complex schedule correlation, but significantly simpler to implement and maintain  
**Date:** January 2026

**Section Types:**
- `in_person`: Traditional classroom, display-only (no check-in required)
- `remote`: Remote work sessions, requires check-in/out with prompts
- `internship`: Off-site work, requires check-in/out with prompts + geolocation

**Schedule Patterns:**
- `every_day`: Section occurs every school day
- `specific_days`: Section occurs on specific weekdays (M/W/F, T/Th, etc.)
- `a_days`: Section occurs only on A days (for students at other schools)
- `b_days`: Section occurs only on B days (for students at other schools)

---

### Multi-Role Authentication
**Decision:** Users can have multiple roles simultaneously (student, teacher, admin, mentor)  
**Reasoning:**
- Small school environment means role overlap is common (teacher who also mentors, admin who also teaches)
- Avoids need for "fake accounts" to access different features
- More accurate representation of actual user permissions
- Built with many-to-many `user_roles` table  
**Trade-offs:** More complex permission checks and RLS policies, but necessary for real-world use cases  
**Date:** January 2026

**Roles:**
- **Student**: Access to own schedule, check-in/out capability, view own history
- **Teacher**: View assigned students, comment on responses, mark attendance
- **Admin**: Full system access, schedule management, user management
- **Mentor**: Verify internship check-ins, provide feedback to mentees (email-based engagement in V1)

---

### Internship Opportunities as Separate Entity
**Decision:** Internship opportunities exist separately from schedule sections  
**Reasoning:**
- Opportunities are catalog items (browseable, searchable)
- Sections are schedule entries (specific student, specific times)
- Same opportunity can spawn multiple sections over time
- Enables future features like application workflows
- Cleaner separation of concerns  
**Trade-offs:** More tables and relationships, but better data model  
**Date:** January 2026

**Flow:**
1. Admin creates internship opportunity (organization, mentor, location)
2. Student is placed in internship
3. Admin creates section for that student, links to opportunity
4. Section inherits location/geofence from opportunity

---

### Unified Interactions Model
**Decision:** Use single `interactions` table for all conversational content (prompt responses, comments, messages)  
**Reasoning:**
- Reduces table proliferation (no separate tables for responses, comments, DMs)
- Natural threading via `parent_id` foreign key
- Enables future messaging features without schema changes
- Simpler activity feed queries
- Matches modern chat/collaboration app patterns  
**Trade-offs:** More abstract than separate tables, requires `type` enum to distinguish content  
**Date:** January 2026

**Interaction Types:**
- `prompt_response`: Student answering check-in/out prompts
- `comment`: Teacher/mentor feedback on responses
- `message`: Direct messages (future feature)

**Key Relationships:**
- `attendance_event_id`: Links response to specific check-in/out
- `prompt_id`: Links response to which prompt was answered
- `parent_id`: Links comments to responses (threading)
- `section_id`: General section context

---

### A/B Day Calendar Support
**Decision:** Built into database from V1 via `calendar_days` table  
**Reasoning:**
- City View students attend classes at other schools with A/B day schedules
- Calendar marks which dates are A days vs B days
- Sections can specify they occur on "A days only" or "B days only"
- Most sections ignore A/B designation (every_day pattern)  
**Trade-offs:** Additional complexity in schedule logic, but essential for multi-school students  
**Date:** January 2026

**Implementation:**
- `calendar_days.is_school_day`: Whether school is in session
- `calendar_days.ab_designation`: null (regular), 'a_day', or 'b_day'
- UI shows A/B designation only to students with A/B sections (contextual display)

---

### Geolocation for Internships
**Decision:** Use Leaflet + OpenStreetMap for geolocation features  
**Reasoning:**
- Free and open-source (no ongoing costs)
- Sufficient accuracy for 100m geofence verification
- Privacy-friendly (no Google tracking)  
**Trade-offs:** Less robust geocoding than Google Maps, but acceptable for V1  
**Date:** January 2026

**Geolocation Features:**
- Capture location at internship check-in and check-out
- 100-meter geofence radius for verification (configurable per opportunity)
- "Soft verification": Flag if outside geofence, but don't block check-in
- Mentor can manually verify despite flag (override)

**Location Data Storage:**
```json
{
  "address": "123 Main St NE, Cedar Rapids, IA 52402",
  "lat": 41.9779,
  "lng": -91.6656
}
```

---

### Email-Based Mentor Engagement (V1)
**Decision:** Mentors verify check-ins via email links, with option for in-app access later  
**Reasoning:**
- Low friction for mentors (no required login)
- Validates whether mentors actually engage before building full UI
- Magic link authentication allows future login without separate credentials
- Can upgrade to in-app role in V2 if engagement is high  
**Trade-offs:** Less rich interaction than in-app, but appropriate for V1 validation  
**Date:** January 2026

**Flow:**
1. Student checks in at internship
2. Email sent to mentor with check-in details
3. Mentor clicks "Verify" link (magic link authentication)
4. Sets `verified_by` and `verified_at` in database
5. Optional: Mentor leaves comment via web form

---

### Admin-Only Schedule Building (V1)
**Decision:** Only admins can create sections and enroll students  
**Reasoning:**
- Simplifies permissions for initial launch
- Matches current City View workflow (Dennis/Amanda build schedules)
- Can expand to teacher permissions later if needed  
**Trade-offs:** Less distributed control, but appropriate for small school  
**Date:** January 2026

**Schedule Building UI (planned):**
1. Admin creates sections (name, type, times, days)
2. Admin enrolls students in sections (many-to-many)
3. Visual schedule grid shows student schedules
4. CSV import deferred to V2 (manual entry for V1)

---

## Major Design Patterns

### Server Components by Default
Use client components only when interactivity is needed:
- Forms (check-in, comments)
- Location capture
- Interactive schedule views
- Real-time updates (future)

### Row Level Security (RLS) for Authorization
Database-level security ensures users can only access appropriate data:
- Students see own schedule and check-ins
- Teachers see students in their sections
- Mentors see mentees at their internship locations
- Admins see everything

### Custom Hooks for Data Fetching
Consistent patterns for loading data:
- `useStudentSchedule(date)` - Get student's schedule for specific date
- `useCheckInHistory(studentId)` - Get check-in history with responses
- `useInteractions(attendanceEventId)` - Get threaded comments

### Conversational UI Pattern
All student responses and teacher feedback presented as conversation:
- Check-in/out prompts feel like questions from teacher
- Responses appear as student messages
- Comments appear as teacher replies
- Threading creates natural conversation flow

---

## File Organization

```
here-app/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-related pages (login, signup)
│   ├── (student)/         # Student-facing pages
│   │   ├── agenda/        # Daily schedule view
│   │   ├── history/       # Check-in history
│   │   └── profile/       # Student settings
│   ├── (teacher)/         # Teacher-facing pages
│   │   ├── students/      # Student list and detail views
│   │   └── sections/      # Section management
│   ├── (admin)/           # Admin-facing pages
│   │   ├── sections/      # Section creation/management
│   │   ├── schedules/     # Schedule building UI
│   │   ├── calendar/      # A/B day calendar setup
│   │   └── opportunities/ # Internship opportunity management
│   └── api/               # API routes if needed
├── components/            # React components
│   ├── ui/               # Reusable UI components (buttons, cards, etc.)
│   ├── student/          # Student-specific components
│   ├── teacher/          # Teacher-specific components
│   ├── admin/            # Admin-specific components
│   └── shared/           # Shared across roles
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase client and helpers
│   │   ├── client.ts     # Browser client
│   │   ├── server.ts     # Server client
│   │   └── rls.ts        # RLS policy helpers
│   ├── utils/            # General utilities
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript types
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md   # This file
│   ├── DATABASE.md       # Database schema
│   ├── CHANGELOG.md      # Version history
│   └── DEVELOPMENT.md    # Development workflow
└── public/               # Static assets
```

---

## Data Flow Examples

### Check-In Flow
1. Student navigates to agenda page
2. Server component fetches today's schedule from Supabase
3. Client component shows "Check In" button for remote/internship sections
4. Student clicks "Check In"
5. **If internship:** Capture geolocation, verify against geofence
6. Show prompt: "What are your plans for this session?"
7. Student types response
8. Create `attendance_event` record (timestamp, location if applicable)
9. Create `interaction` record (type: prompt_response, content: plans)
10. **If internship with mentor:** Send email to mentor with verification link
11. Update UI to show "Checked In" state

### Teacher Viewing Check-Ins
1. Teacher navigates to students page
2. Server component queries sections where teacher is assigned
3. Fetch students in those sections
4. Fetch today's attendance events for those students
5. Display list: student name, section, check-in time, plans response
6. Teacher clicks to expand: see full response + any existing comments
7. Teacher types comment
8. Create `interaction` record (type: comment, parent_id: response interaction, content: feedback)
9. Student sees comment in their history view

### Mentor Verification Email
1. Student checks in at internship (attendance event created)
2. Server function triggers email to mentor
3. Email contains:
   - Student name
   - Check-in time
   - Location (if captured)
   - Plans response
   - "Verify" button (magic link)
4. Mentor clicks verify link
5. Magic link authenticates mentor (sets session)
6. Simple web page: "Confirm check-in for [Student]?"
7. Mentor clicks confirm
8. Update `attendance_events.verified_by` and `verified_at`
9. Optional: Show form to leave comment
10. Create `interaction` record if comment provided

---

## Future Considerations

### Features Built Into Schema But Deferred
- **Custom prompts**: `prompts` table exists, UI to create them is V2+
- **Direct messaging**: `interactions.type = 'message'` supported, UI is V2+
- **Opportunity gallery**: Data model ready, browsing/application UI is V2+
- **CSV import**: Schema supports bulk import, UI is V2+
- **Real-time updates**: Supabase subscriptions available, implementation is V2+

### Potential V2+ Features
- Student self-scheduling for remote work blocks
- Photo upload with check-ins (proof of presence)
- Weekly/monthly attendance reports
- Integration with SIS APIs (automated attendance posting)
- Mobile app (PWA or native)
- Push notifications for check-in reminders
- Mentor dashboard (in-app, not just email)

### Scalability Considerations
- Current design supports 100-500 students easily
- A/B day calendar scales to any number of patterns
- Interactions table will grow large over time (consider archiving after semester)
- Geolocation lookups are infrequent (only at check-in), minimal API costs
- RLS policies are performant with proper indexes

---

## Dependencies & Rationale

### Core Dependencies
- **next** (^16.1.1): React framework with server-side rendering and routing
- **react** (^19.2.3) / **react-dom** (^19.2.3): UI library
- **@supabase/supabase-js**: Supabase client library for database and auth
- **@supabase/auth-helpers-nextjs**: Next.js-specific Supabase auth utilities
- **tailwindcss** (^4): Utility-first CSS framework
- **leaflet**: Open-source maps library
- **react-leaflet**: React bindings for Leaflet

### Dev Dependencies
- **typescript** (^5): Type safety and better developer experience
- **eslint** (^9): Code quality and consistency
- **prettier**: Code formatting (to be added)
- **@types/leaflet**: TypeScript definitions for Leaflet

### Why Not X?
- **Prisma**: Supabase's direct PostgreSQL access is simpler for this use case
- **Google Maps**: Leaflet is free and sufficient for geofencing needs
- **Redux**: React Server Components + Supabase subscriptions handle state well
- **tRPC**: Direct Supabase queries from server components are simpler

---

## Testing Strategy (Future)

### Unit Tests
- Utility functions (date helpers, permission checks)
- Custom hooks (schedule logic, interaction threading)

### Integration Tests
- RLS policies (ensure proper data access control)
- Check-in flow (geolocation, prompt response, database writes)
- Schedule query logic (A/B days, specific days, conflicts)

### E2E Tests (Playwright)
- Student check-in/out flow
- Teacher viewing and commenting on responses
- Admin creating sections and enrolling students

### Manual Testing Focus Areas
- Geolocation accuracy across devices
- Email delivery and magic link authentication
- Schedule display for various A/B day scenarios
- Multi-role user experience (role switching)

---

## Security Considerations

### Authentication
- Supabase handles password hashing and secure session management
- Magic links for mentor verification (time-limited, single-use)
- No password in public.users table (stored in auth.users only)

### Authorization
- All data access enforced at database level via RLS
- No client-side permission checks (they can be bypassed)
- Admin operations require explicit admin role check
- Multi-role users checked against user_roles table, not just primary_role

### Data Privacy
- Students can only see their own data (schedule, check-ins, responses)
- Teachers limited to students in their sections
- Mentors limited to students at their internship locations
- Geolocation data only captured for internships (opt-in by enrollment)
- Location data not shared publicly (only visible to student, assigned teachers, mentor)

### Input Validation
- Prompt responses: Max length limits, XSS sanitization
- Location data: Validate lat/lng ranges
- Time inputs: Validate against section times
- Section creation: Prevent overlapping times for same student

---

## Performance Optimization

### Database
- Indexes on foreign keys and common query fields (see DATABASE.md)
- Denormalized `author_role` in interactions for faster filtering
- Composite indexes for multi-column queries (student+date, section+active)

### Frontend
- Server components for initial page loads (no client-side data fetching)
- Client components only for interactive features
- Optimistic updates for check-ins (update UI before database confirmation)
- Lazy loading for check-in history (infinite scroll or pagination)

### Caching
- Student schedules cached per day (invalidate at midnight)
- Section data cached (invalidate on admin changes)
- Geolocation results cached per address (reduce API calls)

---

## Deployment Architecture

### Production Environment
- **Frontend**: Vercel (Next.js deployment)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Email**: Supabase (for mentor verification emails)
- **Maps**: Leaflet + OpenStreetMap tiles (public CDN)

### CI/CD Pipeline
1. Push to `main` branch
2. Vercel auto-deploys to production
3. Database migrations run via Supabase CLI (manual for now)
4. Environment variables managed in Vercel dashboard

### Environments
- **Development**: Local Next.js + Supabase local development
- **Staging**: Vercel preview deployments (per PR)
- **Production**: Vercel production + Supabase production database

---

## Monitoring & Observability (Future)

### Metrics to Track
- Check-in completion rate (% of expected check-ins that occur)
- Average response time to prompts
- Location verification failure rate
- Mentor verification rate
- Active user counts by role

### Error Tracking
- Sentry or similar for frontend errors
- Supabase logs for database errors
- Email delivery failures (Supabase email logs)

### Alerts
- Failed check-ins exceeding threshold
- Database connection issues
- Email delivery failures

---

## Migration Path from V1 to V2

### Adding Custom Prompts
1. Build admin UI to create prompts
2. Build UI to assign prompts to sections or students
3. Modify check-in flow to show custom prompts
4. No database changes needed (schema already supports it)

### Adding Direct Messaging
1. Build message composer UI
2. Add recipient selection (student ↔ teacher)
3. Display messages in conversational thread view
4. No database changes needed (`interactions.type = 'message'` already exists)

### Adding Opportunity Gallery
1. Build browsing UI (filter by location, type, availability)
2. Add "apply" or "express interest" button
3. Admin workflow to review and place students
4. No database changes needed (opportunities table ready)

### Moving to In-App Mentor Role
1. Build mentor dashboard (view mentees, check-ins)
2. Add in-app verification button (replace email-only flow)
3. Add mentor commenting interface
4. Add mentor profile page
5. No database changes needed (mentors already in users table)
