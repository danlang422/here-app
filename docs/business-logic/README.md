# Here App — Business Logic Documentation

**Last updated**: March 2026
**Status**: Ready for implementation

---

## Overview

Business rules, algorithms, and validation logic for the Here attendance and scheduling application. This documentation bridges the gap between the database schema and user flows — it explains *how* the system makes decisions and enforces constraints.

All table and column references match the V2 schema. See [`docs/schema/`](../schema/README.md) for the source of truth on database structure.

---

## Documents

| # | File | Covers |
|---|------|--------|
| 01 | [Schedule & Calendar](01-schedule-and-calendar.md) | Rotation day calculation, block time resolution, "activity meets today" logic, instance creation |
| 02 | [Check-In Rules](02-checkin-rules.md) | Check-in/out availability, validation, geofence, freeform tagging flow |
| 03 | [Attendance Rules](03-attendance-rules.md) | Teacher attendance marking, status transitions, bulk operations |
| 04 | [Status & Presence](04-status-and-presence.md) | Status update rules, presence waves, streak calculation |
| 05 | [Enrollment Validation & Overlap Prevention](05-conflict-resolution.md) | Block-based enrollment gating, time-based scheduling visibility, overlap/gap detection, scheduling examples, teacher roster logic |
| 06 | [Notifications & Access](06-notifications-and-access.md) | Notification triggers, deduplication, role-based permissions |

---

## Related Documentation

- **[Schema Documentation](../schema/README.md)** — Source of truth for all database tables, columns, relationships, queries, and RLS policies
- **[Architecture Documentation](../architecture/README.md)** — Tech stack, data flow, auth, realtime, and UI patterns
- **[User Flows](../user-flows/)** — Role-specific UX narratives and interaction patterns
