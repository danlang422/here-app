# Here App - Status

**Last Updated:** 2026-01-29 (Design System Created, Instructor Fields Added)

---

## 🔨 In Progress

**Student Agenda Redesign** - Implementing Clean Bright design system with new interaction patterns (👋 buttons, collapsible sections, color-rotated "here" text).

---

## ⚠️ Action Required Before Continuing

**RLS Policy Review:**
- [ ] Audit all RLS policies for teacher access to student data
- [ ] Verify teachers can view students in child sections (via parent assignment)
- [ ] Test multi-role access patterns

**Admin UI Updates Needed:**
- [ ] Section detail page redesign (to support child section management)
- [ ] Add "Manage Children" interface to parent section detail page
- [ ] Add "Link to Parent Section" bulk action on sections list
- [ ] Server actions for cascading teacher changes (parent → children)

---

## 📋 Next Up - Teacher UI Implementation

### Phase 1: Database & Types
- [x] Run migration 005
- [x] Regenerate TypeScript types
- [x] Verify new fields appear in database.ts
- [x] Add RLS policy for teachers to view students

### Phase 2: Teacher Agenda Page - Foundation
- [x] Create `/app/teacher` directory structure
- [x] Build teacher layout with sidebar and navigation
- [x] Build agenda page with date navigation
- [x] Server action to fetch teacher's sections for a date
- [x] Section cards with attendance completion indicators
- [x] Visual indicators: 👋 presence count, ✓ check-in count, 📝 prompts count
- [x] Modal-based attendance interface (instead of inline)
- [x] Expandable student rows with attendance buttons
- [x] Server action for saving attendance
- [x] Teacher comment functionality (notes field working)
- [ ] Parent section handling in agenda modal: Grouped by child sections with collapsible groups
- [ ] Optional alphabetical toggle for parent section view

### Phase 3: Admin UI - Parent-Child Section Management
- [ ] Update section detail page to show child sections
  - Display list of children with enrollment counts
  - "Add Child Section" and "Create New Child" actions
  - Remove child functionality
- [ ] Bulk "Link to Parent Section" action on sections list
  - Multi-select sections
  - Choose parent from dropdown
  - Confirmation: "This will copy teachers from [Parent] to these X sections"
- [ ] Auto-copy teacher assignments when linking child to parent
  - Server action: `linkChildToParent(childId, parentId)`
  - Copies all teachers from parent to child
  - Sets `show_assigned_teacher = false` by default for children
- [x] Add instructor fields to section form
  - "Student View Options" section
  - Checkbox: "Show assigned teacher on student view"
  - Text input: "Instructor Name" (shown when teacher hidden)
- [ ] Server actions for cascading teacher changes
  - When teacher added to parent → add to all children
  - When teacher removed from parent → remove from all children

### Phase 4: Teacher UI - Parent Section Display
- [ ] Update AttendanceModal to detect and handle parent sections
  - Query child sections and their enrollments
  - Group students by child section (collapsible groups)
  - Show per-section completion tracking
  - Optional toggle for alphabetical view (all students flat)
- [ ] Update TeacherAgendaClient to show parent section metadata
  - Aggregate counts from children (total students, marked, etc.)
  - Visual indication that section has children

### Phase 5: Teacher Sections Page (Deferred)
- [ ] Create sections list page (`/app/teacher/sections/page.tsx`)
  - Server component fetches teacher's sections
  - Display section cards with key info (name, time, student count, schedule pattern)
  - Link to detailed views (roster, schedule)
  - Handle parent sections (show aggregated student counts)
- [ ] Server action for fetching teacher sections
  - Query sections where teacher is assigned
  - Include enrollment counts and basic metadata
  - Sort by time or name

### Phase 4: Bulk Section Editing (Admin)
- [x] Add checkbox selection to admin sections list
- [x] Build bulk actions dropdown component
  - "Enable Attendance" / "Disable Attendance"
  - "Enable Presence" / "Disable Presence"
- [x] Server action for bulk updates
  - `bulkUpdateSections(sectionIds, updates)`
  - Confirmation dialog before executing
- [x] Success feedback (toast with count)
- [x] Fixed database view to include feature toggle columns

### Phase 6: Profile Pages & Search
- [ ] Build global search component
  - Search users and sections
  - Accessible from header/nav for teachers and admins
- [ ] Create `/app/profile/[id]/page.tsx`
  - Dynamic content based on viewed user's role
  - Student profiles: Schedule, Check-ins, Info tabs
  - Teacher profiles: Schedule, Students, Info tabs
  - Admin/Mentor: Info tab only
- [ ] Schedule builder component (embedded in Schedule tab)
  - List view with time filtering
  - Add/remove sections from student schedule

### Phase 7: Student Presence Feature
- [ ] Add "👋 Say you're here!" button to student agenda
  - Only shows for sections with presence_enabled
  - Optional mood emoji picker (if presence_mood_enabled)
- [ ] Server action: `createPresence(sectionId, moodEmoji?)`
  - Creates interaction with type='presence'
  - Validates section has presence_enabled
- [ ] Display presence count on teacher agenda cards

---

## 🚧 Blocked / Questions

- **Attendance workflow observation needed**: Sub tomorrow to see who's actually marking attendance and how
  - Is it all teachers? Just certain teachers?
  - What's the actual workflow with the spreadsheet?
  - This will inform whether we need different permission levels

---

## ✅ Completed Recently (2026-01-29)

- [x] **Design System Documentation (Clean Bright Style)**
  - Created comprehensive `/docs/DESIGN_SYSTEM.md`
  - Defined 4-color accent palette (Orange, Purple, Pink, Yellow)
  - Specified "here" text treatment with color rotation
  - Documented emoji button interactions (👋 wave, ✌️ peace)
  - Defined collapsible plans/progress section with tabs
  - Animation specifications (timing, easing, hover effects)
  - Check-in/check-out flow states documented
  - Presence wave pattern documented
  - Component specifications ready for implementation

- [x] **Instructor Display Fields - Admin UI**
  - Added `instructor_name` and `show_assigned_teacher` to section form
  - "Student View Options" section in form
  - Checkbox to show/hide assigned teacher on student view
  - Text input for external instructor name
  - Updated SectionFormData type with new fields
  - Updated createSection() and updateSection() to save new fields
  - Migration 008 run and types regenerated

## ✅ Completed Recently (2026-01-27)

- [x] **Parent-Child Section Pattern Design & Documentation**
  - Resolved teacher assignment pattern: Teachers assigned to BOTH parent and children
  - Auto-copy teacher assignments from parent to children when linking
  - Cascade teacher changes from parent to all children
  - Designed instructor display for college classes and external instruction
  - Added `instructor_name` and `show_assigned_teacher` fields to sections schema
  - Created migration 008: Add instructor fields to sections table
  - Updated DATABASE.md with new fields and parent-child patterns
  - Created migration 008: Add instructor fields to sections table
  - Updated DECISIONS.md with two new decisions:
    - "Teacher Assignment on Parent-Child Sections"
    - "Instructor Display for College Classes"
  - Updated ARCHITECTURE.md with admin UI workflows and teacher UI patterns
  - Updated STATUS.md with new phases and action items
  - Finalized bulk linking UI pattern (both detail page and sections list)
  - Default `show_assigned_teacher = false` for child sections
  - Student UI logic for showing/hiding teachers based on section settings

- [x] **Teacher Attendance Saving - COMPLETE**
  - Created `saveAttendance()` server action with full functionality
  - Upsert logic for creating/updating attendance records
  - Deletion support for unmarking students
  - Teacher notes field fully functional
  - Batch updates for multiple students
  - Teacher assignment verification
  - Error handling and user feedback
  - Integration with AttendanceModal component
  - Committed changes with focused commit message

## ✅ Completed Recently (2026-01-26)

- [x] **Bulk Section Editing (Admin) - COMPLETE**
  - Checkbox selection on sections list (individual and select-all)
  - BulkActionsDropdown component with four actions:
    - Enable/Disable Attendance
    - Enable/Disable Presence
  - ConfirmationDialog component (reusable for future features)
  - Server action `bulkUpdateSections()` using admin client to bypass RLS
  - Success toast notification with count of updated sections
  - Selected rows highlighted in blue
  - Auto-reload sections after bulk update
  - Selection auto-clears after successful update
  - Migration 007: Recreated sections_with_enrollment_counts view to include feature toggle columns
  - Fixed internship opportunities query (company_name → organization_name, position_title → name)

- [x] **Admin Section Form - Feature Toggles & Internship Integration**
  - Added feature toggle checkboxes: attendance_enabled, presence_enabled, presence_mood_enabled
  - Added internship opportunity dropdown (internship sections only)
  - Auto-populates location and geofence_radius from selected opportunity
  - Added geofence_radius field (internship sections only)
  - Updated SectionFormData type with new fields
  - Updated createSection() and updateSection() actions to save new fields
  - Added getInternshipOpportunities() server action
  - Mood emoji toggle automatically disabled unless presence is enabled
  - Form properly preserves feature toggle defaults in "Save & Add Another" workflow
  - All fields properly loaded when editing existing sections

- [x] **Teacher UI Foundation - Agenda & Attendance Modal**
  - Teacher layout and sidebar with green accent theme
  - Sign out functionality added to both admin and teacher sidebars
  - Teacher agenda page with working date navigation (Previous/Next/Today)
  - Server action `getTeacherAgenda()` fetches sections for selected date
  - Handles schedule patterns (every_day, specific_days, a_days, b_days)
  - Section cards display with visual indicators for presence, check-ins, attendance completion
  - Modal-based attendance interface (cleaner than inline approach)
  - Expandable student rows (click arrow to see details)
  - Attendance marking buttons (Present/Absent/Excused) with toggle behavior
  - "Mark All Present" quick action button
  - Shows check-in times, location verification, prompt responses when expanded
  - Teacher comment textarea (placeholder for future functionality)
  - RLS policy created: Teachers can view user profiles for students in their sections
  - Migration 006: Added teacher view students policy
  - Placeholder save functionality (needs real server action next)

- [x] **Database Migration 005 - Attendance & Presence Features**
  - Added attendance_records table for teacher-marked attendance
  - Added presence interaction type to enum
  - Added feature toggles to sections (attendance_enabled, presence_enabled, presence_mood_enabled)
  - Created indexes for performance
  - Set up RLS policies for attendance_records

## ✅ Completed Recently (2026-01-25)

- [x] **Documentation Overhaul - Attendance & Presence Features**
  - DECISIONS.md: Added 6 new decisions (presence, teacher UI, attendance workflow, bulk editing, parent-child attendance)
  - DATABASE.md: Added attendance_records table, updated sections fields, new queries, new indexes
  - ARCHITECTURE.md: Updated system overview, teacher UI section, added profile pages section
  - Migration file created: 005_add_attendance_and_presence_features.sql
  - All documentation aligned with new direction

- [x] **Major Design Decisions Finalized**
  - Attendance as optional section-level feature (enabled/disabled per section)
  - Presence waves stored as interaction type (no separate table)
  - Teacher UI: Agenda-first with expandable rows for attendance marking
  - Teacher Sections page: Overview list for "what sections do I teach" workflow
  - Profile pages: Role-agnostic routes at `/profile/[id]` with search access
  - Parent sections: Attendance saved to children, aggregated for teacher display
  - Bulk section editing for feature toggles
  - Attendance workflow: Null default, completion indicators, expandable details

- [x] **Schema Update - Parent-Child Section Relationship** (2026-01-23)
  - Added `parent_section_id` foreign key to sections table
  - Enables grouping student sections under teacher supervision sections
  - Supports "Hub Monitor" workflow where teacher supervises multiple sections simultaneously
  - Migration file created: 004_add_parent_section_relationship.sql
  - TypeScript types updated
  - Documentation updated (DATABASE.md, DECISIONS.md)

- [x] **Admin UI - Internships (Leaflet Integration)** (2026-01-23)
  - Location search with debounced geocoding
  - Interactive map display with markers
  - Visual geofence radius on map

- [x] **Admin UI - Internships Management** (2026-01-23)
  - Internships list page with search and status filters
  - Create/edit internship form with "Save & Add Another" workflow
  - Server actions for CRUD operations on internship_opportunities
  - Mentor assignment dropdown
  - Contact information and requirements fields
  - Available slots tracking
  - Active/inactive status management
  - "Internships Created This Session" sidebar
  - Delete with validation (prevents deletion if sections exist)

- [x] **Admin UI - Calendar Management** (2026-01-23)
  - Calendar grid view - displays A/B days in blue/green and days off in red
  - Click day to add day off (requires confirmation)
  - A/B day setup - CSV import with date, day_type
  - Mark school days (marked A, B, off in CSV)

- [x] **Performance Optimization - Phase 1-4** (2026-01-22)
  - Fixed N+1 query in getSections() using database view
  - Converted sections page to server component pattern
  - Optimized admin layout with parallel queries
  - Converted users page to server component pattern
  - Result: Eliminated loading delays, instant page loads with data

- [x] **Section Detail Page - Enrollment Display** (2026-01-21)
  - Display list of enrolled students with name, email, enrollment date
  - Unenroll functionality with confirmation dialog
  - Standalone enrollment modal for quick student additions
  - Reusable StudentSelector component for multi-select UI
  - EnrollmentModal component for enrollment workflow
  - SectionFormModal refactored to use StudentSelector
  - Server actions: getEnrolledStudents, enrollStudents, unenrollStudent

- [x] **Admin UI - Student Enrollment** (2026-01-20)
  - Student enrollment integrated into section form modal
  - Collapsible enrollment section (collapsed by default in create, expanded in edit)
  - Multi-select student list with search/filter
  - "Save & Add Another" works with enrollment
  - Shows enrollment count in modal sidebar
  - Server actions for enrolling/unenrolling students
  - Handles reactivation of previously unenrolled students
  - Clear button for "Created This Session" list

- [x] **Admin UI - Users Management** (2026-01-20)
  - Users list page with search and role filters
  - Create user form with "Save & Add Another" workflow
  - Edit user and manage multiple roles
  - Password reset functionality (email setup pending)
  - Delete user functionality with confirmation
  - Server actions for all CRUD operations
  - Admin client with service role key for privileged operations
  - "Users Created This Session" list in modal sidebar
  - Multi-role support with auto-checking of primary role
  - Works with database trigger that auto-creates user profiles
  - Cleaned up table layout (removed redundant "All Roles" column)

- [x] **Admin UI - Sections Management** (2026-01-20)
  - Sections list page with search and type filters
  - Smart create section form with "Save & Add Another" workflow
  - Section detail page showing schedule, teacher, location info
  - Edit section via modal (reusable SectionFormModal component)
  - Server actions for CRUD operations on sections
  - View/Edit buttons wired up with proper navigation
  - "Sections Created This Session" list displayed in modal sidebar

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
- CSV import for bulk user creation (deferred to V2)
- Mentor accounts with app access (deferred to V2)
- Emoji reactions to student posts (deferred to V2)
- Social feed / sharing workflow (deferred to V2)

---

## 📝 Notes

### Build Phases
- Admin UI: ✅ Complete (Sections → Users → Enrollment → Calendar → Internships)
- Documentation: ✅ Complete (Major design decisions finalized 2026-01-25)
- Teacher UI: 📋 Next (Agenda → Sections → Attendance → Profile/Search → Presence)
- Student UI: 🔮 Future (Presence waves, improved check-in flow)

### Key Patterns Established
- Smart forms with "Save & Add Another" for bulk data entry
- Server component pattern for instant data loading
- Database views for N+1 query prevention
- Reusable modal components (SectionFormModal, UserFormModal)
- Multi-role support from V1
- Feature toggles at section level (attendance, presence)
- Parent-child section relationships for supervision groups

### Technical Notes
- Admin operations require SUPABASE_SERVICE_ROLE_KEY
- Bulk operations use admin client to bypass RLS policies
- Database trigger auto-creates user profiles
- Modal overlay at 20% opacity for visibility
- Performance optimized with parallel queries
- Database views must be recreated when underlying table columns change

### Product Direction
- Attendance features are optional per section (gradual adoption)
- Presence waves add lightweight engagement without requirements
- Teacher workflow optimized for speed (agenda-first, expandable details)
- Parent sections aggregate children for unified teacher view
- Profile pages accessible via search (not directory browsing)
- All decisions documented in DECISIONS.md with rationale
