# Row Level Security

All tables have RLS enabled. Key policies:

```sql
-- Users can always read their own profile
CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can view other profiles in their org.
-- Uses auth.jwt() instead of a subquery on user_profiles to avoid
-- infinite recursion in RLS policy evaluation.
CREATE POLICY "Users view org profiles"
  ON user_profiles FOR SELECT
  USING (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );

-- Students read own enrollments
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

-- Teachers read all activities in org
CREATE POLICY "Teachers read activities"
  ON activities FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE id = auth.uid() AND 'teacher' = ANY(roles)
  ));

-- Teachers manage attendance
CREATE POLICY "Teachers manage attendance"
  ON attendance_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'teacher' = ANY(roles)
  ));

-- Students create own check-ins
CREATE POLICY "Students create own check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Admins full access to org data
CREATE POLICY "Admins full access"
  ON activities FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));
```

**Note:** These are starter policies for MVP. As the application grows, policies will need to be added for all tables, and some of these will need refinement (e.g., scoping teacher attendance management to their own org, adding policies for posts/comments visibility rules).
