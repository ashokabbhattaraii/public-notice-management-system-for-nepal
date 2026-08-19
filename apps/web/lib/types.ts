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

export type DigestFrequency = "INSTANT" | "DAILY" | "WEEKLY"

export interface WhatsappStatus {
  connected: boolean
  alertsEnabled: boolean
  phoneNumberMasked: string | null
  digestFrequency: DigestFrequency
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

export type AlertPriority = "NORMAL" | "HIGH"
export type AlertUrgency = "LOW" | "MEDIUM" | "HIGH"

// Categories and/or tags are the required primary basis for a rule (the
// "easy" alert setup — e.g. "notify me about all Vacancy notices" or
// "anything tagged scholarship"). Every other field is an optional
// refinement layered on top for users who want advanced tuning; none of
// them may be the sole basis of a rule. Every non-empty dimension is AND'd
// together; values within one dimension (e.g. multiple keywords) are OR'd.
export interface AlertRule {
  id: string
  userId: string
  name: string
  enabled: boolean
  /** HIGH always delivers instantly, bypassing the account's digest setting. */
  priority: AlertPriority
  // Primary (required — at least one of the two):
  categories: ScrapedItemCategory[]
  tags: string[]
  // Optional advanced refinements:
  keywords: string[]
  excludeKeywords: string[]
  organizations: string[]
  minUrgency: AlertUrgency | null
  deadlineWithinDays: number | null
  matchCount: number
  createdAt: string
  updatedAt: string
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

export type ScrapedItemCategory = "NOTICE" | "NEWS" | "PRESS_RELEASE" | "CIRCULAR" | "TENDER" | "VACANCY" | "JOB" | "INTERNSHIP" | "OTHER"

export const CATEGORY_ORDER: ScrapedItemCategory[] = [
  "NOTICE",
  "JOB",
  "INTERNSHIP",
  "VACANCY",
  "CIRCULAR",
  "TENDER",
  "NEWS",
  "PRESS_RELEASE",
  "OTHER",
]

const CATEGORY_LABELS: Record<ScrapedItemCategory, string> = {
  NOTICE: "Notice",
  NEWS: "News",
  PRESS_RELEASE: "Press Release",
  CIRCULAR: "Circular",
  TENDER: "Tender",
  VACANCY: "Vacancy",
  JOB: "Job",
  INTERNSHIP: "Internship",
  OTHER: "Other",
}
export function categoryLabel(cat: ScrapedItemCategory): string {
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ").toLowerCase()
}

// Canonical tags — the controlled vocabulary LLM should prefer. Used for
// UI filter chips and prompt guidance. Update when new themes emerge.
export const CANONICAL_TAGS: string[] = [
  "education",
  "health",
  "employment",
  "procurement",
  "infrastructure",
  "environment",
  "finance",
  "legal",
  "transport",
  "technology",
  "agriculture",
  "tourism",
  "culture",
  "disaster",
  "governance",
  "social welfare",
  "youth",
  "women",
  "senior citizens",
  "disability",
  "migration",
  "foreign affairs",
  "defense",
  "energy",
  "water",
  "sanitation",
  "housing",
  "urban development",
  "rural development",
  "local government",
  "federal affairs",
  "constitution",
  "election",
  "budget",
  "taxation",
  "trade",
  "industry",
  "science",
  "research",
  "innovation",
  "digital",
  "cybersecurity",
  "climate",
  "biodiversity",
  "forestry",
  "mining",
  "labor",
  "skill development",
  "vocational training",
  "scholarship",
  "exam",
  "result",
  "admission",
  "recruitment",
  "promotion",
  "transfer",
  "retirement",
  "pension",
  "insurance",
  "banking",
  "microfinance",
  "cooperatives",
  "ngo",
  "civil society",
  "human rights",
  "gender",
  "child protection",
]

export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[^\w\s-]/g, "")
}

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
  aiSummary?: string | null
  aiSummaryNe?: string | null
  aiUrgency?: string | null
}

export interface Attachment {
  id: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  storageKey: string | null
  label: string | null
}

/** Full detail (includes body content), returned by GET /notices/:id. */
export interface PublicNoticeDetail extends ScrapedItem {
  contentText: string | null
  contentHtml: string | null
  views: number
  aiSummary: string | null
  aiSummaryNe: string | null
  aiUrgency: string | null
  keyFacts: string[] | null
  tags: string[] | null
  attachments: Attachment[]
  metadata: Record<string, string> | null
  sourceSlug: string | null
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
  itemsSkipped: number
  itemsSummarized: number
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
  pressReleaseListUrl: string | null
  paginationType: ScrapePaginationType
  paginationParam: string
  startPage: number
  maxPages: number
  // Automatic polling: seconds between scheduler probes of this source.
  pollIntervalSeconds: number
  // Cached sitemap fast-path URL (null = no usable sitemap, HTML-poll only).
  sitemapUrl: string | null
  // When sitemap detection was last attempted (attempted once, cached forever).
  sitemapCheckedAt: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
  lastStatus: ScrapeRunStatus | null
  itemCount: number
}

/** Result of a cheap sitemap check (POST /admin/scraping/sources/:id/check). */
export interface SitemapCheckResult {
  sitemap_url: string | null
  checked_at: string
  new_urls: string[]
  total_locs: number
}

/** Effective scheduler configuration + last tick (GET /admin/scraping/scheduler). */
export interface SchedulerStatus {
  cron: string
  concurrency: number
  staleRunTimeoutSeconds: number
  minPollIntervalSeconds: number
  ticking: boolean
  // Global automatic-scraping on/off switch (persisted; manual runs unaffected).
  autoScraping: boolean
  lastTickAt: string | null
  lastDueCount: number
}

/** Result of a bulk "run all sources" trigger. */
export interface RunAllResult {
  scheduled: number
  skipped: number
  results: {
    sourceId: string
    sourceName: string
    runId: string | null
    status: "scheduled" | "already-running" | "disabled"
  }[]
}

export interface ScrapeRunProgress {
  run_id: string
  stage: "running" | "done" | "failed" | null
  messages: { at: number; text: string }[]
  error: string | null
}

// ── Admin settings ─────────────────────────────────────────────────────

export type SettingType = "boolean" | "number" | "cron" | "text" | "textarea" | "select"

export interface SettingOption {
  value: string
  label: string
}

export interface SettingField {
  key: string
  group: string
  label: string
  description: string
  type: SettingType
  value: string
  default: string
  overridden: boolean
  unit?: string
  min?: number
  max?: number
  step?: number
  options?: SettingOption[]
  placeholder?: string
}

export interface SettingGroup {
  id: string
  label: string
  description: string
  changed: number
}

export interface SettingsView {
  groups: SettingGroup[]
  settings: SettingField[]
}

export interface SettingApplyResult extends SettingsView {
  applied: { key: string; value: string }[]
  errors: { key: string; message: string }[]
  runtime?: { scheduler: SchedulerStatus }
}

export interface PublicSiteSettings {
  site: { title: string; description: string }
}

export interface Activity {
  id: string
  userId: string
  type: "view" | "save" | "alert" | "search" | "document"
  description: string
  timestamp: string
  relatedId?: string
}
