# Session 4 - March 2, 2026

### User Management
- **UserForm component** (`src/components/users/UserForm.jsx`): Reusable, container-agnostic form (modal-ready, like ActivityForm). Create mode shows email + password fields; edit mode hides them. Role selection via checkboxes (admin, teacher, student — at least one required). Optional preferred name and grade level.
- **UserTable component** (`src/components/users/UserTable.jsx`): Table with name, email, color-coded role badges, grade level, edit buttons. Loading and empty states.
- **UserManagement page** (`src/pages/admin/UserManagement.jsx`): Modal-based create/edit flow, role filter dropdown, error handling. Wired up at `/admin/users`.
- **Supabase Edge Function** (`supabase/functions/create-user/index.ts`): Deno-based function using service role key to create auth accounts. Verifies caller is an authenticated admin in the same org. Passes user data via `user_metadata` so the existing `on_auth_user_created` trigger creates the profile row. Deployed with `--no-verify-jwt` (function handles its own auth verification). CORS handled via shared module.
- **API additions to `src/api/users.js`**: `createUser` (invokes Edge Function with explicit auth header and error extraction from Response context), `updateUser` (direct profile update). Query functions (`getUsers`, `getStaffUsers`, etc.) and `formatUserName` were already in place from Session 3.
- No new migration needed — existing schema and RLS policies already supported user management.

### Edge Function Fixes (Session 4 troubleshooting)
- Gateway was rejecting requests with 401 before function code ran — fixed by deploying with `--no-verify-jwt` (the publishable key auth flow doesn't pass the JWT in a way the gateway's built-in verification expects).
- `auth.admin.createUser()` was failing with "Database error creating new user" because the `on_auth_user_created` trigger requires `organization_id` in `user_metadata` — fixed by passing all profile fields through `user_metadata` and letting the trigger handle profile creation.
- `supabase.functions.invoke()` swallows response bodies on non-2xx status — added error extraction via `error.context.json()` in the client-side `createUser` to surface real error messages.
- Service role key: function now checks both `SERVICE_ROLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase auto-provides the latter as a reserved secret).

### Verified with Real Data
- Created multiple users (staff, students) via the User Management form — confirmed Edge Function, trigger, and profile creation all work end to end.
- Created multiple activities of different types — confirmed type-driven field visibility, save, and table display all work correctly.