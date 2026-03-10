# Core Tables

## organizations

Multi-tenancy root. City View is the only org for MVP.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{
    "timezone": "America/Chicago",
    "uses_rotation_schedule": false,
    "rotation_day_names": ["A", "B"],
    "rotation_mode": "continue"
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Settings schema:**
```json
{
  "timezone": "America/Chicago",
  "block_count": null,
  "uses_rotation_schedule": true,
  "rotation_day_names": ["A", "B"],
  "rotation_mode": "continue"
}
```

`block_count`: Number of blocks in the daily schedule. `null` means the org hasn't defined their block structure yet. Activities can still be created with `block = NULL` in this state. When set (e.g. `6`), the app validates that block assignments stay within `0` to `block_count - 1`.

`rotation_mode`: **Deprecated.** Ignored by application code. Rotation advancement is now determined per-reason: planned holidays pause the rotation, unscheduled cancellations (weather/emergency) advance it. See `docs/business-logic/01-schedule-and-calendar.md`. Left in existing JSONB data — no migration to remove it.

---

## user_profiles

All users — students, teachers, admins.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}',
  -- Possible values: 'student', 'teacher', 'admin'
  -- Users can have multiple roles: ['teacher', 'admin']
  grade_level TEXT, -- students only
  advisor_id UUID REFERENCES user_profiles(id), -- students only
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_roles ON user_profiles USING GIN(roles);
CREATE INDEX idx_user_profiles_advisor ON user_profiles(advisor_id);
```
