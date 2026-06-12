"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, Filter, Calendar, Eye, Clock, Bell, FileText,
  ExternalLink, Sparkles, ScanText, ChevronRight, X,
  Bookmark, BookmarkCheck, MessageSquare, Send, Building2,
  AlertTriangle, CheckCircle, ArrowRight, Globe, Tag,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { mockNotices, categories } from "@/lib/mock-data"
import { Notice, NoticeCategory } from "@/lib/types"
import Link from "next/link"
import gsap from "gsap"

// ─── helpers ────────────────────────────────────────────────────────────────

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
  onSelect,
  onToggleSave,
}: {
  notice: Notice
  saved: boolean
  onSelect: () => void
  onToggleSave: () => void
}) {
  const days = notice.deadline ? deadlineDays(notice.deadline) : null
  const urgentDeadline = days !== null && days <= 7 && days >= 0

  return (
    <article
      className="group flex cursor-pointer overflow-hidden rounded-[20px] bg-white transition-colors hover:bg-vez-sky/10"
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1 p-5 md:p-6">
        {/* Top row — badges */}
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
             `${days} days remaining — ${formatDate(notice.deadline!)}`}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-l border-vez-line/60 p-4">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave() }}
          className="flex size-9 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
          title={saved ? "Remove bookmark" : "Bookmark"}
        >
          {saved ? <BookmarkCheck className="size-4 text-vez-navy" /> : <Bookmark className="size-4" />}
        </button>
        <ChevronRight className="size-4 text-vez-mute/50 transition-all group-hover:translate-x-0.5 group-hover:text-vez-navy" />
      </div>
    </article>
  )
}

// ─── Notice Detail Panel ──────────────────────────────────────────────────────

function NoticeDetail({
  notice,
  saved,
  onToggleSave,
}: {
  notice: Notice
  saved: boolean
  onToggleSave: () => void
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "content" | "qa" | "source">("summary")
  const [question, setQuestion] = useState("")
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([])
  const [answering, setAnswering] = useState(false)
  const days = notice.deadline ? deadlineDays(notice.deadline) : null

  // Reset tab when notice changes
  useEffect(() => {
    setActiveTab("summary")
    setQaHistory([])
    setQuestion("")
  }, [notice.id])

  const mockAnswer = (q: string): string => {
    const ql = q.toLowerCase()
    if (ql.includes("deadline") || ql.includes("last date") || ql.includes("when")) {
      return notice.deadline
        ? `The deadline for this notice is **${formatDate(notice.deadline)}** — ${days! > 0 ? `${days} days from now` : "already passed"}.`
        : "No specific deadline is mentioned in this notice."
    }
    if (ql.includes("eligib") || ql.includes("qualify") || ql.includes("requirement")) {
      const ef = notice.keyFacts?.find(f => f.toLowerCase().includes("qualif") || f.toLowerCase().includes("eligib"))
      return ef
        ? `Eligibility: ${ef}. For full details, refer to the complete notice content.`
        : `Eligibility criteria are detailed in the full notice from ${notice.organization}. Please review the Full Content tab.`
    }
    if (ql.includes("apply") || ql.includes("how") || ql.includes("process")) {
      return `To apply for this notice from ${notice.organization}, visit the source portal at ${notice.sourcePortal ?? "the official website"}. ${notice.keyFacts?.slice(0, 2).join(" — ") ?? ""}`
    }
    if (ql.includes("contact") || ql.includes("address") || ql.includes("phone")) {
      return `Contact details are available directly at ${notice.sourceUrl ?? notice.sourcePortal ?? "the official portal"}. This notice was scraped from the official government source.`
    }
    const relevantFact = notice.keyFacts?.find(f =>
      f.toLowerCase().split(/\s+/).some(w => ql.includes(w))
    )
    if (relevantFact) return `Based on the notice: ${relevantFact}. You can find the complete details in the Full Content tab.`
    return `This notice from ${notice.organization} covers "${notice.title}". ${notice.aiSummary ?? notice.description} For complete information, visit the source: ${notice.sourcePortal}.`
  }

  const handleAsk = () => {
    if (!question.trim() || answering) return
    setAnswering(true)
    const q = question.trim()
    setQuestion("")
    setTimeout(() => {
      setQaHistory(prev => [...prev, { q, a: mockAnswer(q) }])
      setAnswering(false)
    }, 900)
  }

  const suggestedQuestions = [
    "What is the deadline to apply?",
    "What are the eligibility requirements?",
    "How do I apply for this?",
    "Who published this notice?",
  ]

  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-vez-line p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-3 py-1 text-xs capitalize text-vez-navy">
                {notice.category}
              </span>
              {notice.isOcr && (
                <span className="inline-flex items-center gap-1 rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-mute">
                  <ScanText className="size-3" /> OCR {notice.ocrConfidence && `${notice.ocrConfidence}%`}
                </span>
              )}
              {notice.priority === "high" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-vez-navy px-3 py-1 text-xs text-white">
                  <AlertTriangle className="size-3" /> Urgent
                </span>
              )}
            </div>
            <h2 className="text-base leading-snug text-vez-ink md:text-lg">{notice.title}</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-vez-mute">
              <Building2 className="size-3.5 shrink-0" /> {notice.organization}
            </p>
          </div>
          <button
            onClick={onToggleSave}
            className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-vez-surface"
            title={saved ? "Remove bookmark" : "Bookmark"}
          >
            {saved ? <BookmarkCheck className="size-4 text-vez-navy" /> : <Bookmark className="size-4 text-vez-mute" />}
          </button>
        </div>

        {/* Deadline */}
        {days !== null && days >= 0 && (
          <div className={`mt-4 flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-sm ${
            days <= 7 ? "bg-red-50 text-red-700" : "bg-vez-surface text-vez-mute"
          }`}>
            <Clock className="size-4 shrink-0" />
            Deadline: {formatDate(notice.deadline!)} ({days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days left`})
          </div>
        )}
      </div>

      {/* Tabs — pill style */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-vez-line px-4 py-3">
        {([
          { id: "summary", label: "AI summary", icon: Sparkles },
          { id: "content", label: "Full content", icon: FileText },
          { id: "qa",      label: "Ask AI",       icon: MessageSquare },
          { id: "source",  label: "Source",        icon: Globe },
        ] as const).map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-vez-navy text-white"
                  : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
              }`}
            >
              <Icon className="size-3.5" /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        {/* ── AI Summary ── */}
        {activeTab === "summary" && (
          <div className="space-y-5">
            {notice.aiSummary ? (
              <>
                <div className="rounded-[16px] bg-vez-sky/20 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="size-4 text-vez-navy" />
                    <span className="text-sm text-vez-navy">AI-generated summary</span>
                  </div>
                  <p className="text-sm leading-relaxed text-vez-ink">{notice.aiSummary}</p>
                </div>

                {notice.keyFacts && notice.keyFacts.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm text-vez-mute">Key facts</h4>
                    <ul className="space-y-2.5">
                      {notice.keyFacts.map((fact, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-vez-ink">
                          <CheckCircle className="mt-0.5 size-4 shrink-0 text-vez-navy" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {notice.tags && notice.tags.length > 0 && (
                  <div>
                    <h4 className="mb-2.5 text-sm text-vez-mute">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {notice.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-mute">
                          <Tag className="size-3" /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-10 text-center text-sm text-vez-mute">
                <Sparkles className="mx-auto mb-3 size-8 opacity-30" />
                <p>AI summary not available for this notice.</p>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 border-t border-vez-line pt-4">
              {[
                { label: "Organization", value: notice.organization },
                { label: "Published", value: formatDate(notice.publishedAt) },
                { label: "Views", value: notice.views.toLocaleString() },
                { label: "Author", value: notice.author },
                ...(notice.deadline ? [{ label: "Deadline", value: formatDate(notice.deadline) }] : []),
                ...(notice.scrapedAt ? [{ label: "Scraped at", value: formatDate(notice.scrapedAt) }] : []),
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-vez-mute">{item.label}</p>
                  <p className="mt-0.5 text-sm text-vez-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full Content ── */}
        {activeTab === "content" && (
          <div className="space-y-4">
            <div className="rounded-[16px] bg-vez-surface p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs text-vez-mute">
                <FileText className="size-3" />
                {notice.isOcr ? `Extracted via OCR from scanned PDF (confidence: ${notice.ocrConfidence ?? "—"}%)` : "Scraped directly from HTML source"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-vez-ink">{notice.content}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-vez-mute">
              <Calendar className="size-3" />
              Last updated: {formatDate(notice.updatedAt)} · Author: {notice.author}
            </div>
          </div>
        )}

        {/* ── Ask AI ── */}
        {activeTab === "qa" && (
          <div className="flex h-full flex-col gap-4">
            {qaHistory.length === 0 && (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-sm text-vez-mute">
                  <MessageSquare className="size-3.5" /> Ask anything about this notice
                </p>
                <div className="space-y-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="group flex w-full items-center justify-between rounded-[12px] bg-vez-surface px-4 py-3 text-left text-sm text-vez-ink transition-colors hover:bg-vez-sky/20"
                    >
                      <span>{q}</span>
                      <ArrowRight className="size-3.5 text-vez-mute opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {qaHistory.length > 0 && (
              <div className="flex-1 space-y-4 overflow-y-auto">
                {qaHistory.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="ml-auto max-w-[85%] rounded-[16px] rounded-br-[4px] bg-vez-sky/30 px-4 py-2.5 text-right text-sm text-vez-ink">
                      {item.q}
                    </div>
                    <div className="mr-auto max-w-[90%] rounded-[16px] rounded-bl-[4px] bg-vez-surface px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="size-3 text-vez-navy" />
                        <span className="text-xs text-vez-navy">Suchana AI</span>
                      </div>
                      <p className="text-sm leading-relaxed text-vez-ink">{item.a}</p>
                    </div>
                  </div>
                ))}
                {answering && (
                  <div className="mr-auto max-w-[90%] rounded-[16px] rounded-bl-[4px] bg-vez-surface px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 animate-bounce rounded-full bg-vez-navy [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-vez-navy [animation-delay:150ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-vez-navy [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="mt-auto flex gap-2 border-t border-vez-line pt-4">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="Ask a question about this notice…"
                className="h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
                disabled={answering}
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || answering}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vez-navy text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label="Send question"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Source ── */}
        {activeTab === "source" && (
          <div className="space-y-4">
            <div className="space-y-4 rounded-[16px] bg-vez-surface p-5">
              <div>
                <p className="mb-1 text-xs text-vez-mute">Source portal</p>
                <p className="text-sm text-vez-ink">{notice.sourcePortal ?? "Unknown"}</p>
              </div>
              {notice.sourceUrl && (
                <div>
                  <p className="mb-1 text-xs text-vez-mute">Direct URL</p>
                  <a
                    href={notice.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all text-sm text-vez-navy hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {notice.sourceUrl} <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
              )}
              {notice.scrapedAt && (
                <div>
                  <p className="mb-1 text-xs text-vez-mute">Scraped at</p>
                  <p className="text-sm text-vez-ink">{new Date(notice.scrapedAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* OCR info */}
            {notice.isOcr ? (
              <div className="rounded-[16px] bg-vez-sky/20 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ScanText className="size-4 text-vez-navy" />
                  <span className="text-sm text-vez-navy">OCR processed document</span>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-vez-mute">
                  This notice was originally a scanned PDF. Text was extracted using Tesseract OCR (nep+eng) with
                  {notice.ocrConfidence ? ` ${notice.ocrConfidence}% confidence.` : " high confidence."}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-white">
                    <div
                      className="h-1.5 rounded-full bg-vez-navy"
                      style={{ width: `${notice.ocrConfidence ?? 90}%` }}
                    />
                  </div>
                  <span className="text-xs text-vez-navy">{notice.ocrConfidence ?? 90}%</span>
                </div>
              </div>
            ) : (
              <div className="rounded-[16px] bg-vez-sky/20 p-5">
                <div className="mb-1.5 flex items-center gap-2">
                  <CheckCircle className="size-4 text-vez-navy" />
                  <span className="text-sm text-vez-navy">Scraped directly</span>
                </div>
                <p className="text-sm text-vez-mute">
                  This notice was scraped directly from the HTML source of the official government portal via Scrapy/Selenium. No OCR processing was required.
                </p>
              </div>
            )}

            <div className="text-center">
              {notice.sourceUrl && (
                <a
                  href={notice.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"
                >
                  <ExternalLink className="size-3.5" /> View original notice
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex shrink-0 gap-2.5 border-t border-vez-line p-4">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"
          onClick={onToggleSave}
        >
          {saved ? <><BookmarkCheck className="size-4" /> Saved</> : <><Bookmark className="size-4" /> Save notice</>}
        </button>
        <Link
          href="/login"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
        >
          <Bell className="size-4" /> Set alert
        </Link>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NoticesPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory | "all">("all")
  const [selectedPriority, setSelectedPriority] = useState<"all" | "high" | "normal" | "low">("all")
  const [sortBy, setSortBy] = useState<"date" | "views">("date")
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
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
    <div className="min-h-screen bg-vez-surface font-poppins">
      <Header />

      {/* Page hero */}
      <div className="bg-white">
        <div className="mx-auto max-w-[1480px] px-6 py-12 md:px-8 md:py-16 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-base text-vez-mute">Public notices</p>
              <h1 className="mt-3 max-w-[16ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink">
                Every notice, one feed.
              </h1>
              <p className="mt-4 max-w-[48ch] text-base leading-6 text-vez-mute">
                Scraped, OCR-processed, and AI-summarized from {new Set(mockNotices.map(n => n.sourcePortal)).size} official government portals.
              </p>
            </div>
            <Link
              href={user ? "/dashboard/alerts" : "/login"}
              className="flex items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
            >
              <Bell className="size-4" /> Set up alerts
            </Link>
          </div>

          {/* Search bar */}
          <div className="relative mt-8 max-w-2xl">
            <Search className="absolute left-5 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
            <input
              placeholder="Search by title, keyword, organisation, or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-13 w-full rounded-full border border-vez-line bg-white py-3.5 pl-12 pr-12 text-base text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-vez-mute hover:text-vez-navy"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] px-6 py-10 md:px-8 lg:px-12">
        <div className="flex items-start gap-6">
          {/* ── Left sidebar ── */}
          <aside className="sticky top-24 hidden w-60 shrink-0 flex-col gap-5 lg:flex">
            {/* Categories */}
            <div className="rounded-[20px] bg-white p-4">
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm transition-colors ${selectedCategory === "all" ? "bg-vez-navy text-white" : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"}`}
                >
                  <span>All</span>
                  <span className="text-xs">{publishedCount}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as NoticeCategory)}
                    className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm transition-colors ${selectedCategory === cat.id ? "bg-vez-sky/40 text-vez-navy" : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"}`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs">{categoryCounts[cat.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="rounded-[20px] bg-white p-4">
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Priority</h3>
              <div className="space-y-1">
                {(["all", "high", "normal", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(p)}
                    className={`w-full rounded-full px-4 py-2 text-left text-sm capitalize transition-colors ${selectedPriority === p ? "bg-vez-sky/40 text-vez-navy" : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"}`}
                  >
                    {p === "all" ? "All priority" : p === "high" ? "Urgent" : p === "normal" ? "Normal" : "Low"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="rounded-[20px] bg-white p-4">
              <h3 className="mb-3 px-2 text-xs text-vez-mute">Sort by</h3>
              <div className="space-y-1">
                {[{ id: "date", label: "Newest first" }, { id: "views", label: "Most viewed" }].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id as "date" | "views")}
                    className={`w-full rounded-full px-4 py-2 text-left text-sm transition-colors ${sortBy === s.id ? "bg-vez-sky/40 text-vez-navy" : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2.5 rounded-[20px] bg-white p-5">
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

          {/* ── Main content ── */}
          <div className="min-w-0 flex-1">
            {/* Mobile filters */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
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

            <p className="mb-4 text-sm text-vez-mute">
              {filteredNotices.length} notice{filteredNotices.length !== 1 ? "s" : ""}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>

            {/* Notice feed */}
            <div ref={feedRef} className="space-y-4">
              {filteredNotices.length === 0 ? (
                <div className="rounded-[20px] bg-white py-16 text-center text-vez-mute">
                  <Filter className="mx-auto mb-4 size-10 opacity-30" />
                  <h3 className="mb-1 text-base text-vez-ink">No notices found</h3>
                  <p className="mb-5 text-sm">Try adjusting your search or filter criteria</p>
                  <button
                    className="rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"
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
                  onSelect={() => setSelectedNotice(notice)}
                  onToggleSave={() => toggleSave(notice.id)}
                />
              ))}
            </div>

            {/* Notice detail — modal */}
            <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
              <DialogContent className="w-full max-w-2xl gap-0 overflow-hidden rounded-[24px] border-vez-line p-0">
                {selectedNotice && (
                  <NoticeDetail
                    notice={selectedNotice}
                    saved={savedIds.has(selectedNotice.id)}
                    onToggleSave={() => toggleSave(selectedNotice.id)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
