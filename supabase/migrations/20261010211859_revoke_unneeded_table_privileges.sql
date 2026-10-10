-- RLS does not protect against TRUNCATE; browser roles do not need these table privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;
