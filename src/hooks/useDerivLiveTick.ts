import { useEffect, useRef, useState } from "react";

const DERIV_PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

export type LiveTickState = {
  price: number | null;
  bid: number | null;
  ask: number | null;
  epoch: number | null;
  connected: boolean;
  error: string | null;
};

function isExistingSubscriptionMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("already subscribed") || normalized.includes("already subscribe");
}

export function useDerivLiveTick(providerSymbol?: string | null) {
  const [state, setState] = useState<LiveTickState>({
    price: null,
    bid: null,
    ask: null,
    epoch: null,
    connected: false,
    error: null,
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const symbol = providerSymbol?.trim();
    if (!symbol) {
      setState({ price: null, bid: null, ask: null, epoch: null, connected: false, error: null });
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function connect() {
      if (cancelled) return;
      const socket = new WebSocket(DERIV_PUBLIC_WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        attempts = 0;
        setState((current) => ({ ...current, connected: true, error: null }));
        socket.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 1 }));
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(String(event.data)) as {
            msg_type?: string;
            error?: { message?: string };
            tick?: { quote?: number; bid?: number; ask?: number; epoch?: number };
          };
          if (message.error) {
            const errorMessage = message.error.message || "Live market stream error";
            if (isExistingSubscriptionMessage(errorMessage)) {
              setState((current) => ({ ...current, connected: true, error: null }));
              return;
            }
            setState((current) => ({ ...current, error: errorMessage }));
            return;
          }
          if (message.msg_type !== "tick" || !message.tick) return;
          const price = Number(message.tick.quote);
          if (!Number.isFinite(price)) return;
          const bid = Number(message.tick.bid);
          const ask = Number(message.tick.ask);
          const epoch = Number(message.tick.epoch);
          setState({
            price,
            bid: Number.isFinite(bid) ? bid : null,
            ask: Number.isFinite(ask) ? ask : null,
            epoch: Number.isFinite(epoch) ? epoch : null,
            connected: true,
            error: null,
          });
        } catch {
          // Ignore malformed frames; the next valid tick will replace state.
        }
      };

      const recover = () => {
        if (cancelled) return;
        setState((current) => ({ ...current, connected: false }));
        if (reconnectTimer) return;
        attempts += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, Math.min(500 * 2 ** Math.min(attempts, 4), 8_000));
      };

      socket.onerror = recover;
      socket.onclose = recover;
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    };
  }, [providerSymbol]);

  return state;
}
