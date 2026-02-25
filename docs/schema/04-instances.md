# Activity Instances

## activity_instances

A specific occurrence of an activity on a specific date.

```sql
CREATE TABLE activity_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Denormalized from activities for RLS performance. Set from the parent activity at creation time.
  date DATE NOT NULL,
  cancelled BOOLEAN DEFAULT false,
  notes TEXT, -- "Sub teacher today", "Fire drill shortened session"
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_activity_date UNIQUE (activity_id, date)
);

CREATE INDEX idx_activity_instances_activity ON activity_instances(activity_id);
CREATE INDEX idx_activity_instances_date ON activity_instances(activity_id, date);
CREATE INDEX idx_activity_instances_org_date ON activity_instances(organization_id, date);
```

**Creation strategy:** Instances are created lazily — on the first time anyone interacts with an activity on a given date. "Interaction" means: a teacher opens their roster for a block, a student views their schedule, attendance is taken, a post is created, or a check-in occurs. The application performs an upsert (`INSERT ... ON CONFLICT DO NOTHING`) whenever rendering any view that requires an instance to exist.

This means:
- No pre-generation of a semester's worth of instances is needed
- Instances only exist for dates that have actually been accessed
- Reporting queries that need "all instances of Bio this semester" may have gaps for dates nobody opened the app — acceptable for MVP since no meaningful data would exist for those gaps anyway

**What references activity_instances:**
- `attendance_records` — one per student per instance
- `check_ins` — one per student per instance
- `presence_waves` — one per student per instance
- `posts` — one or more per instance
- `status_updates` — one or more per student per instance
