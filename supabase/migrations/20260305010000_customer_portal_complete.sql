-- customer_auth
CREATE TABLE IF NOT EXISTS public.customer_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  email text,
  password_hash text,
  phone_country_code text,
  phone_number text,
  otp_code text,
  otp_expires_at timestamptz,
  last_otp_sent_at timestamptz,
  reset_token text,
  reset_token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- customers extensions
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS invoice_enabled boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS invoice_credit_limit_minor integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS invoice_payment_terms_days integer DEFAULT 30;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS invoice_balance_minor integer DEFAULT 0;

-- customer_passengers extensions
ALTER TABLE public.customer_passengers ADD COLUMN IF NOT EXISTS relationship text DEFAULT 'Other';
ALTER TABLE public.customer_passengers ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.customer_passengers ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.customer_passengers ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- saved_payment_methods
CREATE TABLE IF NOT EXISTS public.saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  stripe_payment_method_id text NOT NULL,
  last4 text,
  brand text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- tenant_branding
CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#2563eb',
  company_name text,
  contact_email text,
  contact_phone text,
  custom_domain text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- bookings extensions
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'CARD';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_captured_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booked_by text DEFAULT 'ADMIN';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS flight_number text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passenger_preferences jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS prepay_base_fare_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS prepay_extras_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS prepay_total_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS actual_base_fare_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS actual_extras_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS actual_total_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS adjustment_amount_minor integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS adjustment_status text DEFAULT 'PENDING';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS adjustment_stripe_intent_id text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS invoice_id uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_setup_intent_id text;

-- driver_reports
CREATE TABLE IF NOT EXISTS public.driver_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  driver_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actual_distance_km numeric,
  actual_duration_minutes integer,
  actual_toll_minor integer DEFAULT 0,
  actual_parking_minor integer DEFAULT 0,
  waiting_time_minutes integer DEFAULT 0,
  notes text,
  receipts jsonb DEFAULT '[]',
  submitted_at timestamptz DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  invoice_number text NOT NULL,
  invoice_type text DEFAULT 'CUSTOMER',
  booking_ids uuid[] DEFAULT '{}',
  subtotal_minor integer DEFAULT 0,
  tax_minor integer DEFAULT 0,
  total_minor integer DEFAULT 0,
  prepay_minor integer DEFAULT 0,
  adjustment_minor integer DEFAULT 0,
  currency text DEFAULT 'AUD',
  status text DEFAULT 'DRAFT',
  due_date date,
  issued_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  notes text,
  stripe_invoice_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);

-- invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  booking_id uuid REFERENCES public.bookings(id),
  description text,
  quantity integer DEFAULT 1,
  unit_price_minor integer,
  total_minor integer,
  tax_minor integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- tenants cancellation policy
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cancel_window_hours integer DEFAULT 2;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS refund_policy text DEFAULT 'FULL';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AUD';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS default_timezone text DEFAULT 'Australia/Sydney';

-- unique index
CREATE UNIQUE INDEX IF NOT EXISTS one_default_passenger ON public.customer_passengers(customer_id) WHERE is_default = true AND deleted_at IS NULL;

-- RLS
ALTER TABLE public.customer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_reports ENABLE ROW LEVEL SECURITY;
