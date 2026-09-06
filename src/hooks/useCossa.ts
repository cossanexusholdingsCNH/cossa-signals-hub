import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
