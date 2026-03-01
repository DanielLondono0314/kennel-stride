
-- Create report_cards table
CREATE TABLE public.report_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dog_id text NOT NULL,
  dog_name text NOT NULL,
  trainer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT 'daycare',
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_score integer NOT NULL DEFAULT 3,
  energy_level integer NOT NULL DEFAULT 3,
  socialization integer NOT NULL DEFAULT 3,
  obedience integer NOT NULL DEFAULT 3,
  appetite integer NOT NULL DEFAULT 3,
  notes text DEFAULT '',
  highlights text DEFAULT '',
  areas_to_improve text DEFAULT '',
  photos text[] DEFAULT '{}',
  is_sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as staff_members - anon access for demo)
CREATE POLICY "Anon can read report_cards" ON public.report_cards FOR SELECT USING (true);
CREATE POLICY "Anon can insert report_cards" ON public.report_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update report_cards" ON public.report_cards FOR UPDATE USING (true);
CREATE POLICY "Anon can delete report_cards" ON public.report_cards FOR DELETE USING (true);
CREATE POLICY "Admins can manage report_cards" ON public.report_cards FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for report card photos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-card-photos', 'report-card-photos', true);

-- Storage RLS policies
CREATE POLICY "Anyone can upload report photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-card-photos');
CREATE POLICY "Anyone can view report photos" ON storage.objects FOR SELECT USING (bucket_id = 'report-card-photos');
CREATE POLICY "Anyone can delete report photos" ON storage.objects FOR DELETE USING (bucket_id = 'report-card-photos');
