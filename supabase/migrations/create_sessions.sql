-- Run this in the Supabase SQL editor before first use.

CREATE TABLE public.sessions (
  id            TEXT        PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  tag           TEXT        NOT NULL,
  duration_secs INTEGER     NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions" ON public.sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
