-- Migration: Make feedback-screenshots bucket private
-- Description: The bucket was intentionally public (session 36) because GitHub
-- Issues has no API for uploading image attachments, so submit-feedback called
-- getPublicUrl() and embedded that URL in the issue body. The public SELECT
-- policy had no auth check, which also made the storage list endpoint
-- unauthenticated -- anyone could enumerate and read every screenshot in the
-- bucket across all orgs. That tradeoff no longer holds now that the repo is
-- public. submit-feedback now uses createSignedUrl() with a long expiry
-- instead, so no public/authenticated policy is needed at all -- all access
-- (upload and read) happens exclusively through the edge function's
-- service-role client, which bypasses RLS by design.

UPDATE storage.buckets SET public = false WHERE id = 'feedback-screenshots';

DROP POLICY IF EXISTS "Authenticated users can upload feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public read for feedback screenshots" ON storage.objects;
