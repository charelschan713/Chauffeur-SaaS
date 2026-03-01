const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('begin');

  const userId = '72124767-2d7f-43d0-bab4-f99913bf7b13';
  const email = 'charles@mrdrivers.com.au';
  const fullName = 'Charles Driver';
  const tenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const userRes = await client.query(
    'insert into public.users (id, email, full_name, is_platform_admin) values ($1,$2,$3,false) on conflict (id) do nothing',
    [userId, email, fullName],
  );

  const membershipRes = await client.query(
    'insert into public.memberships (tenant_id, user_id, role, status) values ($1,$2,$3,$4) on conflict do nothing',
    [tenantId, userId, 'driver', 'active'],
  );

  await client.query('commit');
  console.log(JSON.stringify({ userInserted: userRes.rowCount, membershipInserted: membershipRes.rowCount }, null, 2));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
