// Seeds baseline data after a schema push/reset. Safe to re-run (upserts by
// a fixed id). Run via `pnpm db:seed` (from repo root) or `node prisma/seed.js`
// from apps/api.
//
// Listing-page paths below follow the common `/category/notice|news|press-release/`
// convention shared by most Nepal government sites, but aren't individually
// verified — the admin UI auto-detects and caches the real extraction pattern
// on first run, so check each source's "Items scraped" count after its first
// crawl and correct any listing URL that 404s or returns 0 items.
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
  {
    id: '00000000-0000-0000-0000-00000000000b',
    name: 'Office of the President',
    baseUrl: 'https://www.presidentofnepal.gov.np',
    noticeListUrl: 'https://www.presidentofnepal.gov.np/category/notice/',
    newsListUrl: 'https://www.presidentofnepal.gov.np/category/news/',
    pressReleaseListUrl: 'https://www.presidentofnepal.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000000c',
    name: 'Ministry of Defence',
    baseUrl: 'https://mod.gov.np',
    noticeListUrl: 'https://mod.gov.np/category/notice/',
    newsListUrl: 'https://mod.gov.np/category/news/',
    pressReleaseListUrl: 'https://mod.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000000d',
    name: 'Ministry of Agriculture and Livestock Development',
    baseUrl: 'https://moald.gov.np',
    noticeListUrl: 'https://moald.gov.np/category/notice/',
    newsListUrl: 'https://moald.gov.np/category/news/',
    pressReleaseListUrl: 'https://moald.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000000e',
    name: 'Ministry of Labour, Employment and Social Security',
    baseUrl: 'https://mole.gov.np',
    noticeListUrl: 'https://mole.gov.np/category/notice/',
    newsListUrl: 'https://mole.gov.np/category/news/',
    pressReleaseListUrl: 'https://mole.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000000f',
    name: 'Ministry of Federal Affairs and General Administration',
    baseUrl: 'https://mofaga.gov.np',
    noticeListUrl: 'https://mofaga.gov.np/category/notice/',
    newsListUrl: 'https://mofaga.gov.np/category/news/',
    pressReleaseListUrl: 'https://mofaga.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Ministry of Industry, Commerce and Supplies',
    baseUrl: 'https://moics.gov.np',
    noticeListUrl: 'https://moics.gov.np/category/notice/',
    newsListUrl: 'https://moics.gov.np/category/news/',
    pressReleaseListUrl: 'https://moics.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Ministry of Physical Infrastructure and Transport',
    baseUrl: 'https://mopit.gov.np',
    noticeListUrl: 'https://mopit.gov.np/category/notice/',
    newsListUrl: 'https://mopit.gov.np/category/news/',
    pressReleaseListUrl: 'https://mopit.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Ministry of Urban Development',
    baseUrl: 'https://mud.gov.np',
    noticeListUrl: 'https://mud.gov.np/category/notice/',
    newsListUrl: 'https://mud.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Ministry of Energy, Water Resources and Irrigation',
    baseUrl: 'https://moewri.gov.np',
    noticeListUrl: 'https://moewri.gov.np/category/notice/',
    newsListUrl: 'https://moewri.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    name: 'Ministry of Forests and Environment',
    baseUrl: 'https://mofe.gov.np',
    noticeListUrl: 'https://mofe.gov.np/category/notice/',
    newsListUrl: 'https://mofe.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000015',
    name: 'Ministry of Water Supply',
    baseUrl: 'https://mowss.gov.np',
    noticeListUrl: 'https://mowss.gov.np/category/notice/',
    newsListUrl: 'https://mowss.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000016',
    name: 'Ministry of Land Management, Cooperatives and Poverty Alleviation',
    baseUrl: 'https://molcpa.gov.np',
    noticeListUrl: 'https://molcpa.gov.np/category/notice/',
    newsListUrl: 'https://molcpa.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000017',
    name: 'Ministry of Women, Children and Senior Citizens',
    baseUrl: 'https://mowcsc.gov.np',
    noticeListUrl: 'https://mowcsc.gov.np/category/notice/',
    newsListUrl: 'https://mowcsc.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000018',
    name: 'Ministry of Youth and Sports',
    baseUrl: 'https://moys.gov.np',
    noticeListUrl: 'https://moys.gov.np/category/notice/',
    newsListUrl: 'https://moys.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000019',
    name: 'Ministry of Culture, Tourism and Civil Aviation',
    baseUrl: 'https://tourism.gov.np',
    noticeListUrl: 'https://tourism.gov.np/category/notice/',
    newsListUrl: 'https://tourism.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-00000000001a',
    name: 'Ministry of Communication and Information Technology',
    baseUrl: 'https://mocit.gov.np',
    noticeListUrl: 'https://mocit.gov.np/category/notice/',
    newsListUrl: 'https://mocit.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-00000000001b',
    name: 'Ministry of Law, Justice and Parliamentary Affairs',
    baseUrl: 'https://moljpa.gov.np',
    noticeListUrl: 'https://moljpa.gov.np/category/notice/',
    newsListUrl: 'https://moljpa.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-00000000001c',
    name: 'Office of the Auditor General',
    baseUrl: 'https://oagnep.gov.np',
    noticeListUrl: 'https://oagnep.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-00000000001d',
    name: 'Election Commission Nepal',
    baseUrl: 'https://election.gov.np',
    noticeListUrl: 'https://election.gov.np/category/notice/',
    newsListUrl: 'https://election.gov.np/category/news/',
    pressReleaseListUrl: 'https://election.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000001e',
    name: 'Commission for the Investigation of Abuse of Authority (CIAA)',
    baseUrl: 'https://ciaa.gov.np',
    noticeListUrl: 'https://ciaa.gov.np/category/notice/',
    newsListUrl: 'https://ciaa.gov.np/category/news/',
    pressReleaseListUrl: 'https://ciaa.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-00000000001f',
    name: 'Department of Immigration',
    baseUrl: 'https://www.immigration.gov.np',
    noticeListUrl: 'https://www.immigration.gov.np/category/notice/',
    newsListUrl: 'https://www.immigration.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000020',
    name: 'Inland Revenue Department',
    baseUrl: 'https://ird.gov.np',
    noticeListUrl: 'https://ird.gov.np/category/notice/',
    newsListUrl: 'https://ird.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000021',
    name: 'Department of Customs',
    baseUrl: 'https://www.customs.gov.np',
    noticeListUrl: 'https://www.customs.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000022',
    name: 'Department of Roads',
    baseUrl: 'https://www.dor.gov.np',
    noticeListUrl: 'https://www.dor.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000023',
    name: 'Department of Foreign Employment',
    baseUrl: 'https://dofe.gov.np',
    noticeListUrl: 'https://dofe.gov.np/category/notice/',
    newsListUrl: 'https://dofe.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000024',
    name: 'Office of the Company Registrar',
    baseUrl: 'https://www.ocr.gov.np',
    noticeListUrl: 'https://www.ocr.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000025',
    name: 'Securities Board of Nepal (SEBON)',
    baseUrl: 'https://www.sebon.gov.np',
    noticeListUrl: 'https://www.sebon.gov.np/category/notice/',
    newsListUrl: 'https://www.sebon.gov.np/category/news/',
    pressReleaseListUrl: 'https://www.sebon.gov.np/category/press-release/',
  },
  {
    id: '00000000-0000-0000-0000-000000000026',
    name: 'Nepal Telecommunications Authority (NTA)',
    baseUrl: 'https://www.nta.gov.np',
    noticeListUrl: 'https://www.nta.gov.np/category/notice/',
    newsListUrl: 'https://www.nta.gov.np/category/news/',
    pressReleaseListUrl: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000027',
    name: 'National Vigilance Center',
    baseUrl: 'https://nvc.gov.np',
    noticeListUrl: 'https://nvc.gov.np/category/notice/',
    newsListUrl: null,
    pressReleaseListUrl: null,
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
        maxPages: 10,
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
