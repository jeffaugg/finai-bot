import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client, ClientConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

function parseDatabaseUrl(raw: string): ClientConfig {
  const match = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!match) {
    throw new Error(
      `DATABASE_URL inválido. Esperado: postgresql://user:password@host:port/database`
    );
  }
  const [, user, password, host, port, database] = match;
  return {
    user,
    password,
    host,
    port: port ? Number(port) : 5432,
    database,
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não definido no .env');
    process.exit(1);
  }

  const client = new Client(parseDatabaseUrl(databaseUrl));

  await client.connect();
  console.log('✅ Conectado ao Postgres');

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await client.query<{ name: string }>('SELECT name FROM _migrations')).rows.map((r) => r.name)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`⏭️  ${file} (já aplicada)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`▶️  Aplicando ${file}...`);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✅ ${file} aplicada com sucesso`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Erro ao aplicar ${file}:`, error);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('🎉 Todas as migrations estão em dia.');
}

main().catch((err) => {
  console.error('❌ Falha inesperada:', err);
  process.exit(1);
});
