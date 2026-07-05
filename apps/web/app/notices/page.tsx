"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, Filter, Calendar, Eye, Clock, Bell, FileText,
  Sparkles, ScanText, ChevronRight, X,
  Bookmark, BookmarkCheck, Building2,
  AlertTriangle, Globe,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/lib/auth-context"
import { mockNotices, categories } from "@/lib/mock-data"
import { Notice, NoticeCategory } from "@/lib/types"
import Link from "next/link"
import gsap from "gsap"

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function deadlineDays(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

// ─── Notice Card ─────────────────────────────────────────────────────────────

function NoticeCard({
  notice,
  saved,
  onToggleSave,
}: {
  notice: Notice
  saved: boolean
  onToggleSave: () => void
}) {
  const days = notice.deadline ? deadlineDays(notice.deadline) : null
  const urgentDeadline = days !== null && days <= 7 && days >= 0

  return (
    <Link
      href={`/notices/${generateSlug(notice.title, notice.id)}`}
      className="vz-sweep group flex cursor-pointer rounded-[20px] bg-white"
    >
      <div className="min-w-0 flex-1 p-5 md:p-6">
        {/* Top row - badges */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-3 py-1 text-xs capitalize text-vez-navy">
            {notice.category}
          </span>
          {notice.isOcr && (
            <span className="inline-flex items-center gap-1 rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-mute">
              <ScanText className="size-3" /> OCR
            </span>
          )}
          {notice.priority === "high" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-vez-navy px-3 py-1 text-xs text-white">
              <AlertTriangle className="size-3" /> Urgent
            </span>
          )}
          {notice.aiSummary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-mute">
              <Sparkles className="size-3" /> AI summary
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-base leading-snug text-vez-ink transition-colors group-hover:text-vez-navy md:text-lg">
          {notice.title}
        </h3>

        {/* AI Summary */}
        {notice.aiSummary && (
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-vez-mute">
            {notice.aiSummary}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-vez-mute">
          <span className="flex items-center gap-1 text-vez-ink/80">
            <Building2 className="size-3" /> {notice.organization}
          </span>
          {notice.sourcePortal && (
            <span className="flex items-center gap-1">
              <Globe className="size-3" /> {notice.sourcePortal}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="size-3" /> {formatDate(notice.publishedAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3" /> {notice.views.toLocaleString()}
          </span>
        </div>

        {/* Deadline */}
        {days !== null && (
          <div className={`mt-3 flex items-center gap-1.5 text-xs ${
            days < 0 ? "text-vez-mute line-through" :
            urgentDeadline ? "text-red-600" : "text-vez-mute"
          }`}>
            <Clock className="size-3" />
            {days < 0 ? `Closed ${formatDate(notice.deadline!)}` :
             days === 0 ? "Closes today" :
             days === 1 ? "Closes tomorrow" :
             `${days} days remaining - ${formatDate(notice.deadline!)}`}
          </div>
        )}
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

export default function NoticesPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory | "all">("all")
  const [selectedPriority, setSelectedPriority] = useState<"all" | "high" | "normal" | "low">("all")
  const [sortBy, setSortBy] = useState<"date" | "views">("date")
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!feedRef.current) return
    const cards = feedRef.current.querySelectorAll("article")
    gsap.fromTo(cards,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power3.out" }
    )
  }, [selectedCategory, selectedPriority, sortBy, searchQuery])

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredNotices = useMemo(() => {
    let r = mockNotices.filter((n) => n.status === "published")
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      r = r.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.aiSummary?.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.organization.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (selectedCategory !== "all") r = r.filter((n) => n.category === selectedCategory)
    if (selectedPriority !== "all") r = r.filter((n) => n.priority === selectedPriority)
    r.sort((a, b) =>
      sortBy === "views" ? b.views - a.views
        : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    return r
  }, [searchQuery, selectedCategory, selectedPriority, sortBy])

  const categoryCounts = useMemo(() => {
    const base = mockNotices.filter((n) => n.status === "published")
    return Object.fromEntries(
      categories.map((c) => [c.id, base.filter((n) => n.category === c.id).length])
    )
  }, [])

  const publishedCount = mockNotices.filter(n => n.status === "published").length

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
                {publishedCount} notices · {new Set(mockNotices.map(n => n.sourcePortal)).size} official portals · OCR + AI summarized
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-md flex-1 md:w-auto">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
            <input
              placeholder="Search title, keyword, organisation, tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-vez-line bg-white pl-11 pr-10 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
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

        {/* Mobile filters */}
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:hidden">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as NoticeCategory | "all")}
            className="h-10 shrink-0 rounded-full border border-vez-line bg-white px-4 text-sm text-vez-ink"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as "all" | "high" | "normal" | "low")}
            className="h-10 shrink-0 rounded-full border border-vez-line bg-white px-4 text-sm text-vez-ink"
          >
            <option value="all">All priority</option>
            <option value="high">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={() => setSortBy(sortBy === "date" ? "views" : "date")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-vez-line bg-white px-4 text-sm text-vez-ink"
          >
            <Filter className="size-3.5" /> {sortBy === "date" ? "Newest" : "Popular"}
          </button>
        </div>

        {/* Panels - fill remaining height, page itself never scrolls */}
        <div className="flex min-h-0 flex-1 gap-4 pb-5">
          {/* ── Filter sidebar (scrolls internally) ── */}
          <aside className="hidden w-64 shrink-0 overflow-y-auto rounded-[20px] bg-vez-surface p-5 lg:block">
            <div>
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm transition-colors ${selectedCategory === "all" ? "bg-vez-navy text-white" : "text-vez-mute hover:bg-white hover:text-vez-navy"}`}
                >
                  <span>All</span>
                  <span className="text-xs">{publishedCount}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as NoticeCategory)}
                    className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm transition-colors ${selectedCategory === cat.id ? "bg-vez-sky/50 text-vez-navy" : "text-vez-mute hover:bg-white hover:text-vez-navy"}`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs">{categoryCounts[cat.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="my-5 h-px bg-vez-line" />

            <div>
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Priority</h3>
              <div className="space-y-1">
                {(["all", "high", "normal", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(p)}
                    className={`w-full rounded-full px-4 py-2 text-left text-sm capitalize transition-colors ${selectedPriority === p ? "bg-vez-sky/50 text-vez-navy" : "text-vez-mute hover:bg-white hover:text-vez-navy"}`}
                  >
                    {p === "all" ? "All priority" : p === "high" ? "Urgent" : p === "normal" ? "Normal" : "Low"}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-5 h-px bg-vez-line" />

            <div>
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Sort by</h3>
              <div className="space-y-1">
                {[{ id: "date", label: "Newest first" }, { id: "views", label: "Most viewed" }].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id as "date" | "views")}
                    className={`w-full rounded-full px-4 py-2 text-left text-sm transition-colors ${sortBy === s.id ? "bg-vez-sky/50 text-vez-navy" : "text-vez-mute hover:bg-white hover:text-vez-navy"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-5 h-px bg-vez-line" />

            <div className="space-y-2.5 px-2">
              <h3 className="text-xs text-vez-mute">Legend</h3>
              {[
                { icon: <Sparkles className="size-3.5 text-vez-navy" />, label: "AI summarized" },
                { icon: <ScanText className="size-3.5 text-vez-mute" />, label: "OCR extracted" },
                { icon: <AlertTriangle className="size-3.5 text-vez-navy" />, label: "Urgent / high priority" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-vez-mute">
                  {item.icon} {item.label}
                </div>
              ))}
            </div>
          </aside>

          {/* ── Notice feed (scrolls internally) ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-vez-surface">
            <div className="flex shrink-0 items-center justify-between border-b border-vez-line px-5 py-3.5">
              <p className="text-sm text-vez-ink">
                {filteredNotices.length} notice{filteredNotices.length !== 1 ? "s" : ""}
                {searchQuery && <span className="text-vez-mute"> matching &ldquo;{searchQuery}&rdquo;</span>}
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-vez-sky/40 px-3 py-1 text-xs text-vez-navy">
                <span className="size-1.5 animate-pulse rounded-full bg-vez-navy" /> Live
              </span>
            </div>

            <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {filteredNotices.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center text-vez-mute">
                  <Filter className="mb-4 size-10 opacity-30" />
                  <h3 className="mb-1 text-base text-vez-ink">No notices found</h3>
                  <p className="mb-5 text-sm">Try adjusting your search or filter criteria</p>
                  <button
                    className="rounded-full border border-vez-line bg-white px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-sky/20"
                    onClick={() => { setSearchQuery(""); setSelectedCategory("all"); setSelectedPriority("all") }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : filteredNotices.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  saved={savedIds.has(notice.id)}
                  onToggleSave={() => toggleSave(notice.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Notice detail - now uses slug-based route /notices/[slug] */}
      </div>
    </div>
  )
}
