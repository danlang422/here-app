# Sections Enrollment Counts Migration

## Overview

This migration fixes an N+1 query performance problem in the sections management system. Previously, when fetching sections, the code would:
1. Query all sections (1 query)
2. Loop through each section and make a separate query to count enrolled students (N queries)

For example, with 10 sections, this resulted in 11 database queries.

## Solution

The migration creates a database view `sections_with_enrollment_counts` that pre-computes the active student enrollment counts using a single efficient query with a LEFT JOIN.

## Files Changed

### Database Migration
- **supabase/migrations/003_add_sections_with_counts_view.sql**
  - Creates the `sections_with_enrollment_counts` view
  - Creates the `get_section_enrollment_count()` function for single section queries
  - Grants appropriate permissions

### Type Definitions
- **lib/types/database.ts**
  - Added type definitions for the new view
  - Added type definition for the enrollment count function

### Application Code
- **app/admin/sections/actions.ts**
  - Refactored `getSections()` to query from the view (eliminates N+1)
  - Updated `getSection()` to use the view for consistency
  - Maintained existing return type: `SectionWithTeachers[]`
  - Preserved `_count.section_students` structure
  - Only counts students where `active = true`

## Applying the Migration

### Option 1: Using the provided script
```bash
./scripts/apply-migration.sh
```

### Option 2: Manual application
```bash
# Link your Supabase project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push the migration
supabase db push
```

### Option 3: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/003_add_sections_with_counts_view.sql`
4. Run the SQL

## Verification

After applying the migration, verify it works correctly:

1. **Check the view exists:**
   ```sql
   SELECT * FROM sections_with_enrollment_counts LIMIT 5;
   ```

2. **Check the function exists:**
   ```sql
   SELECT get_section_enrollment_count('some-section-uuid');
   ```

3. **Test in the application:**
   - Navigate to `/admin/sections` in your app
   - Verify sections load correctly with enrollment counts
   - Check the browser's network tab - you should see only 1 database query instead of N+1

## Performance Impact

### Before (N+1 queries)
- 1 query to fetch all sections
- N queries to count students for each section
- **Total: N + 1 queries**
- Example: 10 sections = 11 queries

### After (Single query)
- 1 query to fetch sections with pre-computed counts from the view
- **Total: 1 query**
- Example: 10 sections = 1 query

**Performance improvement: ~90% reduction in database queries**

## Rollback

If you need to rollback this migration:

```sql
-- Drop the view and function
DROP VIEW IF EXISTS sections_with_enrollment_counts CASCADE;
DROP FUNCTION IF EXISTS get_section_enrollment_count(UUID);
```

Then revert the code changes in `app/admin/sections/actions.ts` to query from the `sections` table directly with the old counting logic.

## Notes

- The view automatically updates when the underlying `sections` or `section_students` tables change
- Only active students (`active = true`) are counted
- The view has the same permissions as the `sections` table
- All existing functionality is preserved - the API interface remains unchanged
