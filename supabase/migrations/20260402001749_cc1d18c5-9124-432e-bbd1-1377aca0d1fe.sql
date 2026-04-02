CREATE TYPE public.alert_status AS ENUM ('unresolved', 'dispatched', 'resolved');

CREATE TABLE public.sos_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status alert_status NOT NULL DEFAULT 'unresolved',
  victim_name TEXT NOT NULL DEFAULT 'Amina Bello',
  victim_age INTEGER NOT NULL DEFAULT 28,
  victim_details TEXT NOT NULL DEFAULT 'Wearing blue hijab, Pre-existing risk file',
  emergency_contact TEXT NOT NULL DEFAULT 'Brother (08012345678)',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create alerts" ON public.sos_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read alerts" ON public.sos_alerts
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update alerts" ON public.sos_alerts
  FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sos_alerts_updated_at
  BEFORE UPDATE ON public.sos_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();