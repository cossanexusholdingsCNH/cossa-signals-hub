-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','analyst','support','user');
CREATE TYPE public.asset_class AS ENUM ('forex','synthetic_index','index','equity','commodity');
CREATE TYPE public.validation_status AS ENUM ('experimental','backtested','validation_pending','paper_trading','paper_validated','live_verified','paused','rejected');
CREATE TYPE public.signal_direction AS ENUM ('buy','sell','neutral','wait','no_trade');
CREATE TYPE public.confidence_grade AS ENUM ('low','moderate','strong','high');
CREATE TYPE public.signal_status AS ENUM ('pending','active','target_1_hit','target_2_hit','target_3_hit','closed_win','closed_loss','break_even','expired','cancelled','invalidated');
CREATE TYPE public.signal_mode AS ENUM ('research','backtest','paper','live_verified');
CREATE TYPE public.regime_type AS ENUM ('trending_up','trending_down','ranging','high_volatility','low_volatility','spike_risk','reset_window','breakout','unstable','unknown');
CREATE TYPE public.indicator_direction AS ENUM ('bullish','bearish','neutral');
CREATE TYPE public.risk_rating AS ENUM ('low','moderate','high','extreme');
CREATE TYPE public.risk_gate_status AS ENUM ('approved','caution','rejected');
CREATE TYPE public.agent_vote AS ENUM ('buy','sell','neutral','reject');
CREATE TYPE public.data_status AS ENUM ('healthy','delayed','stale','offline');
CREATE TYPE public.recommendation_type AS ENUM ('strong_setup','moderate_setup','weak_setup','wait','avoid');
CREATE TYPE public.subscription_tier AS ENUM ('free','basic','pro');

-- ============ SHARED HELPERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin','analyst'));
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin'));
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  country TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'ZAR',
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  risk_disclosure_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ INSTRUMENTS ============
CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  asset_class public.asset_class NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deriv',
  timeframe_default TEXT NOT NULL DEFAULT '5m',
  market_status TEXT NOT NULL DEFAULT 'unknown',
  enabled BOOLEAN NOT NULL DEFAULT true,
  validation_status public.validation_status NOT NULL DEFAULT 'experimental',
  minimum_sample_required INT NOT NULL DEFAULT 30,
  description TEXT,
  market_characteristics TEXT,
  risk_rating public.risk_rating NOT NULL DEFAULT 'high',
  data_source TEXT,
  last_data_at TIMESTAMPTZ,
  current_price NUMERIC,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_instruments_category ON public.instruments(category);
CREATE INDEX idx_instruments_asset_class ON public.instruments(asset_class);
GRANT SELECT ON public.instruments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruments TO authenticated;
GRANT ALL ON public.instruments TO service_role;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments public read" ON public.instruments FOR SELECT USING (true);
CREATE POLICY "instruments staff write" ON public.instruments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER instruments_updated BEFORE UPDATE ON public.instruments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STRATEGIES ============
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  strategy_family TEXT NOT NULL,
  applicable_instruments TEXT[] NOT NULL DEFAULT '{}',
  applicable_timeframes TEXT[] NOT NULL DEFAULT '{}',
  validation_status public.validation_status NOT NULL DEFAULT 'experimental',
  minimum_trades INT NOT NULL DEFAULT 30,
  version TEXT NOT NULL DEFAULT '0.1.0',
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.strategies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies public read" ON public.strategies FOR SELECT USING (true);
CREATE POLICY "strategies staff write" ON public.strategies FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER strategies_updated BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MODELS ============
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  model_type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '0.1.0',
  validation_status public.validation_status NOT NULL DEFAULT 'experimental',
  training_period TEXT,
  test_period TEXT,
  features_used TEXT[] NOT NULL DEFAULT '{}',
  performance_summary JSONB,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.models TO authenticated;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "models auth read" ON public.models FOR SELECT TO authenticated USING (true);
CREATE POLICY "models staff write" ON public.models FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER models_updated BEFORE UPDATE ON public.models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SIGNALS ============
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  strategy_name TEXT,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  timeframe TEXT NOT NULL DEFAULT '5m',
  direction public.signal_direction NOT NULL DEFAULT 'wait',
  confidence_score NUMERIC,
  confidence_grade public.confidence_grade,
  confidence_breakdown JSONB,
  signal_quality_score NUMERIC,
  entry_price NUMERIC,
  entry_zone_low NUMERIC,
  entry_zone_high NUMERIC,
  stop_loss NUMERIC,
  take_profit_1 NUMERIC,
  take_profit_2 NUMERIC,
  take_profit_3 NUMERIC,
  risk_reward_ratio NUMERIC,
  status public.signal_status NOT NULL DEFAULT 'pending',
  mode public.signal_mode NOT NULL DEFAULT 'research',
  validation_status public.validation_status NOT NULL DEFAULT 'experimental',
  risk_rating public.risk_rating NOT NULL DEFAULT 'moderate',
  market_regime public.regime_type NOT NULL DEFAULT 'unknown',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  current_price NUMERIC,
  unrealized_return_pct NUMERIC,
  realized_return_pct NUMERIC,
  invalidation_reason TEXT,
  signal_reason TEXT,
  failure_risk TEXT,
  no_trade_reasons TEXT[] NOT NULL DEFAULT '{}',
  ai_summary TEXT,
  ai_bullish_evidence TEXT,
  ai_bearish_evidence TEXT,
  ai_uncertainty TEXT,
  ai_risk_explanation TEXT,
  ai_market_context TEXT,
  ai_recommendation public.recommendation_type,
  historical_sample_size INT,
  source TEXT DEFAULT 'cossa-signals-python',
  source_version TEXT,
  model_version TEXT,
  strategy_version TEXT,
  data_timestamp TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signals_instrument ON public.signals(instrument_id);
CREATE INDEX idx_signals_status ON public.signals(status);
CREATE INDEX idx_signals_opened_at ON public.signals(opened_at DESC);
CREATE INDEX idx_signals_direction ON public.signals(direction);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals auth read" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "signals staff write" ON public.signals FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER signals_updated BEFORE UPDATE ON public.signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SIGNAL INDICATORS ============
CREATE TABLE public.signal_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  indicator_name TEXT NOT NULL,
  indicator_value NUMERIC,
  indicator_display TEXT,
  interpretation TEXT,
  direction public.indicator_direction NOT NULL DEFAULT 'neutral',
  weight NUMERIC,
  timeframe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signal_indicators_signal ON public.signal_indicators(signal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_indicators TO authenticated;
GRANT ALL ON public.signal_indicators TO service_role;
ALTER TABLE public.signal_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "indicators auth read" ON public.signal_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "indicators staff write" ON public.signal_indicators FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ SIGNAL VOTES ============
CREATE TABLE public.signal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  vote public.agent_vote NOT NULL,
  confidence NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signal_votes_signal ON public.signal_votes(signal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_votes TO authenticated;
GRANT ALL ON public.signal_votes TO service_role;
ALTER TABLE public.signal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes auth read" ON public.signal_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes staff write" ON public.signal_votes FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ RISK CHECKS ============
CREATE TABLE public.risk_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  overall_status public.risk_gate_status NOT NULL DEFAULT 'caution',
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_checks_signal ON public.risk_checks(signal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_checks TO authenticated;
GRANT ALL ON public.risk_checks TO service_role;
ALTER TABLE public.risk_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk auth read" ON public.risk_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk staff write" ON public.risk_checks FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ MARKET REGIMES ============
CREATE TABLE public.market_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  timeframe TEXT NOT NULL DEFAULT '5m',
  regime public.regime_type NOT NULL DEFAULT 'unknown',
  confidence_score NUMERIC,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_regimes_instrument ON public.market_regimes(instrument_id, detected_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_regimes TO authenticated;
GRANT ALL ON public.market_regimes TO service_role;
ALTER TABLE public.market_regimes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regimes auth read" ON public.market_regimes FOR SELECT TO authenticated USING (true);
CREATE POLICY "regimes staff write" ON public.market_regimes FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ PERFORMANCE SNAPSHOTS ============
CREATE TABLE public.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  timeframe TEXT,
  mode public.signal_mode NOT NULL DEFAULT 'backtest',
  period TEXT,
  total_trades INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  break_even INT NOT NULL DEFAULT 0,
  win_rate NUMERIC,
  average_win NUMERIC,
  average_loss NUMERIC,
  profit_factor NUMERIC,
  avg_rr_ratio NUMERIC,
  max_drawdown NUMERIC,
  sharpe_ratio NUMERIC,
  total_return_pct NUMERIC,
  benchmark_return_pct NUMERIC,
  beats_benchmark BOOLEAN,
  sample_reliable BOOLEAN NOT NULL DEFAULT false,
  avg_signal_duration_minutes NUMERIC,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_perf_instrument ON public.performance_snapshots(instrument_id);
CREATE INDEX idx_perf_strategy ON public.performance_snapshots(strategy_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_snapshots TO authenticated;
GRANT ALL ON public.performance_snapshots TO service_role;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf auth read" ON public.performance_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "perf staff write" ON public.performance_snapshots FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ WATCHLISTS ============
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Watchlist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlists" ON public.watchlists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, instrument_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist items" ON public.watchlist_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));

-- ============ ALERT PREFERENCES ============
CREATE TABLE public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  new_signal BOOLEAN NOT NULL DEFAULT true,
  high_confidence_signal BOOLEAN NOT NULL DEFAULT true,
  signal_invalidated BOOLEAN NOT NULL DEFAULT false,
  target_hit BOOLEAN NOT NULL DEFAULT true,
  stop_loss_hit BOOLEAN NOT NULL DEFAULT true,
  instrument_becomes_active BOOLEAN NOT NULL DEFAULT false,
  regime_change BOOLEAN NOT NULL DEFAULT false,
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  channel_telegram BOOLEAN NOT NULL DEFAULT false,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,
  channel_push BOOLEAN NOT NULL DEFAULT false,
  telegram_handle TEXT,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_preferences TO authenticated;
GRANT ALL ON public.alert_preferences TO service_role;
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alert_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER alerts_updated BEFORE UPDATE ON public.alert_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DATA HEALTH ============
CREATE TABLE public.data_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE CASCADE,
  last_received_at TIMESTAMPTZ,
  latency_ms INT,
  status public.data_status NOT NULL DEFAULT 'offline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_health_instrument ON public.data_health(instrument_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_health TO authenticated;
GRANT ALL ON public.data_health TO service_role;
ALTER TABLE public.data_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data health auth read" ON public.data_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "data health staff write" ON public.data_health FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ SERVICE HEARTBEATS ============
CREATE TABLE public.service_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  status public.data_status NOT NULL DEFAULT 'offline',
  last_heartbeat TIMESTAMPTZ,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_heartbeats TO authenticated;
GRANT ALL ON public.service_heartbeats TO service_role;
ALTER TABLE public.service_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heartbeats staff read" ON public.service_heartbeats FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "heartbeats admin write" ON public.service_heartbeats FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID,
  actor_label TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit staff read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "audit staff insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ============ PLATFORM CONTROLS ============
CREATE TABLE public.platform_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signals_enabled BOOLEAN NOT NULL DEFAULT true,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  emergency_message TEXT,
  stale_threshold_seconds INT NOT NULL DEFAULT 120,
  minimum_sample_size INT NOT NULL DEFAULT 30,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_controls TO anon;
GRANT SELECT, UPDATE ON public.platform_controls TO authenticated;
GRANT ALL ON public.platform_controls TO service_role;
ALTER TABLE public.platform_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "controls public read" ON public.platform_controls FOR SELECT USING (true);
CREATE POLICY "controls admin write" ON public.platform_controls FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.platform_controls (signals_enabled) VALUES (true);

-- ============ SUBSCRIPTION TIERS ============
CREATE TABLE public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  features TEXT[] NOT NULL DEFAULT '{}',
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_tiers TO authenticated;
GRANT ALL ON public.subscription_tiers TO service_role;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers public read" ON public.subscription_tiers FOR SELECT USING (true);
CREATE POLICY "tiers admin write" ON public.subscription_tiers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.subscription_tiers (tier, name, description, price_monthly, features, entitlements, sort_order) VALUES
('free','Free','Get started with delayed signals and the full education hub.',0,
 ARRAY['Limited instruments','Delayed signals','Limited signal history','Education hub','Limited performance data'],
 '{"max_instruments":5,"signal_delay_seconds":900,"history_days":7,"realtime":false,"ai_analysis":false,"advanced_filters":false,"watchlists":0,"alerts":false}'::jsonb,1),
('basic','Basic','More instruments, full history, watchlists and alerts.',299,
 ARRAY['More instruments','Faster signals','Full signal history','Watchlists','Alerts'],
 '{"max_instruments":20,"signal_delay_seconds":120,"history_days":365,"realtime":false,"ai_analysis":false,"advanced_filters":true,"watchlists":3,"alerts":true}'::jsonb,2),
('pro','Pro','Real-time matrix, all instruments, advanced AI analysis and analytics.',799,
 ARRAY['Real-time Smart Matrix','All available instruments','Advanced AI analysis','Full strategy analytics','Priority alerts','Detailed market intelligence','Advanced filters'],
 '{"max_instruments":null,"signal_delay_seconds":0,"history_days":null,"realtime":true,"ai_analysis":true,"advanced_filters":true,"watchlists":10,"alerts":true}'::jsonb,3);

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  provider TEXT NOT NULL DEFAULT 'payfast',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ ACADEMY ============
CREATE TABLE public.academy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academy_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_categories TO authenticated;
GRANT ALL ON public.academy_categories TO service_role;
ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academy cat public read" ON public.academy_categories FOR SELECT USING (true);
CREATE POLICY "academy cat staff write" ON public.academy_categories FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.academy_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.academy_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  reading_minutes INT,
  level TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_articles_category ON public.academy_articles(category_id);
GRANT SELECT ON public.academy_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_articles TO authenticated;
GRANT ALL ON public.academy_articles TO service_role;
ALTER TABLE public.academy_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles public read published" ON public.academy_articles FOR SELECT USING (published = true);
CREATE POLICY "articles staff read all" ON public.academy_articles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "articles staff write" ON public.academy_articles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER articles_updated BEFORE UPDATE ON public.academy_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.academy_categories (slug, name, description, sort_order) VALUES
('forex-basics','Forex Basics','Currency pairs, sessions, spreads and order mechanics.',1),
('synthetic-indices','Synthetic Indices','How Deriv synthetic markets are constructed and behave.',2),
('volatility-indices','Volatility Indices','Volatility 10 to 300 and the 1s variants.',3),
('boom-crash','Boom & Crash','Spike mechanics and why spike direction matters.',4),
('bull-bear','Bull/Bear','Directional-bias synthetic markets.',5),
('step-index','Step Index','Fixed step-size market behaviour.',6),
('indicators','Indicators','RSI, MACD, moving averages, ATR, ADX and more.',7),
('risk-management','Risk Management','Position sizing, stop placement and drawdown control.',8),
('backtesting','Backtesting','Sample size, overfitting and validation discipline.',9),
('market-psychology','Market Psychology','Discipline, patience and decision quality.',10),
('ai-and-trading','AI & Trading','What machine learning can and cannot do in markets.',11),
('understanding-signals','Understanding Signals','How to read a Cossa Signals card end to end.',12);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_regimes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.data_health;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_controls;