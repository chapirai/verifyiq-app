import 'dotenv/config';

import * as bcrypt from 'bcrypt';
import { Client } from 'pg';

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DBNAME,
  });

  await client.connect();

  const tenantResult = await client.query<{ id: string }>(
    `INSERT INTO tenants (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING id`,
    ['demo-bank', 'Demo Bank AB'],
  );

  const tenantId = tenantResult.rows[0].id;
  const users = [
    {
      email: 'admin@demo-bank.se',
      fullName: 'Demo Admin',
      role: 'admin',
      password: 'Admin1234!',
    },
    {
      email: 'compliance@demo-bank.se',
      fullName: 'Compliance Officer',
      role: 'compliance',
      password: 'Comply1234!',
    },
  ];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     full_name = EXCLUDED.full_name,
                     role = EXCLUDED.role,
                     updated_at = NOW()`,
      [tenantId, user.email, passwordHash, user.fullName, user.role],
    );
  }

  console.log('Seed complete');
  console.log('Tenant: Demo Bank AB');
  console.log('Users:');
  console.log('- admin@demo-bank.se / Admin1234!');
  console.log('- compliance@demo-bank.se / Comply1234!');

  await client.end();
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exitCode = 1;
});
