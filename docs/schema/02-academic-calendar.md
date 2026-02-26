# Academic Calendar System

## academic_terms

Semesters within a school year.

```sql
CREATE TABLE academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Fall 2025", "Spring 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_terms_org ON academic_terms(organization_id);

-- Enforces at most one current term per organization.
-- Switching terms should be done in a transaction: set old to false, set new to true.
CREATE UNIQUE INDEX idx_academic_terms_one_current
  ON academic_terms(organization_id)
  WHERE is_current = true;
```

Only one term can have `is_current = true` per organization, enforced by the unique partial index.

---

## schedule_templates

Reusable block time definitions.

```sql
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Regular", "2hr Delay", "Early Dismissal"
  is_default BOOLEAN DEFAULT false,
  block_definitions JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_templates_org ON schedule_templates(organization_id);

-- Enforces at most one default template per organization.
CREATE UNIQUE INDEX idx_schedule_templates_one_default
  ON schedule_templates(organization_id)
  WHERE is_default = true;
```

**block_definitions schema:**
```json
[
  {"block": 0, "start_time": "07:30", "end_time": "09:00"},
  {"block": 1, "start_time": "09:05", "end_time": "09:50"},
  {"block": 2, "start_time": "09:55", "end_time": "10:40"},
  {"block": 3, "start_time": "10:45", "end_time": "11:30"},
  {"block": 4, "start_time": "12:15", "end_time": "13:15"},
  {"block": 5, "start_time": "13:20", "end_time": "14:20"}
]
```

One template is marked `is_default = true` (the regular schedule). Additional templates handle variations like 2-hour delays or early dismissal. Block times shift for session-linked activities when a non-default template is in effect; externally-scheduled activities (college courses, external HS courses) use their own fixed times and are unaffected by template changes.

---

## school_days

One record per calendar date.

```sql
CREATE TABLE school_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_school_day BOOLEAN DEFAULT true,
  schedule_template_id UUID REFERENCES schedule_templates(id),
  rotation_day TEXT, -- Validated in application layer against organization.settings.rotation_day_names
                     -- Defaults to 'A'/'B' if org hasn't configured custom names.
  override_reason TEXT CHECK (override_reason IN ('weather', 'planned_holiday', 'emergency')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_org_date UNIQUE (organization_id, date)
);

CREATE INDEX idx_school_days_org_date ON school_days(organization_id, date);
```

Auto-generated for the full term on term creation, then exceptions (holidays, rotation overrides, special schedules) are marked manually. The `rotation_day` field can be manually overridden regardless of what the calculated rotation would be.

**Important:** City View itself does not use A/B rotation. The rotation calendar exists solely because external high schools (Kennedy, Washington, Jefferson) use the district A/B calendar, which determines when shared students attend those schools instead of City View. The `school_days.rotation_day` value for each date is pre-determined by the district schedule and stored here. Activities with `rotation_day_type` set match against this value to determine whether they occur on a given date.
