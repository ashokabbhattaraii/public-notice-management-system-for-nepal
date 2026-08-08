// Seeds baseline data after a schema push/reset. Safe to re-run (upserts by
// a fixed id). Run via `pnpm db:seed` (from repo root) or `node prisma/seed.js`
// from apps/api.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SOURCES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Ministry of Foreign Affairs (MOFA)',
    baseUrl: 'https://mofa.gov.np',
    noticeListUrl: 'https://mofa.gov.np/category/information/',
    newsListUrl: 'https://mofa.gov.np/category/news/',
    pressReleaseListUrl: 'https://mofa.gov.np/category/presscategory/',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Nepal Rastra Bank (NRB)',
    baseUrl: 'https://www.nrb.org.np',
    noticeListUrl: 'https://www.nrb.org.np/category/notices/',
    newsListUrl: 'https://www.nrb.org.np/category/news/',
    pressReleaseListUrl: 'https://www.nrb.org.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Tribhuvan University (TU)',
    baseUrl: 'https://tu.edu.np',
    noticeListUrl: 'https://tu.edu.np/category/notice',
    newsListUrl: 'https://tu.edu.np/category/news',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Kathmandu University (KU)',
    baseUrl: 'https://ku.edu.np',
    noticeListUrl: 'https://ku.edu.np/notice',
    newsListUrl: 'https://ku.edu.np/news',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'Ministry of Home Affairs',
    baseUrl: 'https://moha.gov.np',
    noticeListUrl: 'https://moha.gov.np/category/notice/',
    newsListUrl: 'https://moha.gov.np/category/news/',
    pressReleaseListUrl: 'https://moha.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    name: 'Ministry of Education, Science & Technology',
    baseUrl: 'https://moest.gov.np',
    noticeListUrl: 'https://moest.gov.np/category/notice/',
    newsListUrl: 'https://moest.gov.np/category/news/',
    pressReleaseListUrl: 'https://moest.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    name: 'Public Service Commission (Lok Sewa Aayog)',
    baseUrl: 'https://psc.gov.np',
    noticeListUrl: 'https://psc.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: 'https://psc.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    name: 'Ministry of Finance',
    baseUrl: 'https://mof.gov.np',
    noticeListUrl: 'https://mof.gov.np/category/notice/',
    newsListUrl: 'https://mof.gov.np/category/news/',
    pressReleaseListUrl: 'https://mof.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    name: 'Ministry of Health and Population',
    baseUrl: 'https://mohp.gov.np',
    noticeListUrl: 'https://mohp.gov.np/category/notice/',
    newsListUrl: 'https://mohp.gov.np/category/news/',
    pressReleaseListUrl: 'https://mohp.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000000a',
    name: 'Office of the Prime Minister and Council of Ministers',
    baseUrl: 'https://opmcm.gov.np',
    noticeListUrl: 'https://opmcm.gov.np/category/notice/',
    newsListUrl: 'https://opmcm.gov.np/category/news/',
    pressReleaseListUrl: 'https://opmcm.gov.np/category/press-release/',
  },
];

async function main() {
  for (const src of SOURCES) {
    const source = await prisma.scrapeSource.upsert({
      where: { id: src.id },
      update: {
        pressReleaseListUrl: src.pressReleaseListUrl,
        newsListUrl: src.newsListUrl,
        noticeListUrl: src.noticeListUrl,
      },
      create: {
        id: src.id,
        name: src.name,
        baseUrl: src.baseUrl,
        noticeListUrl: src.noticeListUrl,
        newsListUrl: src.newsListUrl,
        pressReleaseListUrl: src.pressReleaseListUrl,
      },
    });
    console.log(`Seeded: ${source.name}`);
  }
  console.log(`\nDone — ${SOURCES.length} sources seeded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
