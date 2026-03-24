-- Create storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload screenshots
CREATE POLICY "Authenticated users can upload feedback screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.role() = 'authenticated'
  );

-- Public read access so Linear can display screenshots
CREATE POLICY "Public read for feedback screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-screenshots');
