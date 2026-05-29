-- ============================================================
-- Stream F (H3) — Customer balance / accounts receivable
-- ============================================================
-- `customers.balance` used to be a static column that was never
-- updated, so the check-in blocking rule in validations.ts ran
-- against a meaningless value. This migration makes the column
-- self-maintaining via AFTER triggers on `invoices`.
--
-- Convention (shared with src/lib/validations.ts): NEGATIVE means
-- the customer OWES money. balance = -(SUM of totals of unpaid
-- invoices), where "unpaid" = status IN ('pending','overdue').
-- A customer with no unpaid invoices has balance 0.
--
-- The column shape (numeric(10,2) NOT NULL DEFAULT 0) is preserved
-- so the generated src/integrations/supabase/types.ts stays valid.
-- ============================================================

-- ── 1. Recompute helper ──────────────────────────────────────
-- Recalculates a single customer's balance from their invoices.
-- SECURITY DEFINER so the triggers run regardless of the writer's
-- RLS scope; search_path pinned for safety.
CREATE OR REPLACE FUNCTION public.recompute_customer_balance(p_customer_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.customers c
  SET balance = COALESCE((
    SELECT -SUM(i.total)
    FROM public.invoices i
    WHERE i.customer_id = p_customer_id
      AND i.status IN ('pending', 'overdue')
  ), 0)
  WHERE c.id = p_customer_id;
$$;

-- ── 2. Row trigger function ──────────────────────────────────
-- Recomputes the affected customer(s) after any invoice change.
-- Handles re-assignment of an invoice to a different customer by
-- recomputing both the old and the new owner.
CREATE OR REPLACE FUNCTION public.trg_invoice_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_customer_balance(OLD.customer_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_customer_balance(NEW.customer_id);

  IF (TG_OP = 'UPDATE' AND OLD.customer_id <> NEW.customer_id) THEN
    PERFORM public.recompute_customer_balance(OLD.customer_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Wire up the trigger (idempotent) ──────────────────────
DROP TRIGGER IF EXISTS invoice_balance_trg ON public.invoices;
CREATE TRIGGER invoice_balance_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_balance();

-- ── 4. Initial backfill ──────────────────────────────────────
-- Bring every existing customer's balance in line with the new
-- convention. Safe to re-run.
UPDATE public.customers c
SET balance = COALESCE((
  SELECT -SUM(i.total)
  FROM public.invoices i
  WHERE i.customer_id = c.id
    AND i.status IN ('pending', 'overdue')
), 0);
