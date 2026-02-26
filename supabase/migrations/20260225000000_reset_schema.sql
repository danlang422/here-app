-- Here App - Schema Reset
-- Created: February 25, 2026
-- Description: Drops all V1 tables, types, functions, and triggers to prepare
--              for the V2 schema. Run this in the Supabase SQL Editor before
--              running the phase migrations.
--
-- WARNING: This destroys all data. Only use in development.

-- ============================================================================
-- DROP TRIGGERS FIRST (they depend on functions and tables)
-- ============================================================================

DROP TRIGGER IF EXISTS audit_enrollments ON enrollments;
DROP TRIGGER IF EXISTS audit_student_activities ON student_activities;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS audit_enrollment_changes();
DROP FUNCTION IF EXISTS audit_student_activity_changes();
DROP FUNCTION IF EXISTS handle_new_auth_user();
DROP FUNCTION IF EXISTS get_schedule_for_date(UUID, DATE);

-- ============================================================================
-- DROP POLICIES (must drop before tables)
-- ============================================================================

-- user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;

-- enrollments
DROP POLICY IF EXISTS "Students read own enrollments" ON enrollments;

-- check_ins
DROP POLICY IF EXISTS "Students create own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Students manage own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Students update own check-ins" ON check_ins;

-- sessions
DROP POLICY IF EXISTS "Teachers read all sessions" ON sessions;

-- attendance_records
DROP POLICY IF EXISTS "Teachers manage attendance" ON attendance_records;

-- organizations
DROP POLICY IF EXISTS "Admins full access to organizations" ON organizations;

-- academic_terms
DROP POLICY IF EXISTS "Admins full access to academic_terms" ON academic_terms;

-- schedule_templates
DROP POLICY IF EXISTS "Admins full access to schedule_templates" ON schedule_templates;

-- school_days
DROP POLICY IF EXISTS "Admins full access to school_days" ON school_days;

-- ============================================================================
-- DROP TABLES (reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS presence_waves CASCADE;
DROP TABLE IF EXISTS status_updates CASCADE;
DROP TABLE IF EXISTS check_ins CASCADE;
DROP TABLE IF EXISTS student_activities CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS internship_opportunities CASCADE;
DROP TABLE IF EXISTS activity_types CASCADE;
DROP TABLE IF EXISTS school_days CASCADE;
DROP TABLE IF EXISTS schedule_templates CASCADE;
DROP TABLE IF EXISTS academic_terms CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================================================
-- DROP ENUMS
-- ============================================================================

DROP TYPE IF EXISTS session_type;
DROP TYPE IF EXISTS attendance_status;

-- ============================================================================
-- VERIFY CLEAN STATE
-- ============================================================================

-- This should return no rows if everything was dropped correctly.
-- Run manually to confirm:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
