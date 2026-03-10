/**
 * Full historical backfill and reconciliation for state-model inconsistencies.
 * Idempotent. Safe to re-run.
 */
const { Client } = require('pg');
const DB = 'postgresql://postgres.erdsjplilnmrcltlecra:Nii62XSLVNxQ3NB0@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const results = [];

  // ── CATEGORY 1: PAID bookings with no INITIAL payments row + PI exists ─────
  {
    const rows = await c.query(`
      SELECT b.id, b.booking_reference, b.tenant_id, b.stripe_payment_intent_id,
             b.total_price_minor, b.currency
      FROM public.bookings b
      WHERE b.tenant_id=$1 AND b.payment_status='PAID'
        AND b.stripe_payment_intent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.booking_id=b.id AND p.payment_type='INITIAL' AND p.payment_status='PAID'
        )
    `, [TENANT]);
    console.log(`Category 1 (PAID + no INITIAL row): ${rows.rows.length} found`);
    let inserted = 0;
    for (const b of rows.rows) {
      if (!DRY_RUN) {
        const r = await c.query(`
          INSERT INTO public.payments (tenant_id,booking_id,stripe_payment_intent_id,payment_type,currency,
            amount_authorized_minor,amount_captured_minor,amount_refunded_minor,payment_status,created_at,updated_at)
          VALUES ($1,$2,$3,'INITIAL',$4,$5,$5,0,'PAID',NOW(),NOW())
          ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING
        `, [b.tenant_id, b.id, b.stripe_payment_intent_id, b.currency ?? 'AUD', b.total_price_minor]);
        if (r.rowCount > 0) { inserted++; console.log(`  INSERTED ${b.booking_reference}`); }
        else console.log(`  SKIPPED (conflict) ${b.booking_reference}`);
      } else {
        console.log(`  WOULD INSERT ${b.booking_reference}`);
      }
    }
    results.push({ category: '1 — PAID + no INITIAL row (with PI)', found: rows.rows.length, repaired: inserted });
  }

  // ── CATEGORY 2: CONFIRMED + PAYMENT_FAILED with PI set ────────────────────
  // These bookings had a Stripe charge succeed but DB persist issue set FAILED
  {
    const rows = await c.query(`
      SELECT id,booking_reference,payment_status,operational_status,stripe_payment_intent_id,total_price_minor,currency,tenant_id
      FROM public.bookings
      WHERE tenant_id=$1 AND operational_status='CONFIRMED'
        AND payment_status='FAILED' AND stripe_payment_intent_id IS NOT NULL
    `, [TENANT]);
    console.log(`Category 2 (CONFIRMED + FAILED payment_status): ${rows.rows.length} found`);
    let fixed = 0;
    for (const b of rows.rows) {
      console.log(`  ${b.booking_reference}: PI=${b.stripe_payment_intent_id}`);
      if (!DRY_RUN) {
        await c.query(`UPDATE public.bookings SET payment_status='PAID', updated_at=NOW() WHERE id=$1`, [b.id]);
        await c.query(`
          INSERT INTO public.payments (tenant_id,booking_id,stripe_payment_intent_id,payment_type,currency,
            amount_authorized_minor,amount_captured_minor,amount_refunded_minor,payment_status,created_at,updated_at)
          VALUES ($1,$2,$3,'INITIAL',$4,$5,$5,0,'PAID',NOW(),NOW())
          ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING
        `, [b.tenant_id, b.id, b.stripe_payment_intent_id, b.currency ?? 'AUD', b.total_price_minor]);
        fixed++;
      }
    }
    results.push({ category: '2 — CONFIRMED + payment_status=FAILED (PI set)', found: rows.rows.length, repaired: fixed });
  }

  // ── CATEGORY 3: CAPTURED adjustment but no ADJUSTMENT payments row ─────────
  {
    const rows = await c.query(`
      SELECT b.id,b.booking_reference,b.adjustment_status,b.adjustment_amount_minor,b.tenant_id,b.currency
      FROM public.bookings b
      WHERE b.tenant_id=$1 AND b.adjustment_status IN ('CAPTURED','SETTLED')
        AND NOT EXISTS (
          SELECT 1 FROM public.payments p WHERE p.booking_id=b.id AND p.payment_type='ADJUSTMENT'
        )
    `, [TENANT]);
    console.log(`Category 3 (CAPTURED/SETTLED adjustment + no ADJUSTMENT row): ${rows.rows.length} found`);
    // Cannot auto-repair without a real stripe_payment_intent_id — log only
    rows.rows.forEach(b => console.log(`  ${b.booking_reference}: adj=${b.adjustment_status} amount=${b.adjustment_amount_minor}`));
    results.push({ category: '3 — CAPTURED adj + no ADJUSTMENT payments row', found: rows.rows.length, repaired: 0, note: 'Cannot auto-repair without PI ID' });
  }

  // ── CATEGORY 4: PAYMENT_FAILED bookings now exist (new state from this phase) ──
  {
    const rows = await c.query(`
      SELECT id,booking_reference,operational_status,payment_status
      FROM public.bookings WHERE tenant_id=$1 AND operational_status='PAYMENT_FAILED'
    `, [TENANT]);
    console.log(`Category 4 (PAYMENT_FAILED status): ${rows.rows.length} found`);
    rows.rows.forEach(b => console.log(`  ${b.booking_reference}: op=${b.operational_status} pay=${b.payment_status}`));
    results.push({ category: '4 — PAYMENT_FAILED bookings (informational)', found: rows.rows.length, repaired: 0, note: 'Valid state per product decision' });
  }

  // ── CATEGORY 5: Fulfilled bookings with unresolved extra charge ────────────
  {
    const rows = await c.query(`
      SELECT id,booking_reference,adjustment_status,operational_status
      FROM public.bookings
      WHERE tenant_id=$1 AND operational_status='FULFILLED'
        AND adjustment_status IN ('FAILED','NO_PAYMENT_METHOD')
    `, [TENANT]);
    console.log(`Category 5 (FULFILLED + unresolved extra charge): ${rows.rows.length} found`);
    rows.rows.forEach(b => console.log(`  ${b.booking_reference}: adj=${b.adjustment_status} — admin action required`));
    results.push({ category: '5 — FULFILLED + FAILED/NO_PAYMENT_METHOD (admin action needed)', found: rows.rows.length, repaired: 0, note: 'Admin must send payment link' });
  }

  // ── CATEGORY 6: Transition history — legacy deprecated status values ────────
  {
    const rows = await c.query(`
      SELECT previous_status,new_status, COUNT(*) as n
      FROM public.booking_status_history
      WHERE (previous_status IN ('ACCEPTED','ON_THE_WAY','PENDING_ADMIN_CONFIRMATION')
         OR new_status IN ('ACCEPTED','ON_THE_WAY','PENDING_ADMIN_CONFIRMATION'))
      GROUP BY 1,2
    `);
    console.log(`Category 6 (deprecated status values in history): ${rows.rows.length} distinct pairs`);
    rows.rows.forEach(r => console.log(`  ${r.previous_status} → ${r.new_status}: ${r.n}`));
    results.push({ category: '6 — deprecated status values in history (informational)', found: rows.rows.reduce((s,r)=>s+Number(r.n),0), repaired: 0, note: 'History-only, no data repair needed' });
  }

  await c.end();

  console.log('\n=== BACKFILL SUMMARY ===');
  results.forEach(r => {
    const status = r.found === 0 ? 'CLEAN' : r.repaired > 0 ? 'REPAIRED' : 'IDENTIFIED';
    console.log(`${status} | ${r.category} | found=${r.found} repaired=${r.repaired}${r.note ? ' | '+r.note : ''}`);
  });
  if (DRY_RUN) console.log('\nDRY RUN — no changes applied.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
