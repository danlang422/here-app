# Session 32 — April 15, 2026

## 32.1 Staff model redesign — planning and issue creation (#70, #77–#81)

This was a planning session focused on the staff association model, substitute teacher support, and related concerns raised during the City View staff demo. No code was written — the output was a set of interconnected GitHub issues capturing the design thinking and breaking the work into buildable pieces.

### Background

Staff demo feedback confirmed that City View operates with a "whoever is available takes attendance" culture. The current `teacher_id` / `monitor_id` columns on `activities` are too rigid — they limit each activity to one teacher and one monitor, which doesn't match how the school works. Staff also raised the need for substitute teacher access, which Daniel noted was an ironic oversight given that he substitute teaches at the school.

### Key design decisions

**Teacher vs Monitor — revised semantics.** The original distinction was about "teaching" vs "supervising," which had no functional difference in the app. The revised meaning is about **physical co-location**:

- **Teacher** = co-located with students. This is their room, their class, their session. Primary roster and attendance interface.
- **Monitor** = responsible for students who are elsewhere (internships, off-campus courses, independent work). Remote oversight — checking in on them, reviewing check-in data, following up on missing check-ins.

This distinction maps well to existing behavior flags (`requires_checkin`, `requires_geofence`, `is_not_scheduled`) and creates a meaningful UI difference: monitored students need a different display treatment than co-located students (sidebar, grouped section, or separate card — TBD pending user research at the school).

**Substitute coverage as bulk staff assignment, not a bespoke workflow.** Rather than building a dedicated "cover for teacher" feature, the substitute use case is handled by a general-purpose bulk staff assignment action in the existing bulk edit flow. Filter to Teacher X's activities → select all → bulk assign sub. This also handles co-teaching, floating aides, and other multi-staff scenarios.

**Substitute role: add now, differentiate later.** Adding `'substitute'` to the roles system now (functionally identical to teacher) establishes the concept so that future restrictions (no activity editing, limited report access, etc.) are conditional additions rather than migrations.

**Attendance concurrency: Realtime, not locking.** Multiple staff marking attendance on the same activity should see each other's changes via Supabase Realtime subscriptions. No pessimistic locking or merge conflict resolution needed at City View's scale. This is a future enhancement — last-write-wins is acceptable for now.

**Substitute scheduling: future automation layer.** The vision is admin-scheduled coverage ("Sub A covers Teacher X on April 15") with automatic `activity_staff` row creation/removal. This sits on top of the manual bulk assignment workflow and doesn't need to be built yet. Two approaches were discussed: materialized assignments via cron vs virtual assignments at query time.

### Issues created/updated

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #70 | Multiple staff per activity — `activity_staff` junction table | Updated | Rewrote with revised teacher/monitor semantics, detailed schema, migration plan, RLS changes. **Foundation for everything else.** |
| #77 | Substitute teacher role | Created | Add `'substitute'` to roles, treat as teacher for now. Low cost, high future value. |
| #78 | Bulk staff assignment via bulk edit | Created | General-purpose staff assignment action. Handles sub coverage + other scenarios. |
| #79 | Monitor UI — "elsewhere" students display | Created | Teacher view design for monitored vs co-located students. Needs user research at the school. |
| #80 | Attendance concurrency — Realtime subscriptions | Created | Multi-staff attendance visibility. Future, depends on #70. |
| #81 | Substitute scheduling — automated coverage | Created | Admin-scheduled sub coverage with automatic assignment. Future, depends on #70 + #77 + #78. |

### Dependency chain

```
#70 activity_staff (foundation)
├── #77 Substitute role (can be concurrent with #70)
├── #78 Bulk staff assignment (depends on #70)
├── #79 Monitor UI (depends on #70, needs user research)
├── #80 Attendance Realtime (depends on #70, future)
└── #81 Substitute scheduling (depends on #70 + #77 + #78, future)
```

### Build order recommendation

1. **#70** — `activity_staff` junction table (needs design doc first, then implementation — this is the big one)
2. **#77** — Substitute role (lightweight, can be done alongside or immediately after #70)
3. **#78** — Bulk staff assignment (after #70 is in place)
4. **#79–#81** — Future work, captured for when we're ready

### Open threads

- **Monitor UI exploration** (#79): Daniel plans to visit City View to ask staff how they actually track "elsewhere" students and what display would help. The design for this depends on that research.
- **Agenda card expansion concept**: Daniel floated the idea of agenda cards expanding in-place to show rosters (instead of the current modal pattern), which would enable side-by-side display of teacher and monitor activities — similar to overlapping events in Google Calendar. This is a larger design shift and was noted but not pursued in this session.
- **#69 (multiple blocks per activity)** remains independent and can be tackled in parallel with the staff model work.

### What's next

Write the design doc for #70 (`activity_staff`). This should cover exact migration SQL, complete list of query/hook changes, RLS policy rewrites, and the ActivityForm/ActivityDetail UI changes. Once the design doc is reviewed, implementation can begin.
