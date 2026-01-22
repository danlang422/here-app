#!/bin/bash

# Script to apply the sections enrollment counts migration to Supabase
# This creates a view that eliminates N+1 queries when fetching sections

set -e  # Exit on error

echo "======================================"
echo "Sections Enrollment Counts Migration"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed."
    echo "Please install it first: npm install -g supabase"
    exit 1
fi

# Check if project is linked
if [ ! -f .supabase/config.toml ]; then
    echo "Error: Supabase project not linked."
    echo "Please run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "Applying migration 003_add_sections_with_counts_view.sql..."
echo ""

# Apply the migration
supabase db push

echo ""
echo "======================================"
echo "Migration applied successfully!"
echo "======================================"
echo ""
echo "The sections_with_enrollment_counts view has been created."
echo "This eliminates N+1 queries when fetching sections with student counts."
echo ""
echo "To verify, you can run:"
echo "  supabase db diff"
echo ""
