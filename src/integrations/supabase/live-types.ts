import type { Database as BaseDatabase, Json } from './types';

type ExecutionMode = 'signals_only' | 'paper_auto' | 'live_manual';
type ExecutionOrderStatus =
  | 'draft'
  | 'awaiting_confirmation'
  | 'approved'
  | 'submitted'
  | 'filled'
  | 'partially_filled'
  | 'rejected'
  | 'cancelled'
  | 'closed'
  | 'failed';
type ExecutionSide = 'buy' | 'sell';
type SignalDirection = BaseDatabase['public']['Enums']['signal_direction'];
type RegimeType = BaseDatabase['public']['Enums']['regime_type'];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type LiveTables = {
  market_candles: Table<
    {
      id: number;
      instrument_id: string;
      provider_id: string;
      provider_symbol: string;
      timeframe: string;
      open_time: string;
      close_time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
      tick_count: number | null;
      is_closed: boolean;
      received_at: string;
      is_demo: boolean;
      metadata: Json;
    },
    {
      id?: never;
      instrument_id: string;
      provider_id: string;
      provider_symbol: string;
      timeframe: string;
      open_time: string;
      close_time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number | null;
      tick_count?: number | null;
      is_closed?: boolean;
      received_at?: string;
      is_demo?: boolean;
      metadata?: Json;
    },
    {
      instrument_id?: string;
      provider_id?: string;
      provider_symbol?: string;
      timeframe?: string;
      open_time?: string;
      close_time?: string;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number | null;
      tick_count?: number | null;
      is_closed?: boolean;
      received_at?: string;
      is_demo?: boolean;
      metadata?: Json;
    }
  >;
  signal_evidence: Table<
    {
      id: string;
      fingerprint: string;
      instrument_id: string;
      provider_id: string;
      provider_symbol: string;
      timeframe: string;
      engine_version: string;
      data_from: string;
      data_to: string;
      candle_count: number;
      direction: SignalDirection;
      regime: RegimeType;
      confidence_score: number;
      entry: number | null;
      entry_zone_low: number | null;
      entry_zone_high: number | null;
      stop_loss: number | null;
      take_profit_1: number | null;
      take_profit_2: number | null;
      take_profit_3: number | null;
      risk_reward_ratio: number | null;
      indicators: Json;
      reasons: string[];
      no_trade_reasons: string[];
      generated_at: string;
      created_at: string;
    },
    {
      id?: string;
      fingerprint: string;
      instrument_id: string;
      provider_id: string;
      provider_symbol: string;
      timeframe: string;
      engine_version: string;
      data_from: string;
      data_to: string;
      candle_count: number;
      direction: SignalDirection;
      regime?: RegimeType;
      confidence_score: number;
      entry?: number | null;
      entry_zone_low?: number | null;
      entry_zone_high?: number | null;
      stop_loss?: number | null;
      take_profit_1?: number | null;
      take_profit_2?: number | null;
      take_profit_3?: number | null;
      risk_reward_ratio?: number | null;
      indicators?: Json;
      reasons?: string[];
      no_trade_reasons?: string[];
      generated_at: string;
      created_at?: string;
    },
    Record<string, never>
  >;
  signal_engine_runs: Table<
    {
      id: string;
      instrument_id: string;
      timeframe: string;
      engine_version: string;
      status: string;
      data_from: string | null;
      data_to: string | null;
      candle_count: number;
      regime: RegimeType;
      direction: SignalDirection;
      confidence_score: number | null;
      risk_status: BaseDatabase['public']['Enums']['risk_gate_status'] | null;
      signal_id: string | null;
      no_trade_reasons: string[];
      diagnostics: Json;
      started_at: string;
      finished_at: string | null;
      created_at: string;
    },
    {
      id?: string;
      instrument_id: string;
      timeframe: string;
      engine_version: string;
      status: string;
      data_from?: string | null;
      data_to?: string | null;
      candle_count?: number;
      regime?: RegimeType;
      direction?: SignalDirection;
      confidence_score?: number | null;
      risk_status?: BaseDatabase['public']['Enums']['risk_gate_status'] | null;
      signal_id?: string | null;
      no_trade_reasons?: string[];
      diagnostics?: Json;
      started_at?: string;
      finished_at?: string | null;
      created_at?: string;
    },
    Record<string, never>
  >;
  trading_accounts: Table<
    {
      id: string;
      user_id: string;
      provider: string;
      provider_account_ref: string | null;
      account_label: string;
      account_environment: string;
      execution_mode: ExecutionMode;
      enabled: boolean;
      currency: string | null;
      max_risk_per_trade_pct: number;
      max_daily_loss_pct: number;
      max_open_positions: number;
      emergency_stop: boolean;
      last_reconciled_at: string | null;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      user_id: string;
      provider: string;
      provider_account_ref?: string | null;
      account_label: string;
      account_environment: string;
      execution_mode?: ExecutionMode;
      enabled?: boolean;
      currency?: string | null;
      max_risk_per_trade_pct?: number;
      max_daily_loss_pct?: number;
      max_open_positions?: number;
      emergency_stop?: boolean;
      last_reconciled_at?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    Record<string, never>
  >;
  execution_orders: Table<
    {
      id: string;
      user_id: string;
      trading_account_id: string;
      signal_id: string | null;
      instrument_id: string;
      side: ExecutionSide;
      execution_mode: ExecutionMode;
      status: ExecutionOrderStatus;
      requested_entry: number | null;
      stop_loss: number | null;
      take_profit_1: number | null;
      take_profit_2: number | null;
      take_profit_3: number | null;
      requested_amount: number;
      requested_currency: string | null;
      risk_pct: number | null;
      risk_reward_ratio: number | null;
      provider_order_ref: string | null;
      provider_position_ref: string | null;
      idempotency_key: string;
      confirmation_required: boolean;
      confirmed_by: string | null;
      confirmed_at: string | null;
      submitted_at: string | null;
      filled_at: string | null;
      closed_at: string | null;
      average_fill_price: number | null;
      close_price: number | null;
      realized_pnl: number | null;
      rejection_reason: string | null;
      error_code: string | null;
      error_message: string | null;
      metadata: Json;
      created_at: string;
      updated_at: string;
    },
    {
      id?: string;
      user_id: string;
      trading_account_id: string;
      signal_id?: string | null;
      instrument_id: string;
      side: ExecutionSide;
      execution_mode: ExecutionMode;
      status?: ExecutionOrderStatus;
      requested_entry?: number | null;
      stop_loss?: number | null;
      take_profit_1?: number | null;
      take_profit_2?: number | null;
      take_profit_3?: number | null;
      requested_amount: number;
      requested_currency?: string | null;
      risk_pct?: number | null;
      risk_reward_ratio?: number | null;
      provider_order_ref?: string | null;
      provider_position_ref?: string | null;
      idempotency_key: string;
      confirmation_required?: boolean;
      confirmed_by?: string | null;
      confirmed_at?: string | null;
      submitted_at?: string | null;
      filled_at?: string | null;
      closed_at?: string | null;
      average_fill_price?: number | null;
      close_price?: number | null;
      realized_pnl?: number | null;
      rejection_reason?: string | null;
      error_code?: string | null;
      error_message?: string | null;
      metadata?: Json;
      created_at?: string;
      updated_at?: string;
    },
    {
      status?: ExecutionOrderStatus;
      requested_amount?: number;
      risk_pct?: number | null;
      rejection_reason?: string | null;
      submitted_at?: string | null;
      metadata?: Json;
    }
  >;
  execution_risk_checks: Table<
    {
      id: string;
      order_id: string;
      approved: boolean;
      account_enabled: boolean;
      emergency_stop_clear: boolean;
      daily_loss_gate_clear: boolean;
      open_position_gate_clear: boolean;
      per_trade_risk_gate_clear: boolean;
      signal_quality_gate_clear: boolean;
      stale_data_gate_clear: boolean;
      duplicate_order_gate_clear: boolean;
      checks: Json;
      rejection_reasons: string[];
      checked_at: string;
    },
    {
      id?: string;
      order_id: string;
      approved?: boolean;
      account_enabled?: boolean;
      emergency_stop_clear?: boolean;
      daily_loss_gate_clear?: boolean;
      open_position_gate_clear?: boolean;
      per_trade_risk_gate_clear?: boolean;
      signal_quality_gate_clear?: boolean;
      stale_data_gate_clear?: boolean;
      duplicate_order_gate_clear?: boolean;
      checks?: Json;
      rejection_reasons?: string[];
      checked_at?: string;
    },
    Record<string, never>
  >;
  execution_events: Table<
    {
      id: number;
      order_id: string;
      event_type: string;
      old_status: ExecutionOrderStatus | null;
      new_status: ExecutionOrderStatus | null;
      provider_event_ref: string | null;
      payload: Json;
      created_at: string;
    },
    {
      id?: never;
      order_id: string;
      event_type: string;
      old_status?: ExecutionOrderStatus | null;
      new_status?: ExecutionOrderStatus | null;
      provider_event_ref?: string | null;
      payload?: Json;
      created_at?: string;
    },
    Record<string, never>
  >;
  trading_account_snapshots: Table<
    {
      id: string;
      trading_account_id: string;
      equity: number;
      balance: number;
      available_balance: number | null;
      currency: string;
      open_positions: number;
      provider_timestamp: string | null;
      captured_at: string;
      metadata: Json;
    },
    Record<string, never>,
    Record<string, never>
  >;
  trading_daily_risk_state: Table<
    {
      id: string;
      trading_account_id: string;
      trading_date: string;
      start_of_day_equity: number;
      realized_pnl: number;
      peak_equity: number | null;
      lowest_equity: number | null;
      trades_opened: number;
      trades_closed: number;
      loss_limit_triggered: boolean;
      updated_at: string;
      created_at: string;
    },
    Record<string, never>,
    Record<string, never>
  >;
};

export type Database = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables' | 'Enums'> & {
    Tables: BaseDatabase['public']['Tables'] & LiveTables;
    Enums: BaseDatabase['public']['Enums'] & {
      execution_mode: ExecutionMode;
      execution_order_status: ExecutionOrderStatus;
      execution_side: ExecutionSide;
    };
  };
};
