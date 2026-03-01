const { Client } = require('pg');
const { randomUUID } = require('crypto');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('begin');

  const tenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const serviceClassId = randomUUID();

  await client.query(
    `INSERT INTO public.tenant_service_classes
      (id, tenant_id, name, description, surge_multiplier, currency, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      serviceClassId,
      tenantId,
      'Luxury Sedan',
      'Premium chauffeur service',
      1.0,
      'AUD',
      true,
    ],
  );

  await client.query(
    `INSERT INTO public.service_class_pricing_items
      (tenant_id, service_class_id, item_type, amount_minor, unit, active)
     VALUES
      ($1,$2,'BASE_FARE',1000,'flat',true),
      ($1,$2,'PER_KM',200,'per_km',true),
      ($1,$2,'DRIVING_TIME',50,'per_minute',true)`,
    [tenantId, serviceClassId],
  );

  await client.query('commit');
  console.log(JSON.stringify({ serviceClassId }, null, 2));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
