import { fetchDerivTick } from "../market-data/deriv";
import {
  calculateDirectionalPnl,
  type ExecutionAdapter,
  type NormalizedClose,
  type NormalizedExecutionOrder,
  type NormalizedFill,
  type NormalizedPositionSnapshot,
  type NormalizedPositionState,
} from "./execution-adapter";

function ref(prefix: string, orderId: string) {
  return `${prefix}:${orderId}:${crypto.randomUUID()}`;
}

export class DemoDerivExecutionAdapter implements ExecutionAdapter {
  readonly provider = "deriv";
  readonly environment = "demo" as const;

  async submit(order: NormalizedExecutionOrder): Promise<NormalizedFill> {
    if (order.environment !== "demo") throw new Error("Demo adapter received a non-demo order");

    const tick = await fetchDerivTick(order.providerSymbol);

    return {
      providerOrderRef: ref("demo-order", order.orderId),
      providerPositionRef: ref("demo-position", order.orderId),
      providerFillRef: ref("demo-fill", order.orderId),
      side: order.side,
      quantity: order.quantity,
      price: tick.quote,
      fee: 0,
      feeCurrency: null,
      filledAt: new Date(tick.epoch * 1000).toISOString(),
      metadata: { source: "deriv_live_tick", simulatedExecution: true },
    };
  }

  async snapshot(position: NormalizedPositionState): Promise<NormalizedPositionSnapshot> {
    const tick = await fetchDerivTick(position.providerSymbol);
    const unrealizedPnl = calculateDirectionalPnl({
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: tick.quote,
      quantity: position.quantity,
    });

    return {
      providerPositionRef: position.providerPositionRef,
      currentPrice: tick.quote,
      quantity: position.quantity,
      unrealizedPnl,
      capturedAt: new Date(tick.epoch * 1000).toISOString(),
      metadata: { source: "deriv_live_tick", simulatedExecution: true },
    };
  }

  async close(
    order: NormalizedExecutionOrder,
    position: NormalizedPositionState,
    reason: "take_profit" | "stop_loss" | "manual" | "risk_stop",
  ): Promise<NormalizedClose> {
    const tick = await fetchDerivTick(position.providerSymbol);
    const realizedPnl = calculateDirectionalPnl({
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: tick.quote,
      quantity: position.quantity,
    });

    return {
      providerPositionRef: position.providerPositionRef,
      providerFillRef: ref("demo-close", order.orderId),
      price: tick.quote,
      quantity: position.quantity,
      realizedPnl,
      fee: 0,
      feeCurrency: null,
      closedAt: new Date(tick.epoch * 1000).toISOString(),
      metadata: { source: "deriv_live_tick", simulatedExecution: true, reason },
    };
  }
}
