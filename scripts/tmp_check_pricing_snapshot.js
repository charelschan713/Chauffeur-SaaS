const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const res = await client.query(
    'SELECT id, booking_reference, total_price_minor, service_class_id, pricing_snapshot FROM public.bookings WHERE id = $1',
    ['74bf7383-afec-4d7c-833b-045d77e03463'],
  );
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
