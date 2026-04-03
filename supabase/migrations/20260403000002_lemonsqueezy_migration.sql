-- ============================================================
-- Migration: Replace Stripe with LemonSqueezy
-- ============================================================
-- Renames all stripe_* columns to ls_* (LemonSqueezy)
-- LemonSqueezy object mapping:
--   stripe_customer_id       → ls_customer_id      (LS customer)
--   stripe_subscription_id   → ls_subscription_id  (LS subscription)
--   stripe_invoice_id        → ls_order_id         (LS order)
--   stripe_payment_intent_id → ls_payment_id       (LS payment)
--   stripe_payment_id        → ls_order_id         (LS order on packages)
--   stripe_product_id        → ls_variant_id       (LS variant/product)
-- ============================================================

-- customers: stripe_customer_id → ls_customer_id
ALTER TABLE public.customers
  RENAME COLUMN stripe_customer_id TO ls_customer_id;

-- invoices: stripe_invoice_id → ls_order_id
ALTER TABLE public.invoices
  RENAME COLUMN stripe_invoice_id TO ls_order_id;

-- invoices: stripe_payment_intent_id → ls_payment_id
ALTER TABLE public.invoices
  RENAME COLUMN stripe_payment_intent_id TO ls_payment_id;

-- packages: stripe_payment_id → ls_order_id
ALTER TABLE public.packages
  RENAME COLUMN stripe_payment_id TO ls_order_id;

-- packages: stripe_product_id → ls_variant_id
ALTER TABLE public.packages
  RENAME COLUMN stripe_product_id TO ls_variant_id;

-- organizations: stripe_customer_id → ls_customer_id
ALTER TABLE public.organizations
  RENAME COLUMN stripe_customer_id TO ls_customer_id;

-- organizations: stripe_subscription_id → ls_subscription_id
ALTER TABLE public.organizations
  RENAME COLUMN stripe_subscription_id TO ls_subscription_id;
