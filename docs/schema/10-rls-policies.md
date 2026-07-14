# Row Level Security

*Last updated: July 2026 (docs-freshness pass ahead of ASVS V8 audit)*

All tables have RLS enabled. Policies were overhauled in session 36 (May 13, 2026) to eliminate `user_metadata` references — see Design Principles below. Since then, two further rounds of changes affect the policy set described here: the `visible_to_all_staff` extension (May 20, 2026) and the INSERT org-scoping fix (July 2, 2026) — both folded into the tables below.

---

## Design Principles

### 1. user_profiles is the authoritative org source
Every policy that needs the caller's `organization_id` reads it from `user_profiles` via a SECURITY DEFINER helper function — never from `auth.jwt() -> 'user_metadata'`. `user_metadata` is user-editable and must never be used in a security context.

**Prior approach (deprecated):** Early policies used `(auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid` to avoid self-referential recursion on `user_profiles`. This was flagged as a security vulnerability by the Supabase Advisor in May 2026 and replaced.

### 2. SECURITY DEFINER functions to break recursion
Policies on `user_profiles` cannot safely query `user_profiles` — Postgres evaluates all policies on a table simultaneously, so a self-referential subquery causes infinite recursion. Five SECURITY DEFINER functions bypass RLS to break these cycles:

- **`get_my_organization_id()`** — Returns the caller's `organization_id` from `user_profiles`. Used in all policies on `user_profiles` itself (and anywhere a policy on another table needs the org_id without going through a potentially recursive path). This is the primary replacement for the old `user_metadata` pattern.

- **`get_profile_display_info(profile_id UUID)`** — Returns `(id, first_name, last_name, preferred_name)` for a profile in the caller's org. Used when students need teacher names or teachers need student names, avoiding cross-role `user_profiles` join recursion.

- **`is_enrolled_in(activity_id UUID)`** — Returns `true` if the current user is actively enrolled in the given activity. Used in `activities` and `activity_instances` policies instead of direct `enrollments` subqueries.

- **`is_teacher_or_monitor_of(activity_id UUID)`** — Returns `true` if the current user appears in `activity_staff` for the given activity (any role), scoped to the caller's org. Used in `enrollments`, `activity_instances`, and all instance-dependent table policies. **Note:** intentionally not renamed to `is_staff_of` — renaming would require dropping and recreating all ~9 dependent policies, which caused the session-36 recursion bugs. The name remains semantically accurate.

- **`activity_is_visible_to_all(activity_id_param UUID)`** — Added May 20, 2026 (`20260520000001_visible_to_all_rls_extension.sql`). Returns `true` if the given activity has `visible_to_all_staff = true` and belongs to the caller's org. Used to extend teacher read (and, on `attendance_records`, write) access to activities a teacher isn't directly staffed on. See the `visible-to-all` rows below.

All five functions are `SECURITY DEFINER`, set `search_path = public`, and are granted `EXECUTE` to `authenticated` only (revoked from `PUBLIC` and `anon`). They expose only the minimum data needed. (The Supabase security advisor still flags `get_my_organization_id()`, `activity_is_visible_to_all()`, and the unrelated `ping()` keep-alive function as callable by `anon`/`authenticated` — this is a lint on *any* client-callable `SECURITY DEFINER` function via PostgREST RPC, not a real gap: each function only returns data scoped to the caller's own `auth.uid()`, and `ping()` returns no user data by design.)

### 3. Every policy must be safe independently
Since policies are OR'd by Postgres, a policy intended for admins still gets evaluated when a student queries the table. Every policy's USING clause must resolve without triggering a recursion chain for any authenticated user.

### 4. Org-scoped everything
No user should ever see data from another organization.

---

## Helper Functions Reference

```sql
-- Returns the caller's organization_id. Used in user_profiles policies
-- and anywhere self-referential recursion would otherwise occur.
public.get_my_organization_id() RETURNS uuid

-- Returns display name fields for a profile in the caller's org.
public.get_profile_display_info(profile_id uuid)
  RETURNS TABLE(id uuid, first_name text, last_name text, preferred_name text)

-- Returns true if auth.uid() is actively enrolled in the given activity.
public.is_enrolled_in(activity_id_param uuid) RETURNS boolean

-- Returns true if auth.uid() appears in activity_staff for the given activity,
-- scoped to the caller's org via user_profiles. (Not renamed to is_staff_of — see #70 build spec.)
public.is_teacher_or_monitor_of(activity_id_param uuid) RETURNS boolean

-- Returns true if the given activity has visible_to_all_staff = true
-- and belongs to the caller's org. Added 20260520000001.
public.activity_is_visible_to_all(activity_id_param uuid) RETURNS boolean
```

---

## Policy Summary by Table

### Legend
- **my_org** = `public.get_my_organization_id()`
- **is_role(r)** = `EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND r = ANY(roles) AND organization_id = <table>.organization_id)`

### organizations
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | `id = my_org` |
| UPDATE | Admin | `id = my_org AND is_role('admin')` |

### user_profiles
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Own profile | `id = auth.uid()` |
| SELECT | Org members | `organization_id = my_org` — uses `get_my_organization_id()` to avoid recursion |
| UPDATE | Own profile | `id = auth.uid()` |
| UPDATE | Admin (org) | `organization_id = my_org AND is_role('admin')` |

**Note:** For cross-role name lookups (e.g., student reading teacher name), use `get_profile_display_info()` RPC instead of joining `user_profiles` directly. Direct joins can trigger recursion depending on the outer query's RLS context. See `src/api/agenda.js` for the batch pattern.

### academic_terms / schedule_templates / school_days / internship_opportunities
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | `organization_id = my_org` |
| ALL | Admin | `organization_id = my_org AND is_role('admin')` |

### activities
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(id)` — DEFINER function |
| SELECT | Teacher (org) | `organization_id = my_org AND is_role('teacher')` |
| SELECT | Teacher (visible-to-all) | `activity_is_visible_to_all(id)` — DEFINER function |
| ALL | Admin | `organization_id = my_org AND is_role('admin')` |

### activity_staff
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(activity_id)` — DEFINER function |
| SELECT | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` — DEFINER function |
| SELECT | Teacher (visible-to-all) | `activity_is_visible_to_all(activity_id)` — DEFINER function |
| ALL | Admin (org) | `EXISTS (activities JOIN user_profiles WHERE org matches AND role='admin')` |

### enrollments
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` — DEFINER function |
| SELECT | Teacher (visible-to-all) | `is_role('teacher') AND activity_is_visible_to_all(activity_id)` — added `20260520000001` |
| ALL | Admin (org) | `is_role('admin')` — org verified via user_profiles subquery against activities |

### activity_instances
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| INSERT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| SELECT/INSERT/UPDATE | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` |
| SELECT | Teacher (visible-to-all) | `is_role('teacher') AND activity_is_visible_to_all(activity_id)` — added `20260520000001` |
| ALL | Admin (org) | `organization_id = my_org AND is_role('admin')` |

### attendance_records
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Teacher (visible-to-all) | Via `activity_instances WHERE activity_is_visible_to_all(activity_id)`, `is_role('teacher')` — added `20260520000001` |
| ALL (read+write) | Teacher (visible-to-all, Path A) | Same condition as above, but `FOR ALL` — a teacher can also *mark* attendance on a visible-to-all activity they aren't staffed on. Confirmed admin intent: flipping `visible_to_all_staff` on is an explicit "any teacher may act on this" signal. Added `20260520000001` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### check_ins
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Student (own) | `student_id = auth.uid()` |
| INSERT | Student (own) | `student_id = auth.uid() AND` the target `activity_instance` belongs to the caller's org (`get_my_organization_id()`) — org check added `20260702000002`, closing a gap where a guessed/obtained instance UUID from another org would otherwise pass |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### checkin_activity_tags
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT | Student (own check-ins) | Via `check_ins WHERE student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via check_ins → activity_instances → `is_teacher_or_monitor_of` |
| SELECT | Admin (org) | Via check_ins → activity_instances → `organization_id = my_org` |

### presence_waves
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| INSERT | Student (own) | `student_id = auth.uid() AND` the target `activity_instance` belongs to the caller's org (`get_my_organization_id()`) — org check added `20260702000002` |
| SELECT | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### status_updates
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Student (own) | `student_id = auth.uid()` |
| INSERT | Student (own) | `student_id = auth.uid() AND` the target `activity_instance` belongs to the caller's org (`get_my_organization_id()`) — org check added `20260702000002` |
| SELECT | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### posts
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | Via `activity_instances WHERE is_enrolled_in(activity_id)` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| UPDATE | Author | `author_id = auth.uid()` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### post_responses
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Student (own) | `student_id = auth.uid()` |
| INSERT | Student (own) | `student_id = auth.uid() AND` the target `post` (via its `activity_instance`) belongs to the caller's org (`get_my_organization_id()`) — org check added `20260702000002` |
| SELECT | Teacher (own activities) | Via posts → activity_instances → `is_teacher_or_monitor_of` |
| SELECT | Admin (org) | Via posts → activity_instances → `organization_id = my_org` |

### comments
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | Via parent chain (post/response/status_update) → activity_instances → `organization_id = my_org` |
| INSERT | All org members | `author_id = auth.uid() AND` whichever parent (`post_id`/`post_response_id`/`status_update_id`) is set resolves, via its own chain to `activity_instances`, to the caller's org (`get_my_organization_id()`) — parent-org check added `20260702000002`; previously only `author_id` ownership was checked, so a comment could be attached to another org's post/response/status_update given a guessed UUID |
| UPDATE | Author | `author_id = auth.uid()` |
| DELETE | Admin | `is_role('admin')` |

### notifications
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Own | `user_id = auth.uid()` |
| INSERT | Org members | The notification's `user_id` (recipient) must belong to the caller's org, checked via a `user_profiles`-to-`user_profiles` join against `get_my_organization_id()` (this table has no `organization_id` column of its own) — org check added `20260702000002`; previously any authenticated user could insert a notification for any `user_id` |

### activity_terms
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Staff (org) | `EXISTS` — caller has `'staff'` role and shares `organization_id` with the parent `activity` |
| SELECT | Student (enrolled) | `EXISTS` active `enrollments` row for the caller on `activity_id` |
| ALL | Admin (org) | `EXISTS` — caller has `'admin'` role and shares `organization_id` with the parent `activity` |

*Note: the staff-read policy checks for `'staff'` in `roles`, not `'teacher'` — worth confirming against actual role values used in `user_profiles.roles` if teachers are expected to read this table directly (they may instead rely on joined activity queries).*

### feedback_reports
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT | Own | `user_id = auth.uid()` |
| SELECT/UPDATE | Admin (org) | `organization_id = my_org AND is_role('admin')` |

### audit_log
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Admin | `is_role('admin')` |
| INSERT | System only | Via service role, not client-side |

### calendars
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | `organization_id = my_org` |
| ALL | Admin | `organization_id = my_org AND is_role('admin')` |

---

## Table Grants (defense-in-depth, independent of RLS)

RLS policies are the primary access control layer, but Postgres also requires a table-level `GRANT` before RLS is even evaluated for a role. As of `20260702000003_revoke_anon_inherited_table_grants.sql`, `anon` holds **zero** grants on any `public` table — `authenticated` and `service_role` hold full CRUD (`SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE`), gated by RLS as described above. Verified live via `information_schema.role_table_grants`.

This was a real gap, not just a doc/reality mismatch: `20260513141200_revoke_default_privilges.sql` (May 13) used `ALTER DEFAULT PRIVILEGES`, which only governs objects *created after* that statement runs. Every table that existed before May 13 had retained its original at-creation grants — which included full CRUD for `anon` — until `20260702000003` explicitly revoked them. RLS was providing real protection throughout that window (every policy keys off `auth.uid()`/`get_my_organization_id()`, both `NULL` for `anon`, and `NULL` comparisons fail closed), but the grant layer was effectively absent for `anon` on nearly the whole schema until July 2, 2026.

**New tables must include explicit grants** — see the pattern in `CLAUDE.md`'s Database section. `ALTER DEFAULT PRIVILEGES` does not retroactively cover pre-existing tables, and there is no grant a table gets "for free."

---

## App-Layer Usage Notes

### Cross-role name lookups
Use `supabase.rpc('get_profile_display_info', { profile_id })` instead of joining `user_profiles` in queries. See `src/api/agenda.js` for the batch pattern.

### Adding policies for new tables
When adding a new table that references `activities` or `enrollments`, use the DEFINER functions (`is_enrolled_in`, `is_teacher_or_monitor_of`) in policies rather than direct subqueries. This prevents introducing new recursion cycles.

For org-scoping on new tables, use `public.get_my_organization_id()` rather than a `user_profiles` subquery inline — the inline subquery pattern is safe on other tables but fragile to maintain and has caused bugs historically.

### Migration reference

**Caution:** local migration filenames are not always a reliable timestamp record. A duplicate-key failure in `supabase db diff --linked` once forced several May 13 migrations to be renamed to their actual applied-in-production timestamps (commit `8fd7942`, "Reconcile migration ledger"). The filenames below were re-verified against `list_migrations` (Supabase's own applied-migration ledger) during the July 2026 docs-freshness pass and match exactly.

- Original comprehensive policies: `supabase/migrations/20260313000000_comprehensive_rls_policies.sql`
- `user_metadata` → `user_profiles` overhaul: `supabase/migrations/20260513132022_fix_rls_user_metadata.sql`
- Function security fixes + `get_my_organization_id` introduction: `supabase/migrations/20260513132044_fix_function_security.sql`, `20260513132120_revoke_anon_execute_functions.sql`, `20260513132144_revoke_public_execute_functions.sql`
- Recursion fix for user_profiles policies: `supabase/migrations/20260513141142_fix_user_profiles_recursion.sql`
- Default-privilege opt-out (objects created after May 13 only): `supabase/migrations/20260513141200_revoke_default_privilges.sql`
- `visible_to_all_staff` RLS extension (enrollments/activity_instances/attendance_records): `supabase/migrations/20260520000001_visible_to_all_rls_extension.sql`
- INSERT policy org-scoping fix (check_ins, presence_waves, status_updates, post_responses, comments, notifications): `supabase/migrations/20260702000002_fix_insert_policy_org_scoping.sql`
- Anon inherited table-grant revocation: `supabase/migrations/20260702000003_revoke_anon_inherited_table_grants.sql`
