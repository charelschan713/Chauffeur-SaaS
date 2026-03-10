/**
 * Dispatch Phase 2 — Historical reconciliation
 * Fixes assignment/execution inconsistencies identified in Phase 2 audit.
 */
const { Client } = require('pg');
const DB = 'postgresql://postgres.erdsjplilnmrcltlecra:Nii62XSLVNxQ3NB0@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function main() {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== PRE-FIX COUNTS ===');

  const pre1 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE b.tenant_id=$1 AND b.operational_status='CANCELLED'
       AND a.status NOT IN ('CANCELLED','DECLINED')`,
    [TENANT]);
  console.log(`Cat1 active-assign on CANCELLED booking: ${pre1.rows[0].n}`);

  const pre2 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE a.tenant_id=$1 AND a.driver_execution_status='job_done'
       AND b.operational_status NOT IN ('COMPLETED','FULFILLED','CANCELLED')`,
    [TENANT]);
  console.log(`Cat2 job_done exec but booking not COMPLETED/FULFILLED: ${pre2.rows[0].n}`);

  const pre3 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE a.tenant_id=$1 AND b.operational_status='FULFILLED'
       AND a.status IN ('OFFERED','PENDING','ACCEPTED')`,
    [TENANT]);
  console.log(`Cat3 FULFILLED booking with open assignment: ${pre3.rows[0].n}`);

  const pre4 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE a.tenant_id=$1 AND a.status='PENDING'
       AND b.operational_status='CANCELLED'`,
    [TENANT]);
  console.log(`Cat4 PENDING assign on CANCELLED booking: ${pre4.rows[0].n}`);

  console.log('\n=== APPLYING FIXES ===');

  // Fix 1: Cancel active assignments on CANCELLED bookings
  const fix1 = await c.query(
    `UPDATE public.assignments a
     SET status='CANCELLED', cancellation_reason='Booking cancelled — reconciled by Phase2 script',
         updated_at=NOW()
     FROM public.bookings b
     WHERE b.id=a.booking_id AND b.tenant_id=$1
       AND b.operational_status='CANCELLED'
       AND a.status NOT IN ('CANCELLED','DECLINED','JOB_COMPLETED','COMPLETED')
     RETURNING a.id`,
    [TENANT]);
  console.log(`Fix1: cancelled ${fix1.rowCount} active assignment(s) on CANCELLED bookings`);
  fix1.rows.forEach(r => console.log(`  → assignment ${r.id}`));

  // Fix 2: Cancel OFFERED/PENDING/ACCEPTED assignments on FULFILLED bookings
  const fix2 = await c.query(
    `UPDATE public.assignments a
     SET status='CANCELLED', cancellation_reason='Booking fulfilled — stale assignment reconciled',
         updated_at=NOW()
     FROM public.bookings b
     WHERE b.id=a.booking_id AND b.tenant_id=$1
       AND b.operational_status='FULFILLED'
       AND a.status IN ('OFFERED','PENDING','ACCEPTED')
     RETURNING a.id, b.booking_reference`,
    [TENANT]);
  console.log(`Fix2: cancelled ${fix2.rowCount} stale assignment(s) on FULFILLED bookings`);
  fix2.rows.forEach(r => console.log(`  → assignment ${r.id} (${r.booking_reference})`));

  console.log('\n=== POST-FIX COUNTS ===');

  const post1 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE b.tenant_id=$1 AND b.operational_status='CANCELLED'
       AND a.status NOT IN ('CANCELLED','DECLINED')`,
    [TENANT]);
  console.log(`Cat1 active-assign on CANCELLED booking: ${post1.rows[0].n} (was ${pre1.rows[0].n})`);

  const post3 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE a.tenant_id=$1 AND b.operational_status='FULFILLED'
       AND a.status IN ('OFFERED','PENDING','ACCEPTED')`,
    [TENANT]);
  console.log(`Cat3 FULFILLED booking with open assignment: ${post3.rows[0].n} (was ${pre3.rows[0].n})`);

  const post4 = await c.query(
    `SELECT COUNT(*) n FROM public.assignments a
     JOIN public.bookings b ON b.id=a.booking_id
     WHERE a.tenant_id=$1 AND a.status='PENDING'
       AND b.operational_status='CANCELLED'`,
    [TENANT]);
  console.log(`Cat4 PENDING assign on CANCELLED booking: ${post4.rows[0].n} (was ${pre4.rows[0].n})`);

  console.log('\n=== LEGITIMATELY OPEN ITEMS (no fix applied) ===');
  // COMPLETED bookings awaiting admin fulfilBooking — correct state, not a bug
  const open1 = await c.query(
    `SELECT b.booking_reference, a.driver_execution_status, a.post_job_status
     FROM public.bookings b
     LEFT JOIN public.assignments a ON a.booking_id=b.id AND a.driver_execution_status='job_done'
     WHERE b.tenant_id=$1 AND b.operational_status='COMPLETED'`,
    [TENANT]);
  console.log(`COMPLETED bookings awaiting admin review: ${open1.rows.length}`);
  open1.rows.forEach(r => console.log(`  → ${r.booking_reference} exec=${r.driver_execution_status} post_job=${r.post_job_status}`));

  await c.end();
  console.log('\nReconciliation complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
