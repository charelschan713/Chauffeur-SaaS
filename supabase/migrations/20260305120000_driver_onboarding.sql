-- ─────────────────────────────────────────────────────────────────────────────
-- Driver Invitations + Onboarding Profile
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Driver invitations table
CREATE TABLE IF NOT EXISTS public.driver_invitations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_by            uuid NOT NULL REFERENCES public.users(id),
  -- Pre-filled by admin
  display_name          text,                          -- optional hint name
  email                 text,
  phone_country_code    text NOT NULL DEFAULT '+61',
  phone_number          text,
  invite_type           text NOT NULL DEFAULT 'INTERNAL'
                          CHECK (invite_type IN ('INTERNAL','EXTERNAL')),
  -- Token for secure URL
  token                 uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status                text NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','CANCELLED')),
  expires_at            timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at           timestamptz,
  -- Resulting user (set after onboarding complete)
  user_id               uuid REFERENCES public.users(id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_tenant  ON public.driver_invitations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_di_token   ON public.driver_invitations(token);

-- 2. Extend driver_profiles with onboarding fields
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS first_name                   text,
  ADD COLUMN IF NOT EXISTS last_name                    text,
  ADD COLUMN IF NOT EXISTS email                        text,
  ADD COLUMN IF NOT EXISTS phone_country_code           text,
  ADD COLUMN IF NOT EXISTS phone_number                 text,

  -- Driver licence
  ADD COLUMN IF NOT EXISTS licence_number               text,
  ADD COLUMN IF NOT EXISTS licence_state                text,
  ADD COLUMN IF NOT EXISTS licence_expiry               date,

  -- Tax
  ADD COLUMN IF NOT EXISTS tax_file_number              text,  -- TFN (encrypted at app layer)
  ADD COLUMN IF NOT EXISTS abn                          text,

  -- Emergency contact
  ADD COLUMN IF NOT EXISTS emergency_contact_name       text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone      text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,

  -- External driver documents
  ADD COLUMN IF NOT EXISTS driving_record_url           text,
  ADD COLUMN IF NOT EXISTS criminal_record_url          text,
  ADD COLUMN IF NOT EXISTS driving_record_verified      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criminal_record_verified     boolean NOT NULL DEFAULT false,

  -- Onboarding state
  ADD COLUMN IF NOT EXISTS onboarding_status            text NOT NULL DEFAULT 'PENDING'
                              CHECK (onboarding_status IN ('PENDING','SUBMITTED','APPROVED','REJECTED')),
  ADD COLUMN IF NOT EXISTS invitation_id                uuid REFERENCES public.driver_invitations(id);

-- 3. RLS: driver_invitations (tenant admin can see their own)
ALTER TABLE public.driver_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS di_tenant_isolation ON public.driver_invitations;
CREATE POLICY di_tenant_isolation ON public.driver_invitations
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- Public read by token (for onboarding page) — app layer enforces this via service key
-- No RLS bypass needed; backend uses service-role key for token lookup
