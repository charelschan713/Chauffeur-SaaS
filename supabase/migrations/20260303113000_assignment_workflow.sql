-- Phase: Assignment Workflow + Driver Pay

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_method text DEFAULT 'AUTO' CHECK (assignment_method IN ('AUTO', 'MANUAL')),
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS driver_pay_type text DEFAULT 'PERCENTAGE' CHECK (driver_pay_type IN ('FIXED', 'PERCENTAGE')),
  ADD COLUMN IF NOT EXISTS driver_pay_value numeric(10,2) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS driver_pay_minor integer DEFAULT 0 CHECK (driver_pay_minor >= 0),
  ADD COLUMN IF NOT EXISTS platform_fee_minor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_pay_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auto_assign_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_driver_pay_type text DEFAULT 'PERCENTAGE',
  ADD COLUMN IF NOT EXISTS default_driver_pay_value numeric(10,2) DEFAULT 70;
