# Here App - User Flows Documentation
**Date**: February 2026  
**Status**: Design complete, ready for implementation  
**Last Updated**: February 14, 2026 - Updated for status updates model

**Key Changes:**
- Replaced embedded plans/progress in check-ins with separate status_updates table
- Added universal Status Update flow with type selection (Plans/Progress/Reflection)
- Updated Presence flow to use presence_waves table with streak tracking
- Status updates can be added multiple times throughout session
- Teachers comment on specific status updates rather than general check-in

## Overview

This document describes detailed user workflows for the Here attendance tracking application. Each role (student, teacher, admin) has distinct needs and interactions with the system.

## Design Principles

1. **Mobile-first for students** - Quick check-ins, easy calendar viewing
2. **Efficiency for teachers** - Bulk actions, clear status indicators, minimal clicks
3. **Flexibility for admins** - Powerful tools without overwhelming complexity
4. **Progressive disclosure** - Show simple by default, reveal complexity when needed
5. **Real-time updates** - Changes visible immediately across all users

---

## Student User Flows

### Primary Goals
- Know where to be and when
- Check in/out for remote work
- Communicate plans and progress
- View attendance history

### Daily Schedule View

**Entry Point:** Student opens app

**Flow:**
1. Student sees today's date with rotation day badge (e.g., "Monday, Feb 17 - A Day")
2. Calendar shows current block highlighted, with all blocks for today
3. Each block displays:
   - Session/activity name (e.g., "Biology 2" or "Internship - City Hall")
   - Location
   - Teacher name
   - Time range (from schedule template)
   - Status indicator:
     - ✓ Checked in (green)
     - ⏰ Check-in available (blue)
     - 👋 Presence available (gray)
     - 📍 Requires geofence validation (orange pin icon)
     - No indicator if no interaction needed

**Schedule Conflicts:**
- If student has overlapping sessions (e.g., Advisory vs. Kennedy Band on B days):
  - Active session shown normally
  - Overridden session either hidden OR shown grayed out with reason
  - Student can toggle "Show all enrolled sessions" to see conflicts

**Date Navigation:**
- Default view: Today
- Arrow buttons to navigate: ← Previous day | Next day →
- Date picker for jumping to specific date
- Dates show:
  - Rotation day indicator (A/B)
  - Special schedule indicator (delay, early dismissal)
  - Holiday/no school (grayed out)

**Edge Cases:**
- No school day: Shows "No School - [reason]"
- Special schedule: Shows alert "2-Hour Delay Schedule" with adjusted times
- Weekend: Grayed out, no blocks shown

---

### Check-In Flow (Full Check-In)

**Trigger:** Student has activity with `requires_checkin = true` (internship, remote work)

**Entry Point:** Student taps block card with "Check In" button (available ~10 min before start)

**Flow:**

1. **Pre-Check-In Screen**
   - Activity name and location shown
   - If geofenced: "Location verification required"
   - Two buttons visible:
     - [Check In] (primary, disabled until within time window)
     - [💬 Status] (secondary, always available)

2. **Check-In Button Clicked**
   - Request location permission (if first time or geofenced)
   - If geofenced:
     - Validate student is within radius
     - Success: Green checkmark "Location verified"
     - Failure: Orange warning "You're outside the expected area. Check in anyway?"
   - Records check-in timestamp
   - Automatically opens Status Update modal (see Status Update Flow below)
   - Status type pre-selected to "Plans"

3. **Check-In Confirmation**
   - Success message: "Checked in at [time]"
   - Shows status update they submitted
   - Shows any previous teacher comments
   - Block card updates with check-in indicator

4. **During Session**
   - Block card shows:
     - ✓ "Checked in at 9:03 AM"
     - Most recent status updates (Plans/Progress)
     - Any teacher comments/reactions
   - Two buttons:
     - [Check Out] (primary, available during/after session)
     - [💬 Status] (secondary, can add more updates)

5. **Check-Out Prompt**
   - Notification at session end time: "Time to check out of [activity]"
   - Check-out available from end time until midnight
   - Block card shows [Check Out] button (primary)

6. **Check-Out Button Clicked**
   - Records check-out timestamp
   - Automatically opens Status Update modal (see Status Update Flow below)
   - Status type pre-selected to "Progress"
   - Student can change type if desired

7. **Check-Out Confirmation**
   - Success message: "Checked out at [time]"
   - Block card updates:
     - Shows check-in to check-out time range
     - Shows all status updates from session
     - Teacher comments (if any)
     - [Complete] indicator (grayed button)

**Edge Cases:**
- **Forgot to check in:** Button available until midnight, shows "Late Check-In"
- **Forgot to check out:** Reminder notification, can check out late
- **Multiple activities same block:** Separate check-in for each
- **Lost location access:** Warn but allow check-in, flag for teacher
- **Network failure:** Queue locally, sync when connection restored

---

### Status Update Flow (Universal)

**Trigger:** 
- Student clicks [💬 Status] button on any activity card
- OR automatically opens after Check In / Check Out

**Entry Point:** Status Update modal

**Flow:**

1. **Status Update Modal**
   ```
   ┌─────────────────────────────────────┐
   │ Add Status Update                    │
   ├─────────────────────────────────────┤
   │ Type:                               │
   │ ○ 📝 Plans                          │
   │ ○ 📊 Progress                       │
   │ ○ 💭 Reflection                     │
   │                                     │
   │ ┌─────────────────────────────────┐ │
   │ │ [Placeholder text based on type] │ │
   │ │                                 │ │
   │ │                                 │ │
   │ └─────────────────────────────────┘ │
   │ 0/500 characters                    │
   │                                     │
   │         [Cancel]  [Post Update]     │
   └─────────────────────────────────────┘
   ```

2. **Type Selection**
   - Three radio buttons:
     - 📝 **Plans** - What you're working on
     - 📊 **Progress** - What you accomplished  
     - 💭 **Reflection** - Thoughts, questions, observations
   - Selection determines placeholder text (see below)
   - Can change type even when pre-selected

3. **Context-Aware Placeholders**
   - **During check-in (Plans pre-selected):** "What are you planning to work on this session?"
   - **During check-out (Progress pre-selected):** "Share what you accomplished this session!"
   - **Standalone Plans:** "What are you planning to work on this session?"
   - **Standalone Progress:** "Share what you accomplished this session!"
   - **Standalone Reflection:** "Any thoughts, questions, or observations?"
   - **No type selected:** "What's on your mind?"

4. **Submit Status**
   - Student types update (required, 1-500 chars)
   - Clicks [Post Update]
   - Creates status_update record
   - If during check-in/out: Links to check-in via `related_checkin_id`

5. **Confirmation**
   - Brief success message
   - Modal closes
   - Block card updates showing new status
   - Teacher can see update immediately

**Multiple Updates Allowed:**
- Student can click [💬 Status] multiple times per session
- Each creates new status_update record
- Timeline shows all updates chronologically
- Examples:
  - 9:05 AM - Plans: "Working on data entry"
  - 9:45 AM - Progress: "Entered 15 permits so far"
  - 10:10 AM - Progress: "Finished 23 permits total"

---

### Presence Wave Flow

**Trigger:** Student has activity with `allows_presence_wave = true` (monitoring session, advisory)

**Entry Point:** Student taps block card with "👋 Say hey!" button

**Flow:**

1. **Pre-Wave Screen**
   - Activity name shown
   - Two buttons visible:
     - [👋 Say hey!] (primary, available ~10 min before session)
     - [💬 Status] (secondary, always available)
   - If student has streak: Shows "🔥 5 day streak - wave today to keep it!"

2. **Wave Button Clicked**
   - Records timestamp in presence_waves table
   - Brief animation/haptic feedback
   - Success message: "👋 Waved at [time]"
   - Streak updates: "🔥 6 day streak!"

3. **After Wave**
   - [👋 Say hey!] button becomes disabled/grayed
   - Shows "Waved at 9:05 AM"
   - [💬 Status] button remains active
   - Block card shows:
     - 👋 "Here at 9:05 AM"
     - 🔥 "6 day streak"
     - Any status updates (if added)
   - Can tap to view details/teacher comments

4. **Adding Status Updates (Optional)**
   - Student can click [💬 Status] anytime
   - Opens Status Update modal (see above)
   - Not required, but encouraged
   - Shows timeline if multiple updates

**Streak Display:**
- Always shows current streak if > 0
- Before wave: "5 day streak - wave today!"
- After wave: "6 day streak!"
- Resets if student misses a school day
- Calculates based on consecutive school days (not calendar days)

**Availability:**
- Button enabled ~10 min before session
- Stays enabled all day (student can wave anytime)
- Can only wave once per day per activity
- After wave: Button disabled for that activity/day

**Edge Cases:**
- **Student waves very early:** Allowed, counts for the day
- **Student waves very late:** Allowed until midnight, counts for the day
- **Missed yesterday:** Streak shows 0, starts new streak at 1
- **Weekend/holiday:** Doesn't break streak (only counts school days)
- **Teacher comments on wave:** Student receives notification

---

### Viewing Attendance History

**Entry Point:** Student taps "Attendance" in navigation menu

**Flow:**

1. **Attendance Overview**
   - Current term shown at top
   - Summary stats:
     - Total days: 98
     - Present: 94
     - Absent: 2
     - Excused: 2
     - Tardy: 0
   - Filter options:
     - Date range picker
     - Session filter (dropdown: "All sessions" or specific session)
     - Status filter (checkboxes: Present, Absent, Excused, Tardy)

2. **Attendance List**
   - Grouped by week
   - Each entry shows:
     - Date and day of week
     - Session name
     - Status badge (colored: green=present, red=absent, yellow=excused, orange=tardy)
     - Teacher notes (if any)
   - Tap entry to see details

3. **Attendance Detail View**
   - Full information:
     - Date, session, teacher
     - Status
     - Time marked
     - Teacher notes
     - Related check-in (if exists) with plans/progress
   - "Question about this?" button → creates message to teacher/admin

**Edge Cases:**
- **No attendance records:** Shows "No attendance records for this period"
- **Disputed attendance:** Can add note/question for teacher review
- **Export option:** "Share attendance report" → PDF or CSV

---

### Managing Schedule Conflicts

**Entry Point:** Student sees conflict indicator on calendar

**Flow:**

1. **Conflict Notification**
   - Banner on daily view: "You have overlapping sessions in Block 2 on B days"
   - "Resolve Conflict" button

2. **Conflict Resolution Screen**
   - Shows both conflicting sessions:
     ```
     Block 2 - Tuesday (B Day)
     
     ⚠️ CONFLICT
     
     Session 1: Advisory
     - Teacher: Ms. Johnson
     - Location: Room 103
     - Type: On-campus
     
     Session 2: Kennedy Band
     - Teacher: Mr. Smith (Kennedy HS)
     - Location: Kennedy High School
     - Type: Off-campus
     ```
   
3. **Resolution Options**
   - Radio buttons:
     - ○ Attend Advisory (hide Kennedy Band on B days)
     - ○ Attend Kennedy Band (hide Advisory on B days)
     - ○ I'll choose each day (no automatic override)
   - Text field: "Reason" (optional, helps teacher understand)
   - "Save Preference" button

4. **Confirmation**
   - "Conflict resolved! Kennedy Band will show on B days."
   - Calendar updates immediately
   - Teacher sees updated roster

5. **One-Time Override**
   - On a specific day, student can tap hidden session
   - "Show this session today" option
   - Creates temporary override

**Edge Cases:**
- **Admin already set priority:** Shows "Default: Kennedy Band takes priority. Change?"
- **Multiple conflicts:** Handle one at a time
- **Mid-semester change:** Can update preference anytime

---

### Notifications

**Types of notifications students receive:**

1. **Teacher Comment**
   - "Ms. Johnson commented on your check-in"
   - Tap to view comment and respond

2. **Check-Out Reminder**
   - "Don't forget to check out of your internship" (15 min after session end)

3. **Schedule Change**
   - "Tomorrow's schedule has changed to 2-Hour Delay"
   - Shows updated times

4. **Attendance Marked**
   - "Ms. Johnson marked you present in Biology 2"
   - Tap to view details

**Notification Center:**
- Badge count on bell icon
- List view showing all notifications (newest first)
- Mark as read
- Filter by type
- Clear all read notifications

---

## Teacher User Flows

### Primary Goals
- Take attendance quickly and accurately
- Monitor student check-ins and progress
- Communicate with students about their work
- Identify students who need support

### Daily Session Overview

**Entry Point:** Teacher opens app

**Flow:**

1. **Today's Sessions Dashboard**
   - Current date with rotation day
   - List of teacher's sessions for today (chronological)
   - Each session card shows:
     - Block number and time
     - Session name
     - Location
     - Student count: "23 enrolled, 3 off-campus today"
     - Quick status:
       - "18 present" (green)
       - "2 absent" (red)  
       - "3 not marked" (gray)
     - If monitoring session:
       - "5 checked in" / "8 expected to check in"
   
2. **Current/Next Session Highlight**
   - Current block shown with blue border
   - "Take Attendance" button (prominent)
   - Next session shown below with countdown: "Next: Block 3 in 25 minutes"

3. **Quick Actions**
   - "View All Sessions" (shows full schedule)
   - "Attendance History" 
   - "Messages" (unread count badge)

**Edge Cases:**
- **No sessions today:** Shows "No sessions scheduled for today"
- **Special schedule:** Banner shows "2-Hour Delay Schedule"
- **Session canceled:** Grayed out with "Canceled" badge

---

### Standard Class Attendance

**Trigger:** Teacher teaches standard class (Biology, English, etc.)

**Entry Point:** Teacher taps "Take Attendance" on session card

**Flow:**

1. **Attendance Roster**
   - Session name and block at top
   - Date with rotation day
   - Full student list (alphabetical by last name)
   - Each student row shows:
     - Name (last, first)
     - Profile photo (optional)
     - Attendance status buttons (large, tappable):
       - [P] Present (default)
       - [A] Absent
       - [E] Excused
       - [T] Tardy
     - Notes icon (if teacher previously added notes)
   
2. **Bulk Actions Bar** (sticky at top)
   - "Mark All Present" button
   - "Mark All Absent" button
   - Student count: "0 of 23 marked"
   
3. **Individual Marking**
   - Tap status button → immediately saves, shows checkmark animation
   - Tap again to change status
   - Default state: All "Present" (can change in settings)
   
4. **Adding Notes**
   - Tap student name → expands row
   - Text field appears: "Add note..."
   - Save automatically on blur
   - Examples: "Arrived 10 min late", "Left early for appointment"

5. **Review & Submit**
   - Once all marked, "Complete Attendance" button appears
   - Shows summary: "23 present, 0 absent, 0 excused, 0 tardy"
   - Tap to submit → Success message
   - Can edit after submission (updates attendance record)

**Edge Cases:**
- **Student not in roster:** "Add Student" button → search and add
- **Student left mid-class:** Can change from Present to Absent with note
- **Forgot to take attendance:** Can do it later, shows "Late Attendance" tag
- **Network offline:** Queues locally, syncs when online

---

### Monitoring Session Attendance

**Trigger:** Teacher supervises monitoring session (Hub Monitor, Advisory with mixed activities)

**Entry Point:** Teacher taps session card

**Flow:**

1. **Monitoring Session Dashboard**
   - Session name, block, date
   - **View Toggle** (prominent, at top):
     - 🔲 Grouped by Activity
     - ☐ Full Roster (alphabetical)
   
2. **Grouped View** (default)
   - Students organized by what they're doing
   - Collapsible sections:
     ```
     ▼ Independent Study (5 students)
       ✓ Anderson, Tom - Checked in 9:05 AM
       ✓ Chen, Maria - Checked in 9:03 AM
       ○ Davis, John - Not checked in
       ...
     
     ▼ Physics Online (3 students)  
       ✓ Brown, Sarah - Checked in 9:04 AM
       ...
     
     ▼ Internship - City Hall (2 students)
       ✓ Garcia, Luis - Checked in 9:00 AM ✓ Location verified
       ⚠ Wilson, Emma - Checked in 9:05 AM ⚠ Outside geofence
     
     ⊘ Off-Campus Today (3 students)
       ⊘ Johnson, Allison - Kennedy Band
       ⊘ Martinez, Carlos - Kirkwood English
       ...
     ```
   
3. **Student Detail View**
   - Tap student name → expands
   - Shows:
     - Activity details
     - Check-in time (if applicable)
     - Plans text (if provided)
     - Location status (if geofenced)
     - Previous teacher comments
   - Actions:
     - Mark attendance (P/A/E/T)
     - Add comment
     - React with emoji (👍 👏 ✨)

4. **Full Roster View** (alphabetical)
   - All enrolled students listed A-Z
   - Activity shown inline after name:
     ```
     Anderson, Tom - Independent Study ✓ Checked in
     Brown, Sarah - Physics Online ✓ Checked in
     Johnson, Allison - Kennedy Band (Off-campus)
     ```
   - Can mark attendance for all students

5. **Check-In Monitoring**
   - Real-time updates as students check in
   - Notification sound/badge when student checks in late
   - Geofence warnings highlighted in orange
   - Can tap to view student's plans

6. **Bulk Attendance**
   - "Mark All Present" applies to currently visible students
   - If grouped view: Can mark entire group
     - "Mark all Independent Study students present"
   - Off-campus students excluded from bulk actions

7. **Teacher Comments & Interactions**
   - Tap student → see check-in details
   - "Add Comment" button
   - Text field with common responses:
     - Quick picks: "Great plan!", "Be more specific", "Check in with me"
     - Or custom text
   - Or tap emoji reaction: 👍 👏 ✨ 💯
   - Student receives notification

**Edge Cases:**
- **Student doing multiple activities:** Choose primary for grouping, note secondary
- **Student forgot to check in:** Teacher can add note "Saw student working"
- **Geofence failure legit:** Teacher can dismiss warning, add note
- **Student switches activities mid-session:** Update student_activity, roster refreshes

---

### Viewing Attendance History

**Entry Point:** Teacher taps "Attendance History" from menu

**Flow:**

1. **Attendance Overview**
   - Filter bar:
     - Session dropdown (all sessions or specific)
     - Date range picker
     - Student search
   - Summary stats for selected period/session:
     - Total attendance records
     - Percentage present
     - Absences, tardies

2. **Student List View**
   - Shows all students for selected session(s)
   - Each student card:
     - Name
     - Attendance summary: "45/48 present (93%)"
     - Red flag if < 90% attendance
     - "View Details" button

3. **Individual Student Attendance**
   - Calendar view showing all days
   - Color coding:
     - Green = Present
     - Red = Absent
     - Yellow = Excused
     - Orange = Tardy
   - Tap date → see details and notes
   - "Message Student" or "Message Advisor" button

4. **Export Options**
   - "Export to CSV" (for spreadsheet)
   - "Print Report" (PDF)
   - Date range selection
   - Can export for single student or whole session

**Edge Cases:**
- **No attendance yet:** Shows "No attendance records"
- **Partial period:** Calculates percentage based on school days so far
- **Student transferred mid-term:** Shows date range they were enrolled

---

### Status Update Review & Feedback

**Entry Point:** Teacher receives notification "Luis posted a status update"

**Flow:**

1. **Status Update Notification**
   - Shows student name, activity, status type
   - Preview of content (first 50 chars)
   - Tap to view full details

2. **Student Activity Detail View**
   - Student info (name, activity, location)
   - Check-in/out times (if applicable)
   - Location status (if geofenced):
     - ✓ Location verified (green)
     - ⚠️ Outside expected area (orange) + map showing student pin
   
   - **Status Updates Timeline:**
     ```
     Status Updates (4):
     📝 12:13 PM - Plans: "Working on data entry for permits"
     📊 12:45 PM - Progress: "Entered 15 permits so far"
     📝 12:50 PM - Plans: "Also helping with filing"
     📊 1:10 PM - Progress: "Finished 23 permits, organized cabinet"
     ```
   
   - Previous teacher interactions shown under each status

3. **Teacher Response Options (Per Status Update)**
   - Tap any status update to expand actions:
   
   - **Quick Reactions:**
     - Emoji bar: 👍 👏 ✨ 💯 👀
     - Tap → sends immediately, student gets notification
     - Shows under that specific status update
   
   - **Add Comment:**
     - Text field
     - Suggested responses (customizable):
       - "Great work!"
       - "Tell me more about this"
       - "Excellent progress today"
       - "Can you be more specific?"
     - Or type custom
     - Send → student receives notification
     - Comment links to specific status update

4. **Geofence Issue Handling**
   - If student outside geofence:
     - See map with:
       - Expected location (blue circle)
       - Student's location (red pin)
       - Distance shown
     - Options:
       - "Dismiss Warning" (one-time, with note)
       - "Update Location" (if student is at correct alternate location)
       - "Message Student" (ask for clarification)

5. **Presence Wave Review**
   - When student waves presence:
     - Teacher sees notification
     - Can view wave timestamp and streak
     - Can react with emoji or comment
   - Wave shows in student timeline:
     ```
     👋 Waved at 9:05 AM 🔥 6 day streak
     ```

6. **Multiple Status Updates**
   - Timeline shows all updates chronologically
   - Teacher can see student's thought process evolve
   - Can comment on specific updates
   - Example view:
     ```
     📝 9:05 AM - Plans: "Reading chapter 5"
     👍 You reacted
     
     📝 10:15 AM - Plans: "Actually working on essay instead"
     💬 You: "Good choice, that's due tomorrow!"
     
     📊 10:35 AM - Progress: "Completed outline and intro"
     ```

**Edge Cases:**
- **Student never checked out:** Shows warning on activity detail, teacher can follow up
- **Late check-in:** Flagged in orange, teacher decides if acceptable
- **Vague status updates:** Teacher can request more detail via comment
- **No status updates:** If student checked in but didn't add status, teacher sees just timestamp
- **Student updates during different activity:** Updates linked to correct activity

---

### Roster Management

**Entry Point:** Teacher taps "Edit Roster" on session

**Flow:**

1. **Current Roster View**
   - All enrolled students listed
   - Shows:
     - Name
     - Grade level
     - Advisor
     - Days active (if subset of session days)
     - Off-campus overrides (if any)
   - "Add Student" button
   - Edit icon per student

2. **Add Student**
   - Search bar (name or ID)
   - Results show students not currently in session
   - Shows if student has conflict
   - Tap student → confirm enrollment
   - Option to set:
     - Days active (if not all session days)
     - Notes

3. **Edit Student Enrollment**
   - Change days active
   - Add/edit notes
   - View/edit off-campus overrides
   - "Remove from Session" button

4. **Bulk Add**
   - "Import from CSV" option
   - Or "Add Multiple Students"
     - Multi-select interface
     - Can filter by grade, advisor
     - Add all selected at once

**Edge Cases:**
- **Student has conflict:** Warning shown, can proceed anyway
- **Session full:** Warning if over capacity (soft limit)
- **Student removed mid-term:** Marked inactive, history preserved

---

## Admin User Flows

### Primary Goals
- Set up and maintain calendar
- Create and manage sessions
- Enroll students efficiently
- Handle schedule changes and conflicts
- Generate reports

### Initial System Setup

**Entry Point:** First-time admin login or new term setup

**Flow:**

1. **Organization Configuration**
   - Already exists for City View (done in initial setup)
   - Can edit settings:
     - Timezone
     - Rotation schedule enabled? (Yes for City View)
     - Rotation day names: ["A", "B"]
     - Rotation mode: "continue" or "repeat"

2. **Academic Term Creation**
   - "Create New Term" button
   - Form fields:
     - Term name (e.g., "Spring 2026")
     - Start date (date picker)
     - End date (date picker)
     - Mark as current? (checkbox)
   - Submit → creates term

3. **Schedule Template Setup**
   - "Create Schedule Template" button
   - Template name: "Regular Schedule"
   - Mark as default: Yes
   - Block definitions:
     ```
     Block 0: 7:30 AM - 9:00 AM
     Block 1: 9:05 AM - 9:50 AM
     Block 2: 9:55 AM - 10:40 AM
     Block 3: 10:45 AM - 11:30 AM
     [Lunch: 11:30 AM - 12:15 PM]
     Block 4: 12:15 PM - 1:15 PM
     Block 5: 1:20 PM - 2:20 PM
     ```
   - "Add Block" / "Remove Block" buttons
   - Save template

4. **Alternate Schedules**
   - Create additional templates:
     - "2-Hour Delay"
     - "Early Dismissal"
     - etc.
   - Copy from existing template and modify times

5. **Calendar Generation**
   - "Generate School Days" button
   - Selects term
   - System creates school_day record for each M-F date in term
   - Applies default schedule template to all
   - Shows success: "Generated 98 school days for Spring 2026"

6. **Mark Exceptions**
   - Calendar view of term
   - Select dates to mark as:
     - Holiday/Break (not school day)
     - Special schedule (choose template)
     - A or B rotation day
   - Can do individually or bulk select

**Edge Cases:**
- **Overlapping terms:** Warning if dates overlap
- **Multiple current terms:** Only one can be current, system enforces
- **Invalid block times:** Validation prevents overlapping times

---

### Activity Type & Internship Management

**Entry Point:** Admin taps "Activities" in menu

**Flow:**

1. **Activity Types Catalog**
   - Search bar
   - Filter by category: All | Classes | Internships | Independent Study | Monitoring
   - List view:
     ```
     Biology 2 (Class)
     Independent Study (Independent Study)
     Internship - City Hall (Internship)
     ...
     ```
   - "Add Activity Type" button

2. **Create Activity Type**
   - Form:
     - Name (required): "AP Physics"
     - Category dropdown: Class | Internship | Independent Study | Monitoring
     - Defaults:
       - Requires check-in? (checkbox)
       - Allows remote? (checkbox)
       - Requires geofence? (checkbox)
   - Save → added to catalog

3. **Bulk Import**
   - "Import from CSV" button
   - Template provided:
     ```
     name,category,requires_checkin,allows_remote,requires_geofence
     "Biology 2","class",false,false,false
     "Independent Study","independent_study",false,false,false
     ```
   - Upload CSV
   - Review/confirm
   - Import creates all activity types

4. **Internship Opportunities Catalog**
   - Separate tab: "Internship Opportunities"
   - List shows:
     ```
     Data Entry Assistant - Cedar Rapids City Hall
     5 slots available, 3 filled
     
     Marketing Intern - Local Nonprofit
     2 slots available, 0 filled
     ```
   - "Add Opportunity" button

5. **Create Internship Opportunity**
   - Form:
     - Position name: "Data Entry Assistant"
     - Organization: "Cedar Rapids City Hall"
     - Description (multiline)
     - Location:
       - Address (autocomplete)
       - OR Lat/Lng (advanced)
       - Geofence radius (meters): 100
     - Contact info:
       - Person
       - Email
       - Phone
     - Slots available: 5
   - Map preview shows geofence circle
   - Save

**Edge Cases:**
- **Duplicate activity names:** Allow but warn
- **Geofence too small:** Warn if < 50 meters
- **No location:** Can skip for remote internships

---

### Session Creation

**Entry Point:** Admin taps "Sessions" → "Create Session"

**Flow:**

1. **Basic Session Info**
   - Session name: "Biology 2, Block 1"
   - Teacher: Dropdown (all teachers)
   - Session type: Standard Class | Monitoring
   - Block: 0-5 (dropdown)
   - Days of week: M T W Th F (checkboxes, default all)
   - Location: "Room 208"

2. **Scheduling Details**
   - Academic term: Dropdown (defaults to current)
   - Start date: First day of term (or choose specific)
   - End date: Last day of term (or choose specific)
   - Default times: Auto-filled from block definition
     - Can override if needed
   
3. **Rotation Configuration**
   - Honors rotation schedule? (checkbox)
     - If yes: Which day? A | B (radio buttons)
     - Session only meets on selected rotation day
   - If no: Meets all scheduled days

4. **Review & Create**
   - Shows summary:
     ```
     Biology 2, Block 1
     Teacher: Ms. Smith
     Type: Standard Class
     Block 1 (9:05 AM - 9:50 AM)
     Days: M, W, F (A Days only)
     Term: Spring 2026
     Location: Room 208
     ```
   - "Create Session" button
   - Success → redirect to enrollment

**Edge Cases:**
- **Teacher has conflict:** Warning shown, can proceed anyway
- **Multiple sessions same block:** Allowed, common for monitoring
- **No room specified:** Warning but allowed

---

### Student Enrollment

**Entry Point:** After creating session OR from Sessions list → "Manage Enrollment"

**Flow:**

1. **Current Enrollment View**
   - Session details at top
   - Student list (if any enrolled)
   - "Add Students" button
   - "Import from CSV" button
   - "Copy from Another Session" button

2. **Add Students Individually**
   - Search student by name
   - Results show:
     - Student name
     - Grade
     - Advisor
     - Warning if schedule conflict
   - Select student(s)
   - Click "Enroll"

3. **Bulk Enrollment**
   - Filter students by:
     - Grade level
     - Advisor
     - Already in specific session
   - Multi-select
   - "Enroll All Selected"

4. **CSV Import**
   - Download template
   - Upload CSV with student IDs or emails
   - Preview enrollment
   - Confirm → bulk enroll

5. **Copy from Another Session**
   - Select source session
   - Shows roster
   - Can deselect students if needed
   - "Copy Selected"

6. **Configure Student-Specific Settings**
   - After enrollment, can click student to:
     - Set days active (subset of session days)
     - Add notes
     - Configure overrides (if conflicts)

**For Monitoring Sessions: Create Student Activities**

7. **Assign Activities to Students**
   - After enrollment, "Configure Activities" button appears
   - For each student:
     - Select activity type from catalog
     - Set configuration:
       - Location (if not in catalog)
       - Requires check-in?
       - Allows presence?
       - Conflict priority (0-10)
     - Save

8. **Bulk Activity Assignment**
   - Select multiple students
   - "Assign Activity" button
   - Choose activity type
   - Applies to all selected

**Edge Cases:**
- **Student already enrolled:** Warning, prevent duplicate
- **Enrollment creates conflict:** Show warning with details:
  ```
  Warning: Sarah is already in Physics Lab (Block 2, B Days)
  This session is Block 2, All Days
  Continue anyway? [Yes] [No, configure override]
  ```
- **Dropped student:** Mark enrollment inactive instead of deleting

---

### Managing Schedule Conflicts

**Entry Point:** Admin sees conflict report OR student/teacher requests help

**Flow:**

1. **Conflict Detection Dashboard**
   - "Schedule Conflicts" menu item
   - Shows all detected conflicts:
     ```
     Sarah Johnson - Block 2 Conflict
     - Biology Lab (M-F)
     - Physics Online (B Days)
     Priority: Physics Online
     
     Carlos Martinez - Block 3 Conflict
     - Advisory (M-F)  
     - Kirkwood English (Tue, Thu)
     Priority: Not Set ⚠️
     ```
   - Filter by:
     - Resolved / Unresolved
     - Student
     - Block

2. **Resolve Individual Conflict**
   - Click conflict → detail view
   - Shows both sessions side-by-side
   - Options:
     - **Set Activity Priority:**
       - Adjust conflict_priority on activities
       - Higher priority activity shows by default
     
     - **Create Enrollment Override:**
       - Choose enrollment to override
       - Select override type:
         - Rotation days
         - Days of week
         - Specific dates
       - Enter reason
       - Save
     
     - **Remove Enrollment:**
       - If conflict is error, can remove one enrollment
   
3. **Bulk Conflict Resolution**
   - For common patterns (e.g., all Kennedy Band students)
   - Select multiple similar conflicts
   - "Apply Same Rule to All"
   - Creates overrides for all selected

4. **Preview Student Calendar**
   - "Preview Calendar" button
   - Shows what student will see after resolution
   - Verify before saving

**Edge Cases:**
- **Three-way conflict:** Handle pairwise, may require manual schedule adjustment
- **Changing priority mid-term:** Warning about impact on existing overrides
- **Student-created override:** Admin can view/edit/delete

---

### Calendar Management

**Entry Point:** Admin taps "Calendar" in menu

**Flow:**

1. **Calendar Overview**
   - Month view of current term
   - Days color-coded:
     - Blue = Regular school day
     - Green = A Day
     - Orange = B Day  
     - Purple = Special schedule
     - Gray = No school
   - Tap day to edit

2. **Edit School Day**
   - Shows current settings:
     - Is school day? (toggle)
     - Schedule template: Dropdown
     - Rotation day: A | B | None
     - Override reason: Dropdown (weather, holiday, etc.)
     - Notes: Text field
   - Save changes

3. **Bulk Update**
   - Select date range
   - "Mark as A Days" or "Mark as B Days"
   - "Apply Special Schedule"
   - "Mark as No School"
   - Confirm → updates all in range

4. **Special Schedule Alert**
   - When changing to special schedule:
   - "Notify affected users?" checkbox
   - Creates notifications for students/teachers with sessions that day

5. **Rotation Pattern Setup**
   - "Configure Rotation Pattern" tool
   - Starting date
   - Pattern: A, B, A, B... (continues automatically)
   - Can skip dates (weekends, holidays)
   - Apply pattern to term

**Edge Cases:**
- **Day-of changes:** Warning about notifying users
- **Multiple schedule changes:** Batch notifications to avoid spam
- **Past dates:** Can edit but shows warning

---

### User Management

**Entry Point:** Admin taps "Users" in menu

**Flow:**

1. **User List**
   - Search bar
   - Filter by role: All | Students | Teachers | Admins
   - Table view:
     ```
     Name          Email              Roles           Grade  Status
     Sarah Johnson sjohnson@...       student         11     Active
     John Smith    jsmith@...         teacher, admin  -      Active
     ```
   - "Add User" button

2. **Create User**
   - Form:
     - Email (required)
     - First name
     - Last name
     - Preferred name
     - Roles (checkboxes): Student | Teacher | Admin | Mentor
     - If student:
       - Grade level
       - Advisor (dropdown)
     - Send invitation email? (checkbox)
   - Save → creates user, sends invite if selected

3. **Edit User**
   - Click user in list
   - Can update all fields
   - "Deactivate User" button (soft delete)
   - "Reset Password" button (sends email)

4. **Bulk Import**
   - "Import Users" button
   - CSV template:
     ```
     email,first_name,last_name,roles,grade_level,advisor_email
     sarah@...,"Sarah","Johnson","student","11",trevor@...
     ```
   - Upload, review, import

5. **Role Management**
   - Users can have multiple roles
   - Changing roles:
     - Warning if has active sessions/enrollments
     - Confirm change
   - Users see role switcher in app if multi-role

**Edge Cases:**
- **Email already exists:** Error, can't create duplicate
- **Removing admin role:** Require at least one admin in org
- **Deactivating user with active sessions:** Warning, proceed anyway

---

### Reporting & Analytics

**Entry Point:** Admin taps "Reports" in menu

**Flow:**

1. **Report Dashboard**
   - Quick stats:
     - Current attendance rate: 94%
     - Check-in compliance: 87%
     - Active sessions: 45
     - Total students: 121
   - Report categories:
     - Attendance Reports
     - Check-In Reports
     - Schedule Reports

2. **Attendance Report Builder**
   - Select parameters:
     - Date range
     - Session(s): All or specific
     - Student(s): All or specific
     - Include: Present | Absent | Excused | Tardy (checkboxes)
   - Format: Table | Summary | Charts
   - "Generate Report" button

3. **Report View**
   - Interactive table/chart
   - Export options:
     - Download CSV
     - Download PDF
     - Email to recipient
   - Save report template for reuse

4. **Check-In Compliance Report**
   - Shows which students/sessions have low check-in rates
   - Highlights geofence issues
   - Can drill down to individual students

5. **Schedule Conflict Report**
   - All current conflicts
   - Resolved vs. unresolved
   - Export for planning purposes

**Edge Cases:**
- **No data:** Shows "No records found for selected criteria"
- **Large reports:** Progress indicator, background generation
- **Scheduled reports:** Can set up weekly email delivery (future)

---

## Cross-Role Workflows

### Notification System

**How notifications work across all roles:**

1. **Creation**
   - Triggered by events (check-in, comment, schedule change)
   - Created in notifications table
   - Real-time push via Supabase realtime

2. **Delivery**
   - In-app: Badge count, notification center
   - Push notification: If enabled, mobile app
   - Email digest: Optional, daily summary

3. **Viewing**
   - Notification center (bell icon)
   - Badge shows unread count
   - List of notifications (newest first)
   - Tap notification → navigate to relevant view

4. **Management**
   - Mark as read (tap to view)
   - Mark all read (bulk action)
   - Delete notification
   - Notification settings:
     - Which types to receive
     - Delivery method (in-app, push, email)
     - Quiet hours

---

### Real-Time Updates

**How changes propagate to all users:**

1. **Student checks in**
   - Creates check_in record
   - Triggers notification to teacher
   - Teacher's roster updates in real-time (via Supabase subscription)
   - Shows green checkmark next to student name

2. **Teacher marks attendance**
   - Creates attendance_record
   - Student can see it immediately in attendance history
   - Admin reports update in real-time

3. **Admin changes schedule**
   - Updates school_day record
   - Creates notifications for affected students/teachers
   - Calendars refresh showing new schedule
   - Teachers see alert on session cards

4. **Technical Implementation**
   - Supabase realtime subscriptions on key tables
   - React Query for cache invalidation
   - Optimistic updates for perceived speed

---

## Navigation Structure

### Student App

```
Bottom Navigation:
- [📅] Today (default)
- [📋] Attendance
- [🔔] Notifications
- [⚙️] Settings

Today Screen:
- Date selector
- Block cards
- Quick access to check-in/presence

Attendance Screen:
- Summary stats
- History list
- Filters

Settings:
- Profile
- Notification preferences
- Help/Support
```

### Teacher App

```
Bottom Navigation:
- [📊] Dashboard (default)
- [📋] Sessions
- [💬] Messages
- [⚙️] Settings

Dashboard:
- Today's sessions
- Quick attendance
- Notifications

Sessions:
- All sessions list
- Attendance history
- Roster management

Messages:
- Check-in comments
- Student interactions
- Unread badge
```

### Admin App

```
Main Navigation (Sidebar):
- [📊] Dashboard
- [📅] Calendar
- [👥] Users
- [📚] Sessions
- [🎯] Activities
- [🏢] Internships
- [📈] Reports
- [⚙️] Settings

Each section has sub-navigation
Breadcrumbs for deep navigation
```

---

## Mobile Considerations

### Student Mobile App
- **Primary use case:** Check-ins on-the-go
- **Key features:**
  - Location access for geofencing
  - Camera for QR codes (future)
  - Push notifications
  - Offline support for viewing schedule

### Teacher Mobile App
- **Dual use:** Attendance on laptop, monitoring on mobile
- **Responsive design:**
  - Desktop: Full roster, multi-column
  - Mobile: Stacked cards, swipe actions

### PWA vs. Native
- **MVP:** Progressive Web App (PWA)
  - Single codebase
  - Installable on mobile
  - Push notifications (limited on iOS)
  - Location access
- **Future:** Native app if needed
  - Better location accuracy
  - Full push notification support
  - Offline-first architecture

---

## Error States & Edge Cases

### Network Issues
- **Offline mode:**
  - Show cached schedule
  - Queue check-ins locally
  - Sync when connection restored
  - Clear indicator of offline status

### Data Conflicts
- **Simultaneous edits:**
  - Last write wins (acceptable for attendance)
  - Show warning if editing old data
  - Refresh to see latest

### User Errors
- **Wrong check-in:**
  - No edit/delete (create new check-in note instead)
  - Teacher can override via attendance

- **Forgot password:**
  - Standard reset flow via email
  - Contact admin as backup

### System Errors
- **500 errors:**
  - Friendly message
  - Retry button
  - "Contact support" link

- **Validation errors:**
  - Inline field errors
  - Clear messaging
  - Prevent submission until fixed

---

## Success Metrics

### For Students
- Time to complete check-in: < 30 seconds
- Calendar load time: < 2 seconds
- Check-in completion rate: > 95%

### For Teachers
- Attendance time per session: < 2 minutes
- Monitoring view clarity: > 90% teacher satisfaction
- Real-time update lag: < 1 second

### For Admins
- Session creation time: < 5 minutes
- Enrollment bulk upload: < 10 minutes for 100 students
- Report generation: < 30 seconds

---

## Future Enhancements

### Phase 2 Features
- QR code check-ins
- Parent portal
- Student work submissions
- Automated attendance suggestions
- Advanced analytics dashboard

### Phase 3 Features
- Multi-school coordination
- District-level reporting
- Integration with external SIS
- Mobile native apps
- AI-powered insights

---

**End of User Flows Documentation**

*This document will be updated as features are implemented and user feedback is gathered.*
