-- COSSA SIGNALS SECURITY HARDENING
-- Additive migration. Does not delete user data or alter existing signal records.
-- Goals:
--   1) enforce subscription delay/history windows at RLS level;
--   2) make the global signal kill switch authoritative at the database read layer;
--   3) prevent child signal evidence tables from bypassing signal visibility;
--   4) explicitly mark demo health/heartbeat telemetry.

-- Effective tier is derived server-side. Inactive accounts are treated as Free.
CREATE OR REPLACE FUNCTION public.effective_subscription_tier(_user_id uuid)
RETURNS public.subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN p.subscription_status IN ('active', 'trialing') THEN p.subscription_tier
        ELSE 'free'::public.subscription_tier
      END
      FROM public.profiles p
      WHERE p.id = _user_id
      LIMIT 1
    ),
    'free'::public.subscription_tier
  );
$$;

REVOKE ALL ON FUNCTION public.effective_subscription_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_subscription_tier(uuid) TO authenticated;

-- Central visibility rule for signals. Staff can always inspect records.
-- Non-staff users are subject to the platform kill switch plus tier delay/history windows.
CREATE OR REPLACE FUNCTION public.can_read_signal(
  _user_id uuid,
  _opened_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_staff(_user_id)
    OR (
      COALESCE((SELECT pc.signals_enabled FROM public.platform_controls pc ORDER BY pc.created_at ASC LIMIT 1), false)
      AND CASE public.effective_subscription_tier(_user_id)
        WHEN 'pro' THEN true
        WHEN 'basic' THEN
          _opened_at <= now() - interval '120 seconds'
          AND _opened_at >= now() - interval '365 days'
        ELSE
          _opened_at <= now() - interval '900 seconds'
          AND _opened_at >= now() - interval '7 days'
      END
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_signal(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_signal(uuid, timestamptz) TO authenticated;

DROP POLICY IF EXISTS "signals auth read" ON public.signals;
DROP POLICY IF EXISTS "signals entitlement read" ON public.signals;
CREATE POLICY "signals entitlement read"
ON public.signals
FOR SELECT
TO authenticated
USING (public.can_read_signal(auth.uid(), opened_at));

-- Child evidence must never reveal a signal the user cannot read.
DROP POLICY IF EXISTS "indicators auth read" ON public.signal_indicators;
DROP POLICY IF EXISTS "indicators entitlement read" ON public.signal_indicators;
CREATE POLICY "indicators entitlement read"
ON public.signal_indicators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.signals s
    WHERE s.id = signal_id
      AND public.can_read_signal(auth.uid(), s.opened_at)
  )
);

DROP POLICY IF EXISTS "votes auth read" ON public.signal_votes;
DROP POLICY IF EXISTS "votes entitlement read" ON public.signal_votes;
CREATE POLICY "votes entitlement read"
ON public.signal_votes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.signals s
    WHERE s.id = signal_id
      AND public.can_read_signal(auth.uid(), s.opened_at)
  )
);

DROP POLICY IF EXISTS "risk auth read" ON public.risk_checks;
DROP POLICY IF EXISTS "risk entitlement read" ON public.risk_checks;
CREATE POLICY "risk entitlement read"
ON public.risk_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.signals s
    WHERE s.id = signal_id
      AND public.can_read_signal(auth.uid(), s.opened_at)
  )
);

-- Demo telemetry must be explicit. The original seed migration created simulated
-- healthy rows without a demo discriminator, which could be mistaken for live health.
ALTER TABLE public.data_health
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_heartbeats
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

UPDATE public.data_health dh
SET is_demo = true
WHERE EXISTS (
  SELECT 1 FROM public.instruments i
  WHERE i.id = dh.instrument_id AND i.is_demo = true
);

-- The current bootstrap heartbeats are seeded demo records. Real backend workers
-- should upsert with is_demo=false when they take ownership of these services.
UPDATE public.service_heartbeats
SET is_demo = true
WHERE service_name IN ('signal-engine', 'deriv-feed', 'forex-feed', 'realtime');

COMMENT ON COLUMN public.data_health.is_demo IS
  'True when the health row is simulated/demo telemetry rather than a live provider heartbeat.';
COMMENT ON COLUMN public.service_heartbeats.is_demo IS
  'True when the service heartbeat is seeded/demo telemetry rather than a live worker heartbeat.';
