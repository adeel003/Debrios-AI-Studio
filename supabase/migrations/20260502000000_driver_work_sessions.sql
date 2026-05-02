-- =============================================================================
-- DRIVER WORK SESSIONS MVP
-- =============================================================================
-- Tables:   driver_work_sessions, driver_work_session_events,
--           driver_live_status, driver_load_sessions
-- RPCs:     driver_clock_in, driver_clock_out, driver_start_break,
--           driver_end_break, dispatch_job, start_job, complete_job,
--           cancel_job, admin_correct_session
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Maps auth.uid() → drivers.id for the calling user.
CREATE OR REPLACE FUNCTION public.auth_driver_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns the tenant_id of the calling user's profile.
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns the role string of the calling user.
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.driver_work_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id           uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  clocked_in_at       timestamptz NOT NULL DEFAULT now(),
  clocked_out_at      timestamptz,
  break_started_at    timestamptz,                    -- non-null ⟹ currently on break
  total_break_minutes int         NOT NULL DEFAULT 0, -- accumulates closed breaks
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Exactly one open session per driver per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS driver_work_sessions_one_open_per_driver
  ON public.driver_work_sessions (tenant_id, driver_id)
  WHERE clocked_out_at IS NULL;

CREATE TABLE IF NOT EXISTS public.driver_work_session_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id  uuid        NOT NULL REFERENCES public.driver_work_sessions(id) ON DELETE CASCADE,
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  event_type  text        NOT NULL CHECK (event_type IN (
                'clock_in', 'clock_out', 'break_start', 'break_end', 'admin_correction'
              )),
  notes       text,
  actor_id    uuid,                     -- auth.users id; no FK (cross-schema)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Append-only: no UPDATE or DELETE policies are defined.

-- Denormalized single-row-per-driver snapshot for the dispatch board.
CREATE TABLE IF NOT EXISTS public.driver_live_status (
  driver_id        uuid        PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id       uuid        REFERENCES public.driver_work_sessions(id) ON DELETE SET NULL,
  clocked_in       boolean     NOT NULL DEFAULT false,
  on_break         boolean     NOT NULL DEFAULT false,
  clocked_in_since timestamptz,
  break_since      timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Time-per-load tracking; session_id is nullable (driver may not be clocked in).
CREATE TABLE IF NOT EXISTS public.driver_load_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  load_id     uuid        NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  session_id  uuid        REFERENCES public.driver_work_sessions(id) ON DELETE SET NULL,
  outcome     text        NOT NULL DEFAULT 'in_progress'
                           CHECK (outcome IN ('in_progress', 'completed', 'cancelled')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- At most one in-progress load session per load.
CREATE UNIQUE INDEX IF NOT EXISTS driver_load_sessions_one_in_progress_per_load
  ON public.driver_load_sessions (load_id)
  WHERE outcome = 'in_progress';

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.driver_work_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_work_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_live_status         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_load_sessions       ENABLE ROW LEVEL SECURITY;

-- driver_work_sessions -------------------------------------------------------
CREATE POLICY "dws_driver_read_own" ON public.driver_work_sessions
  FOR SELECT USING (driver_id = public.auth_driver_id());

CREATE POLICY "dws_staff_read_tenant" ON public.driver_work_sessions
  FOR SELECT USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_role() IN ('admin', 'dispatcher')
  );

-- driver_work_session_events -------------------------------------------------
CREATE POLICY "dwse_driver_read_own" ON public.driver_work_session_events
  FOR SELECT USING (driver_id = public.auth_driver_id());

CREATE POLICY "dwse_staff_read_tenant" ON public.driver_work_session_events
  FOR SELECT USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_role() IN ('admin', 'dispatcher')
  );

-- driver_live_status ---------------------------------------------------------
CREATE POLICY "dls_tenant_members_read" ON public.driver_live_status
  FOR SELECT USING (tenant_id = public.auth_tenant_id());

-- driver_load_sessions -------------------------------------------------------
CREATE POLICY "dlsess_driver_read_own" ON public.driver_load_sessions
  FOR SELECT USING (driver_id = public.auth_driver_id());

CREATE POLICY "dlsess_staff_read_tenant" ON public.driver_load_sessions
  FOR SELECT USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_role() IN ('admin', 'dispatcher')
  );

-- ---------------------------------------------------------------------------
-- RPC: driver_clock_in
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_clock_in(p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_id       uuid;
  v_tenant_id       uuid;
  v_old_session_id  uuid;
  v_session_id      uuid;
BEGIN
  v_driver_id := auth_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM drivers WHERE id = v_driver_id;

  -- Auto-close any stale open session (safety net).
  SELECT id INTO v_old_session_id
    FROM driver_work_sessions
    WHERE tenant_id = v_tenant_id
      AND driver_id = v_driver_id
      AND clocked_out_at IS NULL;

  IF v_old_session_id IS NOT NULL THEN
    UPDATE driver_work_sessions
      SET clocked_out_at = now(), updated_at = now()
      WHERE id = v_old_session_id;

    INSERT INTO driver_work_session_events
      (tenant_id, session_id, driver_id, event_type, notes, actor_id)
      VALUES (v_tenant_id, v_old_session_id, v_driver_id,
              'clock_out', 'auto-closed on new clock-in', auth.uid());
  END IF;

  -- Open new session.
  INSERT INTO driver_work_sessions (tenant_id, driver_id, notes)
    VALUES (v_tenant_id, v_driver_id, p_notes)
    RETURNING id INTO v_session_id;

  INSERT INTO driver_work_session_events
    (tenant_id, session_id, driver_id, event_type, notes, actor_id)
    VALUES (v_tenant_id, v_session_id, v_driver_id, 'clock_in', p_notes, auth.uid());

  -- Upsert live status snapshot.
  INSERT INTO driver_live_status
    (driver_id, tenant_id, session_id, clocked_in, on_break, clocked_in_since, break_since, updated_at)
    VALUES (v_driver_id, v_tenant_id, v_session_id, true, false, now(), NULL, now())
    ON CONFLICT (driver_id) DO UPDATE
      SET session_id       = EXCLUDED.session_id,
          clocked_in       = true,
          on_break         = false,
          clocked_in_since = EXCLUDED.clocked_in_since,
          break_since      = NULL,
          updated_at       = now();

  RETURN v_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: driver_clock_out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_clock_out(p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_id         uuid;
  v_tenant_id         uuid;
  v_session_id        uuid;
  v_break_started_at  timestamptz;
  v_extra_break_min   int := 0;
BEGIN
  v_driver_id := auth_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM drivers WHERE id = v_driver_id;

  SELECT id, break_started_at
    INTO v_session_id, v_break_started_at
    FROM driver_work_sessions
    WHERE tenant_id = v_tenant_id
      AND driver_id = v_driver_id
      AND clocked_out_at IS NULL;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'no_open_session';
  END IF;

  -- Auto-close any open break and accumulate its minutes.
  IF v_break_started_at IS NOT NULL THEN
    v_extra_break_min :=
      GREATEST(0, EXTRACT(EPOCH FROM (now() - v_break_started_at)) / 60)::int;

    INSERT INTO driver_work_session_events
      (tenant_id, session_id, driver_id, event_type, notes, actor_id)
      VALUES (v_tenant_id, v_session_id, v_driver_id,
              'break_end', 'auto-ended on clock-out', auth.uid());
  END IF;

  UPDATE driver_work_sessions
    SET clocked_out_at      = now(),
        break_started_at    = NULL,
        total_break_minutes = total_break_minutes + v_extra_break_min,
        updated_at          = now()
    WHERE id = v_session_id;

  INSERT INTO driver_work_session_events
    (tenant_id, session_id, driver_id, event_type, notes, actor_id)
    VALUES (v_tenant_id, v_session_id, v_driver_id, 'clock_out', p_notes, auth.uid());

  UPDATE driver_live_status
    SET session_id       = NULL,
        clocked_in       = false,
        on_break         = false,
        clocked_in_since = NULL,
        break_since      = NULL,
        updated_at       = now()
    WHERE driver_id = v_driver_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: driver_start_break
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_start_break(p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_id  uuid;
  v_tenant_id  uuid;
  v_session_id uuid;
BEGIN
  v_driver_id := auth_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM drivers WHERE id = v_driver_id;

  -- Must be clocked in and not already on break.
  SELECT id INTO v_session_id
    FROM driver_work_sessions
    WHERE tenant_id        = v_tenant_id
      AND driver_id        = v_driver_id
      AND clocked_out_at   IS NULL
      AND break_started_at IS NULL;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'no_clockable_session';
  END IF;

  UPDATE driver_work_sessions
    SET break_started_at = now(), updated_at = now()
    WHERE id = v_session_id;

  INSERT INTO driver_work_session_events
    (tenant_id, session_id, driver_id, event_type, notes, actor_id)
    VALUES (v_tenant_id, v_session_id, v_driver_id, 'break_start', p_reason, auth.uid());

  UPDATE driver_live_status
    SET on_break    = true,
        break_since = now(),
        updated_at  = now()
    WHERE driver_id = v_driver_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: driver_end_break
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_end_break()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_id        uuid;
  v_tenant_id        uuid;
  v_session_id       uuid;
  v_break_started_at timestamptz;
  v_break_minutes    int;
BEGIN
  v_driver_id := auth_driver_id();
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'not_a_driver';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM drivers WHERE id = v_driver_id;

  SELECT id, break_started_at
    INTO v_session_id, v_break_started_at
    FROM driver_work_sessions
    WHERE tenant_id        = v_tenant_id
      AND driver_id        = v_driver_id
      AND clocked_out_at   IS NULL
      AND break_started_at IS NOT NULL;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'not_on_break';
  END IF;

  v_break_minutes :=
    GREATEST(0, EXTRACT(EPOCH FROM (now() - v_break_started_at)) / 60)::int;

  UPDATE driver_work_sessions
    SET break_started_at    = NULL,
        total_break_minutes = total_break_minutes + v_break_minutes,
        updated_at          = now()
    WHERE id = v_session_id;

  INSERT INTO driver_work_session_events
    (tenant_id, session_id, driver_id, event_type, notes, actor_id)
    VALUES (v_tenant_id, v_session_id, v_driver_id, 'break_end', NULL, auth.uid());

  UPDATE driver_live_status
    SET on_break    = false,
        break_since = NULL,
        updated_at  = now()
    WHERE driver_id = v_driver_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: dispatch_job  (creates / replaces existing dispatch RPC + adds session)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_job(p_job_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id     uuid;
  v_old_driver_id uuid;
  v_from_status   text;
  v_new_session_id uuid;
BEGIN
  SELECT tenant_id, driver_id, status
    INTO v_tenant_id, v_old_driver_id, v_from_status
    FROM loads
    WHERE id = p_job_id AND tenant_id = auth_tenant_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'load_not_found';
  END IF;

  IF v_from_status NOT IN ('scheduled', 'assigned') THEN
    RAISE EXCEPTION 'invalid_state_transition';
  END IF;

  -- Cancel previous driver's load session when re-dispatching to a different driver.
  IF v_old_driver_id IS NOT NULL AND v_old_driver_id <> p_driver_id THEN
    UPDATE driver_load_sessions
      SET outcome  = 'cancelled',
          ended_at = now()
      WHERE load_id = p_job_id AND outcome = 'in_progress';

    UPDATE drivers
      SET status     = 'available',
          updated_at = now()
      WHERE id = v_old_driver_id AND tenant_id = v_tenant_id;
  END IF;

  UPDATE loads
    SET status       = 'assigned',
        driver_id    = p_driver_id,
        dispatched_at = now(),
        updated_at   = now()
    WHERE id = p_job_id;

  INSERT INTO load_events
    (tenant_id, load_id, actor_id, from_status, to_status, metadata)
    VALUES (v_tenant_id, p_job_id, auth.uid(), v_from_status, 'assigned', '{}');

  UPDATE drivers
    SET status     = 'busy',
        updated_at = now()
    WHERE id = p_driver_id AND tenant_id = v_tenant_id;

  -- Attach the new driver's active session (nullable).
  SELECT id INTO v_new_session_id
    FROM driver_work_sessions
    WHERE driver_id      = p_driver_id
      AND tenant_id      = v_tenant_id
      AND clocked_out_at IS NULL;

  INSERT INTO driver_load_sessions
    (tenant_id, load_id, driver_id, session_id, outcome)
    VALUES (v_tenant_id, p_job_id, p_driver_id, v_new_session_id, 'in_progress')
    ON CONFLICT DO NOTHING; -- same driver re-dispatched: keep existing row
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start_job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
    FROM loads WHERE id = p_job_id AND tenant_id = auth_tenant_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'load_not_found'; END IF;

  UPDATE loads
    SET status     = 'en_route',
        started_at = now(),
        updated_at = now()
    WHERE id = p_job_id AND status = 'assigned';

  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state_transition'; END IF;

  INSERT INTO load_events
    (tenant_id, load_id, actor_id, from_status, to_status, metadata)
    VALUES (v_tenant_id, p_job_id, auth.uid(), 'assigned', 'en_route', '{}');
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: complete_job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id     uuid;
  v_driver_id     uuid;
  v_from_status   text;
BEGIN
  SELECT tenant_id, driver_id, status
    INTO v_tenant_id, v_driver_id, v_from_status
    FROM loads
    WHERE id = p_job_id AND tenant_id = auth_tenant_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'load_not_found'; END IF;

  IF v_from_status NOT IN
      ('assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required') THEN
    RAISE EXCEPTION 'invalid_state_transition';
  END IF;

  UPDATE loads
    SET status       = 'completed',
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_job_id;

  INSERT INTO load_events
    (tenant_id, load_id, actor_id, from_status, to_status, metadata)
    VALUES (v_tenant_id, p_job_id, auth.uid(), v_from_status, 'completed', '{}');

  -- Release driver if they have no other active loads.
  IF v_driver_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM loads
        WHERE driver_id = v_driver_id
          AND tenant_id = v_tenant_id
          AND status IN ('assigned','en_route','on_site','service_done','dumpyard_required')
    ) THEN
      UPDATE drivers
        SET status = 'available', updated_at = now()
        WHERE id = v_driver_id AND tenant_id = v_tenant_id;
    END IF;
  END IF;

  -- Close the load session (graceful: skip if none exists).
  UPDATE driver_load_sessions
    SET outcome  = 'completed',
        ended_at = now()
    WHERE load_id = p_job_id AND outcome = 'in_progress';
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cancel_job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id   uuid;
  v_driver_id   uuid;
  v_from_status text;
BEGIN
  SELECT tenant_id, driver_id, status
    INTO v_tenant_id, v_driver_id, v_from_status
    FROM loads
    WHERE id = p_job_id AND tenant_id = auth_tenant_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'load_not_found'; END IF;

  IF v_from_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'already_terminal';
  END IF;

  UPDATE loads
    SET status       = 'cancelled',
        cancelled_at = now(),
        updated_at   = now()
    WHERE id = p_job_id;

  INSERT INTO load_events
    (tenant_id, load_id, actor_id, from_status, to_status, metadata)
    VALUES (v_tenant_id, p_job_id, auth.uid(), v_from_status, 'cancelled', '{}');

  IF v_driver_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM loads
        WHERE driver_id = v_driver_id
          AND tenant_id = v_tenant_id
          AND status IN ('assigned','en_route','on_site','service_done','dumpyard_required')
    ) THEN
      UPDATE drivers
        SET status = 'available', updated_at = now()
        WHERE id = v_driver_id AND tenant_id = v_tenant_id;
    END IF;
  END IF;

  -- Close the load session (graceful: skip if none exists).
  UPDATE driver_load_sessions
    SET outcome  = 'cancelled',
        ended_at = now()
    WHERE load_id = p_job_id AND outcome = 'in_progress';
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admin_correct_session
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_correct_session(
  p_session_id     uuid,
  p_clocked_in_at  timestamptz,
  p_clocked_out_at timestamptz,
  p_reason         text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_driver_id uuid;
BEGIN
  IF auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  SELECT tenant_id, driver_id
    INTO v_tenant_id, v_driver_id
    FROM driver_work_sessions
    WHERE id = p_session_id AND tenant_id = auth_tenant_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;

  UPDATE driver_work_sessions
    SET clocked_in_at  = p_clocked_in_at,
        clocked_out_at = p_clocked_out_at,
        updated_at     = now()
    WHERE id = p_session_id;

  INSERT INTO driver_work_session_events
    (tenant_id, session_id, driver_id, event_type, notes, actor_id)
    VALUES (v_tenant_id, p_session_id, v_driver_id,
            'admin_correction', p_reason, auth.uid());
END;
$$;
