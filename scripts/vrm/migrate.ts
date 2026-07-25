/**
 * Applies supabase/migrations/*.sql in filename order.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/migrate.ts
 *
 * A convenience for a project with no local Supabase CLI/Docker. The migrations
 * are idempotent, so re-running is safe. Each file runs inside a transaction, so
 * a failure part-way leaves nothing half-applied.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')

async function main() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.error(`No .sql files in ${MIGRATIONS_DIR}`)
    process.exit(1)
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  console.log(`Connected. Applying ${files.length} migration(s).\n`)

  try {
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
      process.stdout.write(`  ${file} ... `)
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('commit')
        console.log('ok')
      } catch (err) {
        await client.query('rollback')
        console.log('FAILED')
        throw err
      }
    }
    console.log('\nMigrations applied.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('\n' + (err instanceof Error ? err.message : String(err)))
  process.exit(1)
})
