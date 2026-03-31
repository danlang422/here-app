-- Enforce mutual exclusivity between allows_presence_wave and requires_checkin.
-- Check-in is a formalized version of presence wave; enabling both on the same
-- activity would disrupt the student agenda display and is logically incoherent.
ALTER TABLE activities
  ADD CONSTRAINT presence_wave_and_checkin_mutually_exclusive
  CHECK (NOT (allows_presence_wave = true AND requires_checkin = true));
