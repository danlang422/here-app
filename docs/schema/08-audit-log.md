# Audit Log

## audit_log

Tracks changes to critical records.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'soft_deleted')),
  changed_by UUID REFERENCES user_profiles(id),
  change_summary TEXT,
  changes JSONB, -- {"old": {...}, "new": {...}}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

**Tracked tables:** `enrollments`, `activities`, `school_days`, `attendance_records`
