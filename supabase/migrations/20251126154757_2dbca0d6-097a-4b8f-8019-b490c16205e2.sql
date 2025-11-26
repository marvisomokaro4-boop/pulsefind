-- Create system_error_scans table for admin dashboard
CREATE TABLE public.system_error_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  error_count integer NOT NULL DEFAULT 0,
  critical_errors integer NOT NULL DEFAULT 0,
  failed_scans integer NOT NULL DEFAULT 0,
  total_scans integer NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  low_success_rate boolean NOT NULL DEFAULT false,
  error_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_error_scans ENABLE ROW LEVEL SECURITY;

-- Only admins can view error scans
CREATE POLICY "Admins can view all error scans"
ON public.system_error_scans
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert error scans
CREATE POLICY "Service role can insert error scans"
ON public.system_error_scans
FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);

-- Create index for faster queries
CREATE INDEX idx_system_error_scans_timestamp ON public.system_error_scans(scan_timestamp DESC);