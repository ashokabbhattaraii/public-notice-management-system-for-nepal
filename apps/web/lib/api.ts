import {
  User,
  WhatsappStatus,
  DigestFrequency,
  AlertRule,
  RagDocument,
  RagDocumentListResponse,
  RagQueryResponse,
  DocumentStatus,
  DocumentProgress,
  ScrapedItem,
  ScrapedItemCategory,
  ScrapeRun,
  ScrapeRunStatus,
  ScrapeRunProgress,
  ScrapeSource,
  ScrapePaginationType,
  SitemapCheckResult,
  SchedulerStatus,
  RunAllResult,
  PublicNoticeDetail,
  PublicNoticeSource,
  SettingsView,
  SettingApplyResult,
  PublicSiteSettings,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

const TOKEN_KEY = "pnm_token"
const TOKEN_COOKIE = "pnm_token"
const SESSION_DAYS = 7

/**
 * Fired on `window` whenever a request comes back 401 while a token was sent.
 * AuthProvider listens and force-logs-out so guards can bounce to /login.
 */
export const AUTH_EXPIRED_EVENT = "pnm:unauthorized"

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => {
    if (typeof window === "undefined") return
    localStorage.setItem(TOKEN_KEY, token)
    // Mirror to a cookie so the edge middleware can gate protected routes
    // without a round-trip to the API. SameSite=Lax keeps it usable for the
    // browser navigation; the API still authorizes via the Authorization
    // header (the cookie is a UX gate, never a security boundary).
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${
      60 * 60 * 24 * SESSION_DAYS
    }; SameSite=Lax`
  },
  clear: () => {
    if (typeof window === "undefined") return
    localStorage.removeItem(TOKEN_KEY)
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  },
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

// ─── Membership & billing ────────────────────────────────────────────────────

export type PlanTier = "FREE" | "PRO" | "MAX"

export type QuotaKind =
  | "ai_questions"
  | "documents"
  | "alert_rules"
  | "whatsapp_notifications"
  | "upload_size"
  | "instant_alerts"

export interface QuotaDenial {
  kind: QuotaKind
  limit: number | null
  used: number
  tier: PlanTier
  message: string
}

/** Thrown on HTTP 402 — the request was refused by the user's plan. */
export class QuotaError extends Error {
  constructor(message: string, readonly quota: QuotaDenial) {
    super(message)
    this.name = "QuotaError"
  }
}

export function isQuotaError(err: unknown): err is QuotaError {
  return err instanceof QuotaError
}

export interface PlanLimits {
  maxDocuments: number | null
  maxAiQuestionsPerMonth: number | null
  maxAlertRules: number | null
  maxWhatsappPerMonth: number | null
  maxUploadMb: number
  allowInstantAlerts: boolean
}

export interface PublicPlan {
  tier: PlanTier
  name: string
  tagline: string | null
  description: string | null
  priceMonthlyCents: number
  priceYearlyCents: number | null
  currency: string
  features: string[]
  limits: PlanLimits
  sortOrder: number
  purchasable: boolean
}

export interface UsageMeter {
  used: number
  limit: number | null
  remaining: number | null
  exceeded: boolean
}

export interface BillingSummary {
  plan: {
    tier: PlanTier
    name: string
    tagline: string | null
    priceMonthlyCents: number
    currency: string
  }
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"
  isDefault: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  limits: PlanLimits
  usage: {
    aiQuestions: UsageMeter
    documents: UsageMeter
    alertRules: UsageMeter
    whatsappNotifications: UsageMeter
    periodStart: string
    periodEnd: string
  }
  paymentsConfigured: boolean
}

/** Public plan catalogue for the pricing page (no auth required). */
export async function fetchPlans(): Promise<PublicPlan[]> {
  return apiFetch("/plans")
}

/** Current plan, limits and this month's usage for the signed-in user. */
export async function fetchBillingSummary(): Promise<BillingSummary> {
  return apiFetch("/billing/me")
}

/** Start an upgrade — returns the Stripe Checkout URL to redirect to. */
export async function startCheckout(tier: Exclude<PlanTier, "FREE">): Promise<{ url: string }> {
  return apiFetch("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ tier }),
  })
}

/** Open Stripe's hosted billing portal for the current subscriber. */
export async function openBillingPortal(): Promise<{ url: string }> {
  return apiFetch("/billing/portal", { method: "POST", body: JSON.stringify({}) })
}

export interface AdminPlan extends Omit<PublicPlan, "features" | "purchasable"> {
  id: string
  features: string[] | null
  stripeProductId: string | null
  stripePriceId: string | null
  stripeYearlyPriceId: string | null
  maxDocuments: number | null
  maxAiQuestionsPerMonth: number | null
  maxAlertRules: number | null
  maxWhatsappPerMonth: number | null
  maxUploadMb: number
  allowInstantAlerts: boolean
  isPublic: boolean
}

export async function fetchAdminPlans(): Promise<AdminPlan[]> {
  return apiFetch("/admin/plans")
}

export async function updateAdminPlan(
  tier: PlanTier,
  patch: Partial<AdminPlan>,
): Promise<AdminPlan> {
  return apiFetch(`/admin/plans/${tier}`, { method: "PUT", body: JSON.stringify(patch) })
}

export interface AdminUsageRow {
  id: string
  name: string
  email: string
  role: "user" | "admin"
  status: "active" | "inactive"
  createdAt: string
  tier: PlanTier
  planName: string
  subscriptionStatus: string | null
  grantedByAdmin: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  usage: {
    aiQuestions: number
    documentUploads: number
    whatsappNotifications: number
    documents: number
    alertRules: number
  }
}

export async function fetchAdminUsage(
  limit = 100,
  offset = 0,
): Promise<{ data: AdminUsageRow[]; meta: { total: number; limit: number; offset: number; periodStart: string } }> {
  return apiFetch(`/admin/usage?limit=${limit}&offset=${offset}`)
}

export interface AdminUserUsageDetail extends BillingSummary {
  userId: string
  events: Array<{
    id: string
    metric: string
    quantity: number
    metadata: Record<string, unknown> | null
    createdAt: string
  }>
}

export async function fetchAdminUserUsage(userId: string): Promise<AdminUserUsageDetail> {
  return apiFetch(`/admin/users/${userId}/usage`)
}

export async function grantUserPlan(userId: string, tier: PlanTier, note?: string) {
  return apiFetch(`/admin/users/${userId}/plan`, {
    method: "POST",
    body: JSON.stringify({ tier, note }),
  })
}

export async function revokeUserPlan(userId: string) {
  return apiFetch(`/admin/users/${userId}/plan`, { method: "DELETE" })
}

/** Money formatting shared by the pricing page and billing panel. */
export function formatPlanPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/**
 * In-flight GETs, keyed by path. A browser only opens a handful of connections
 * per host, so a poll timer that fires again before its previous request came
 * back (slow API, backgrounded tab) queues duplicates until nothing else — a
 * chat query, a page load — can get through. Identical GETs therefore share
 * one request instead of stacking.
 */
const inFlightGets = new Map<string, Promise<unknown>>()

/** Authenticated fetch - attaches the bearer token when present. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase()
  // Callers that pass their own signal manage cancellation themselves, so they
  // must not be handed a shared promise someone else can abort.
  if (method !== "GET" || init.signal) return requestJson<T>(path, init)

  const pending = inFlightGets.get(path) as Promise<T> | undefined
  if (pending) return pending

  const request = requestJson<T>(path, init).finally(() => inFlightGets.delete(path))
  inFlightGets.set(path, request)
  return request
}

/**
 * Nest error bodies are JSON ({statusCode, message, error}); surface the
 * message so UI toasts read "Downloaded file is not a PDF …" instead of a
 * dump of the whole envelope. 402 means "your plan doesn't cover this" —
 * throws a typed QuotaError so callers can render a targeted upgrade prompt
 * instead of a generic toast.
 */
async function throwApiError(res: Response): Promise<never> {
  const body = await res.text()
  let message = body
  let parsed: { message?: unknown; error?: unknown; quota?: unknown } | null = null
  try {
    parsed = JSON.parse(body)
    const raw = parsed?.message ?? parsed?.error
    if (raw) message = Array.isArray(raw) ? raw.join(", ") : String(raw)
  } catch {
    // not JSON — use the raw body
  }

  if (res.status === 402 && parsed?.quota) {
    throw new QuotaError(message, parsed.quota as QuotaDenial)
  }

  throw new Error(message || `Request failed: ${res.status}`)
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    // A 401 while we believed we were signed in means the session died
    // (expired token, revoked account, storage wiped mid-session). Clear it
    // and tell AuthProvider so protected pages bounce to /login.
    if (res.status === 401 && token && typeof window !== "undefined") {
      tokenStore.clear()
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
    }
    await throwApiError(res)
  }
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

/**
 * Tell the backend to revoke the session (best-effort — the client clears
 * local state regardless, and the token dies on expiry anyway).
 */
export async function apiLogout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" })
  } catch {
    // network hiccup — the server token is short-lived; nothing to do
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
  if (!res.ok) await throwApiError(res)
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
  pollIntervalSeconds?: number
  sitemapUrl?: string | null
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

/**
 * One-time sitemap detection (robots.txt → /sitemap.xml → best child).
 * Persists the cached sitemap URL on the source; safe to call again.
 */
export async function detectScrapeSitemap(id: string): Promise<ScrapeSource> {
  return apiFetch(`/admin/scraping/sources/${id}/detect-sitemap`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/**
 * Cheap sitemap poll — sitemap URLs not yet known to this source, without
 * triggering a full crawl. Requires a sitemapUrl on the source.
 */
export async function checkScrapeSitemap(id: string): Promise<SitemapCheckResult> {
  return apiFetch(`/admin/scraping/sources/${id}/check`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/** Effective scheduler configuration + last tick. */
export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  return apiFetch("/admin/scraping/scheduler")
}

/** Flip the global auto-scraping switch. Returns the updated scheduler status. */
export async function setAutoScraping(enabled: boolean): Promise<SchedulerStatus> {
  return apiFetch("/admin/scraping/scheduler/auto-scraping", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  })
}

/** Triggers a run of every enabled source that isn't already scraping. */
export async function runAllScrapeSources(): Promise<RunAllResult> {
  return apiFetch("/admin/scraping/sources/run-all", {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/** Admin settings: schema + effective values for the settings UI. */
export async function fetchSettings(): Promise<SettingsView> {
  return apiFetch("/admin/settings")
}

/** Batch-apply settings; returns fresh state + per-key validation errors. */
export async function updateSettings(values: Record<string, string>): Promise<SettingApplyResult> {
  return apiFetch("/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ values }),
  })
}

/** Revert one setting to its schema default. */
export async function resetSetting(key: string): Promise<{ key: string; reset: boolean }> {
  return apiFetch(`/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" })
}

/** Public subset (site.title/description) for the footer. */
export async function fetchPublicSettings(): Promise<PublicSiteSettings> {
  return apiFetch("/public/settings")
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

export interface ReextractResult {
  id: string
  updated: boolean
  chars?: number
  isOcr?: boolean
  method?: string | null
  qualityBefore?: number
  qualityAfter?: number
  reason?: string
}

/** Admin: re-run attachment text extraction for one notice. */
export async function reextractNotice(id: string): Promise<ReextractResult> {
  return apiFetch(`/admin/scraping/items/${id}/reextract`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export interface BulkReextractResult {
  scope: "garbled" | "all"
  scanned: number
  queued: number
  message: string
}

/**
 * Admin: re-extract many notices at once. "garbled" (default) only touches
 * notices whose stored text scores as unreadable.
 */
export async function reextractNotices(
  scope: "garbled" | "all" = "garbled",
  limit = 200,
): Promise<BulkReextractResult> {
  return apiFetch("/admin/scraping/items/reextract", {
    method: "POST",
    body: JSON.stringify({ scope, limit }),
  })
}

export interface ScrapeRunFilters {
  sourceId?: string
  status?: ScrapeRunStatus
  page?: number
  limit?: number
}

export async function fetchScrapeRuns(
  filters: ScrapeRunFilters = {},
): Promise<{ data: ScrapeRun[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const { page = 1, limit = 20, ...rest } = filters
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const [key, value] of Object.entries(rest)) {
    if (value) params.set(key, String(value))
  }
  return apiFetch(`/admin/scraping/runs?${params}`)
}

// ─── Public Notices API (no auth required) ───────────────────────────────────

export interface PublicNoticeFilters {
  category?: ScrapedItemCategory
  sourceId?: string
  search?: string
  tag?: string
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

// ─── Alerts API ───────────────────────────────────────────────────────────
// Server and client share the same AlertRule shape directly — no mapping
// needed (each filter dimension is AND'd; values within one are OR'd).

export type NewAlertRuleInput = Pick<
  AlertRule,
  | "name"
  | "enabled"
  | "priority"
  | "categories"
  | "tags"
  | "keywords"
  | "excludeKeywords"
  | "organizations"
  | "minUrgency"
  | "deadlineWithinDays"
>

export async function fetchAlertRules(): Promise<AlertRule[]> {
  return apiFetch<AlertRule[]>("/alerts")
}

export async function createAlertRule(input: NewAlertRuleInput): Promise<AlertRule> {
  return apiFetch<AlertRule>("/alerts", { method: "POST", body: JSON.stringify(input) })
}

export async function updateAlertRule(id: string, updates: Partial<NewAlertRuleInput>): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/alerts/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
}

export async function deleteAlertRule(id: string): Promise<void> {
  await apiFetch(`/alerts/${id}`, { method: "DELETE" })
}

// ─── WhatsApp notification channel API ───────────────────────────────────

export async function fetchWhatsappStatus(): Promise<WhatsappStatus> {
  return apiFetch("/notifications/whatsapp/status")
}

export async function setWhatsappDigestFrequency(digestFrequency: DigestFrequency): Promise<WhatsappStatus> {
  return apiFetch("/notifications/whatsapp/digest-frequency", {
    method: "PATCH",
    body: JSON.stringify({ digestFrequency }),
  })
}

export async function requestWhatsappOtp(phoneNumber: string): Promise<{ requested: true }> {
  return apiFetch("/notifications/whatsapp/request-otp", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  })
}

export async function verifyWhatsappOtp(code: string): Promise<WhatsappStatus> {
  return apiFetch("/notifications/whatsapp/verify-otp", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

export async function toggleWhatsappAlerts(enabled: boolean): Promise<WhatsappStatus> {
  return apiFetch("/notifications/whatsapp/toggle", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  })
}

export async function disconnectWhatsapp(): Promise<WhatsappStatus> {
  return apiFetch("/notifications/whatsapp", { method: "DELETE" })
}

// ─── Admin: shared WhatsApp sender instance (Evolution API) ─────────────────
// Distinct from the per-user opt-in flow above — this controls the single
// shared sending number itself. Admin-only (JwtAuthGuard + RolesGuard).

export interface AdminWhatsappStatus {
  configured: boolean
  state: string // "open" (connected) | "connecting" | "close" | "unknown"
}

export async function fetchAdminWhatsappStatus(): Promise<AdminWhatsappStatus> {
  return apiFetch("/admin/whatsapp/status")
}

export async function fetchAdminWhatsappQr(): Promise<{ available: boolean; base64: string | null; pairingCode: string | null }> {
  return apiFetch("/admin/whatsapp/qr", { method: "POST" })
}

export async function logoutAdminWhatsapp(): Promise<{ loggedOut: boolean }> {
  return apiFetch("/admin/whatsapp/logout", { method: "POST" })
}

export async function correctScrapedItem(
  id: string,
  body: { category?: string; tags?: string[]; aiCategoryConfidence?: number; reClassify?: boolean }
): Promise<{ reClassified?: boolean; category?: string; tags?: string[]; aiCategoryConfidence?: number }> {
  return apiFetch(`/admin/scraping/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}
