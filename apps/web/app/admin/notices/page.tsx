"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { Search, Trash2, ExternalLink, ChevronLeft, ChevronRight, Loader2, X, SlidersHorizontal } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { fetchScrapedItems, deleteScrapedItem, fetchScrapeSources } from "@/lib/api"
import type { ScrapedItem, ScrapedItemCategory, ScrapeSource } from "@/lib/types"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

const fieldClass =
  "w-full rounded-[12px] border border-vez-line bg-white px-4 py-3 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

const PAGE_SIZE = 20

type SortOption = "publishedAt:desc" | "publishedAt:asc" | "scrapedAt:desc" | "title:asc"
type ScrapedItemFiltersSortBy = "publishedAt" | "scrapedAt" | "title"

export default function AdminNoticesPage() {
  const [items, setItems] = useState<ScrapedItem[]>([])
  const [sources, setSources] = useState<ScrapeSource[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [category, setCategory] = useState<ScrapedItemCategory | "">("")
  const [sourceId, setSourceId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState<SortOption>("publishedAt:desc")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchScrapeSources().then(setSources).catch(() => {})
  }, [])

  const [sortBy, sortOrder] = sort.split(":") as [ScrapedItemFiltersSortBy, "asc" | "desc"]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchScrapedItems({
        page,
        limit: PAGE_SIZE,
        category: category || undefined,
        sourceId: sourceId || undefined,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      })
      setItems(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notices")
    } finally {
      setLoading(false)
    }
  }, [page, category, sourceId, debouncedSearch, dateFrom, dateTo, sortBy, sortOrder])

  useEffect(() => {
    load()
  }, [load])

  // Reset to page 1 whenever a filter (other than page itself) changes.
  useEffect(() => {
    setPage(1)
  }, [category, sourceId, debouncedSearch, dateFrom, dateTo, sort])

  function clearFilters() {
    setSearch("")
    setCategory("")
    setSourceId("")
    setDateFrom("")
    setDateTo("")
    setSort("publishedAt:desc")
  }

  const activeFilterCount = [category, sourceId, dateFrom, dateTo, debouncedSearch].filter(Boolean).length

  async function handleDelete(id: string) {
    if (!confirm("Remove this notice from the list?")) return
    try {
      await deleteScrapedItem(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notice")
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const sourceName = useMemo(() => {
    const map = new Map(sources.map((s) => [s.id, s.name]))
    return (item: ScrapedItem) => (item.sourceId && map.get(item.sourceId)) || item.sourceLabel
  }, [sources])

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Notice management.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">{total.toLocaleString()} scraped notices &amp; news</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="rounded-[20px] bg-white p-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
              <input
                placeholder="Search title or content…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-11`}
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors ${
                showFilters ? "bg-vez-navy text-white" : "border border-vez-line text-vez-ink hover:bg-vez-surface"
              }`}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-vez-mute transition-colors hover:text-vez-navy"
              >
                <X className="size-3.5" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mb-6 grid grid-cols-1 gap-4 rounded-[14px] bg-vez-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs text-vez-mute">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ScrapedItemCategory | "")}
                  className={`${fieldClass} h-10 py-0`}
                >
                  <option value="">All categories</option>
                  <option value="NOTICE">Notice</option>
                  <option value="NEWS">News</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-vez-mute">Source</label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className={`${fieldClass} h-10 py-0`}
                >
                  <option value="">All sources</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-vez-mute">Published from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`${fieldClass} h-10 py-0`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vez-mute">Published to</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`${fieldClass} h-10 py-0`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vez-mute">Sort by</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className={`${fieldClass} h-10 py-0`}
                >
                  <option value="publishedAt:desc">Newest published</option>
                  <option value="publishedAt:asc">Oldest published</option>
                  <option value="scrapedAt:desc">Recently scraped</option>
                  <option value="title:asc">Title (A–Z)</option>
                </select>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-vez-mute">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-vez-mute">No notices match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vez-line text-left">
                    <th className="pb-3 font-normal text-vez-mute">Title</th>
                    <th className="pb-3 font-normal text-vez-mute">Category</th>
                    <th className="pb-3 font-normal text-vez-mute">Source</th>
                    <th className="pb-3 font-normal text-vez-mute">Published</th>
                    <th className="pb-3 font-normal text-vez-mute">Scraped</th>
                    <th className="pb-3 font-normal text-vez-mute">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-vez-line/50 transition-colors hover:bg-vez-surface/60">
                      <td className="max-w-[320px] py-3.5 pr-4 text-vez-ink">
                        <span className="line-clamp-2">{item.title}</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="rounded-full bg-vez-sky/30 px-3 py-1 text-xs capitalize text-vez-navy">
                          {item.category.toLowerCase()}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate py-3.5 pr-4 text-vez-mute">{sourceName(item)}</td>
                      <td className="whitespace-nowrap py-3.5 pr-4 text-vez-mute">
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="whitespace-nowrap py-3.5 pr-4 text-vez-mute">
                        {new Date(item.scrapedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1">
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                            aria-label="Open original source"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete notice"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-sm">
              <p className="text-vez-mute">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex size-8 items-center justify-center rounded-full border border-vez-line text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex size-8 items-center justify-center rounded-full border border-vez-line text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </div>
  )
}
