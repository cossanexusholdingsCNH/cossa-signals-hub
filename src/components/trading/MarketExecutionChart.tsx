import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CandlePoint = {
  at: string;
  close: number;
};

type Props = {
  symbol: string;
  timeframe: string;
  data: CandlePoint[];
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit1?: number | null;
  currentPrice?: number | null;
};

export function MarketExecutionChart({
  symbol,
  timeframe,
  data,
  entryPrice,
  stopLoss,
  takeProfit1,
  currentPrice,
}: Props) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{symbol}</h2>
          <p className="text-sm text-muted-foreground">Live execution chart · {timeframe}</p>
        </div>
        {currentPrice != null ? (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Current price</div>
            <div className="font-mono text-lg font-semibold">{currentPrice}</div>
          </div>
        ) : null}
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="at" minTickGap={32} tick={{ fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} width={80} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="close" dot={false} isAnimationActive={false} />
            {entryPrice != null ? <ReferenceLine y={entryPrice} label="Entry" /> : null}
            {stopLoss != null ? <ReferenceLine y={stopLoss} label="SL" /> : null}
            {takeProfit1 != null ? <ReferenceLine y={takeProfit1} label="TP" /> : null}
            {currentPrice != null ? <ReferenceLine y={currentPrice} label="Live" /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
