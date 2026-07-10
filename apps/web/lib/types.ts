export type UserRole = "guest" | "user" | "admin"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  createdAt: string
  lastLogin: string
  status: "active" | "inactive"
  /** Full name from the Google profile (optional; used by real auth). */
  name?: string
  /** Profile picture URL from the Google profile (optional). */
  avatarUrl?: string | null
}

export interface Notice {
  id: string
  title: string
  description: string
  content: string
  category: NoticeCategory
  organization: string
  publishedAt: string
  updatedAt: string
  deadline?: string
  priority: "high" | "normal" | "low"
  views: number
  author: string
  status: "published" | "draft"
  attachments?: string[]
  // AI-pipeline fields (set by scraper + AI service)
  sourceUrl?: string
  sourcePortal?: string
  isOcr?: boolean
  aiSummary?: string
  keyFacts?: string[]
  scrapedAt?: string
  ocrConfidence?: number
  tags?: string[]
}

export type NoticeCategory = "exams" | "vacancies" | "tenders" | "policy" | "announcements"

export interface AlertRule {
  id: string
  userId: string
  type: "keyword" | "category" | "organization"
  name: string
  conditions: string[]
  enabled: boolean
  createdAt: string
  matchCount: number
}

export type DocumentStatus = "PENDING" | "PROCESSING" | "INDEXED" | "UNEMBEDDED" | "FAILED"

/** Live ingestion progress reported by the AI service while a document embeds. */
export interface DocumentProgress {
  doc_id: string
  stage: "extracting" | "chunking" | "embedding" | "indexing" | "done" | "failed" | null
  percent: number | null
  total_chunks?: number
  processed_chunks?: number
  message?: string
  error?: string | null
  status?: DocumentStatus
}

export interface RagDocument {
  id: string
  title: string
  filename: string
  mimeType: string
  fileSize: number
  status: DocumentStatus
  isOcr: boolean
  isSystem: boolean
  textLength: number | null
  chunkCount: number | null
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
  indexedAt: string | null
  user?: { id: string; name: string; email: string }
}

export interface RagDocumentListResponse {
  data: RagDocument[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface RagSource {
  doc_id: string
  chunk_index: number
  content: string
  score: number
  title?: string
}

export interface RagQueryResponse {
  answer: string
  sources: RagSource[]
  model_used: string | null
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: RagSource[]
  modelUsed?: string | null
}

export interface ScrapingSource {
  id: string
  name: string
  url: string
  frequency: string
  category: NoticeCategory
  status: "active" | "inactive" | "error"
  lastRun?: string
  itemsScraped: number
}

// ─── Live scraping (crawl4ai pipeline, dynamic multi-source) ─────────────────

export type ScrapedItemCategory = "NOTICE" | "NEWS"

export interface ScrapedItem {
  id: string
  sourceId: string | null
  sourceLabel: string
  category: ScrapedItemCategory
  title: string
  sourceUrl: string
  summary: string | null
  attachmentUrl: string | null
  publishedAt: string | null
  scrapedAt: string
  updatedAt: string
  views?: number
}

/** Full detail (includes body content), returned by GET /notices/:id. */
export interface PublicNoticeDetail extends ScrapedItem {
  contentText: string | null
  contentHtml: string | null
  views: number
}

export interface PublicNoticeSource {
  id: string
  name: string
}

export type ScrapeRunStatus = "RUNNING" | "SUCCESS" | "FAILED"

export interface ScrapeRun {
  id: string
  sourceId: string | null
  sourceLabel: string
  status: ScrapeRunStatus
  itemsFound: number
  itemsNew: number
  itemsUpdated: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export type ScrapePaginationType = "QUERY_PARAM" | "PATH_TEMPLATE" | "NONE"

export interface ScrapeSource {
  id: string
  name: string
  baseUrl: string
  noticeListUrl: string | null
  newsListUrl: string | null
  paginationType: ScrapePaginationType
  paginationParam: string
  startPage: number
  maxPages: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
  lastStatus: ScrapeRunStatus | null
  itemCount: number
}

export interface ScrapeRunProgress {
  run_id: string
  stage: "running" | "done" | "failed" | null
  messages: { at: number; text: string }[]
  error: string | null
}

export interface Activity {
  id: string
  userId: string
  type: "view" | "save" | "alert" | "search" | "document"
  description: string
  timestamp: string
  relatedId?: string
}
