const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const res = await client.query(
    'SELECT id, tenant_id, operational_status FROM public.bookings WHERE id = $1 AND tenant_id = $2',
    ['481b51a9-f64e-4e75-9f9a-0bcf1e222b60', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
  );
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
