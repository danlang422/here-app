# Here App - Status

**Last Updated:** 2026-01-16

---

## 🔨 In Progress

- [ ] **Admin UI - Phase 1: Sections Management** (see `/docs/wip/ADMIN_UI.md`)
  - Building admin layout and navigation
  - Creating sections list page
  - Building smart create section form with "Save & Add Another" workflow
  - Section detail page with enrollment management
  - Edit section form

---

## 📋 Next Up

- [ ] **Admin UI - Phase 2: City View (People & Schedules)**
  - People directory with role tabs
  - Profile pages (role-aware with dynamic tabs)
  - Schedule builder (list view with time filter)

- [ ] **Admin UI - Phase 3: Users Management**
  - Users list page
  - Create/edit user forms
  - Role management

- [ ] **Admin UI - Phase 4: Calendar Management**
  - Calendar grid view
  - A/B day setup

- [ ] **Student Agenda - Real Data Integration**
  - Connect agenda page to Supabase
  - Display student's actual schedule for today
  - Show check-in/out buttons based on section type

- [ ] **Check-In Flow**
  - Geolocation capture for internships
  - Prompt for plans
  - Create attendance event and interaction records
  - Send mentor verification email (internships only)

- [ ] **Check-Out Flow**
  - Prompt for progress
  - Create attendance event and interaction records

---

## 🚧 Blocked / Questions

*Nothing currently blocked*

---

## ✅ Completed Recently

- [x] **Authentication System** (2026-01-13)
  - Server actions for login, signup, logout, password reset
  - Client pages and components
  - Middleware for route protection
  - Auto-redirect logic for authenticated users

- [x] **Supabase Integration** (2026-01-13)
  - Installed Supabase CLI
  - Generated TypeScript types from schema
  - Created client utilities (browser and server)
  - Tested database connection

- [x] **Database Schema Design** (2026-01-13)
  - Complete schema with all tables, indexes, RLS policies
  - Migrations created and applied
  - Documented in DATABASE.md

- [x] **Admin UI Planning Session** (2026-01-14)
  - Detailed UI specifications in `/docs/wip/ADMIN_UI.md`
  - Build phases defined
  - Smart form design for section creation
  - Profile page architecture (role-aware tabs)

- [x] **Project Setup** (2026-01-11 - 2026-01-14)
  - Next.js 16 with App Router
  - Tailwind CSS 4
  - Project structure and documentation
  - Demo student agenda page (visual prototype)

---

## 💡 Ideas / Future Considerations

- Student self-scheduling for remote work blocks (V2+)
- Photo upload with check-ins (V2+)
- Weekly/monthly attendance reports (V2+)
- SIS API integration for automated attendance posting (V2+)
- Mobile app (PWA or native) (V2+)
- Push notifications for check-in reminders (V2+)
- In-app mentor dashboard (V2+)
- Custom prompts UI (schema ready, UI deferred)
- Direct messaging (schema ready, UI deferred)
- Opportunity gallery/browsing (schema ready, UI deferred)

---

## 📝 Notes

- Admin UI is first major feature to implement
- Building in phases: Sections → City View → Users → Calendar
- Schedule builder using list view with time filter (not visual calendar) for V1
- Smart section form optimized for bulk entry (~20 sections)
- Multi-role users supported from V1
- Email-based mentor engagement for V1 (in-app upgrade possible in V2)
