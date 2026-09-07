import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  DataHealthRow,
  Heartbeat,
  Instrument,
  MarketRegime,
  PerformanceSnapshot,
  PlatformControls,
  RiskCheck,
  Signal,
  SignalIndicator,
  SignalVote,
  Strategy,
  TierRow,
} from "@/lib/types";

const SIGNAL_SELECT = `
  id, instrument_id, strategy_id, strategy_name, timeframe, direction, confidence_score,
  confidence_grade, confidence_breakdown, signal_quality_score, entry_price, entry_zone_low,
  entry_zone_high, stop_loss, take_profit_1, take_profit_2, take_profit_3, risk_reward_ratio,
  status, mode, validation_status, risk_rating, market_regime, opened_at, expires_at, closed_at,
  current_price, unrealized_return_pct, realized_return_pct, invalidation_reason, signal_reason,
  failure_risk, no_trade_reasons, ai_summary, ai_bullish_evidence, ai_bearish_evidence,
  ai_uncertainty, ai_risk_explanation, ai_market_context, ai_recommendation,
  historical_sample_size, source, source_version, model_version, strategy_version,
  data_timestamp, calculated_at, is_demo, created_at,
  instrument:instruments ( id, symbol, display_name, asset_class, category, risk_rating,
    validation_status, current_price, last_data_at, provider, timeframe_default )
`;

export type SignalRow = Signal;

const LIVE_STATUSES = ["pending", "active", "target_1_hit", "target_2_hit", "target_3_hit"] as const;
const CLOSED_STATUSES = [
  "closed_win",
  "closed_loss",
  "break_even",
  "expired",
  "cancelled",
  "invalidated",
] as const;

export function usePlatformControls() {
  return useQuery({
    queryKey: ["platform_controls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_controls")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PlatformControls | null;
    },
    staleTime: 30_000,
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("*")
        .order("asset_class")
        .order("symbol");
      if (error) throw error;
      return (data ?? []) as unknown as Instrument[];
    },
    staleTime: 60_000,
  });
}

export function useInstrument(symbol: string) {
  return useQuery({
    queryKey: ["instrument", symbol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("*")
        .eq("symbol", symbol)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Instrument | null;
    },
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Strategy[];
    },
    staleTime: 60_000,
  });
}

export function useLiveSignals(limit = 200) {
  return useQuery({
    queryKey: ["signals", "live", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select(SIGNAL_SELECT)
        .in("status", LIVE_STATUSES)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Signal[];
    },
    // Free/Basic entitlements are enforced by RLS using a time delay. Re-query so a
    // row becomes visible when its server-side delay window expires even if no new
    // realtime event is emitted at that exact moment.
    refetchInterval: 30_000,
  });
}

export function useSignalHistory(limit = 200) {
  return useQuery({
    queryKey: ["signals", "history", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select(SIGNAL_SELECT)
        .in("status", CLOSED_STATUSES)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Signal[];
    },
    refetchInterval: 60_000,
  });
}

export function useAllSignals(limit = 300) {
  return useQuery({
    queryKey: ["signals", "all", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select(SIGNAL_SELECT)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Signal[];
    },
  });
}

export function useSignal(id: string) {
  return useQuery({
    queryKey: ["signal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select(SIGNAL_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Signal | null;
    },
  });
}

export function useSignalIndicators(signalId: string) {
  return useQuery({
    queryKey: ["signal_indicators", signalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_indicators")
        .select("*")
        .eq("signal_id", signalId)
        .order("weight", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SignalIndicator[];
    },
  });
}

export function useSignalVotes(signalId: string) {
  return useQuery({
    queryKey: ["signal_votes", signalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_votes")
        .select("*")
        .eq("signal_id", signalId)
        .order("agent_name");
      if (error) throw error;
      return (data ?? []) as unknown as SignalVote[];
    },
  });
}

export function useRiskCheck(signalId: string) {
  return useQuery({
    queryKey: ["risk_check", signalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_checks")
        .select("*")
        .eq("signal_id", signalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RiskCheck | null;
    },
  });
}

export function useMarketRegimes() {
  return useQuery({
    queryKey: ["market_regimes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_regimes")
        .select("*, instrument:instruments ( symbol, display_name, category )")
        .order("detected_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as MarketRegime[];
    },
  });
}

export function usePerformanceSnapshots() {
  return useQuery({
    queryKey: ["performance_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_snapshots")
        .select(
          "*, instrument:instruments ( symbol, display_name, asset_class ), strategy:strategies ( name, strategy_family, validation_status )",
        )
        .order("calculated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PerformanceSnapshot[];
    },
  });
}

export function useDataHealth() {
  return useQuery({
    queryKey: ["data_health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_health")
        .select("*, instrument:instruments ( symbol )")
        .order("last_received_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DataHealthRow[];
    },
  });
}

export function useHeartbeats() {
  return useQuery({
    queryKey: ["service_heartbeats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_heartbeats")
        .select("*")
        .order("service_name");
      if (error) throw error;
      return (data ?? []) as unknown as Heartbeat[];
    },
  });
}

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ["subscription_tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_tiers")
        .select("*")
        .eq("enabled", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as TierRow[];
    },
    staleTime: 300_000,
  });
}

/** One realtime channel for the whole signal surface. */
export function useSignalRealtime(enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("cossa-signals")
      .on("postgres_changes", { event: "*", schema: "public", table: "signals" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["signals"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "data_health" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["data_health"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_controls" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["platform_controls"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

/* ---------------------------------------------------------------- Academy */

export interface AcademyCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface AcademyArticle {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  reading_minutes: number | null;
  level: string | null;
  published: boolean;
  created_at: string;
}

export function useAcademyCategories() {
  return useQuery({
    queryKey: ["academy_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_categories")
        .select("id, slug, name, description, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as AcademyCategory[];
    },
    staleTime: 300_000,
  });
}

export function useAcademyArticles() {
  return useQuery({
    queryKey: ["academy_articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_articles")
        .select("id, category_id, slug, title, summary, content, reading_minutes, level, published, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AcademyArticle[];
    },
    staleTime: 300_000,
  });
}

export function useAcademyArticle(slug: string) {
  return useQuery({
    queryKey: ["academy_article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_articles")
        .select("id, category_id, slug, title, summary, content, reading_minutes, level, published, created_at")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AcademyArticle | null;
    },
  });
}

/* -------------------------------------------------------------- Watchlist */

export interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  instrument_id: string;
  instrument: { id: string; symbol: string; display_name: string; category: string; current_price: number | null; last_data_at: string | null; risk_rating: string } | null;
}

export function useWatchlist(userId: string | undefined) {
  return useQuery({
    queryKey: ["watchlist", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: lists, error: listErr } = await supabase
        .from("watchlists")
        .select("id, name")
        .eq("user_id", userId!)
        .order("created_at")
        .limit(1);
      if (listErr) throw listErr;
      let list = lists?.[0];
      if (!list) {
        const { data: created, error: createErr } = await supabase
          .from("watchlists")
          .insert({ user_id: userId!, name: "My watchlist" })
          .select("id, name")
          .single();
        if (createErr) throw createErr;
        list = created;
      }
      const { data: items, error: itemErr } = await supabase
        .from("watchlist_items")
        .select("id, watchlist_id, instrument_id, instrument:instruments ( id, symbol, display_name, category, current_price, last_data_at, risk_rating )")
        .eq("watchlist_id", list.id);
      if (itemErr) throw itemErr;
      return { list, items: (items ?? []) as unknown as WatchlistItemRow[] };
    },
  });
}

export function useToggleWatchlistItem(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      watchlistId,
      instrumentId,
      existingItemId,
    }: {
      watchlistId: string;
      instrumentId: string;
      existingItemId?: string;
    }) => {
      if (existingItemId) {
        const { error } = await supabase.from("watchlist_items").delete().eq("id", existingItemId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("watchlist_items")
        .insert({ watchlist_id: watchlistId, instrument_id: instrumentId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    },
  });
}

/* ------------------------------------------------------- Alert preferences */

export type AlertPrefs = {
  id: string;
  user_id: string;
  new_signal: boolean;
  high_confidence_signal: boolean;
  signal_invalidated: boolean;
  target_hit: boolean;
  stop_loss_hit: boolean;
  instrument_becomes_active: boolean;
  regime_change: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_telegram: boolean;
  channel_whatsapp: boolean;
  channel_push: boolean;
  telegram_handle: string | null;
  whatsapp_number: string | null;
};

export function useAlertPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ["alert_preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_preferences")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as AlertPrefs;
      const { data: created, error: createErr } = await supabase
        .from("alert_preferences")
        .insert({ user_id: userId! })
        .select("*")
        .single();
      if (createErr) throw createErr;
      return created as unknown as AlertPrefs;
    },
  });
}

export function useUpdateAlertPreferences(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AlertPrefs>) => {
      const { error } = await supabase
        .from("alert_preferences")
        .update(patch)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alert_preferences", userId] });
    },
  });
}

/* ---------------------------------------------------------- Subscriptions */

export interface SubscriptionRow {
  id: string;
  tier: "free" | "basic" | "pro";
  provider: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export function useMySubscription(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, tier, provider, status, current_period_start, current_period_end, cancelled_at, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SubscriptionRow | null;
    },
  });
}

/* ------------------------------------------------------------------ Admin */

export interface AuditLogRow {
  id: string;
  actor_label: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: ["audit_logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor_label, action, entity, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AuditLogRow[];
    },
  });
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  country: string | null;
  subscription_tier: "free" | "basic" | "pro";
  subscription_status: string;
  last_login_at: string | null;
  created_at: string;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, country, subscription_tier, subscription_status, last_login_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdminUserRow[];
    },
  });
}

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        name: string;
        model_type: string;
        version: string;
        validation_status: string;
        training_period: string | null;
        test_period: string | null;
        features_used: string[];
        enabled: boolean;
      }[];
    },
  });
}

export function useUpdatePlatformControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("platform_controls").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform_controls"] });
    },
  });
}
