-- Driver execution status for step-by-step job progress tracking
-- Separate from assignments.status (which tracks assignment lifecycle)

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS driver_execution_status text
    CHECK (driver_execution_status IN (
      'assigned','accepted','on_the_way','arrived','passenger_on_board','job_done','cancelled'
    )),
  ADD COLUMN IF NOT EXISTS driver_remarks text,
  ADD COLUMN IF NOT EXISTS dispatch_notes text,
  ADD COLUMN IF NOT EXISTS status_locations jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS driver_payout_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS post_job_status text DEFAULT 'none';

-- Backfill: map existing assignment status to driver execution status
UPDATE public.assignments
SET driver_execution_status = CASE
  WHEN status IN ('PENDING','OFFERED') THEN 'assigned'
  WHEN status = 'JOB_COMPLETED'        THEN 'job_done'
  WHEN status = 'CANCELLED'            THEN 'cancelled'
  ELSE 'assigned'
END
WHERE driver_execution_status IS NULL;

-- Index for driver dashboard queries
CREATE INDEX IF NOT EXISTS idx_assignments_driver_exec
  ON public.assignments (driver_id, driver_execution_status);
