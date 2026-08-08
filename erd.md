# Entity Relationship Diagram — Public Notice Management

**Database:** PostgreSQL, managed via [Prisma](apps/api/prisma/schema.prisma) (`apps/api`).
**Scope:** notice aggregation, AI enrichment, RAG document store, and auth. There is exactly one bounded context in this schema — no unrelated subsystems.
**Vector index:** chunk embeddings for RAG live in **Qdrant**, outside Postgres — see [External Systems](#external-systems).

> Generated from `apps/api/prisma/schema.prisma`. Keep this file in sync whenever the schema changes.

---

## Diagram

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : "uploads"
    SCRAPE_SOURCE ||--o{ SCRAPED_ITEM : "produces"
    SCRAPE_SOURCE ||--o{ SCRAPE_RUN : "logs runs of"
    SCRAPED_ITEM ||--o{ ATTACHMENT : "has"

    USER {
        uuid id PK
        string googleId UK "Google OAuth subject claim"
        string email UK
        string name
        string avatarUrl "nullable"
        Role role "user | admin, default user"
        UserStatus status "active | inactive, default active"
        datetime lastLoginAt "nullable"
        datetime createdAt
        datetime updatedAt
    }

    DOCUMENT {
        uuid id PK
        string title
        string filename
        string mimeType
        int fileSize "bytes"
        string filePath
        DocumentStatus status "PENDING|PROCESSING|INDEXED|UNEMBEDDED|FAILED"
        boolean isOcr "default false"
        boolean isSystem "default false; seeded, not user-uploaded"
        int textLength "nullable"
        int chunkCount "nullable"
        uuid uploadedBy FK "nullable -> USER.id"
        datetime createdAt
        datetime updatedAt
        datetime indexedAt "nullable"
    }

    SCRAPE_SOURCE {
        uuid id PK
        string name
        string baseUrl
        string noticeListUrl "nullable"
        string newsListUrl "nullable"
        string pressReleaseListUrl "nullable"
        json noticeSchema "nullable; cached crawl4ai CSS schema"
        json newsSchema "nullable"
        json pressReleaseSchema "nullable"
        ScrapePaginationType paginationType "QUERY_PARAM|PATH_TEMPLATE|NONE"
        string paginationParam "default page"
        int startPage "default 1"
        int maxPages "default 3"
        boolean enabled "default true"
        datetime lastRunAt "nullable"
        ScrapeRunStatus lastStatus "nullable"
        datetime createdAt
        datetime updatedAt
    }

    SCRAPED_ITEM {
        uuid id PK
        uuid sourceId FK "nullable -> SCRAPE_SOURCE.id, cascades on delete"
        string sourceLabel "default mofa.gov.np; denormalized source name"
        ScrapedItemCategory category "NOTICE|NEWS|PRESS_RELEASE|CIRCULAR|TENDER|VACANCY|OTHER"
        string sourceSlug "nullable"
        string title
        string sourceUrl UK "dedup key across scrape runs"
        string summary "nullable"
        string contentText "nullable"
        string contentHtml "nullable"
        string attachmentUrl "nullable"
        datetime publishedAt "nullable"
        string contentHash "change-detection hash"
        int views "default 0"
        string aiSummary "nullable"
        string aiSummaryNe "nullable; Nepali summary"
        string aiUrgency "nullable"
        float aiCategoryConfidence "nullable"
        json keyFacts "nullable"
        json tags "nullable"
        json metadata "nullable; ref no., issuing office, deadline, etc."
        datetime aiAnalyzedAt "nullable"
        datetime scrapedAt
        datetime updatedAt
    }

    ATTACHMENT {
        uuid id PK
        uuid itemId FK "-> SCRAPED_ITEM.id, cascades on delete"
        string url
        string mimeType "nullable"
        int sizeBytes "nullable"
        string storageKey "nullable"
        datetime downloadedAt "nullable"
        string label "nullable"
        datetime createdAt
    }

    SCRAPE_RUN {
        uuid id PK
        uuid sourceId FK "nullable -> SCRAPE_SOURCE.id, cascades on delete"
        string sourceLabel "default mofa.gov.np"
        ScrapeRunStatus status "RUNNING|SUCCESS|FAILED, default RUNNING"
        int itemsFound "default 0"
        int itemsNew "default 0"
        int itemsUpdated "default 0"
        int itemsSkipped "default 0"
        int itemsSummarized "default 0"
        int itemsSummaryFailed "default 0"
        string error "nullable"
        datetime startedAt
        datetime finishedAt "nullable"
    }
```

---

## Legend

| Notation | Meaning |
|---|---|
| `PK` | Primary key |
| `FK` | Foreign key |
| `UK` | Unique constraint |
| `\|\|--o{` | One-to-many (crow's foot): exactly one on the left, zero-or-more on the right |
| `Type` in caps (`Role`, `DocumentStatus`, …) | Prisma enum — allowed values noted in the attribute comment |

## Relationships

| Relationship | Cardinality | On delete | Notes |
|---|---|---|---|
| `User → Document` | 1 : N | `RESTRICT` (default) | `uploadedBy` is nullable — system-seeded documents (`isSystem=true`) have no owning user |
| `ScrapeSource → ScrapedItem` | 1 : N | `CASCADE` | `sourceId` nullable — legacy/manually-seeded items use free-text `sourceLabel` instead |
| `ScrapeSource → ScrapeRun` | 1 : N | `CASCADE` | Same nullable-source pattern as above |
| `ScrapedItem → Attachment` | 1 : N | `CASCADE` | Deleting a notice removes its attachments |

## External Systems

- **Qdrant (vector DB)** — `apps/ai/app/store.py` maintains a hybrid (dense + sparse) vector collection keyed by `doc_id` / `chunk_index`, one point per document chunk. This is the RAG index backing `DOCUMENT` rows (`textLength`, `chunkCount`, `status` in Postgres mirror what's indexed in Qdrant) and is not itself relational, so it isn't modeled above.
- **Frontend types** (`apps/web/lib/types.ts`) mirror these API DTOs closely (`RagDocument` ↔ `DOCUMENT`, `ScrapedItem` / `PublicNoticeDetail` ↔ `SCRAPED_ITEM` + `ATTACHMENT`, plus `ScrapeSource`, `ScrapeRun`). A handful of types (`AlertRule`, `Activity`, `ScrapingSource`) exist only in the web app's localStorage mock layer (`lib/local-store.ts`, `lib/mock-data.ts`) with no backing table yet — part of the local-only mode described in `CLAUDE.md`.
