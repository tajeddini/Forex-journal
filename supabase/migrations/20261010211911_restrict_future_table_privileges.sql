-- Prevent future public-schema tables created by postgres from granting
-- TRUNCATE, REFERENCES, or TRIGGER to browser-facing roles by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
