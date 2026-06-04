// Shared domain types — consumed by apps/web, apps/api, apps/ai

export type UserRole = "user" | "admin"
export type UserStatus = "active" | "inactive" | "suspended"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

export type NoticeCategory =
  | "vacancies"
  | "tenders"
  | "exams"
  | "policy"
  | "gazette"
  | "general"

export type NoticePriority = "low" | "medium" | "high"

export interface Notice {
  id: string
  title: string
  organization: string
  category: NoticeCategory
  priority: NoticePriority
  publishedAt: string
  expiresAt?: string
  sourceUrl: string
  summary?: string
  views: number
  isOcr: boolean
}

export type AlertType = "keyword" | "category" | "organization"

export interface Alert {
  id: string
  userId: string
  name: string
  type: AlertType
  conditions: string[]
  enabled: boolean
  matchCount: number
  lastMatchedAt?: string
  createdAt: string
}

export type ScrapingSourceStatus = "active" | "inactive" | "error"

export interface ScrapingSource {
  id: string
  name: string
  url: string
  status: ScrapingSourceStatus
  itemsScraped: number
  lastScrapedAt?: string
  errorMessage?: string
}

export interface Document {
  id: string
  noticeId?: string
  filename: string
  mimeType: string
  sizeBytes: number
  isOcr: boolean
  uploadedAt: string
}

export interface RagQuery {
  query: string
  topK?: number
}

export interface RagResult {
  answer: string
  sources: Array<{ id: string; title: string; score: number }>
}

// API response envelope
export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
