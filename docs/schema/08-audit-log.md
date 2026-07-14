# Audit Log

*Last updated: July 2026 (docs-freshness pass)*

## audit_log

Intended to track changes to critical records. **Not currently populated:** verified live that the table has 0 rows, there are no database triggers anywhere in the `public` schema that write to it (the only trigger in the schema is `trg_activity_block_cascade` on `activities`, which syncs `enrollments.block` — unrelated), and no application code (`src/`) references `audit_log` at all. The table, RLS policy (admin SELECT), and grants exist, but nothing writes to it yet. Treat the "Tracked tables" list below as a design intent for future work, not current behavior.

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

**Planned tracked tables (not yet wired up):** `enrollments`, `activities`, `school_days`, `attendance_records`
