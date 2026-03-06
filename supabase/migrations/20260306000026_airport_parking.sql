-- Airport parking fee rules per tenant
CREATE TABLE IF NOT EXISTS public.tenant_airport_parking (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,                        -- e.g. "Sydney Airport T1"
  keywords    text[] NOT NULL DEFAULT '{}',         -- e.g. ARRAY['Mascot','T1','Departures']
  fee_minor   integer NOT NULL DEFAULT 0,           -- fee in cents
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Seed Sydney terminals for aschauffeured
INSERT INTO public.tenant_airport_parking (tenant_id, name, keywords, fee_minor, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sydney Airport T1', ARRAY['T1', 'Terminal 1', 'International'], 1434, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sydney Airport T2', ARRAY['T2', 'Terminal 2'], 1143, true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sydney Airport T3', ARRAY['T3', 'Terminal 3', 'Domestic'], 1143, true);
