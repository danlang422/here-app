ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_term_id_fkey,
  ADD CONSTRAINT activities_term_id_fkey
    FOREIGN KEY (term_id) REFERENCES academic_terms(id)
    ON DELETE SET NULL;