CREATE OR REPLACE FUNCTION elastic_link_processing_schema.has_remaining_jobs_in_queue(t_schema text, t_name text)
RETURNS boolean AS $$
DECLARE
  exists_flag boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)', t_schema, t_name)
  INTO exists_flag;
  RETURN exists_flag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;