
-- Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  zip_code text DEFAULT '',
  emergency_contact_name text DEFAULT '',
  emergency_contact_phone text DEFAULT '',
  notes text DEFAULT '',
  balance numeric(10,2) NOT NULL DEFAULT 0,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Anon can insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Anon can delete customers" ON public.customers FOR DELETE USING (true);

-- Packages table
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  service_type text NOT NULL DEFAULT 'daycare',
  total_credits integer NOT NULL DEFAULT 1,
  remaining_credits integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  stripe_payment_id text,
  stripe_product_id text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read packages" ON public.packages FOR SELECT USING (true);
CREATE POLICY "Anon can insert packages" ON public.packages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update packages" ON public.packages FOR UPDATE USING (true);
CREATE POLICY "Anon can delete packages" ON public.packages FOR DELETE USING (true);

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL DEFAULT ('INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  reservation_id text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  paid_at timestamptz,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Anon can insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Anon can delete invoices" ON public.invoices FOR DELETE USING (true);

-- Invoice items table
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read invoice_items" ON public.invoice_items FOR SELECT USING (true);
CREATE POLICY "Anon can insert invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update invoice_items" ON public.invoice_items FOR UPDATE USING (true);
CREATE POLICY "Anon can delete invoice_items" ON public.invoice_items FOR DELETE USING (true);

-- Notices table
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  entity_type text NOT NULL DEFAULT 'system',
  entity_id text,
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read notices" ON public.notices FOR SELECT USING (true);
CREATE POLICY "Anon can insert notices" ON public.notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update notices" ON public.notices FOR UPDATE USING (true);
CREATE POLICY "Anon can delete notices" ON public.notices FOR DELETE USING (true);

-- Function to auto-generate notices for expiring packages
CREATE OR REPLACE FUNCTION public.check_expiring_packages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pkg RECORD;
BEGIN
  FOR pkg IN 
    SELECT p.*, c.first_name, c.last_name 
    FROM public.packages p 
    JOIN public.customers c ON c.id = p.customer_id
    WHERE p.status = 'active' 
      AND p.expires_at <= (CURRENT_DATE + interval '7 days')
      AND p.expires_at >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.notices n 
        WHERE n.entity_type = 'package' 
          AND n.entity_id = p.id::text
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notices (title, message, severity, entity_type, entity_id, auto_generated, suggested_actions)
    VALUES (
      'Paquete Por Vencer',
      pkg.first_name || ' ' || pkg.last_name || ': paquete "' || pkg.name || '" vence el ' || to_char(pkg.expires_at, 'DD/MM/YYYY') || ' con ' || pkg.remaining_credits || ' créditos restantes.',
      CASE WHEN pkg.expires_at <= CURRENT_DATE + interval '2 days' THEN 'critical' ELSE 'warning' END,
      'package',
      pkg.id::text,
      true,
      json_build_array(
        json_build_object('label', 'Ver Paquete', 'action', 'navigate', 'params', json_build_object('path', '/packages')),
        json_build_object('label', 'Contactar Cliente', 'action', 'contact', 'params', json_build_object('customerId', pkg.customer_id::text))
      )::jsonb
    );
  END LOOP;
END;
$$;

-- Function to auto-generate notices for overdue invoices
CREATE OR REPLACE FUNCTION public.check_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Mark overdue invoices
  UPDATE public.invoices SET status = 'overdue', updated_at = now()
  WHERE status = 'pending' AND due_date < CURRENT_DATE;

  FOR inv IN
    SELECT i.*, c.first_name, c.last_name
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status = 'overdue'
      AND NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.entity_type = 'invoice'
          AND n.entity_id = i.id::text
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notices (title, message, severity, entity_type, entity_id, auto_generated, suggested_actions)
    VALUES (
      'Factura Vencida',
      'Factura ' || inv.invoice_number || ' de ' || inv.first_name || ' ' || inv.last_name || ' por $' || inv.total || ' está vencida.',
      'critical',
      'invoice',
      inv.id::text,
      true,
      json_build_array(
        json_build_object('label', 'Ver Factura', 'action', 'navigate', 'params', json_build_object('path', '/invoices')),
        json_build_object('label', 'Enviar Recordatorio', 'action', 'sendReminder', 'params', json_build_object('customerId', inv.customer_id::text))
      )::jsonb
    );
  END LOOP;
END;
$$;

-- Function to auto-generate notice when package credits are low
CREATE OR REPLACE FUNCTION public.notify_low_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.remaining_credits <= 1 AND NEW.remaining_credits < OLD.remaining_credits AND NEW.status = 'active' THEN
    INSERT INTO public.notices (title, message, severity, entity_type, entity_id, auto_generated, suggested_actions)
    SELECT
      'Créditos Bajos',
      c.first_name || ' ' || c.last_name || ': paquete "' || NEW.name || '" tiene solo ' || NEW.remaining_credits || ' crédito(s) restante(s).',
      'warning',
      'package',
      NEW.id::text,
      true,
      json_build_array(
        json_build_object('label', 'Ver Paquete', 'action', 'navigate', 'params', json_build_object('path', '/packages')),
        json_build_object('label', 'Renovar Paquete', 'action', 'renewPackage', 'params', json_build_object('packageId', NEW.id::text))
      )::jsonb
    FROM public.customers c WHERE c.id = NEW.customer_id;
  END IF;
  
  -- Auto-deplete package
  IF NEW.remaining_credits = 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_package_credit_change
  BEFORE UPDATE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_credits();

-- Seed some customers for testing
INSERT INTO public.customers (id, first_name, last_name, email, phone, address, city, state, zip_code, balance)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Juan', 'Pérez', 'juan.perez@email.com', '+1 555-1001', '123 Main St', 'Miami', 'FL', '33101', 0),
  ('00000000-0000-0000-0000-000000000002', 'Sofia', 'López', 'sofia.lopez@email.com', '+1 555-2001', '456 Oak Ave', 'Miami', 'FL', '33102', -150),
  ('00000000-0000-0000-0000-000000000003', 'Roberto', 'Sánchez', 'roberto.sanchez@email.com', '+1 555-3001', '789 Palm Blvd', 'Miami', 'FL', '33103', 250)
ON CONFLICT DO NOTHING;

-- Seed packages
INSERT INTO public.packages (customer_id, name, service_type, total_credits, remaining_credits, price, purchase_date, expires_at, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Paquete 10 Días Guardería', 'daycare', 10, 3, 400.00, '2024-01-15', CURRENT_DATE + interval '5 days', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Paquete 5 Sesiones Entrenamiento', 'training_session', 5, 5, 375.00, '2024-02-01', '2025-08-01', 'active');

-- Seed invoices
INSERT INTO public.invoices (customer_id, invoice_number, subtotal, tax, total, status, due_date, payment_method)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'INV-20240201-A1B2', 150.00, 0, 150.00, 'overdue', '2024-02-15', null),
  ('00000000-0000-0000-0000-000000000001', 'INV-20240301-C3D4', 400.00, 0, 400.00, 'paid', '2024-03-15', 'card');
