import { fetchDerivTick } from "../market-data/deriv";
import {
  calculateDirectionalPnl,
  type ExecutionAdapter,
  type NormalizedClose,
  type NormalizedExecutionOrder,
  type NormalizedFill,
  type NormalizedPositionSnapshot,
} from "./execution-adapter";

type DemoPosition = {
  order: NormalizedExecutionOrder;
  entryPrice: number;
  quantity: number;
};

const positions = new Map<string, DemoPosition>();

function ref(prefix: string, orderId: string) {
  return `${prefix}:${orderId}:${crypto.randomUUID()}`;
}

export class DemoDerivExecutionAdapter implements ExecutionAdapter {
  readonly provider = "deriv";
  readonly environment = "demo" as const;

  async submit(order: NormalizedExecutionOrder): Promise<NormalizedFill> {
    if (order.environment !== "demo") throw new Error("Demo adapter received a non-demo order");

    const tick = await fetchDerivTick(order.providerSymbol);
    const providerOrderRef = ref("demo-order", order.orderId);
    const providerPositionRef = ref("demo-position", order.orderId);
    const providerFillRef = ref("demo-fill", order.orderId);

    positions.set(providerPositionRef, {
      order,
      entryPrice: tick.quote,
      quantity: order.quantity,
    });

    return {
      providerOrderRef,
      providerPositionRef,
      providerFillRef,
      side: order.side,
      quantity: order.quantity,
      price: tick.quote,
      fee: 0,
      feeCurrency: null,
      filledAt: new Date(tick.epoch * 1000).toISOString(),
      metadata: { source: "deriv_live_tick", simulatedExecution: true },
    };
  }

  async snapshot(providerPositionRef: string): Promise<NormalizedPositionSnapshot> {
    const position = positions.get(providerPositionRef);
    if (!position) throw new Error("Demo position is not available in this runtime");

    const tick = await fetchDerivTick(position.order.providerSymbol);
    const unrealizedPnl = calculateDirectionalPnl({
      side: position.order.side,
      entryPrice: position.entryPrice,
      exitPrice: tick.quote,
      quantity: position.quantity,
    });

    return {
      providerPositionRef,
      currentPrice: tick.quote,
      quantity: position.quantity,
      unrealizedPnl,
      capturedAt: new Date(tick.epoch * 1000).toISOString(),
      metadata: { source: "deriv_live_tick", simulatedExecution: true },
    };
  }

  async close(
    order: NormalizedExecutionOrder,
    providerPositionRef: string,
    reason: "take_profit" | "stop_loss" | "manual" | "risk_stop",
  ): Promise<NormalizedClose> {
    const position = positions.get(providerPositionRef);
    if (!position) throw new Error("Demo position is not available in this runtime");

    const tick = await fetchDerivTick(order.providerSymbol);
    const realizedPnl = calculateDirectionalPnl({
      side: order.side,
      entryPrice: position.entryPrice,
      exitPrice: tick.quote,
      quantity: position.quantity,
    });

    positions.delete(providerPositionRef);

    return {
      providerPositionRef,
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
