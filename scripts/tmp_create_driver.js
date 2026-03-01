const { Client } = require('pg');
const { randomUUID } = require('crypto');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('begin');

  const email = 'charles@mrdrivers.com.au';
  const fullName = 'Charles Chan';
  const phone = '+61 415880519';
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let userId;
  const existingUser = await client.query(
    'select id from public.users where email = $1',
    [email],
  );

  if (existingUser.rows.length) {
    userId = existingUser.rows[0].id;
    await client.query(
      'update public.users set full_name = $1, phone = $2, updated_at = now() where id = $3',
      [fullName, phone, userId],
    );
  } else {
    userId = randomUUID();
    await client.query(
      'insert into public.users (id, email, full_name, is_platform_admin, phone, created_at, updated_at) values ($1,$2,$3,false,$4,now(),now())',
      [userId, email, fullName, phone],
    );
  }

  const existingMembership = await client.query(
    'select id from public.memberships where tenant_id = $1 and user_id = $2',
    [tenantId, userId],
  );

  if (existingMembership.rows.length) {
    await client.query(
      'update public.memberships set role = $1, status = $2, updated_at = now() where id = $3',
      ['driver', 'active', existingMembership.rows[0].id],
    );
  } else {
    await client.query(
      'insert into public.memberships (id, tenant_id, user_id, role, status, created_at, updated_at) values ($1,$2,$3,$4,$5,now(),now())',
      [randomUUID(), tenantId, userId, 'driver', 'active'],
    );
  }

  await client.query('commit');
  console.log(JSON.stringify({ userId, tenantId, email }, null, 2));
  await client.end();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
