# Migration Strategy

## Phase 1: Core structure
1. Organizations, users, roles, auth trigger
2. Academic calendar (terms, templates, school days)

## Phase 2: Activities & enrollments
1. Internship opportunities
2. Activities table (unified — replaces sessions + student_activities)
3. Enrollments

## Phase 3: Instances & attendance
1. Activity instances
2. Attendance records
3. Check-ins, checkin_activity_tags
4. Presence waves

## Phase 4: Social layer
1. Status updates (must be created before comments due to FK reference)
2. Posts, post_responses
3. Comments (references posts, post_responses, and status_updates)
4. Notifications (references posts, post_responses, status_updates, and check_ins)

---

## Seed Data for City View
- Organization record
- Default schedule template (regular block times)
- Current academic term + school days calendar
- Core activity catalog from CSV (~25-30 scheduled Kirkwood courses, online courses, plus City View classes and monitoring blocks once schedule is entered)

---

## Ongoing Migration Conventions

**Explicit GRANTs required for new tables (as of May 2026):** We opted into Supabase's new default-grant behavior. Every new table added to `public` must include explicit GRANT statements before it will be accessible via the Data API:

```sql
-- Required for every new table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT ALL ON public.your_table TO service_role;
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;
-- Then add RLS policies
```

**Do not grant `anon` access on new tables.** As of `20260702000003_revoke_anon_inherited_table_grants.sql`, `anon` holds zero table grants anywhere in `public` — this app requires authentication for all functionality, and that migration made "no anon access" the explicit, verified baseline (see `docs/schema/10-rls-policies.md`). The one exception is the `ping()` keep-alive function (`20260625000001`), which is a SECURITY DEFINER RPC, not a table grant, and returns no user data.

The platform enforces the default-grant opt-out for all existing projects on October 30, 2026.

**RLS org-scoping pattern:** Use `public.get_my_organization_id()` (SECURITY DEFINER) when a policy needs the caller's org, rather than an inline `user_profiles` subquery. This avoids recursion on `user_profiles` and is consistent with the established pattern. See `docs/schema/10-rls-policies.md`.

---

## Future Considerations

### Not in MVP
- Post broadcasting by activity type (e.g., push message to all internship activities)
- Schedule-building features (visual block availability, enrollment-aware placement — the `is_not_scheduled` flag and one-per-block constraint already support this; the UI is the deferred part)
- Student-created activities or self-scheduling
- Parent/guardian access (new role + relationship to students)
- Direct messaging (expand comments model)
- File attachments on posts or status updates
- Materialized views for attendance reporting

### Schema will need updates for
- `mentors` table — if mentor contact info needs to be structured (currently free text)
- `post response_options` — if single/multi-select response types are implemented
- Freeform tagging restrictions — per-enrollment toggle for "restrict to unscheduled activities only" if that feature is built
- Additional commentable entities — would require a new nullable FK column on `comments` and updating the `exactly_one_parent` constraint
