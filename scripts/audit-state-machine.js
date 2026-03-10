/**
 * Full state-machine audit: DB enums, constraints, live value distribution
 */
const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.erdsjplilnmrcltlecra:Nii62XSLVNxQ3NB0@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function q(sql, params) {
  return (await c.query(sql, params || [])).rows;
}

async function main() {
  await c.connect();

  // 1. All relevant enums
  console.log('\n=== ENUMS ===');
  const enums = await q(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN (
      'operational_status_enum','payment_status_enum','payment_type_enum',
      'invoice_status_enum','invoice_type_enum','adjustment_status_enum',
      'booking_source_enum','booking_status_enum','assignment_status_enum'
    )
    GROUP BY t.typname ORDER BY t.typname
  `);
  enums.forEach(e => console.log(`${e.typname}: ${JSON.stringify(e.values)}`));

  // 2. Check constraints on bookings
  console.log('\n=== BOOKINGS CHECK CONSTRAINTS ===');
  const chk = await q(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'c'
    ORDER BY conname
  `);
  chk.forEach(c => console.log(`${c.conname}: ${c.def}`));

  // 3. Bookings column types (relevant fields)
  console.log('\n=== BOOKINGS RELEVANT COLUMNS ===');
  const cols = await q(`
    SELECT column_name, data_type, udt_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
      AND column_name IN (
        'operational_status','payment_status','adjustment_status',
        'adjustment_amount_minor','actual_total_minor',
        'stripe_payment_intent_id','payment_captured_at',
        'payment_token','payment_link_expires_at','payment_token_expires_at',
        'booking_source','booking_reference'
      )
    ORDER BY column_name
  `);
  cols.forEach(c => console.log(`${c.column_name}: ${c.udt_name} default=${c.column_default} nullable=${c.is_nullable}`));

  // 4. Payments table columns
  console.log('\n=== PAYMENTS COLUMNS ===');
  const pcols = await q(`
    SELECT column_name, data_type, udt_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments'
    ORDER BY ordinal_position
  `);
  pcols.forEach(c => console.log(`${c.column_name}: ${c.udt_name} nullable=${c.is_nullable}`));

  // 5. Payments check constraints
  console.log('\n=== PAYMENTS CHECK CONSTRAINTS ===');
  const pchk = await q(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass AND contype = 'c'
    ORDER BY conname
  `);
  pchk.forEach(c => console.log(`${c.conname}: ${c.def}`));

  // 6. Invoices table
  console.log('\n=== INVOICES COLUMNS ===');
  const icols = await q(`
    SELECT column_name, data_type, udt_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices'
    ORDER BY ordinal_position
  `);
  icols.forEach(c => console.log(`${c.column_name}: ${c.udt_name} nullable=${c.is_nullable}`));

  // 7. Invoice check constraints
  console.log('\n=== INVOICES CHECK CONSTRAINTS ===');
  const ichk = await q(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass AND contype = 'c'
    ORDER BY conname
  `);
  ichk.forEach(c => console.log(`${c.conname}: ${c.def}`));

  // 8. Live distribution of booking states
  const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  console.log('\n=== LIVE booking operational_status distribution ===');
  const ops = await q(`
    SELECT operational_status, COUNT(*) as n
    FROM public.bookings WHERE tenant_id=$1 GROUP BY 1 ORDER BY 2 DESC`, [TENANT]);
  ops.forEach(r => console.log(`  ${r.operational_status}: ${r.n}`));

  console.log('\n=== LIVE booking payment_status distribution ===');
  const pays = await q(`
    SELECT payment_status, COUNT(*) as n
    FROM public.bookings WHERE tenant_id=$1 GROUP BY 1 ORDER BY 2 DESC`, [TENANT]);
  pays.forEach(r => console.log(`  ${r.payment_status}: ${r.n}`));

  console.log('\n=== LIVE booking adjustment_status distribution ===');
  const adjs = await q(`
    SELECT adjustment_status, COUNT(*) as n
    FROM public.bookings WHERE tenant_id=$1 AND adjustment_status IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC`, [TENANT]);
  adjs.forEach(r => console.log(`  ${r.adjustment_status}: ${r.n}`));

  console.log('\n=== LIVE payments payment_type + payment_status distribution ===');
  const ptypes = await q(`
    SELECT payment_type, payment_status, COUNT(*) as n
    FROM public.payments WHERE tenant_id=$1 GROUP BY 1,2 ORDER BY 3 DESC`, [TENANT]);
  ptypes.forEach(r => console.log(`  ${r.payment_type}/${r.payment_status}: ${r.n}`));

  console.log('\n=== LIVE invoice status+type distribution ===');
  const inv = await q(`
    SELECT invoice_type, status, COUNT(*) as n
    FROM public.invoices WHERE tenant_id=$1 AND deleted_at IS NULL
    GROUP BY 1,2 ORDER BY 3 DESC`, [TENANT]);
  inv.forEach(r => console.log(`  ${r.invoice_type}/${r.status}: ${r.n}`));

  // 9. Suspicious / inconsistent combinations
  console.log('\n=== SUSPICIOUS: CONFIRMED + payment_status=FAILED ===');
  const sus1 = await q(`
    SELECT id,booking_reference,operational_status,payment_status,stripe_payment_intent_id
    FROM public.bookings
    WHERE tenant_id=$1 AND operational_status='CONFIRMED' AND payment_status='FAILED'`, [TENANT]);
  sus1.forEach(r => console.log(`  ${r.booking_reference}: ${r.operational_status}/${r.payment_status} pi=${r.stripe_payment_intent_id}`));
  if (!sus1.length) console.log('  none');

  console.log('\n=== SUSPICIOUS: CONFIRMED + payment_status=UNPAID (no PI) ===');
  const sus2 = await q(`
    SELECT id,booking_reference,operational_status,payment_status
    FROM public.bookings
    WHERE tenant_id=$1 AND operational_status='CONFIRMED' AND payment_status='UNPAID'
      AND stripe_payment_intent_id IS NULL`, [TENANT]);
  sus2.forEach(r => console.log(`  ${r.booking_reference}: ${r.operational_status}/${r.payment_status}`));
  if (!sus2.length) console.log('  none');

  console.log('\n=== SUSPICIOUS: FULFILLED + adjustment_status=CAPTURED but no payments ADJUSTMENT row ===');
  const sus3 = await q(`
    SELECT b.id,b.booking_reference,b.adjustment_status
    FROM public.bookings b
    WHERE b.tenant_id=$1 AND b.adjustment_status='CAPTURED'
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.booking_id=b.id AND p.payment_type='ADJUSTMENT' AND p.payment_status='PAID'
      )`, [TENANT]);
  sus3.forEach(r => console.log(`  ${r.booking_reference}: adj=${r.adjustment_status} but no ADJUSTMENT payment row`));
  if (!sus3.length) console.log('  none');

  console.log('\n=== SUSPICIOUS: PAID booking but no INITIAL payments row ===');
  const sus4 = await q(`
    SELECT b.id,b.booking_reference,b.payment_status,b.operational_status
    FROM public.bookings b
    WHERE b.tenant_id=$1 AND b.payment_status='PAID'
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p WHERE p.booking_id=b.id AND p.payment_type='INITIAL' AND p.payment_status='PAID'
      )
    LIMIT 10`, [TENANT]);
  sus4.forEach(r => console.log(`  ${r.booking_reference}: ${r.operational_status}/${r.payment_status} but no INITIAL payment row`));
  if (!sus4.length) console.log('  none');

  console.log('\n=== SUSPICIOUS: adjustment_status=CAPTURED but no matching ADJUSTMENT payment row (broader) ===');
  const sus5 = await q(`
    SELECT b.id,b.booking_reference,b.adjustment_status,b.adjustment_amount_minor
    FROM public.bookings b
    WHERE b.tenant_id=$1 AND b.adjustment_status IN ('CAPTURED','SETTLED')
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p WHERE p.booking_id=b.id AND p.payment_type='ADJUSTMENT'
      )`, [TENANT]);
  sus5.forEach(r => console.log(`  ${r.booking_reference}: adj=${r.adjustment_status} amount=${r.adjustment_amount_minor}`));
  if (!sus5.length) console.log('  none');

  // 10. Unique constraints on payments
  console.log('\n=== PAYMENTS UNIQUE CONSTRAINTS ===');
  const uidx = await q(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename='payments' AND schemaname='public'
    ORDER BY indexname`);
  uidx.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  // 11. Status history table if exists
  console.log('\n=== STATUS HISTORY TABLE EXISTS? ===');
  const hist = await q(`
    SELECT column_name, udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='booking_status_history'
    ORDER BY ordinal_position LIMIT 10`);
  if (hist.length) hist.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name}`));
  else console.log('  NOT FOUND');

  await c.end();
  console.log('\n=== AUDIT COMPLETE ===');
}

main().catch(e => { console.error(e.message); process.exit(1); });
