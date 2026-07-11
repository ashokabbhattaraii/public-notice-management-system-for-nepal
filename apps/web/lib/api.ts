import {
  User,
  RagDocument,
  RagDocumentListResponse,
  RagQueryResponse,
  DocumentStatus,
  DocumentProgress,
  ScrapedItem,
  ScrapedItemCategory,
  ScrapeRun,
  ScrapeRunProgress,
  ScrapeSource,
  ScrapePaginationType,
  PublicNoticeDetail,
  PublicNoticeSource,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

const TOKEN_KEY = "pnm_token"

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// Shape returned by the API for a user.
interface ApiUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: "user" | "admin"
  status: "active" | "inactive"
  createdAt: string
  lastLoginAt: string | null
}

// Map the API user onto the web app's existing User shape.
function mapUser(u: ApiUser): User {
  return {
    id: u.id,
    username: u.name,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLogin: u.lastLoginAt ?? u.createdAt,
  }
}

/** Authenticated fetch - attaches the bearer token when present. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error((await res.text()) || `Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

/** Exchange a Google ID token for an app session and return the mapped user. */
export async function googleLogin(credential: string): Promise<User> {
  const data = await apiFetch<{ token: string; user: ApiUser }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  })
  tokenStore.set(data.token)
  return mapUser(data.user)
}

/** Validate the stored token and return the current user, or null. */
export async function fetchMe(): Promise<User | null> {
  if (!tokenStore.get()) return null
  try {
    return mapUser(await apiFetch<ApiUser>("/auth/me"))
  } catch {
    tokenStore.clear()
    return null
  }
}

// ─── Documents API ───────────────────────────────────────────────────────────

export async function uploadDocument(file: File, title: string): Promise<RagDocument> {
  const token = tokenStore.get()
  const form = new FormData()
  form.append("file", file)
  form.append("title", title)

  const res = await fetch(`${API_URL}/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchDocuments(
  page = 1,
  limit = 50,
  status?: DocumentStatus,
): Promise<RagDocumentListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.set("status", status)
  return apiFetch<RagDocumentListResponse>(`/documents?${params}`)
}

export async function fetchDocument(id: string): Promise<RagDocument> {
  return apiFetch<RagDocument>(`/documents/${id}`)
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/documents/${id}`, { method: "DELETE" })
}

/** Start embedding a document's file into the vector store. */
export async function embedDocument(id: string): Promise<RagDocument> {
  return apiFetch<RagDocument>(`/documents/${id}/embed`, { method: "POST" })
}

/** Remove a document's vectors from the store (keeps the file and record). */
export async function unembedDocument(id: string): Promise<RagDocument> {
  return apiFetch<RagDocument>(`/documents/${id}/unembed`, { method: "POST" })
}

/** Live ingestion progress while a document is PENDING/PROCESSING. */
export async function fetchDocumentProgress(id: string): Promise<DocumentProgress> {
  return apiFetch<DocumentProgress>(`/documents/${id}/progress`)
}

/** Batched progress for several documents - one request per poll tick. */
export async function fetchDocumentsProgress(
  ids: string[],
): Promise<Record<string, DocumentProgress | null>> {
  if (ids.length === 0) return {}
  const params = new URLSearchParams({ ids: ids.join(",") })
  return apiFetch<Record<string, DocumentProgress | null>>(`/documents/progress/batch?${params}`)
}

// ─── RAG Query API ───────────────────────────────────────────────────────────

export async function ragQuery(
  question: string,
  documentId?: string,
  topK = 5,
): Promise<RagQueryResponse> {
  return apiFetch<RagQueryResponse>("/rag/query", {
    method: "POST",
    body: JSON.stringify({ question, documentId, topK }),
  })
}

// ─── Admin Scraping API (crawl4ai pipeline, dynamic multi-source) ────────────

export async function fetchScrapeSources(): Promise<ScrapeSource[]> {
  return apiFetch("/admin/scraping/sources")
}

export interface ScrapeSourceInput {
  name: string
  baseUrl: string
  noticeListUrl?: string
  newsListUrl?: string
  pressReleaseListUrl?: string
  paginationType?: ScrapePaginationType
  paginationParam?: string
  startPage?: number
  maxPages?: number
}

export async function createScrapeSource(input: ScrapeSourceInput): Promise<ScrapeSource> {
  return apiFetch("/admin/scraping/sources", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function updateScrapeSource(
  id: string,
  input: Partial<ScrapeSourceInput & { enabled: boolean }>,
): Promise<ScrapeSource> {
  return apiFetch(`/admin/scraping/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export async function deleteScrapeSource(id: string): Promise<void> {
  await apiFetch(`/admin/scraping/sources/${id}`, { method: "DELETE" })
}

/** Trigger a scrape run for one source. Returns immediately; poll fetchScrapeRunProgress for live status. */
export async function runScrapeSource(
  id: string,
  categories?: ScrapedItemCategory[],
): Promise<{ runId: string }> {
  return apiFetch(`/admin/scraping/sources/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ categories }),
  })
}

/** Poll live status messages for a run while it's in progress. */
export async function fetchScrapeRunProgress(runId: string): Promise<ScrapeRunProgress> {
  return apiFetch(`/admin/scraping/runs/${runId}/progress`)
}

export interface ScrapedItemFilters {
  sourceId?: string
  category?: ScrapedItemCategory
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: "publishedAt" | "scrapedAt" | "title"
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}

export async function fetchScrapedItems(
  filters: ScrapedItemFilters = {},
): Promise<{ data: ScrapedItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page = 1, limit = 20, ...rest } = filters
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const [key, value] of Object.entries(rest)) {
    if (value) params.set(key, String(value))
  }
  return apiFetch(`/admin/scraping/items?${params}`)
}

export async function deleteScrapedItem(id: string): Promise<void> {
  await apiFetch(`/admin/scraping/items/${id}`, { method: "DELETE" })
}

export async function fetchScrapeRuns(sourceId?: string, limit = 20): Promise<ScrapeRun[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (sourceId) params.set("sourceId", sourceId)
  return apiFetch(`/admin/scraping/runs?${params}`)
}

// ─── Public Notices API (no auth required) ───────────────────────────────────

export interface PublicNoticeFilters {
  category?: ScrapedItemCategory
  sourceId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  urgency?: string
  sortBy?: "publishedAt" | "views"
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}

export async function fetchNotices(
  filters: PublicNoticeFilters = {},
): Promise<{ data: ScrapedItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page = 1, limit = 20, ...rest } = filters
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const [key, value] of Object.entries(rest)) {
    if (value) params.set(key, String(value))
  }
  return apiFetch(`/notices?${params}`)
}

export async function fetchNotice(id: string): Promise<PublicNoticeDetail> {
  return apiFetch(`/notices/${id}`)
}

export async function askNoticeQuestion(id: string, question: string): Promise<{ answer: string }> {
  return apiFetch(`/notices/${id}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  })
}

export interface NoticeSearchResponse {
  answer: string
  sources: { id: string; title: string; category: string; sourceUrl: string; score?: number }[]
  model_used: string | null
}

export async function searchNotices(
  question: string,
  category?: string,
  language?: string,
): Promise<NoticeSearchResponse> {
  return apiFetch("/notices/search", {
    method: "POST",
    body: JSON.stringify({ question, category, language }),
  })
}

export async function fetchNoticeCategoryCounts(): Promise<Record<string, number>> {
  return apiFetch("/notices/meta/category-counts")
}

export async function fetchNoticeSources(): Promise<PublicNoticeSource[]> {
  return apiFetch("/notices/meta/sources")
}
