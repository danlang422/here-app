# Admin UI Planning

**Status:** In Progress  
**Created:** 2026-01-14  
**Delete when:** Admin UI is complete and documented in CHANGELOG

---

## Navigation Structure

### Admin Nav Items
- **Dashboard** - Overview/stats (future)
- **Sections** - Section management (CRUD + smart form)
- **City View** - People directory/lookup (uses org name dynamically)
- **Calendar** - Calendar day management (A/B days, school days)
- **Users** - Account management (create/edit/roles/passwords)

### Key Distinction
- **Users** = Account management (CRUD operations, roles, passwords)
- **City View** = People lookup/profiles (view schedules, info, check-ins)

### Organization Name in Nav
- Nav item uses dynamic organization name (not hardcoded "City View")
- Fetched from `organizations` table
- Falls back to "School" if no org found

---

## Sections Management

### Build Priority: Phase 1

#### 1. Sections List Page (`/admin/sections`)
**Purpose:** View all sections, navigate to detail/edit/create

**Features:**
- Table/list of all sections
- Columns: Name, Type, Time, Days, Teacher(s), Enrolled Count
- Filter by type (in_person, remote, internship)
- Search by name
- "Create Section" button (prominent)

#### 2. Create Section Form (`/admin/sections/create`)
**Purpose:** Smart form for rapid section creation

**Form Fields:**
- Section Name (required)
- Type: dropdown (in_person, remote, internship)
- Start Time: time picker (required)
- End Time: time picker (required)
- Schedule Pattern: radio buttons
  - Every Day
  - Specific Days (shows day checkboxes: M T W Th F)
  - A Days
  - B Days
- Teacher: searchable dropdown (users with teacher role)
- Location: text input (optional)
- SIS Block: number input (optional)

**Smart Form Behavior:**
- Primary button: "Save & Add Another" (keeps form open)
- Secondary button: "Save & Done" (returns to list)
- After first save, shows "Sections Created This Session" list below form
- List shows: Name, Time, Days, Teacher
- Form clears after each save (ready for next entry)
- Can add 10-20 sections in one flow without navigating away

**Why This Design:**
- Optimized for bulk entry (~20 in-person classes)
- Faster than creating sections one-by-one with redirects
- No CSV parsing complexity
- Visual confirmation of what's been created

#### 3. Section Detail Page (`/admin/sections/[id]`)
**Purpose:** View section details and manage enrollment

**Displays:**
- Section info (name, type, times, teacher, location)
- Schedule pattern and days
- List of enrolled students (with remove option)

**Actions:**
- Edit section button
- Delete section button (blocked if students enrolled, or shows warning)
- "Enroll Students" button → Opens multi-select modal
  - Search/filter students
  - Checkboxes to select multiple
  - "Enroll Selected" button

#### 4. Edit Section Form (`/admin/sections/[id]/edit`)
**Purpose:** Modify existing section

**Features:**
- Same form as create
- Pre-populated with current values
- "Save Changes" button
- "Cancel" returns to detail page
- Warning if changing times affects enrolled students

---

## City View (People Directory)

### Build Priority: Phase 2

#### URL Structure
- `/admin/city-view` - All people
- `/admin/city-view?role=student` - Students only
- `/admin/city-view?role=teacher` - Teachers only
- `/admin/city-view?role=mentor` - Mentors only

#### City View List Page (`/admin/city-view`)
**Purpose:** Browse and search people in the organization

**Layout:**
- Tabs at top: [All] [Students] [Teachers] [Mentors]
- Search bar: "Search by name or email"
- Results: Cards or table with:
  - Name
  - Email
  - Primary Role
  - Quick link to profile

**Interaction:**
- Click person → Navigate to profile page
- Tabs filter by role (same component, different query)

#### Profile Page (`/admin/city-view/[userId]`)
**Purpose:** View person's information and manage their schedule

**Dynamic Tabs Based on Role:**

**Student Profile:**
- **Schedule tab** (default)
  - Timeline view of enrolled sections
  - Sorted by time
  - Shows gaps visually
  - "Add Section" button (see Schedule Builder below)
- **Check-ins tab**
  - History of check-in/out events
  - Responses to prompts
  - Teacher comments
- **Info tab**
  - Contact info
  - Roles
  - Account details

**Teacher Profile:**
- **Schedule tab** (default)
  - Sections they're teaching
  - Sorted by time
  - Shows gaps in their schedule
- **Students tab**
  - All students in their sections
  - Quick links to student profiles
- **Info tab**
  - Contact info
  - Roles

**Admin/Mentor Profile:**
- **Info tab** only (for now)

#### Schedule Builder (within Profile Schedule Tab)
**Purpose:** Add sections to a student's schedule

**Interface: List View with Time Filter (V1)**

**Current Schedule:**
- List of enrolled sections, sorted by time
- Each section shows: Name, Time, Type
- "Remove" button on each (with confirmation)

**Add Section:**
- "Add Section" button at bottom
- Opens form/modal with:
  - **Time Filter** (optional but helpful):
    - From: [time picker]
    - To: [time picker]
    - Days: [M] [T] [W] [Th] [F] checkboxes
    - "Search Sections" button
  - **Search Results:**
    - Shows existing sections matching time criteria
    - Shows section name, teacher, type
    - "Enroll" button on each
  - **Create New Section:**
    - "Can't find what you need? Create new section" link
    - Opens create section form
    - Pre-fills student enrollment
    - Pre-fills time range if filter was used

**Time Conflict Detection:**
- When adding section, check for overlaps
- Show warning if conflict exists
- Allow override (sometimes intentional)

---

## Users Management

### Build Priority: Phase 3

#### Users List Page (`/admin/users`)
**Purpose:** Account management (CRUD)

**Features:**
- List all user accounts
- Columns: Name, Email, Roles, Status, Last Login
- Filter by role
- Search by name/email

**Actions per user:**
- Edit (change name, email)
- Manage Roles (add/remove role assignments)
- Reset Password (send reset email)
- Deactivate Account

#### Create User Form (`/admin/users/create`)
**Form Fields:**
- Email (required)
- First Name
- Last Name
- Phone (optional)
- Primary Role (dropdown)
- Additional Roles (checkboxes)
- Send welcome email? (checkbox)

**Password Handling:**
- Either auto-generate and email
- Or send signup link
- No password input on create (security best practice)

---

## Calendar Management

### Build Priority: Phase 4

#### Calendar Page (`/admin/calendar`)
**Purpose:** Manage school calendar, A/B days

**Features:**
- Calendar grid view (month view)
- Color coding:
  - Green: School day (regular)
  - Blue: A day
  - Purple: B day
  - Gray: Not a school day
- Click date to edit:
  - Toggle school day on/off
  - Set A/B designation
  - Add notes (e.g., "Spring Break")

**Bulk Operations:**
- "Mark range as school days"
- "Set A/B pattern" (ABABAB...)
- "Import from CSV" (date, is_school_day, ab_designation, notes)

---

## Build Order Summary

### Phase 1: Sections (Current Focus)
1. Admin layout and nav
2. Sections list page
3. Smart create section form
4. Section detail page
5. Edit section form
6. Enroll students (multi-select)

### Phase 2: City View (People & Schedules)
7. City View list page (with role tabs)
8. Profile page component (role-aware)
9. Schedule builder (student profile)
10. Teacher schedule view

### Phase 3: Users
11. Users list page
12. Create user form
13. Edit user / manage roles

### Phase 4: Calendar
14. Calendar grid view
15. Edit calendar days
16. A/B day management

---

## Design Notes

### Time Input
- Use time pickers (dropdowns or native input type="time")
- 12-hour format with AM/PM (matches user preference)
- Store as TIME in database (24-hour)

### Form Validation
- Client-side validation for immediate feedback
- Server-side validation in actions
- Clear error messages

### Confirmation Modals
- Deleting section (especially if students enrolled)
- Removing student from section
- Deactivating user account

### Success Feedback
- Toast notifications for successful actions
- "Sections created" list for smart form
- Visual confirmation after enrollments

---

## Open Questions

1. **Dashboard content** - What stats/overview should show?
   - Total sections, students, teachers?
   - Recent check-ins?
   - Upcoming events?
   - Defer to later?

2. **Teacher self-service** - Should teachers be able to:
   - View their own schedule? (Yes, probably)
   - Edit their sections? (No for V1, admin only)
   - View their students? (Yes, read-only)

3. **Notification preferences** - When/how do we notify:
   - Teachers about new students?
   - Students about schedule changes?
   - Defer to V2?

---

## Technical Notes

### Component Reusability
- Section form: Used for both create and edit
- Profile page: Single component, role-aware rendering
- Time filter: Reusable component for schedule builder

### Data Loading Patterns
- Server components for initial page loads
- Client components for interactive forms
- Optimistic updates for better UX

### RLS Policies
- Admins can do everything
- Teachers can view their sections and students
- Students can view their own schedule
- Already implemented in database

---

**Next Steps:** Start with Phase 1 - Admin layout and sections list page
