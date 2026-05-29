-- ─────────────────────────────────────────────────────────────────────────────
-- [E3] Webhook idempotency for LemonSqueezy (handle-ls-webhook)
--
-- LemonSqueezy retries webhooks on non-2xx responses (and occasionally delivers
-- duplicates). Without a dedupe guard a single event can be processed twice,
-- e.g. double-applying a subscription status change or order. This table records
-- every event we have already handled; the edge function inserts the event id
-- with `ON CONFLICT DO NOTHING` and, when the row already exists, returns 200
-- without reprocessing.
--
-- No RLS policies are defined: with RLS enabled and no policy, only the
-- service_role key (used by the edge function) can read/write this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Belt-and-braces: ensure the anon/authenticated client roles cannot touch this
-- table even if a future migration adds a permissive policy by mistake.
REVOKE ALL ON public.processed_webhooks FROM anon, authenticated;
