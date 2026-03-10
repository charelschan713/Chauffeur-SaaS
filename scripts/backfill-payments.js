/**
 * Backfill missing INITIAL payments rows for bookings with payment_status=PAID
 * but no corresponding payments row (pre-dates payments recording feature).
 *
 * Safe to run multiple times: ON CONFLICT DO NOTHING.
 * Only processes bookings that have a stripe_payment_intent_id set.
 * Does NOT create a Stripe charge — records only.
 */
const { Client } = require('pg');
const DB = 'postgresql://postgres.erdsjplilnmrcltlecra:Nii62XSLVNxQ3NB0@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function main() {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Find PAID bookings with stripe_payment_intent_id but no INITIAL payments row
  const gaps = await c.query(`
    SELECT b.id, b.booking_reference, b.tenant_id, b.stripe_payment_intent_id,
           b.total_price_minor, b.currency, b.payment_status
    FROM public.bookings b
    WHERE b.tenant_id = $1
      AND b.payment_status = 'PAID'
      AND b.stripe_payment_intent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.booking_id = b.id AND p.payment_type = 'INITIAL' AND p.payment_status = 'PAID'
      )
    ORDER BY b.created_at
  `, [TENANT]);

  console.log(`Found ${gaps.rows.length} bookings to backfill:`);
  gaps.rows.forEach(b => console.log(`  ${b.booking_reference}: pi=${b.stripe_payment_intent_id} amount=${b.total_price_minor} ${b.currency}`));

  if (gaps.rows.length === 0) {
    console.log('Nothing to backfill.');
    await c.end();
    return;
  }

  const DRY_RUN = process.argv.includes('--dry-run');
  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes applied. Re-run without --dry-run to execute.');
    await c.end();
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const b of gaps.rows) {
    const result = await c.query(`
      INSERT INTO public.payments (
        tenant_id, booking_id, stripe_payment_intent_id, payment_type,
        currency, amount_authorized_minor, amount_captured_minor,
        amount_refunded_minor, payment_status, created_at, updated_at
      ) VALUES ($1, $2, $3, 'INITIAL', $4, $5, $5, 0, 'PAID', NOW(), NOW())
      ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING
    `, [b.tenant_id, b.id, b.stripe_payment_intent_id, b.currency ?? 'AUD', b.total_price_minor]);

    if (result.rowCount > 0) {
      inserted++;
      console.log(`  INSERTED: ${b.booking_reference}`);
    } else {
      skipped++;
      console.log(`  SKIPPED (conflict): ${b.booking_reference}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
