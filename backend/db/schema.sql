--
-- Sudoku database setup script
-- Creates the schema (functions, tables, constraints, indexes, triggers) in an
-- empty database. Contains no data.
--
-- Usage: psql -d <database> -f schema.sql
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET search_path = public;


--
-- Name: trigger_set_timestamp(); Type: FUNCTION
--

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

--
-- Name: puzzles; Type: TABLE
--

CREATE TABLE IF NOT EXISTS public.puzzles (
    puzzle_id uuid DEFAULT gen_random_uuid() NOT NULL,
    cells text NOT NULL,
    difficulty_score integer,
    difficulty_rating text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    solved_cells text NOT NULL,
    CONSTRAINT puzzles_pkey PRIMARY KEY (puzzle_id)
);

--
-- Name: users; Type: TABLE
--

CREATE TABLE IF NOT EXISTS public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false,
    username text NOT NULL,
    password_hash text NOT NULL,
    salt text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    image_url text,
    current_puzzle_id uuid,
    tos_acknowledged boolean DEFAULT false,
    last_login_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_username UNIQUE (username),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin')),
    CONSTRAINT fk_current_puzzle FOREIGN KEY (current_puzzle_id)
        REFERENCES public.puzzles(puzzle_id) ON DELETE SET NULL
);

--
-- Name: user_puzzles; Type: TABLE
--

CREATE TABLE IF NOT EXISTS public.user_puzzles (
    user_id uuid NOT NULL,
    puzzle_id uuid NOT NULL,
    is_completed boolean DEFAULT false,
    cells text NOT NULL,
    candidates text,
    "time" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    actions integer[],
    CONSTRAINT pk_user_id_puzzle_id PRIMARY KEY (user_id, puzzle_id),
    CONSTRAINT check_valid_completion_time
        CHECK ((completed_at >= (created_at + (("time")::double precision * '00:00:01'::interval)))),
    CONSTRAINT fk_user_id FOREIGN KEY (user_id)
        REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_puzzle_id FOREIGN KEY (puzzle_id)
        REFERENCES public.puzzles(puzzle_id) ON DELETE CASCADE
);

--
-- Name: refresh_tokens; Type: TABLE
--

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

--
-- NAME: reset_tokens; Type: TABLE
--

CREATE TABLE IF NOT EXISTS public.reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'UNUSED',
  reset_token uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp  with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_valid_status CHECK (status IN ('UNUSED', 'USED'))
);


CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens (expires_at);


--
-- Name: users set_timestamp; Type: TRIGGER
--

DROP TRIGGER IF EXISTS set_timestamp ON public.users;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

