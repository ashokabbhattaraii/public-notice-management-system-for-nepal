// Seeds baseline data after a schema push/reset. Safe to re-run (upserts by
// a fixed id). Run via `pnpm db:seed` (from repo root) or `node prisma/seed.js`
// from apps/api.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MOFA_SOURCE_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const source = await prisma.scrapeSource.upsert({
    where: { id: MOFA_SOURCE_ID },
    update: {},
    create: {
      id: MOFA_SOURCE_ID,
      name: 'Ministry of Foreign Affairs (MOFA)',
      baseUrl: 'https://mofa.gov.np',
      noticeListUrl: 'https://mofa.gov.np/category/information/',
      newsListUrl: 'https://mofa.gov.np/category/presscategory/',
    },
  });
  console.log(`Seeded scrape source: ${source.name} (${source.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
