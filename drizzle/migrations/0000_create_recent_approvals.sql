CREATE TABLE public.recent_approvals (
  row_no INTEGER PRIMARY KEY,
  feedback TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recent_approvals TO anon, authenticated;
GRANT ALL ON public.recent_approvals TO service_role;
ALTER TABLE public.recent_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read recent approvals" ON public.recent_approvals FOR SELECT TO anon, authenticated USING (true);