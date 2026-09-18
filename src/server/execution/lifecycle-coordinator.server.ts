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
        metadata: fill.metadata ?? {},
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
    .update({ status: "filled", fill_price: fill.price, filled_at: fill.filledAt })
    .eq("id", order.orderId);
  if (orderError) throw orderError;

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
    stop_loss: number | null;
    take_profit_1: number | null;
  };
}) {
  const { supabase, adapter, order, position } = input;
  const snapshot = await adapter.snapshot(position.provider_position_ref);

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
      .eq("id", position.id);
    if (error) throw error;
    return { closed: false, snapshot };
  }

  const closed = await adapter.close(order, position.provider_position_ref, boundary);
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
      close_reason: boundary,
    })
    .eq("id", position.id);
  if (positionError) throw positionError;

  const { error: orderError } = await supabase
    .from("execution_orders")
    .update({
      status: "closed",
      close_price: closed.price,
      realized_pnl: closed.realizedPnl,
      closed_at: closed.closedAt,
    })
    .eq("id", order.orderId);
  if (orderError) throw orderError;

  return { closed: true, reason: boundary, close: closed };
}

export function normalizedOrderFromRow(row: Record<string, unknown>): NormalizedExecutionOrder {
  return {
    orderId: String(row.id),
    accountId: String(row.trading_account_id),
    userId: String(row.user_id),
    instrumentId: String(row.instrument_id),
    providerSymbol: String(row.provider_symbol),
    environment: row.account_type === "live" ? "live" : "demo",
    side: row.side === "sell" ? "sell" : "buy",
    quantity: num(row.quantity ?? row.calculated_position_size, "position size"),
    requestedEntry: row.requested_entry == null ? null : num(row.requested_entry, "requested entry"),
    stopLoss: row.stop_loss == null ? null : num(row.stop_loss, "stop loss"),
    takeProfit1: row.take_profit_1 == null ? null : num(row.take_profit_1, "take profit 1"),
    takeProfit2: row.take_profit_2 == null ? null : num(row.take_profit_2, "take profit 2"),
    takeProfit3: row.take_profit_3 == null ? null : num(row.take_profit_3, "take profit 3"),
    idempotencyKey: String(row.idempotency_key),
  };
}
