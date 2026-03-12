# Session 12 — March 11, 2026

---

## 12.1 — Project Review and Direction Setting

Planning and spec session. No code changes.

### Status Review

Reviewed current project state. Calendar management was confirmed built (session 11.2) but STATUS.md had not been updated to reflect this. Updated this session.

Confirmed that the bulk of admin functionality is now in place and usable for real data entry:
- Auth, Activity Management, User Management, Enrollment Panel, Admin Dashboard/Agenda, Org Settings, Calendar Management all working
- Activity Panel (floating panel for dashboard) deferred — depends on agenda view fixes
- Agenda view filter/zoom bug still open (issue #3), block overlay not yet built — both deferred

### Strategic Pivot: Shifting to Student and Teacher Roles

Decision: the app is "done enough" on the admin side to support real data entry. Rather than polishing admin further, shift to building student and teacher role views. The data entry foundation exists; it's time to build other users' view of that data.

One small admin improvement flagged for near-term build (independent of the pivot): **"Save + Add New" button** on the activity form — clears the form but keeps it open for a new entry. Low effort, high payoff when entering many activities.

### Discussion: Student and Teacher Agenda Views

Extensive design discussion covering both views. Key decisions:

**Shared layout:** Both are today-first with `<` `>` date navigation. Same time-based grid as admin agenda. Block overlay strips as visual reference. Date state is local to each page (not Zustand).

**Student card design:**
- Staff display: `instructor_name` if set, else `teacher_id` last name, else omit
- Property icons (informational, not buttons): geolocation, freeform, attendance
- Action button: check-in/out (if `requires_checkin`) or presence wave (if `allows_presence_wave`) — placeholder for now
- Status updates button: always shown if instance exists — placeholder for now
- No card click interaction

**Teacher aggregate card:**
- Title: block label + stack icon (e.g. `FaLayerGroup`) — avoids the "what do we call this?" problem, keeps block label as the primary identifier
- Shows: activity count, student count, earliest start – latest end time range
- Aggregate card positioning already handled by existing `AgendaDayColumn` logic (earliestStart → latestEnd)

**Fuzzy edge time display:** Confirmed the admin agenda does NOT have time labels on aggregate cards — positioning is implied by grid location. Teacher agenda will show explicit time range labels on aggregate cards. This will need to be backported to admin aggregate cards later.

**Roster modal:**
- Standard DaisyUI modal (not floating panel)
- Opens on click for any attendance-bearing card, single or aggregate
- Rows: student name | activity label (aggregate only, lighter/italic) | attendance buttons (Present/Absent/Excused/Tardy)
- Optimistic attendance upsert on button click, no explicit save

**Monitoring groups:** Confirmed — no special schema construct. The teacher's "monitoring group" view is just a query result: all activities in a block where `teacher_id = me OR monitor_id = me`. The aggregate card is a UI concern, not a data concern. Schema handles this cleanly already.

**Social/interaction features (posts, status updates, check-in prompts):** Deferred until agendas are built. Build order: agendas → check-in + status updates → posts + responses.

### Spec Written

`docs/user-flows/student-teacher-agenda-build-spec.md` written and saved to project. Covers:
- Student `TodayView` and teacher `Dashboard` pages
- New hooks: `useStudentAgenda`, `useTeacherAgenda`, `useRoster`
- New API file: `src/api/agenda.js`
- New components: `StudentActivityCard`, `TeacherActivityCard`, `RosterModal`
- Lazy instance upsert pattern
- Deferred: all interaction features (check-in, presence, status updates, posts)
```

---
