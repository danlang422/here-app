# Session 3 - March 1, 2026

### Dynamic Block Count
- Block count is now org-defined (`organization.settings.block_count`), not hardcoded to 0-5
- Loosened `valid_block` DB constraints on `activities` and `enrollments` — removed `<= 5` ceiling, upper bound enforced at app layer
- Replaced hardcoded `BLOCKS`/`BLOCK_LABELS` constants with `getBlocks(blockCount)`, `getBlockLabel(blockNum)`, `getBlockLabels(blockCount)` utilities
- City View seeded with `block_count: 6`
- Migration: `20260301000001_dynamic_block_count.sql`

### Activity Management (Layer 1 — CRUD Basics)
- **ActivityForm component** (`src/components/activities/ActivityForm.jsx`): Reusable, self-contained form designed for future use in modals/slide-overs. Type dropdown drives field visibility in real time. Staff section shows contextually by type with "+ Add staff" for extras. Block dropdown populated from org settings (shows "Blocks not yet defined" if null). Behavior flags in collapsible Advanced section, auto-populated by type defaults. All fields optional except name and type.
- **ActivityTable component** (`src/components/activities/ActivityTable.jsx`): Table with type badges, block labels, day abbreviations, 12-hour time display, edit buttons. Empty and loading states.
- **ActivityManagement page** (`src/pages/admin/ActivityManagement.jsx`): Wires form and table together. Create/edit flow, type filter, error handling.

### API Layer Additions
- `src/api/organizations.js` — `getOrganization`, `updateOrgSettings`, `getOrgSettings`
- `src/api/users.js` — `getUsers` (with role filtering), `getStaffUsers`, `getStudents`, `getUser`, `formatUserName`

### Admin RLS Policies
- Added missing RLS policies for admin page functionality
- `organizations`: SELECT for org members (via JWT), UPDATE for admins
- `academic_terms`, `schedule_templates`, `school_days`: SELECT for org members, ALL for admins
- `enrollments`: ALL for admins (scoped to org activities)
- `user_profiles`: UPDATE for admins in their org
- `internship_opportunities`: SELECT for org members, ALL for admins
- All use JWT-based org_id pattern to avoid self-referential subquery issues
- Migration: `20260301000002_admin_rls_policies.sql`

### Schema Doc Updates
- `docs/schema/01-core-tables.md` — Added `block_count` to settings schema with documentation
- `docs/schema/03-activities.md` — Updated constraint notation for dynamic blocks