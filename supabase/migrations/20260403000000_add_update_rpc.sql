-- Allow anonymous users to safely update their own recent alerts
-- by requiring the unguessable alert ID (Security Definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.update_alert_profile(
  p_alert_id UUID,
  p_new_name TEXT,
  p_new_age INTEGER,
  p_new_details TEXT,
  p_new_contact TEXT
) RETURNS void AS $$
BEGIN
  UPDATE public.sos_alerts
  SET victim_name = COALESCE(p_new_name, 'Unknown'),
      victim_age = p_new_age,
      victim_details = COALESCE(p_new_details, 'No details provided'),
      emergency_contact = COALESCE(p_new_contact, 'None provided'),
      updated_at = now()
  WHERE id = p_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
