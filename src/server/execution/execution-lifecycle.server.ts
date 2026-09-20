import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { refreshDemoRiskState } from "./demo-account.server";
import { DemoDerivExecutionAdapter } from "./demo-deriv-adapter.server";
import {
  closeOpenPosition,
  fillSubmittedOrder,
  monitorOpenPosition,
  normalizedOrderFromRow,
} from "./lifecycle-coordinator.server";

async function loadOrder(orderId: string, userId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("execution_orders")
    .select(
      "id,user_id,trading_account_id,signal_id,instrument_id,side,status,requested_entry,stop_loss,take_profit_1,take_profit_2,take_profit_3,requested_amount,idempotency_key,metadata",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();
  if (error || !order) throw new Error("Execution order was not found");

  const { data: account, error: accountError } = await supabaseAdmin
    .from("trading_accounts")
    .select("id,provider,account_environment")
    .eq("id", order.trading_account_id)
    .eq("user_id", userId)
    .single();
  if (accountError || !account) throw new Error("Trading account was not found");

  const { data: provider, error: providerError } = await supabaseAdmin
    .from("market_data_providers")
    .select("id,slug")
    .eq("slug", account.provider)
    .eq("enabled", true)
    .maybeSingle();
  if (providerError || !provider) throw new Error("Enabled market-data provider was not found");

  const { data: mapping, error: mappingError } = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("provider_symbol")
    .eq("instrument_id", order.instrument_id)
    .eq("provider_id", provider.id)
    .eq("enabled", true)
    .maybeSingle();
  if (mappingError || !mapping?.provider_symbol) {
    throw new Error("Instrument provider mapping was not found");
  }

  return {
    row: {
      ...order,
      account_environment: account.account_environment,
      provider_symbol: mapping.provider_symbol,
    },
    provider: account.provider,
  };
}

function adapterFor(provider: string, environment: string) {
  if (provider === "deriv" && environment === "demo") return new DemoDerivExecutionAdapter();
  throw new Error(`Execution adapter is not enabled for ${provider}/${environment}`);
}

export async function fillApprovedDemoOrder(orderId: string, userId: string) {
  const loaded = await loadOrder(orderId, userId);
  if (loaded.row.status !== "submitted") throw new Error("Execution order is not submitted");
  if (loaded.row.account_environment !== "demo") throw new Error("Demo fill requested for live order");

  const order = normalizedOrderFromRow(loaded.row);
  const adapter = adapterFor(loaded.provider, order.environment);
  const lifecycle = await fillSubmittedOrder({
    supabase: supabaseAdmin,
    adapter,
    order,
    signalId: loaded.row.signal_id,
  });
  const accountState = await refreshDemoRiskState(order.accountId, userId);
  return { ...lifecycle, accountState };
}

async function loadPosition(positionId: string, userId: string) {
  const { data: position, error } = await supabaseAdmin
    .from("execution_positions")
    .select(
      "id,user_id,order_id,trading_account_id,instrument_id,environment,provider,side,status,quantity,entry_price,current_price,stop_loss,take_profit_1,provider_position_ref,unrealized_pnl,realized_pnl,close_price,close_reason,opened_at,closed_at",
    )
    .eq("id", positionId)
    .eq("user_id", userId)
    .single();
  if (error || !position) throw new Error("Execution position was not found");
  if (position.status !== "open") throw new Error("Execution position is not open");
  if (!position.provider_position_ref || position.entry_price == null) {
    throw new Error("Execution position is missing durable provider state");
  }

  const loaded = await loadOrder(position.order_id, userId);
  return { position, loaded };
}

export async function refreshDemoPosition(positionId: string, userId: string) {
  const { position, loaded } = await loadPosition(positionId, userId);
  const order = normalizedOrderFromRow(loaded.row);
  const adapter = adapterFor(loaded.provider, order.environment);

  const lifecycle = await monitorOpenPosition({
    supabase: supabaseAdmin,
    adapter,
    order,
    position: {
      id: position.id,
      provider_position_ref: position.provider_position_ref,
      entry_price: Number(position.entry_price),
      quantity: Number(position.quantity),
      side: position.side,
      stop_loss: position.stop_loss == null ? null : Number(position.stop_loss),
      take_profit_1: position.take_profit_1 == null ? null : Number(position.take_profit_1),
    },
  });
  const accountState = await refreshDemoRiskState(order.accountId, userId);
  return { ...lifecycle, accountState };
}

export async function closeDemoPosition(positionId: string, userId: string) {
  const { position, loaded } = await loadPosition(positionId, userId);
  const order = normalizedOrderFromRow(loaded.row);
  const adapter = adapterFor(loaded.provider, order.environment);

  const lifecycle = await closeOpenPosition({
    supabase: supabaseAdmin,
    adapter,
    order,
    position: {
      id: position.id,
      provider_position_ref: position.provider_position_ref,
      entry_price: Number(position.entry_price),
      quantity: Number(position.quantity),
      side: position.side,
      stop_loss: position.stop_loss == null ? null : Number(position.stop_loss),
      take_profit_1: position.take_profit_1 == null ? null : Number(position.take_profit_1),
    },
    reason: "manual",
  });
  const accountState = await refreshDemoRiskState(order.accountId, userId);
  return { ...lifecycle, accountState };
}
