-- Online store (Stripe). Optional to run by hand: ensureSchema in lib/db.ts
-- applies the same statements on the first request.
alter table orders add column if not exists stripe_session_id text;
create unique index if not exists orders_stripe_session_idx on orders (stripe_session_id);
alter table orders alter column unit_price type numeric(12, 4);
