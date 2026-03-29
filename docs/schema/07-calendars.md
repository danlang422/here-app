# Calendars

## calendars

Optional groupings for activities, used in the admin calendar view. An activity can belong to at most one calendar. Deleting a calendar sets `activities.calendar_id = NULL` on all affected activities (ON DELETE SET NULL).

```sql
CREATE TABLE calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- Unique per org
  color TEXT NOT NULL DEFAULT '#6366f1', -- Hex color for UI event cards
  owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- NULL = org-level calendar (visible/editable by all admins)
  -- Non-null = personal calendar owned by a specific staff member
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Soft delete: set is_active = false instead of deleting to preserve history.
  -- Hard delete is also supported — cascade sets activities.calendar_id = NULL.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `organization_id` | UUID | NO | — | FK `organizations.id` ON DELETE CASCADE |
| `name` | TEXT | NO | — | Unique per org |
| `color` | TEXT | NO | `#6366f1` | Hex color for UI |
| `owner_id` | UUID | YES | NULL | FK `user_profiles.id` ON DELETE SET NULL; null = org-level calendar |
| `description` | TEXT | YES | NULL | — |
| `is_active` | BOOLEAN | NO | true | Soft delete via is_active = false |
| `created_at` | TIMESTAMPTZ | NO | NOW() | — |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | — |

**RLS:** All authenticated org users can SELECT; admins can INSERT/UPDATE/DELETE.

**API:** `src/api/calendars.js` — `getCalendars`, `createCalendar`, `updateCalendar`, `deleteCalendar`.

**Hooks:** `src/hooks/useCalendars.js` — `useCalendars`, `useCreateCalendar`, `useUpdateCalendar`, `useDeleteCalendar`.

**Activity join:** `getActivities` joins `calendar:calendars(id, name, color)` so activity objects include `{ calendar: { id, name, color } | null }`.
