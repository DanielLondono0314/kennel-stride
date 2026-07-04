-- PR-8: check-out atómico.
-- Antes: el modal creaba la factura (o descontaba crédito) en el cliente y
-- LUEGO llamaba check_out_reservation. Si el RPC fallaba, quedaba una factura
-- huérfana pagada/pendiente con la reserva aún en curso.
-- Ahora: complete_checkout hace pago + notas + liberación de perrera +
-- completitud de la reserva en UNA transacción. Si algo falla, no queda nada.

CREATE OR REPLACE FUNCTION public.complete_checkout(
  p_reservation_id uuid,
  p_payment_method text,
  p_package_id     uuid DEFAULT NULL,
  p_notes          text DEFAULT ''
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res        record;
  v_invoice_id uuid;
  v_now        timestamptz := now();
BEGIN
  -- a. Reserva válida, de una org del usuario y en curso. FOR UPDATE serializa
  --    dobles check-outs concurrentes de la misma reserva.
  SELECT r.id, r.organization_id, r.customer_id, r.service_name, r.total_price
    INTO v_res
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_user_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;
  IF v_res.id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso';
  END IF;

  -- b. Pago según método.
  IF p_payment_method = 'package' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'Falta el paquete para cobrar con créditos';
    END IF;
    -- El paquete debe ser del mismo cliente y organización que la reserva.
    PERFORM 1 FROM public.packages p
     WHERE p.id = p_package_id
       AND p.organization_id = v_res.organization_id
       AND p.customer_id = v_res.customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El paquete no pertenece a este cliente';
    END IF;
    -- Reutiliza el descuento atómico existente (piso en 0 + log de auditoría).
    -- Si no quedan créditos lanza excepción y aborta todo el check-out.
    PERFORM public.deduct_package_credit(p_package_id, 'check-out');

  ELSIF p_payment_method IN ('cash', 'card') THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       payment_method, paid_at, due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'paid', v_res.total_price, 0, 0, v_res.total_price,
       p_payment_method, v_now, v_now, NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSIF p_payment_method = 'invoice' THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'pending', v_res.total_price, 0, 0, v_res.total_price,
       v_now + interval '30 days', NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSE
    RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
  END IF;

  -- c. Liberar SOLO la perrera ligada a esta reserva (idempotente: si ya fue
  --    liberada manualmente no afecta filas y no falla).
  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = p_reservation_id;

  -- d. Completar la reserva + guardar notas de check-out si vienen.
  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = v_now,
         notes = CASE WHEN btrim(p_notes) <> '' THEN p_notes ELSE notes END,
         updated_at = v_now
   WHERE id = p_reservation_id;

  RETURN json_build_object('invoice_id', v_invoice_id);
END $$;

GRANT EXECUTE ON FUNCTION public.complete_checkout(uuid, text, uuid, text) TO authenticated;
