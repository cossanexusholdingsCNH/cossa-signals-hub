-- Tier-aware entitlement helpers (security definer so RLS on profiles cannot recurse)

CREATE OR REPLACE FUNCTION public.current_tier(_user_id uuid)
RETURNS public.subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.tier
       FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1),
    (SELECT p.subscription_tier FROM public.profiles p WHERE p.id = _user_id),
    'free'::public.subscription_tier
  );
$$;

REVOKE ALL ON FUNCTION public.current_tier(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated;

-- Signal visibility: delay + history window per tier. Demo rows stay visible to all
-- signed-in accounts because they are clearly labelled and carry no live value.
CREATE OR REPLACE FUNCTION public.can_view_signal(_opened_at timestamptz, _is_demo boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_staff(auth.uid()) THEN true
    WHEN COALESCE(_is_demo, false) THEN true
    ELSE CASE public.current_tier(auth.uid())
      WHEN 'pro' THEN true
      WHEN 'basic' THEN _opened_at <= now() - interval '30 minutes'
                     AND _opened_at >= now() - interval '90 days'
      ELSE _opened_at <= now() - interval '2 hours'
           AND _opened_at >= now() - interval '7 days'
    END
  END;
$$;

REVOKE ALL ON FUNCTION public.can_view_signal(timestamptz, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_signal(timestamptz, boolean) TO authenticated;

-- Signals: replace the blanket authenticated read with a tier-gated read
DROP POLICY IF EXISTS "signals auth read" ON public.signals;
CREATE POLICY "signals tier read"
  ON public.signals
  FOR SELECT
  TO authenticated
  USING (public.can_view_signal(opened_at, is_demo));

-- Child evidence tables inherit the parent signal's visibility
DROP POLICY IF EXISTS "indicators auth read" ON public.signal_indicators;
CREATE POLICY "indicators tier read"
  ON public.signal_indicators
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signals s
     WHERE s.id = signal_indicators.signal_id
       AND public.can_view_signal(s.opened_at, s.is_demo)
  ));

DROP POLICY IF EXISTS "votes auth read" ON public.signal_votes;
CREATE POLICY "votes tier read"
  ON public.signal_votes
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signals s
     WHERE s.id = signal_votes.signal_id
       AND public.can_view_signal(s.opened_at, s.is_demo)
  ));

DROP POLICY IF EXISTS "risk auth read" ON public.risk_checks;
CREATE POLICY "risk tier read"
  ON public.risk_checks
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signals s
     WHERE s.id = risk_checks.signal_id
       AND public.can_view_signal(s.opened_at, s.is_demo)
  ));

-- Supporting indexes for the gated lookups
CREATE INDEX IF NOT EXISTS signals_opened_at_idx ON public.signals (opened_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON public.subscriptions (user_id, status);
