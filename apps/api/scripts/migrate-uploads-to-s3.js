/**
 * One-off migration: uploads every file still sitting in apps/api/uploads
 * (left over from before the S3 migration) into the S3 bucket, and repoints
 * the matching Document row's storageKey at the new S3 key. Safe to re-run —
 * skips rows whose storageKey already looks like an S3 key (documents/…).
 *
 * Usage: node scripts/migrate-uploads-to-s3.js
 */
const fs = require('fs');
const path = require('path');

// No dotenv dependency in apps/api — parse the .env file directly instead.
function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(path.resolve(__dirname, '..', '.env'));

const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

const bucket = process.env.S3_BUCKET_NAME;
if (!bucket) {
  console.error('S3_BUCKET_NAME is not set in apps/api/.env');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

function extOf(filename) {
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.slice(idx).slice(0, 10) : '';
}

function buildDocumentKey(id, originalFilename) {
  return `documents/${id}${extOf(originalFilename)}`;
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

async function main() {
  const documents = await prisma.document.findMany();
  console.log(`Found ${documents.length} document row(s) in the database.`);

  let migrated = 0;
  let skippedAlreadyS3 = 0;
  let missingLocalFile = 0;

  for (const doc of documents) {
    const key = doc.storageKey;

    if (key && key.startsWith('documents/')) {
      skippedAlreadyS3 += 1;
      continue;
    }

    // Old rows stored either an absolute path or a bare filename under uploads/.
    const localPath = path.isAbsolute(key) ? key : path.join(UPLOADS_DIR, key);

    if (!fs.existsSync(localPath)) {
      console.warn(`  ! ${doc.id} (${doc.filename}) — local file not found at "${key}", skipping`);
      missingLocalFile += 1;
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    const newKey = buildDocumentKey(doc.id, doc.filename);

    if (!(await objectExists(newKey))) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: newKey,
          Body: buffer,
          ContentType: doc.mimeType,
        }),
      );
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { storageKey: newKey },
    });

    console.log(`  ✓ ${doc.id} (${doc.filename}) -> s3://${bucket}/${newKey}`);
    migrated += 1;
  }

  console.log('\nDone.');
  console.log(`  migrated:            ${migrated}`);
  console.log(`  already on S3:       ${skippedAlreadyS3}`);
  console.log(`  missing local file:  ${missingLocalFile}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
