#!/usr/bin/env npx tsx
/**
 * Script to clear all data from database and S3 storage
 * Usage: npx tsx scripts/clear-all.ts
 * 
 * WARNING: This will delete ALL files and database records!
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : false,
});

const s3Client = new S3Client({
  endpoint: `${process.env.S3_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.S3_ENDPOINT}:${process.env.S3_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

async function clearS3Bucket(): Promise<number> {
  console.log(`🗑️  Clearing S3 bucket: ${BUCKET_NAME}`);
  
  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    }));

    const objects = listResponse.Contents || [];
    
    if (objects.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: objects.map(obj => ({ Key: obj.Key })),
        },
      }));
      totalDeleted += objects.length;
      console.log(`   Deleted ${objects.length} objects...`);
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return totalDeleted;
}

async function clearDatabase(): Promise<void> {
  console.log('🗑️  Clearing database tables...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    const tables = [
      'files',
      'discord_upload_sessions', 
      'upload_tokens',
      'magic_links',
      'upload_identities',
      'users',
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`   Deleted ${result.rowCount} rows from ${table}`);
      } catch (err: any) {
        if (err.code === '42P01') {
          // Table doesn't exist, skip
          console.log(`   Table ${table} doesn't exist, skipping`);
        } else {
          throw err;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('');
  console.log('⚠️  WARNING: This will delete ALL data from database and S3!');
  console.log('');

  try {
    // Clear S3
    const s3Count = await clearS3Bucket();
    console.log(`✅ S3: Deleted ${s3Count} objects`);

    // Clear Database
    await clearDatabase();
    console.log('✅ Database: All tables cleared');

    console.log('');
    console.log('🎉 All data has been cleared!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
