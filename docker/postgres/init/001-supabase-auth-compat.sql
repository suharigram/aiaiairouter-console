DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.sub', true) IS NOT NULL
      THEN NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    WHEN current_setting('request.jwt.claims', true) IS NOT NULL
      THEN NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
    ELSE NULL
  END;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
