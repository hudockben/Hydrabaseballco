-- Shipping billed to the customer, kept apart from `shipping_cost` (what the
-- business pays the carrier). Revenue is unit sales plus this, so an order that
-- bills shipping no longer reads as though that money never arrived.
--
-- Defaults to 0, which reproduces the old behaviour: shipping is a pure cost
-- until someone records that a customer was charged for it.

alter table orders add column if not exists shipping_charged numeric(12, 2) not null default 0;
