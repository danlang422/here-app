# Row Level Security

*Last updated: May 2026 (session 36)*

All tables have RLS enabled. Policies were overhauled in session 36 (May 13, 2026) to eliminate `user_metadata` references — see Design Principles below.

---

## Design Principles

### 1. user_profiles is the authoritative org source
Every policy that needs the caller's `organization_id` reads it from `user_profiles` via a SECURITY DEFINER helper function — never from `auth.jwt() -> 'user_metadata'`. `user_metadata` is user-editable and must never be used in a security context.

**Prior approach (deprecated):** Early policies used `(auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid` to avoid self-referential recursion on `user_profiles`. This was flagged as a security vulnerability by the Supabase Advisor in May 2026 and replaced.

### 2. SECURITY DEFINER functions to break recursion
Policies on `user_profiles` cannot safely query `user_profiles` — Postgres evaluates all policies on a table simultaneously, so a self-referential subquery causes infinite recursion. Four SECURITY DEFINER functions bypass RLS to break these cycles:

- **`get_my_organization_id()`** — Returns the caller's `organization_id` from `user_profiles`. Used in all policies on `user_profiles` itself (and anywhere a policy on another table needs the org_id without going through a potentially recursive path). This is the primary replacement for the old `user_metadata` pattern.

- **`get_profile_display_info(profile_id UUID)`** — Returns `(id, first_name, last_name, preferred_name)` for a profile in the caller's org. Used when students need teacher names or teachers need student names, avoiding cross-role `user_profiles` join recursion.

- **`is_enrolled_in(activity_id UUID)`** — Returns `true` if the current user is actively enrolled in the given activity. Used in `activities` and `activity_instances` policies instead of direct `enrollments` subqueries.

- **`is_teacher_or_monitor_of(activity_id UUID)`** — Returns `true` if the current user appears in `activity_staff` for the given activity (any role), scoped to the caller's org. Used in `enrollments`, `activity_instances`, and all instance-dependent table policies. **Note:** intentionally not renamed to `is_staff_of` — renaming would require dropping and recreating all ~9 dependent policies, which caused the session-36 recursion bugs. The name remains semantically accurate.

All four functions are `SECURITY DEFINER`, set `search_path = public`, and are granted `EXECUTE` to `authenticated` only (revoked from `PUBLIC` and `anon`). They expose only the minimum data needed.

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
| ALL | Admin (org) | `is_role('admin')` — org verified via user_profiles subquery against activities |

### activity_instances
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| INSERT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| SELECT/INSERT/UPDATE | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | `organization_id = my_org AND is_role('admin')` |

### attendance_records
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### check_ins
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
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
| SELECT/INSERT | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Admin (org) | Via `activity_instances WHERE organization_id = my_org` |

### status_updates
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
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
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via posts → activity_instances → `is_teacher_or_monitor_of` |
| SELECT | Admin (org) | Via posts → activity_instances → `organization_id = my_org` |

### comments
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | Via parent chain (post/response/status_update) → activity_instances → `organization_id = my_org` |
| INSERT | All org members | `author_id = auth.uid()` with org membership check via user_profiles |
| UPDATE | Author | `author_id = auth.uid()` |
| DELETE | Admin | `is_role('admin')` |

### notifications
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Own | `user_id = auth.uid()` |
| INSERT | Org members | Org membership check via user_profiles |

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

## App-Layer Usage Notes

### Cross-role name lookups
Use `supabase.rpc('get_profile_display_info', { profile_id })` instead of joining `user_profiles` in queries. See `src/api/agenda.js` for the batch pattern.

### Adding policies for new tables
When adding a new table that references `activities` or `enrollments`, use the DEFINER functions (`is_enrolled_in`, `is_teacher_or_monitor_of`) in policies rather than direct subqueries. This prevents introducing new recursion cycles.

For org-scoping on new tables, use `public.get_my_organization_id()` rather than a `user_profiles` subquery inline — the inline subquery pattern is safe on other tables but fragile to maintain and has caused bugs historically.

### Migration reference
- Original comprehensive policies: `supabase/migrations/20260313000000_comprehensive_rls_policies.sql`
- `user_metadata` → `user_profiles` overhaul: `supabase/migrations/20260513000001_fix_rls_user_metadata.sql`
- Function security fixes + `get_my_organization_id` introduction: `supabase/migrations/20260513000002_fix_function_security.sql`, `20260513000003_revoke_anon_execute_functions.sql`, `20260513000004_revoke_public_execute_functions.sql`
- Recursion fix for user_profiles policies: `supabase/migrations/20260513000005_fix_user_profiles_recursion.sql`
