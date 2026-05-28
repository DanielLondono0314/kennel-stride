-- Fix: security_hardening tried to REVOKE stripe_* columns that were already
-- renamed to ls_* in the LemonSqueezy migration. Apply REVOKE to actual column names.
REVOKE SELECT (ls_customer_id, ls_subscription_id)
  ON public.organizations FROM authenticated, anon;
