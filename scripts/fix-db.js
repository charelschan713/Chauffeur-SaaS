const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.erdsjplilnmrcltlecra:Nii62XSLVNxQ3NB0@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const BOOKING = 'ec1cf3ec-140e-40e8-aa4d-869ed0b86ca6';
const PI      = 'pi_3T9Q5iB3pdczuXMq1sGrb9Bm';
const TENANT  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AMOUNT  = 12574;

c.connect().then(async () => {
  await c.query(
    "UPDATE public.bookings SET payment_status='PAID', updated_at=NOW() WHERE id=$1",
    [BOOKING]
  );
  console.log('Booking payment_status fixed -> PAID');

  await c.query(
    `INSERT INTO public.payments
       (tenant_id, booking_id, stripe_payment_intent_id, payment_type,
        currency, amount_authorized_minor, amount_captured_minor,
        amount_refunded_minor, payment_status, created_at, updated_at)
     VALUES ($1,$2,$3,'INITIAL','AUD',$4,$4,0,'PAID',NOW(),NOW())
     ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING`,
    [TENANT, BOOKING, PI, AMOUNT]
  );
  console.log('Payments row backfilled');

  const b = await c.query(
    'SELECT operational_status,payment_status,stripe_payment_intent_id FROM public.bookings WHERE id=$1',
    [BOOKING]
  );
  const p = await c.query(
    'SELECT payment_type,payment_status,stripe_payment_intent_id,amount_captured_minor FROM public.payments WHERE booking_id=$1',
    [BOOKING]
  );
  console.log('BOOKING after fix:', JSON.stringify(b.rows[0]));
  console.log('PAYMENTS after fix:', JSON.stringify(p.rows[0]));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
