# Admin UI Planning

**Status:** Partially Complete - Sections done, Users next  
**Created:** 2026-01-14  
**Last Updated:** 2026-01-20  
**Delete when:** Admin UI is complete and documented in CHANGELOG

---

## Navigation Structure

### Admin Nav Items
- **Dashboard** - Overview/stats (future)
- **Sections** - Section management (CRUD + smart form) ✅ COMPLETE
- **Users** - Account management (create/edit/roles/passwords) 🔨 IN PROGRESS
- **Calendar** - Calendar day management (A/B days, school days) 📋 PLANNED

### Notes on Deferred Features
- **City View / People Directory** - Deferred to Teacher UI phase
- **Profile Pages** - Deferred to Teacher UI phase (role-aware tabs)
- **Schedule Builder** - Will be built with enrollment management

---

## ✅ Sections Management (COMPLETE)

### 1. Sections List Page (`/admin/sections`) ✅
**Status:** Complete

**Implemented Features:**
- Table view of all sections with sortable columns
- Columns: Name, Type, Time, Schedule Pattern, Teacher, Enrolled Count
- Filter by type (in_person, remote, internship)
- Search by name and teacher
- "Create Section" button opens modal
- View/Edit buttons for each section
- "Sections Created This Session" list shown on page after bulk creation

**Technical Implementation:**
- Client component using getSections() server action
- Real-time filtering and search
- Navigation via Next.js router

### 2. Section Form Modal (Reusable Component) ✅
**Component:** `/components/admin/SectionFormModal.tsx`  
**Status:** Complete

**Features:**
- Works in both create and edit modes
- Form fields: name, type, times, schedule pattern, days, teacher, location, SIS block
- "Save & Add Another" for bulk entry (create mode only)
- "Save & Done" to close modal
- "Sections Created This Session" displayed in right sidebar during bulk creation
- Pre-populates data in edit mode
- Light overlay (20% opacity) for better visibility

**Smart Form Behavior:**
- Form clears after "Save & Add Another" but retains defaults (type, times, pattern)
- Shows created sections in modal sidebar with formatted details
- Teacher dropdown populated from database
- Days selector appears only for "specific_days" pattern

### 3. Section Detail Page (`/admin/sections/[id]`) ✅
**Status:** Complete (enrollment management pending)

**Implemented Features:**
- Section header with name, type badge, enrollment count
- Three info cards: Schedule, Teacher, Location
- Back navigation to sections list
- Edit and Delete buttons in header
- Enrolled Students section (placeholder for enrollment feature)

**Pending:**
- Student enrollment modal/functionality
- Display list of enrolled students
- Remove student from section

### 4. Edit Section ✅
**Status:** Complete

**Implementation:**
- Reuses SectionFormModal in edit mode
- Accessible from both list page and detail page
- Pre-populates all section data
- Updates section and teacher assignment
- Reloads data after successful save

### 5. Server Actions ✅
**File:** `/app/admin/sections/actions.ts`  
**Status:** Complete

**Implemented Actions:**
- `createSection()` - Creates section and assigns teacher
- `updateSection()` - Updates section and reassigns teacher
- `getSection()` - Fetches single section with teacher info
- `getSections()` - Fetches all sections with teachers and enrollment counts
- `deleteSection()` - Deletes section (blocks if students enrolled)
- `getTeachers()` - Fetches all users with teacher role

---

## 🔨 Users Management (IN PROGRESS)

### Build Priority: Next Phase

#### Users List Page (`/admin/users`)
**Purpose:** Account management (CRUD)

**Features to Build:**
- List all user accounts
- Columns: Name, Email, Primary Role, Additional Roles, Status, Last Login
- Filter by role
- Search by name/email
- "Create User" button (opens modal)
- Edit/Delete actions per user

#### Create/Edit User Form (Modal)
**Purpose:** Smart form for rapid user creation

**Form Fields:**
- Email (required)
- First Name
- Last Name
- Phone (optional)
- Primary Role (dropdown: student, teacher, admin, mentor)
- Send welcome email? (checkbox)

**Smart Form Behavior:**
- "Save & Add Another" (keeps modal open)
- "Save & Done" (closes modal)
- Shows "Users Created This Session" list in sidebar
- Form clears after each save

**Password Handling:**
- New users created in Supabase auth.users
- Auto-generates password and sends welcome email
- Or sends signup link
- No password input on create form (security best practice)

#### Server Actions Needed:
- `createUser()` - Creates auth user and profile
- `updateUser()` - Updates user profile
- `getUsers()` - Lists all users with roles
- `getUser()` - Fetches single user
- `deleteUser()` - Deactivates or deletes user
- `updateUserRoles()` - Manages role assignments

---

## 📋 Calendar Management (PLANNED)

### Build Priority: Phase 4

#### Calendar Page (`/admin/calendar`)
**Purpose:** Manage school calendar, A/B days

**Features:**
- Calendar grid view (month view)
- Color coding for day types
- Click date to edit properties
- Bulk operations for ranges

**Deferred for now** - Focus on Users and Enrollment first

---

## 📋 Student Enrollment (PLANNED)

### Build Priority: After Users

Will be built as part of section detail page functionality.

**Features Needed:**
- Multi-select modal to choose students
- Search/filter students by name
- Checkboxes to select multiple
- "Enroll Selected" button
- Display enrolled students list on detail page
- Remove individual students

**Server Actions Needed:**
- `enrollStudents()` - Bulk enroll students in section
- `unenrollStudent()` - Remove student from section
- `getEnrolledStudents()` - Fetch students for a section
- `getAvailableStudents()` - Fetch students not in section

---

## Design Patterns Established

### Modal Pattern
- Reusable modal component for create/edit forms
- Light overlay (20% opacity) instead of dark
- Split layout: form on left, "created this session" on right
- Handles both modes via props (mode, sectionId)

### "Save & Add Another" Pattern
- Primary button for bulk entry workflows
- Form clears but retains sensible defaults
- Shows created items in sidebar for visual confirmation
- Works for creating 10-20+ items in one session

### Server Actions Pattern
- Separate actions.ts file per feature
- Type-safe with TypeScript
- Returns { success, data?, error? }
- Uses revalidatePath for cache invalidation
- Combines related operations (e.g., create section + assign teacher)

### Component Organization
- Server components for initial page loads
- Client components for interactive forms
- Reusable components in `/components/admin/`
- Page-specific logic in route pages

---

## Technical Notes

### Time Formatting
- Store as TIME (24-hour) in database
- Display as 12-hour with AM/PM
- Use native HTML time input

### Form Validation
- Client-side validation for immediate feedback
- Server-side validation in actions
- Clear error messages in red alert boxes

### Data Loading
- Initial load via server components (when possible)
- Client components call server actions
- Loading states displayed during operations

### Navigation
- Use Next.js router for page navigation
- Modals for create/edit to avoid full page transitions
- Back buttons use router.push() for clean navigation

---

## Open Questions

1. **Dashboard content** - What stats/overview should show?
   - Defer to later - not critical for V1

2. **Teacher self-service** - Build teacher views?
   - Defer to after admin basics complete
   - Will include: view own schedule, view student rosters

3. **Bulk import** - CSV upload for users?
   - Defer to V2
   - "Save & Add Another" sufficient for initial setup

---

**Current Status:** Sections complete, moving to Users management next. City View/Profile pages deferred to Teacher UI phase. Enrollment management will follow Users.
