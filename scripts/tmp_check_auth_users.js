const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const res = await client.query(
    'select id, email from auth.users where email = $1',
    ['charles@mrdrivers.com.au'],
  );
  console.log(JSON.stringify(res.rows, null, 2));

  const cols = await client.query(
    "select column_name, data_type, is_nullable from information_schema.columns where table_schema='auth' and table_name='users' order by ordinal_position",
  );
  console.log(JSON.stringify(cols.rows, null, 2));

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
