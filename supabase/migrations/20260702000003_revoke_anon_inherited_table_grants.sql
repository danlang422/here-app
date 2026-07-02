-- Migration: Revoke anon's inherited table grants
-- Description: revoke_default_privilges.sql (May 13) used ALTER DEFAULT
-- PRIVILEGES, which only governs objects created after that statement runs.
-- Confirmed via direct query against production: every table that existed
-- before May 13 retained its original at-creation grants, which included
-- full SELECT/INSERT/UPDATE/DELETE for anon -- i.e., every table except
-- activity_staff (protected only because it happened to be created after
-- May 13). This app requires authentication for all functionality; anon
-- should have zero table access. RLS was still providing real protection
-- in practice throughout (every policy keys off auth.uid()/
-- get_my_organization_id(), both NULL for anon, and NULL comparisons fail
-- closed) -- but grants are meant to be an independent second layer, and
-- that layer was effectively absent for anon on nearly the entire schema
-- until now.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
