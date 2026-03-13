# Row Level Security

All tables have RLS enabled. Comprehensive policies were deployed in `20260313000000_comprehensive_rls.sql`, covering all 19 tables for admin, teacher, and student roles.

---

## Design Principles

### 1. JWT-based org scoping
Every policy that needs the caller's `organization_id` reads it from `auth.jwt() -> 'user_metadata' ->> 'organization_id'` — never from a subquery on `user_profiles`. Self-referential `user_profiles` subqueries were the original source of infinite recursion.

### 2. SECURITY DEFINER functions to break recursion
Postgres evaluates ALL policies on a table and OR's them together, regardless of the current user's role. This means a student policy that queries `enrollments` and a teacher enrollment policy that queries `activities` create a cycle for *any* user. Three `SECURITY DEFINER` functions bypass RLS to break these cycles:

- **`get_profile_display_info(profile_id UUID)`** — Returns `(id, first_name, last_name, preferred_name)` for a profile in the caller's org. Used when students need teacher names or teachers need student names, avoiding `user_profiles` join recursion.

- **`is_enrolled_in(activity_id UUID)`** — Returns `true` if the current user is actively enrolled in the given activity. Used in `activities` and `activity_instances` policies instead of direct `enrollments` subqueries.

- **`is_teacher_or_monitor_of(activity_id UUID)`** — Returns `true` if the current user is `teacher_id` or `monitor_id` of the given activity. Used in `enrollments`, `activity_instances`, and all instance-dependent table policies instead of direct `activities` subqueries.

All three functions are org-scoped internally (check caller's org via JWT), set `search_path = public`, and expose only the minimum data needed.

### 3. Every policy must be safe independently
Since policies are OR'd, a policy intended for admins still gets evaluated when a student queries the table. Every policy's USING clause must resolve without triggering a recursion chain for any authenticated user.

### 4. Org-scoped everything
No user should ever see data from another organization.

---

## Policy Summary by Table

### Legend
- **jwt_org** = `(auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid`
- **is_role(r)** = `EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND r = ANY(roles) AND organization_id = jwt_org)`

### organizations
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | `id = jwt_org` |
| UPDATE | Admin | `id = jwt_org AND is_role('admin')` |

### user_profiles
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Own profile | `id = auth.uid()` |
| SELECT | Org members | `organization_id = jwt_org` |
| UPDATE | Own profile | `id = auth.uid()` |
| UPDATE | Admin (org) | `organization_id = jwt_org AND is_role('admin')` |

**Note:** For cross-role name lookups (e.g., student reading teacher name), use `get_profile_display_info()` RPC instead of joining `user_profiles` directly. Direct joins can trigger recursion depending on the outer query's RLS context.

### academic_terms / schedule_templates / school_days / internship_opportunities
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | `organization_id = jwt_org` |
| ALL | Admin | `organization_id = jwt_org AND is_role('admin')` |

### activities
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(id)` — DEFINER function |
| SELECT | Teacher (org) | `organization_id = jwt_org AND is_role('teacher')` |
| ALL | Admin | `organization_id = jwt_org AND is_role('admin')` |

### enrollments
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` — DEFINER function |
| ALL | Admin (org) | `is_role('admin')` (org check via user_profiles, NOT via activities subquery) |

### activity_instances
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| INSERT | Student (enrolled) | `is_enrolled_in(activity_id)` |
| SELECT/INSERT/UPDATE | Teacher (own activities) | `is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | `organization_id = jwt_org AND is_role('admin')` |

### attendance_records
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (own) | `student_id = auth.uid()` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = jwt_org` |

### check_ins
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = jwt_org` |

### checkin_activity_tags
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT | Student (own check-ins) | Via `check_ins WHERE student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via check_ins → activity_instances chain with DEFINER |
| SELECT | Admin (org) | Via check_ins → activity_instances chain with jwt_org |

### presence_waves
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Admin (org) | Via `activity_instances WHERE organization_id = jwt_org` |

### status_updates
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| SELECT | Admin (org) | Via `activity_instances WHERE organization_id = jwt_org` |

### posts
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Student (enrolled) | Via `activity_instances WHERE is_enrolled_in(activity_id)` |
| ALL | Teacher (own activities) | Via `activity_instances WHERE is_teacher_or_monitor_of(activity_id)` |
| UPDATE | Author | `author_id = auth.uid()` |
| ALL | Admin (org) | Via `activity_instances WHERE organization_id = jwt_org` |

### post_responses
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/INSERT/UPDATE | Student (own) | `student_id = auth.uid()` |
| SELECT | Teacher (own activities) | Via posts → activity_instances chain with DEFINER |
| SELECT | Admin (org) | Via posts → activity_instances chain with jwt_org |

### comments
MVP: org-scoped read for simplicity. Parent content (posts, status_updates) has its own visibility.

| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | All org members | Via parent chain (post/response/status_update) → activity_instances → `organization_id = jwt_org` |
| INSERT | All org members | `author_id = auth.uid()` with org check |
| UPDATE | Author | `author_id = auth.uid()` |
| DELETE | Admin | `is_role('admin')` |

### notifications
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT/UPDATE | Own | `user_id = auth.uid()` |
| INSERT | Org members | Org check via user_profiles + JWT |

### audit_log
| Operation | Who | Condition |
|-----------|-----|-----------|
| SELECT | Admin | `is_role('admin')` |
| INSERT | System only | Via service role, not client-side |

---

## App-Layer Usage Notes

### Cross-role name lookups
Use `supabase.rpc('get_profile_display_info', { profile_id })` instead of joining `user_profiles` in queries. See `src/api/agenda.js` for the batch pattern.

### Adding policies for new tables
When adding a new table that references `activities` or `enrollments`, use the DEFINER functions (`is_enrolled_in`, `is_teacher_or_monitor_of`) in policies rather than direct subqueries. This prevents introducing new recursion cycles.

### Migration reference
All policies are defined in `supabase/migrations/20260313000000_comprehensive_rls.sql`.
