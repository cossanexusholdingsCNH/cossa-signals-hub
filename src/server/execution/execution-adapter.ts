export type ExecutionEnvironment = "demo" | "live";
export type ExecutionSide = "buy" | "sell";

export type NormalizedExecutionOrder = {
  orderId: string;
  accountId: string;
  userId: string;
  instrumentId: string;
  providerSymbol: string;
  environment: ExecutionEnvironment;
  side: ExecutionSide;
  quantity: number;
  requestedEntry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  idempotencyKey: string;
};

export type NormalizedFill = {
  providerOrderRef: string;
  providerPositionRef: string | null;
  providerFillRef: string;
  side: ExecutionSide;
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string | null;
  filledAt: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedPositionSnapshot = {
  providerPositionRef: string;
  currentPrice: number;
  quantity: number;
  unrealizedPnl: number;
  capturedAt: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedClose = {
  providerPositionRef: string;
  providerFillRef: string;
  price: number;
  quantity: number;
  realizedPnl: number;
  fee: number;
  feeCurrency: string | null;
  closedAt: string;
  metadata?: Record<string, unknown>;
};

export interface ExecutionAdapter {
  readonly provider: string;
  readonly environment: ExecutionEnvironment;

  submit(order: NormalizedExecutionOrder): Promise<NormalizedFill>;
  snapshot(providerPositionRef: string): Promise<NormalizedPositionSnapshot>;
  close(
    order: NormalizedExecutionOrder,
    providerPositionRef: string,
    reason: "take_profit" | "stop_loss" | "manual" | "risk_stop",
  ): Promise<NormalizedClose>;
}

export function calculateDirectionalPnl(input: {
  side: ExecutionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees?: number;
}) {
  const direction = input.side === "buy" ? 1 : -1;
  return (input.exitPrice - input.entryPrice) * direction * input.quantity - (input.fees ?? 0);
}

export function shouldCloseAtRiskBoundary(input: {
  side: ExecutionSide;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
}): "take_profit" | "stop_loss" | null {
  if (input.side === "buy") {
    if (input.stopLoss !== null && input.currentPrice <= input.stopLoss) return "stop_loss";
    if (input.takeProfit !== null && input.currentPrice >= input.takeProfit) return "take_profit";
  } else {
    if (input.stopLoss !== null && input.currentPrice >= input.stopLoss) return "stop_loss";
    if (input.takeProfit !== null && input.currentPrice <= input.takeProfit) return "take_profit";
  }
  return null;
}
