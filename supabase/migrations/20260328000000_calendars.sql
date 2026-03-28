-- Migration: Calendars
-- Created: March 28, 2026
-- Description: Adds a `calendars` table for grouping activities by source or owner.
--
-- Calendars serve two purposes:
--   1. Source grouping: Distinguish where activities originate — Kirkwood, Kennedy,
--      Washington, City View internal, internship partners, etc.
--   2. Teacher calendars: Each teacher can own a calendar. Their classes live on it.
--      The calendar UI lets admins toggle calendars on/off for filtering.
--
-- A calendar can optionally have an owner (teacher). Teacher-owned calendars represent
-- "this teacher's classes." Unowned calendars represent external sources or org-level
-- groupings (e.g., "Kirkwood Community College," "Kennedy High School").
--
-- Activities get a nullable `calendar_id` FK. Existing activities will have NULL,
-- meaning "unassigned" — the admin can assign them over time. The app treats NULL
-- calendar activities as visible in all views (no filtering applied).

-- ============================================================================
-- STEP 1: CREATE CALENDARS TABLE
-- ============================================================================

CREATE TABLE calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                -- "Kirkwood Community College", "Kennedy HS", "Ms. Rivera"
  color TEXT DEFAULT '#6366f1',      -- Hex color for UI toggle chips and card accents
  owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
                                     -- If set, this is a teacher-owned calendar.
                                     -- Their activities (where teacher_id = owner_id) belong here.
                                     -- NULL = org-level/source calendar (Kirkwood, Kennedy, etc.)
  description TEXT,                  -- Optional context: "District A/B rotation school", etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_calendar_name_per_org UNIQUE (organization_id, name)
);

CREATE INDEX idx_calendars_org ON calendars(organization_id);
CREATE INDEX idx_calendars_owner ON calendars(owner_id) WHERE owner_id IS NOT NULL;

-- ============================================================================
-- STEP 2: ADD calendar_id TO ACTIVITIES
-- ============================================================================

ALTER TABLE activities
  ADD COLUMN calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL;

CREATE INDEX idx_activities_calendar ON activities(calendar_id) WHERE calendar_id IS NOT NULL;

-- ============================================================================
-- STEP 3: RLS POLICIES FOR CALENDARS
-- ============================================================================

ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the org can read calendars
CREATE POLICY "Users read org calendars"
  ON calendars FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- Only admins can create/update/delete calendars
CREATE POLICY "Admins manage org calendars"
  ON calendars FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));