CREATE EXTENSION IF NOT EXISTS citext;
ALTER TABLE public.users ALTER COLUMN email TYPE citext;
ALTER TABLE public.users ALTER COLUMN username TYPE citext;

