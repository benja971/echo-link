#!/bin/bash
# Clear all data from Echo-Link (DB + S3) in Docker environment
# Usage: ./scripts/docker-clear-all.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  WARNING: This will delete ALL data from database and S3!${NC}"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}🗑️  Clearing all data...${NC}"

# Run the clear script inside the echo-link container
docker exec -it echo-link node -e "
const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : false,
});

const s3Client = new S3Client({
  endpoint: \`\${process.env.S3_USE_SSL === 'true' ? 'https' : 'http'}://\${process.env.S3_ENDPOINT}:\${process.env.S3_PORT}\`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET_NAME;

async function main() {
  // Clear S3
  console.log('Clearing S3 bucket:', BUCKET);
  let total = 0;
  let token;
  do {
    const res = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
    const objects = res.Contents || [];
    if (objects.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objects.map(o => ({ Key: o.Key })) },
      }));
      total += objects.length;
    }
    token = res.NextContinuationToken;
  } while (token);
  console.log('S3: Deleted', total, 'objects');

  // Clear DB
  console.log('Clearing database...');
  const tables = ['files', 'discord_upload_sessions', 'upload_tokens', 'magic_links', 'upload_identities', 'users'];
  for (const table of tables) {
    try {
      const r = await pool.query('DELETE FROM ' + table);
      console.log('  Deleted', r.rowCount, 'rows from', table);
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }
  }
  await pool.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
"

echo ""
echo -e "${GREEN}🎉 All data has been cleared!${NC}"
