import { pool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'files'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Database already migrated');
      return;
    }

    // Read and execute migration
    const migrationPath = join(__dirname, 'migrations', '001_init_files.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration: 001_init_files.sql');
    await pool.query(migrationSQL);

    console.log('✅ Migrations completed successfully');
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
