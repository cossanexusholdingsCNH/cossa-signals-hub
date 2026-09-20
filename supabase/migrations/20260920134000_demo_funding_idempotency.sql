create unique index if not exists demo_funding_events_account_idempotency_idx
  on public.demo_funding_events (
    trading_account_id,
    (metadata ->> 'idempotency_key')
  )
  where metadata ? 'idempotency_key'
    and length(btrim(metadata ->> 'idempotency_key')) > 0;
