-- Enable Supabase Realtime for attendance_records.
-- Required for postgres_changes subscriptions to fire.
-- Without this, the table is not in the supabase_realtime publication
-- and no events are emitted regardless of subscription setup.

ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
