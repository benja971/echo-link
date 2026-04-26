import { pool } from './pool';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get all migration files sorted by name
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration file(s)`);

    // Get already executed migrations
    const executedResult = await pool.query('SELECT version FROM schema_migrations');
    const executedMigrations = new Set(executedResult.rows.map(row => row.version));

    // Run each migration that hasn't been executed
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');

      if (executedMigrations.has(version)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`📝 Executing migration: ${file}`);
      const migrationPath = join(migrationsDir, file);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // Execute migration
      await pool.query(migrationSQL);

      // Record migration as executed
      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);

      console.log(`✅ Completed: ${file}`);
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export { runMigrations };

// If run directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
