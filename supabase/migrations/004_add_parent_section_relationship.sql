-- Migration: Add parent-child relationship to sections
-- Date: 2026-01-23
-- Description: Enables grouping of student sections under a parent supervision section
--              (e.g., multiple student sections under a "Hub Monitor" teacher section)

-- Add parent_section_id column to sections table
ALTER TABLE sections 
ADD COLUMN parent_section_id uuid REFERENCES sections(id) ON DELETE SET NULL;

-- Add index for efficient querying of child sections
CREATE INDEX idx_sections_parent_id ON sections(parent_section_id);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN sections.parent_section_id IS 
'Optional reference to parent section. Used for grouping student sections under teacher supervision sections (e.g., Hub Monitor). Parent sections typically have no direct enrollments but aggregate students from child sections.';
