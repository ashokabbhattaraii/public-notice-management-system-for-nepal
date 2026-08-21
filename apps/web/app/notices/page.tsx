"use client"

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react"
import {
  Search, Filter, Calendar, Eye, Bell, FileText,
  ChevronRight, X, Bookmark, BookmarkCheck, Building2,
  Loader2, Paperclip, Sparkles, RotateCcw, Tag as TagIcon,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/lib/auth-context"
import { fetchNotices, fetchNoticeCategoryCounts, fetchNoticeSources } from "@/lib/api"
import { getStoredJSON, setStoredJSON } from "@/lib/local-store"
import { categoryLabel, CATEGORY_ORDER, CANONICAL_TAGS, normalizeTag } from "@/lib/types"
import type { ScrapedItem, ScrapedItemCategory, PublicNoticeSource } from "@/lib/types"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import gsap from "gsap"

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const PAGE_SIZE = 20

// ─── Notice Card ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  if (!urgency || urgency === "LOW") return null
  const isHigh = urgency === "HIGH"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
      isHigh ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
    }`}>
      {isHigh ? "Urgent" : "Important"}
    </span>
  )
}

function NoticeCard({
  notice,
  saved,
  onToggleSave,
}: {
  notice: ScrapedItem
  saved: boolean
  onToggleSave: () => void
}) {
  return (
    <Link
      href={`/notices/${generateSlug(notice.title, notice.id)}`}
      className="vz-sweep group flex cursor-pointer rounded-[20px] bg-white"
    >
      <div className="min-w-0 flex-1 p-5 md:p-6">
        {/* Top row - badges */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
            {categoryLabel(notice.category)}
          </span>
          <UrgencyBadge urgency={notice.aiUrgency} />
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-base leading-snug text-vez-ink transition-colors group-hover:text-vez-navy md:text-lg">
          {notice.title}
        </h3>

        {/* AI Summary — English & Nepali */}
        {(notice.aiSummary || notice.aiSummaryNe || notice.summary) && (
          <div className="mb-3 space-y-2">
            {notice.aiSummary && (
              <div className="flex items-start gap-2 rounded-[10px] bg-vez-sky/8 px-3 py-2">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-vez-navy/60" />
                <p className="line-clamp-2 text-sm leading-relaxed text-vez-ink/80">
                  {notice.aiSummary}
                </p>
              </div>
            )}
            {notice.aiSummaryNe && (
              <div className="flex items-start gap-2 rounded-[10px] bg-amber-50/60 px-3 py-2">
                <span className="mt-0.5 shrink-0 text-[10px] font-medium text-amber-600">ने</span>
                <p className="line-clamp-2 text-sm leading-relaxed text-vez-ink/80" lang="ne">
                  {notice.aiSummaryNe}
                </p>
              </div>
            )}
            {!notice.aiSummary && !notice.aiSummaryNe && notice.summary && (
              <p className="line-clamp-2 text-sm leading-relaxed text-vez-mute">
                {notice.summary}
              </p>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-vez-mute">
          <span className="flex items-center gap-1 text-vez-ink/80">
            <Building2 className="size-3" /> {notice.sourceLabel}
          </span>
          {notice.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {formatDate(notice.publishedAt)}
            </span>
          )}
          {typeof notice.views === "number" && (
            <span className="flex items-center gap-1">
              <Eye className="size-3" /> {notice.views.toLocaleString()}
            </span>
          )}
          {notice.attachmentUrl && (
            <span className="flex items-center gap-1">
              <Paperclip className="size-3" /> Attachment
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-l border-vez-line/60 p-4">
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleSave() }}
          className="flex size-9 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
          title={saved ? "Remove bookmark" : "Bookmark"}
        >
          {saved ? <BookmarkCheck className="size-4 text-vez-navy" /> : <Bookmark className="size-4" />}
        </button>
        <ChevronRight className="size-4 text-vez-mute/50 transition-all group-hover:translate-x-0.5 group-hover:text-vez-navy" />
      </div>
    </Link>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// URL query param keys — kept short but explicit so a filtered/selected view
// is shareable and survives navigating to a notice and back (browser
// back/forward restores this exact URL, and useSearchParams below re-syncs
// local state to match).
const QP = {
  search: "q",
  category: "category",
  source: "source",
  sort: "sort",
  page: "page",
  tag: "tag",
} as const

// Remembers the last-used filters/search/sort across full navigations and
// reloads (URL params alone only survive browser back/forward — clicking a
// plain nav link to "Notices" starts from a bare URL with no query string).
const PREFS_KEY = "pnm_notices_prefs"

interface NoticesPrefs {
  search: string
  category: ScrapedItemCategory | "all"
  sourceId: string
  sortBy: "publishedAt" | "views"
  tag: string
}

const DEFAULT_PREFS: NoticesPrefs = { search: "", category: "all", sourceId: "", sortBy: "publishedAt", tag: "" }

function NoticesPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didMountSync = useRef(false)

  const storedPrefs = getStoredJSON(PREFS_KEY, DEFAULT_PREFS)

  const [searchInput, setSearchInput] = useState(() => searchParams.get(QP.search) ?? storedPrefs.search)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get(QP.search) ?? storedPrefs.search)
  const [selectedCategory, setSelectedCategory] = useState<ScrapedItemCategory | "all">(
    () => (searchParams.get(QP.category) as ScrapedItemCategory | null) ?? storedPrefs.category,
  )
  const [selectedSourceId, setSelectedSourceId] = useState(
    () => searchParams.get(QP.source) ?? storedPrefs.sourceId,
  )
  const [sortBy, setSortBy] = useState<"publishedAt" | "views">(
    () => (searchParams.get(QP.sort) as "publishedAt" | "views" | null) ?? storedPrefs.sortBy,
  )
  const [page, setPage] = useState(() => Number(searchParams.get(QP.page)) || 1)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState(() => searchParams.get(QP.tag) ?? storedPrefs.tag)
  const feedRef = useRef<HTMLDivElement>(null)

  const [notices, setNotices] = useState<ScrapedItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [sources, setSources] = useState<PublicNoticeSource[]>([])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    // Non-critical sidebar enrichment (category counts, source dropdown) — a
    // failure here shouldn't interrupt browsing with a toast, just leave the
    // filter aids empty and note it for diagnostics.
    fetchNoticeCategoryCounts().then(setCategoryCounts).catch((e) => console.error("category counts:", e))
    fetchNoticeSources().then(setSources).catch((e) => console.error("notice sources:", e))
  }, [])

  // Re-sync local state whenever the URL's query string changes — this is
  // what restores the previously-selected filters when the browser
  // back/forward button returns from a notice detail page. Skipped on the
  // very first run: the lazy useState initializers above already derived
  // the correct mount-time value (URL param, else remembered preference,
  // else default), and blindly applying "missing param -> hardcoded
  // default" here on mount would stomp a preference restored from
  // localStorage before the URL has caught up to it.
  const searchParamsString = searchParams.toString()
  useEffect(() => {
    if (!didMountSync.current) {
      didMountSync.current = true
      return
    }
    setSearchInput(searchParams.get(QP.search) ?? "")
    setSearchQuery(searchParams.get(QP.search) ?? "")
    setSelectedCategory((searchParams.get(QP.category) as ScrapedItemCategory | null) ?? "all")
    setSelectedSourceId(searchParams.get(QP.source) ?? "")
    setSortBy((searchParams.get(QP.sort) as "publishedAt" | "views" | null) ?? "publishedAt")
    setSelectedTag(searchParams.get(QP.tag) ?? "")
    setPage(Number(searchParams.get(QP.page)) || 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString])

  // Remember filters/search/sort (not page) for the next visit, independent
  // of whether the URL still carries them.
  useEffect(() => {
    setStoredJSON(PREFS_KEY, {
      search: searchQuery,
      category: selectedCategory,
      sourceId: selectedSourceId,
      sortBy,
      tag: selectedTag,
    } satisfies NoticesPrefs)
  }, [searchQuery, selectedCategory, selectedSourceId, sortBy, selectedTag])

  // Push the current filter/sort/page state into the URL (no new history
  // entry) so it's shareable and survives a round-trip to a detail page.
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set(QP.search, searchQuery)
    if (selectedCategory !== "all") params.set(QP.category, selectedCategory)
    if (selectedSourceId) params.set(QP.source, selectedSourceId)
    if (sortBy !== "publishedAt") params.set(QP.sort, sortBy)
    if (selectedTag) params.set(QP.tag, selectedTag)
    if (page > 1) params.set(QP.page, String(page))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, selectedSourceId, sortBy, selectedTag, page])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchNotices({
        page,
        limit: PAGE_SIZE,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        sourceId: selectedSourceId || undefined,
        search: searchQuery || undefined,
        tag: selectedTag || undefined,
        sortBy,
        sortOrder: "desc",
      })
      // Defensive: tolerate a malformed/partial response (e.g. a stale API
      // build without the `meta` envelope) instead of throwing on `.total`.
      setNotices(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notices")
    } finally {
      setLoading(false)
    }
  }, [page, selectedCategory, selectedSourceId, searchQuery, selectedTag, sortBy])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!feedRef.current || loading) return
    const cards = feedRef.current.querySelectorAll("a")
    gsap.fromTo(cards,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power3.out" }
    )
  }, [notices, loading])

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectCategory(category: ScrapedItemCategory | "all") {
    setSelectedCategory(category)
    setPage(1)
  }

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId)
    setPage(1)
  }

  function selectSort(sort: "publishedAt" | "views") {
    setSortBy(sort)
    setPage(1)
  }

  function clearFilters() {
    setSearchInput("")
    setSearchQuery("")
    setSelectedCategory("all")
    setSelectedSourceId("")
    setSortBy("publishedAt")
    setSelectedTag("")
    setPage(1)
  }

  const totalCount = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasActiveFilters =
    searchQuery !== "" || selectedCategory !== "all" || selectedSourceId !== "" || selectedTag !== ""

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-poppins">
      <Header />

      {/* Fixed-height workspace - mirrors the Documents page */}
      <div className="mx-auto flex w-full max-w-[1480px] min-h-0 flex-1 flex-col gap-4 px-6 py-5 md:px-8 lg:px-12">

        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-vez-navy">
              <FileText className="size-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg tracking-[-0.02em] text-vez-ink">Public notices</h1>
              <p className="text-xs text-vez-mute">
                {totalCount.toLocaleString()} notices &amp; news · {sources.length} official portals
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-md flex-1 md:w-auto">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
            <input
              placeholder="Search title, keyword, organisation…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-11 w-full rounded-full border border-vez-line bg-white pl-11 pr-10 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vez-mute hover:text-vez-navy"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <Link
            href={user ? "/dashboard/alerts" : "/login"}
            className="flex items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
          >
            <Bell className="size-4" /> Set up alerts
          </Link>
        </div>

        {/* Type chips — the primary filter, visible on all breakpoints.
            "All" + each type with its live count; selected chip fills navy. */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => selectCategory("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
              selectedCategory === "all"
                ? "bg-vez-navy text-white"
                : "border border-vez-line bg-white text-vez-ink hover:border-vez-sky hover:text-vez-navy"
            }`}
          >
            All
            <span className={`text-xs ${selectedCategory === "all" ? "text-white/70" : "text-vez-mute"}`}>
              {totalCount.toLocaleString()}
            </span>
          </button>
          {CATEGORY_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => selectCategory(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
                selectedCategory === id
                  ? "bg-vez-navy text-white"
                  : "border border-vez-line bg-white text-vez-ink hover:border-vez-sky hover:text-vez-navy"
              }`}
            >
              {categoryLabel(id)}
              <span className={`text-xs ${selectedCategory === id ? "text-white/70" : "text-vez-mute"}`}>
                {(categoryCounts[id] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {/* Tag chips — secondary filter for thematic topics. Shows the top
            canonical tags with live counts (derived from current page items),
            plus "All" to clear. */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setSelectedTag("")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
              !selectedTag
                ? "bg-vez-navy text-white"
                : "border border-vez-line bg-white text-vez-ink hover:border-vez-sky hover:text-vez-navy"
            }`}
          >
            All tags
            <TagIcon className="size-3.5" />
          </button>
          {CANONICAL_TAGS.slice(0, 20).map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
                selectedTag === normalizeTag(tag)
                  ? "bg-vez-sky/50 text-vez-navy"
                  : "border border-vez-line bg-white text-vez-ink hover:border-vez-sky hover:text-vez-navy"
              }`}
            >
              <TagIcon className="size-3.5" />
              {tag}
            </button>
          ))}
        </div>

        {/* Refine bar — source + sort dropdowns and clear-all, in a row
            everyone recognizes from news/marketplace sites. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-vez-mute" />
            <select
              value={selectedSourceId}
              onChange={(e) => selectSource(e.target.value)}
              className="h-10 appearance-none rounded-full border border-vez-line bg-white pl-9 pr-8 text-sm text-vez-ink outline-none transition-colors focus:border-vez-sky"
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 rotate-90 text-vez-mute" />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-vez-mute" />
            <select
              value={sortBy}
              onChange={(e) => selectSort(e.target.value as "publishedAt" | "views")}
              className="h-10 appearance-none rounded-full border border-vez-line bg-white pl-9 pr-8 text-sm text-vez-ink outline-none transition-colors focus:border-vez-sky"
              aria-label="Sort notices"
            >
              <option value="publishedAt">Newest first</option>
              <option value="views">Most viewed</option>
            </select>
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 rotate-90 text-vez-mute" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex h-10 items-center gap-1.5 rounded-full border border-vez-line bg-white px-4 text-sm text-vez-mute transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <RotateCcw className="size-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Panels - fill remaining height, page itself never scrolls */}
        <div className="flex min-h-0 flex-1 gap-4 pb-5">
          {/* ── Notice feed (scrolls internally) ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-vez-surface">
            <div className="flex shrink-0 items-center justify-between border-b border-vez-line px-5 py-3.5">
              <p className="text-sm text-vez-ink">
                {total.toLocaleString()} notice{total !== 1 ? "s" : ""}
                {searchQuery && <span className="text-vez-mute"> matching &ldquo;{searchQuery}&rdquo;</span>}
                {selectedCategory !== "all" && (
                  <span className="text-vez-mute"> · {categoryLabel(selectedCategory)}</span>
                )}
                {selectedTag && (
                  <span className="flex items-center gap-1 text-vez-mute">
                    <TagIcon className="size-3" /> {selectedTag}
                  </span>
                )}
                {selectedSourceId && (
                  <span className="text-vez-mute">
                    {" · "}
                    {sources.find((s) => s.id === selectedSourceId)?.name ?? "selected source"}
                  </span>
                )}
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-vez-sky/40 px-3 py-1 text-xs text-vez-navy">
                <span className="size-1.5 animate-pulse rounded-full bg-vez-navy" /> Live
              </span>
            </div>

            {error && (
              <div className="mx-4 mt-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center text-vez-mute">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : notices.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center text-vez-mute">
                  <Filter className="mb-4 size-10 opacity-30" />
                  <h3 className="mb-1 text-base text-vez-ink">No notices found</h3>
                  <p className="mb-5 text-sm">Try adjusting your search or filter criteria</p>
                  <button
                    className="rounded-full border border-vez-line bg-white px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-sky/20"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                notices.map((notice) => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    saved={savedIds.has(notice.id)}
                    onToggleSave={() => toggleSave(notice.id)}
                  />
                ))
              )}
            </div>

            {!loading && totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-between border-t border-vez-line px-5 py-3 text-sm">
                <p className="text-vez-mute">Page {page} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-full border border-vez-line px-4 py-1.5 text-vez-ink transition-colors hover:bg-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-vez-line px-4 py-1.5 text-vez-ink transition-colors hover:bg-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notice detail - now uses slug-based route /notices/[slug] */}
      </div>
    </div>
  )
}

export default function NoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticesPageContent />
    </Suspense>
  )
}
