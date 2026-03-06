
-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  segment_type text NOT NULL DEFAULT 'all',
  segment_filters jsonb NOT NULL DEFAULT '{}',
  message_template text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'email',
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  stats_sent integer NOT NULL DEFAULT 0,
  stats_delivered integer NOT NULL DEFAULT 0,
  stats_opened integer NOT NULL DEFAULT 0,
  stats_clicked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies (anon demo pattern)
CREATE POLICY "Anon can read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Anon can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update campaigns" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Anon can delete campaigns" ON public.campaigns FOR DELETE USING (true);
