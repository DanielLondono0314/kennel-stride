-- ============================================================================
-- Avisos huérfanos (QA E-10). notices.entity_type/entity_id apunta a un
-- registro sin llave foránea (es polimórfico), así que al borrar un cliente
-- — y en cascada sus perros y reservas — su aviso "Nueva solicitud de reserva"
-- quedaba apuntando a una reserva que ya no existe.
--
-- Ahora un trigger por tabla borra los avisos de un registro cuando este se
-- elimina (también cuando se borra en cascada), y se limpian los huérfanos
-- que ya había.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_entity_notices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notices
   WHERE entity_type = TG_ARGV[0]
     AND entity_id = OLD.id::text;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_entity_notices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS delete_notices_on_reservation_delete ON public.reservations;
CREATE TRIGGER delete_notices_on_reservation_delete
  AFTER DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.delete_entity_notices('reservation');

DROP TRIGGER IF EXISTS delete_notices_on_dog_delete ON public.dogs;
CREATE TRIGGER delete_notices_on_dog_delete
  AFTER DELETE ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.delete_entity_notices('dog');

DROP TRIGGER IF EXISTS delete_notices_on_customer_delete ON public.customers;
CREATE TRIGGER delete_notices_on_customer_delete
  AFTER DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.delete_entity_notices('customer');

DROP TRIGGER IF EXISTS delete_notices_on_invoice_delete ON public.invoices;
CREATE TRIGGER delete_notices_on_invoice_delete
  AFTER DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.delete_entity_notices('invoice');

DROP TRIGGER IF EXISTS delete_notices_on_package_delete ON public.packages;
CREATE TRIGGER delete_notices_on_package_delete
  AFTER DELETE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.delete_entity_notices('package');

-- Limpieza única de los huérfanos existentes.
DELETE FROM public.notices n
 WHERE (n.entity_type = 'reservation' AND NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.id::text = n.entity_id))
    OR (n.entity_type = 'dog'         AND NOT EXISTS (SELECT 1 FROM public.dogs d         WHERE d.id::text = n.entity_id))
    OR (n.entity_type = 'customer'    AND NOT EXISTS (SELECT 1 FROM public.customers c    WHERE c.id::text = n.entity_id))
    OR (n.entity_type = 'invoice'     AND NOT EXISTS (SELECT 1 FROM public.invoices i     WHERE i.id::text = n.entity_id))
    OR (n.entity_type = 'package'     AND NOT EXISTS (SELECT 1 FROM public.packages p     WHERE p.id::text = n.entity_id));
