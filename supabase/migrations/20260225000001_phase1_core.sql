-- Here App - Phase 1: Core Structure
-- Created: February 25, 2026
-- Description: Organizations, user profiles, academic calendar, and auth trigger.
--              Run after 20260225000000_reset_schema.sql.

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{
    "timezone": "America/Chicago",
    "uses_rotation_schedule": false,
    "rotation_day_names": ["A", "B"],
    "rotation_mode": "continue"
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}',
  -- Possible values: 'student', 'teacher', 'admin'
  -- Users can have multiple roles: ['teacher', 'admin']
  grade_level TEXT, -- students only
  advisor_id UUID REFERENCES user_profiles(id), -- students only
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_roles ON user_profiles USING GIN(roles);
CREATE INDEX idx_user_profiles_advisor ON user_profiles(advisor_id);

-- ============================================================================
-- ACADEMIC TERMS
-- ============================================================================

CREATE TABLE academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Fall 2025", "Spring 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_terms_org ON academic_terms(organization_id);

-- Enforces at most one current term per organization.
CREATE UNIQUE INDEX idx_academic_terms_one_current
  ON academic_terms(organization_id)
  WHERE is_current = true;

-- ============================================================================
-- SCHEDULE TEMPLATES
-- ============================================================================

CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Regular", "2hr Delay", "Early Dismissal"
  is_default BOOLEAN DEFAULT false,
  block_definitions JSONB NOT NULL,
  -- Example: [{"block": 0, "start_time": "07:30", "end_time": "09:00"}, ...]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_templates_org ON schedule_templates(organization_id);

-- Enforces at most one default template per organization.
CREATE UNIQUE INDEX idx_schedule_templates_one_default
  ON schedule_templates(organization_id)
  WHERE is_default = true;

-- ============================================================================
-- SCHOOL DAYS
-- ============================================================================

CREATE TABLE school_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_school_day BOOLEAN DEFAULT true,
  schedule_template_id UUID REFERENCES schedule_templates(id),
  rotation_day TEXT, -- Validated in app layer against organization.settings.rotation_day_names
  override_reason TEXT CHECK (override_reason IN ('weather', 'planned_holiday', 'emergency')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_org_date UNIQUE (organization_id, date)
);

CREATE INDEX idx_school_days_org_date ON school_days(organization_id, date);

-- ============================================================================
-- AUTH TRIGGER
-- Creates a user_profiles row when a new auth.users record is inserted.
-- Reads organization_id and optional fields from raw_user_meta_data.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create user profile: organization_id missing from user metadata';
  END IF;

  INSERT INTO public.user_profiles (
    id,
    organization_id,
    email,
    first_name,
    last_name,
    preferred_name,
    roles,
    is_active
  )
  VALUES (
    NEW.id,
    org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'preferred_name',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')),
      '{}'::TEXT[]
    ),
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
