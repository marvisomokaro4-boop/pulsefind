-- Add user_provided_url column to missing_link_reports table
ALTER TABLE public.missing_link_reports
ADD COLUMN user_provided_url text;

-- Add comment explaining the column
COMMENT ON COLUMN public.missing_link_reports.user_provided_url IS 'URL provided by user showing where the song exists on the reported platform';