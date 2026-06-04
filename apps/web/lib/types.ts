export type UserRole = "guest" | "user" | "admin"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  createdAt: string
  lastLogin: string
  status: "active" | "inactive"
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

export interface RagDocument {
  id: string
  title: string
  category: string
  uploadedAt: string
  fileSize: string
  viewCount: number
  summary: string
  format: "pdf" | "docx" | "txt"
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: string[]
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

export interface Activity {
  id: string
  userId: string
  type: "view" | "save" | "alert" | "search" | "document"
  description: string
  timestamp: string
  relatedId?: string
}
