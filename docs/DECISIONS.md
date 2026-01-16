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

### Organizations Table for Dynamic Branding (2026-01-14)

**Decision:** Add `organizations` table with basic name/slug, use for dynamic nav naming

**Reasoning:**
- Allows nav item to say "City View" instead of hardcoded "School"
- Prepares for potential multi-tenancy without full implementation
- Single-tenant is simpler for V1 but org awareness is minimal overhead

**Alternatives Considered:**
- Hardcode "City View" everywhere (brittle, not reusable)
- Full multi-tenancy from day one (overkill for launch)
- No organization concept (harder to add later)

**Trade-offs:** Slight added complexity, but keeps options open

---

### "Users" vs "City View" Navigation Split (2026-01-14)

**Decision:** Separate "account management" from "people viewing"

**Reasoning:**
- CRUD operations on accounts (Users page) are different from viewing schedules/profiles
- Using organization name ("City View") for people directory creates clear conceptual distinction
- Single profile component adapts based on user role (student/teacher/admin)

**Alternatives Considered:**
- Single "People" page (conflates different purposes)
- "Accounts" and "Profiles" (less intuitive naming)

**Trade-offs:** Two navigation items instead of one, but clearer purpose

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

## Notes

- This log focuses on **why** decisions were made, not just **what** was decided
- Captures alternatives considered to help future us understand the thinking
- If we reverse a decision later, we'll add a note explaining why
