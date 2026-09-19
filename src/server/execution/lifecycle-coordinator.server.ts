import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shouldCloseAtRiskBoundary,
  type ExecutionAdapter,
  type NormalizedExecutionOrder,
} from "./execution-adapter";

function num(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function recordEvent(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    eventType: string;
    oldStatus: string | null;
    newStatus: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("execution_events").insert({
    order_id: input.orderId,
    event_type: input.eventType,
    old_status: input.oldStatus,
    new_status: input.newStatus,
    payload: input.payload ?? {},
  });
  if (error) throw error;
}

export async function fillSubmittedOrder(input: {
  supabase: SupabaseClient;
  adapter: ExecutionAdapter;
  order: NormalizedExecutionOrder;
  signalId?: string | null;
}) {
  const { supabase, adapter, order } = input;
  if (adapter.environment !== order.environment) throw new Error("Execution environment mismatch");

  const fill = await adapter.submit(order);

  const { data: position, error: positionError } = await supabase
    .from("execution_positions")
    .upsert(
      {
        user_id: order.userId,
        trading_account_id: order.accountId,
        order_id: order.orderId,
        signal_id: input.signalId ?? null,
        instrument_id: order.instrumentId,
        environment: order.environment,
        provider: adapter.provider,
        side: order.side,
        status: "open",
        quantity: fill.quantity,
        entry_price: fill.price,
        current_price: fill.price,
        stop_loss: order.stopLoss,
        take_profit_1: order.takeProfit1,
        take_profit_2: order.takeProfit2,
        take_profit_3: order.takeProfit3,
        provider_order_ref: fill.providerOrderRef,
        provider_position_ref: fill.providerPositionRef,
        opened_at: fill.filledAt,
        metadata: { ...(fill.metadata ?? {}), provider_symbol: order.providerSymbol },
      },
      { onConflict: "order_id" },
    )
    .select("id")
    .single();

  if (positionError || !position) throw positionError ?? new Error("Position persistence failed");

  const { error: fillError } = await supabase.from("execution_fills").upsert(
    {
      order_id: order.orderId,
      position_id: position.id,
      environment: order.environment,
      provider: adapter.provider,
      provider_fill_ref: fill.providerFillRef,
      side: fill.side,
      quantity: fill.quantity,
      price: fill.price,
      fee: fill.fee,
      fee_currency: fill.feeCurrency,
      filled_at: fill.filledAt,
      metadata: fill.metadata ?? {},
    },
    { onConflict: "provider,provider_fill_ref", ignoreDuplicates: true },
  );
  if (fillError) throw fillError;

  const { error: orderError } = await supabase
    .from("execution_orders")
    .update({
      status: "filled",
      average_fill_price: fill.price,
      provider_order_ref: fill.providerOrderRef,
      provider_position_ref: fill.providerPositionRef,
      filled_at: fill.filledAt,
    })
    .eq("id", order.orderId)
    .eq("status", "submitted");
  if (orderError) throw orderError;

  await recordEvent(supabase, {
    orderId: order.orderId,
    eventType: "execution_filled",
    oldStatus: "submitted",
    newStatus: "filled",
    payload: {
      position_id: position.id,
      provider: adapter.provider,
      environment: order.environment,
      fill_price: fill.price,
      quantity: fill.quantity,
    },
  });

  return { positionId: position.id, fill };
}

export async function monitorOpenPosition(input: {
  supabase: SupabaseClient;
  adapter: ExecutionAdapter;
  order: NormalizedExecutionOrder;
  position: {
    id: string;
    provider_position_ref: string;
    entry_price: number;
    quantity: number;
    side: "buy" | "sell";
    stop_loss: number | null;
    take_profit_1: number | null;
  };
}) {
  const { supabase, adapter, order, position } = input;
  const durablePosition = {
    providerPositionRef: position.provider_position_ref,
    providerSymbol: order.providerSymbol,
    side: position.side,
    entryPrice: num(position.entry_price, "entry price"),
    quantity: num(position.quantity, "position quantity"),
  };
  const snapshot = await adapter.snapshot(durablePosition);

  const boundary = shouldCloseAtRiskBoundary({
    side: order.side,
    currentPrice: snapshot.currentPrice,
    stopLoss: position.stop_loss,
    takeProfit: position.take_profit_1,
  });

  if (!boundary) {
    const { error } = await supabase
      .from("execution_positions")
      .update({ current_price: snapshot.currentPrice, unrealized_pnl: snapshot.unrealizedPnl })
      .eq("id", position.id)
      .eq("status", "open");
    if (error) throw error;
    return { closed: false, snapshot };
  }

  return closeOpenPosition({ ...input, reason: boundary });
}

export async function closeOpenPosition(input: {
  supabase: SupabaseClient;
  adapter: ExecutionAdapter;
  order: NormalizedExecutionOrder;
  position: {
    id: string;
    provider_position_ref: string;
    entry_price: number;
    quantity: number;
    side: "buy" | "sell";
    stop_loss: number | null;
    take_profit_1: number | null;
  };
  reason: "take_profit" | "stop_loss" | "manual" | "risk_stop";
}) {
  const { supabase, adapter, order, position, reason } = input;
  const durablePosition = {
    providerPositionRef: position.provider_position_ref,
    providerSymbol: order.providerSymbol,
    side: position.side,
    entryPrice: num(position.entry_price, "entry price"),
    quantity: num(position.quantity, "position quantity"),
  };

  const closed = await adapter.close(order, durablePosition, reason);
  const closeSide = order.side === "buy" ? "sell" : "buy";

  const { error: closeFillError } = await supabase.from("execution_fills").upsert(
    {
      order_id: order.orderId,
      position_id: position.id,
      environment: order.environment,
      provider: adapter.provider,
      provider_fill_ref: closed.providerFillRef,
      side: closeSide,
      quantity: closed.quantity,
      price: closed.price,
      fee: closed.fee,
      fee_currency: closed.feeCurrency,
      filled_at: closed.closedAt,
      metadata: closed.metadata ?? {},
    },
    { onConflict: "provider,provider_fill_ref", ignoreDuplicates: true },
  );
  if (closeFillError) throw closeFillError;

  const { error: positionError } = await supabase
    .from("execution_positions")
    .update({
      status: "closed",
      current_price: closed.price,
      close_price: closed.price,
      realized_pnl: closed.realizedPnl,
      unrealized_pnl: 0,
      closed_at: closed.closedAt,
      close_reason: reason,
    })
    .eq("id", position.id)
    .eq("status", "open");
  if (positionError) throw positionError;

  const { error: orderError } = await supabase
    .from("execution_orders")
    .update({
      status: "closed",
      close_price: closed.price,
      realized_pnl: closed.realizedPnl,
      closed_at: closed.closedAt,
    })
    .eq("id", order.orderId)
    .eq("status", "filled");
  if (orderError) throw orderError;

  await recordEvent(supabase, {
    orderId: order.orderId,
    eventType: reason === "manual" ? "position_closed_manual" : "position_closed_risk_boundary",
    oldStatus: "filled",
    newStatus: "closed",
    payload: {
      position_id: position.id,
      reason,
      close_price: closed.price,
      realized_pnl: closed.realizedPnl,
    },
  });

  return { closed: true, reason, close: closed };
}

export function normalizedOrderFromRow(row: Record<string, unknown>): NormalizedExecutionOrder {
  const metadata = objectValue(row.metadata);
  const environmentSource = row.account_environment ?? row.environment ?? metadata.account_environment;
  const providerSymbol = row.provider_symbol ?? metadata.provider_symbol;
  const quantity = row.requested_amount ?? metadata.calculated_position_size;

  if (typeof providerSymbol !== "string" || !providerSymbol.trim()) {
    throw new Error("Execution order is missing provider symbol");
  }

  return {
    orderId: String(row.id),
    accountId: String(row.trading_account_id),
    userId: String(row.user_id),
    instrumentId: String(row.instrument_id),
    providerSymbol,
    environment: environmentSource === "live" ? "live" : "demo",
    side: row.side === "sell" ? "sell" : "buy",
    quantity: num(quantity, "position size"),
    requestedEntry: row.requested_entry == null ? null : num(row.requested_entry, "requested entry"),
    stopLoss: row.stop_loss == null ? null : num(row.stop_loss, "stop loss"),
    takeProfit1: row.take_profit_1 == null ? null : num(row.take_profit_1, "take profit 1"),
    takeProfit2: row.take_profit_2 == null ? null : num(row.take_profit_2, "take profit 2"),
    takeProfit3: row.take_profit_3 == null ? null : num(row.take_profit_3, "take profit 3"),
    idempotencyKey: String(row.idempotency_key),
  };
}
