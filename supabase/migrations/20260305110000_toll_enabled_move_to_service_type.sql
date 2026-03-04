-- Move toll_enabled from tenant_service_classes (car types) to tenant_service_types
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add toll_enabled to tenant_service_types
ALTER TABLE public.tenant_service_types
  ADD COLUMN IF NOT EXISTS toll_enabled boolean NOT NULL DEFAULT false;

-- 2. Remove toll_enabled from tenant_service_classes (car types)
--    Preserve data: if any car type had toll_enabled=true, set service type too
--    (best-effort backfill via subquery)
UPDATE public.tenant_service_types st
SET toll_enabled = true
WHERE EXISTS (
  SELECT 1 FROM public.tenant_service_classes sc
  WHERE sc.tenant_id = st.tenant_id AND sc.toll_enabled = true
);

ALTER TABLE public.tenant_service_classes
  DROP COLUMN IF EXISTS toll_enabled;
