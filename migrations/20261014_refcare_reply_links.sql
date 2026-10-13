-- Apply after final source synchronization. No anonymous table grants are added.
BEGIN;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reply_access_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS legacy_reply_link_enabled boolean NOT NULL DEFAULT false;

-- Run this marking step only once. Re-running must not grant legacy links to new cases.
CREATE SCHEMA IF NOT EXISTS refcare_private;
REVOKE ALL ON SCHEMA refcare_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS refcare_private.cutovers (name text PRIMARY KEY, marked_at timestamptz NOT NULL DEFAULT now());
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM refcare_private.cutovers WHERE name = 'zeabur_reply_links_20261014') THEN
    UPDATE public.cases SET legacy_reply_link_enabled = true
      WHERE status IN ('一輪媒合中', '二輪媒合中', '三輪媒合中');
    INSERT INTO refcare_private.cutovers(name) VALUES ('zeabur_reply_links_20261014');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION refcare_private.revoke_closed_case_links()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status IN ('一輪媒合中', '二輪媒合中', '三輪媒合中')
     AND (NEW.status IS NULL OR NEW.status NOT IN ('一輪媒合中', '二輪媒合中', '三輪媒合中')) THEN
    NEW.legacy_reply_link_enabled := false;
    NEW.reply_access_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER refcare_revoke_closed_case_links
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION refcare_private.revoke_closed_case_links();

CREATE OR REPLACE FUNCTION public.refcare_submit_reply(
  p_case_id text, p_token text, p_facility_id text, p_status text,
  p_note text DEFAULT '', p_reporter text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  c public.cases%ROWTYPE;
  f public.facilities%ROWTYPE;
  next_index integer;
  next_facility jsonb;
  advance boolean := false;
BEGIN
  -- Serialize replies and closure updates for this case, so checks and insert are atomic.
  SELECT * INTO c FROM public.cases WHERE case_id = p_case_id FOR UPDATE;
  IF NOT FOUND OR c.status IS NULL OR c.status NOT IN ('一輪媒合中', '二輪媒合中', '三輪媒合中')
    OR c.reply_access_token::text IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Invalid or closed case link' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.facilities WHERE id::text = p_facility_id;
  IF NOT FOUND OR NOT (c.target_facility_ids @> jsonb_build_array(p_facility_id)) THEN
    RAISE EXCEPTION 'Facility is not assigned to this case' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('accept', 'reject', 'coordinate') OR length(p_note) > 5000 OR length(p_reporter) > 100 THEN
    RAISE EXCEPTION 'Invalid reply';
  END IF;
  IF EXISTS (SELECT 1 FROM public.replies WHERE case_id = p_case_id
    AND (facility_id = p_facility_id OR (facility_id IS NULL AND facility_name = f.facility_name))) THEN
    RAISE EXCEPTION 'This facility has already replied';
  END IF;
  IF c.target_group = '困難派案(三輪)' AND jsonb_array_length(c.target_facility_queue) > 0 THEN
    IF c.queue_status <> 'WAITING_REPLY'
       OR c.target_facility_queue -> coalesce(c.current_queue_index, 0) ->> 'id' IS DISTINCT FROM p_facility_id THEN
      RAISE EXCEPTION 'Facility is not the current queue target' USING ERRCODE = '42501';
    END IF;
  END IF;
  INSERT INTO public.replies(case_id, facility_id, facility_name, reply_status, note, round, reporter)
    VALUES(p_case_id, p_facility_id, f.facility_name, p_status, p_note,
      CASE WHEN c.status = '三輪媒合中' THEN 3 WHEN c.status = '二輪媒合中' THEN 2 ELSE 1 END, p_reporter);
  IF c.target_group = '困難派案(三輪)' AND jsonb_array_length(c.target_facility_queue) > 0 THEN
    IF p_status = 'accept' THEN
      UPDATE public.cases SET status = '媒合成功', queue_status = 'MATCHED' WHERE case_id = p_case_id;
    ELSIF p_status = 'coordinate' THEN
      UPDATE public.cases SET queue_status = 'PAUSED_PARTIAL' WHERE case_id = p_case_id;
    ELSE
      next_index := coalesce(c.current_queue_index, 0) + 1;
      IF next_index < jsonb_array_length(c.target_facility_queue) THEN
        next_facility := c.target_facility_queue -> next_index;
        UPDATE public.cases SET current_queue_index = next_index, queue_status = 'WAITING_REPLY',
          target_group_line_id = coalesce(next_facility ->> 'line_group_id', '') WHERE case_id = p_case_id;
        advance := true;
      ELSE
        UPDATE public.cases SET status = '媒合失敗', queue_status = 'ENDED' WHERE case_id = p_case_id;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('saved', true, 'advance', advance);
END $$;
REVOKE ALL ON FUNCTION public.refcare_submit_reply(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refcare_submit_reply(text,text,text,text,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
