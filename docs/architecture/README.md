# Here App — Architecture Documentation

**Last updated**: April 2026
**Status**: Reflects current implementation (session 34)

---

## Overview

Technical architecture documentation for the Here attendance and scheduling application, built for City View Community High School in Cedar Rapids. The app supports a non-traditional educational model combining regular classes, community college courses, external high school courses, online courses, freeform work blocks, and internships — all unified under a single activity-based data model.

---

## Documents

| # | File | Covers |
|---|------|--------|
| 01 | [Tech Stack & Structure](01-tech-stack-and-structure.md) | Stack choices, project structure, environment setup, build & deploy |
| 02 | [Data Flow & State](02-data-flow-and-state.md) | Data flow patterns, React Query / Zustand / RHF strategy, API layer |
| 03 | [Auth & Security](03-auth-and-security.md) | Supabase auth, RLS strategy, role switching, protected routes |
| 04 | [Realtime & Notifications](04-realtime-and-notifications.md) | Realtime subscriptions, notification delivery, timezone handling |
| 05 | [UI & Styling](05-ui-and-styling.md) | Tailwind / DaisyUI config, component architecture, responsive patterns |

---

## Related Documentation

- **[Schema Documentation](../schema/README.md)** — The source of truth for all database tables, columns, relationships, queries, and RLS policies
- **[Business Logic](../business-logic/)** — Schedule resolution, attendance rules, check-in logic, scheduling constraints
- **[User Flows](../user-flows/)** — Role-specific UX narratives and interaction patterns
