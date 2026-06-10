"use client"

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  Search, Filter, Calendar, Eye, Clock, Bell, FileText,
  ExternalLink, Sparkles, ScanText, ChevronRight, X,
  Bookmark, BookmarkCheck, MessageSquare, Send, Building2,
  AlertTriangle, CheckCircle, ArrowRight, Globe, Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { mockNotices, categories } from "@/lib/mock-data"
import { Notice, NoticeCategory } from "@/lib/types"
import Link from "next/link"
import gsap from "gsap"

// ─── helpers ────────────────────────────────────────────────────────────────

const categoryMeta: Record<string, { color: string; bg: string; dot: string }> = {
  exams:         { color: "text-blue-600",   bg: "bg-blue-500/10 border-blue-500/20",    dot: "bg-blue-500"   },
  vacancies:     { color: "text-indigo-600", bg: "bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-500" },
  tenders:       { color: "text-red-600",  bg: "bg-red-500/10 border-red-500/20",  dot: "bg-red-500"  },
  policy:        { color: "text-indigo-600", bg: "bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-500" },
  announcements: { color: "text-primary",    bg: "bg-primary/10 border-primary/20",       dot: "bg-primary"    },
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
  onSelect,
  onToggleSave,
}: {
  notice: Notice
  saved: boolean
  onSelect: () => void
  onToggleSave: () => void
}) {
  const meta = categoryMeta[notice.category] ?? categoryMeta.announcements
  const days = notice.deadline ? deadlineDays(notice.deadline) : null
  const urgentDeadline = days !== null && days <= 7 && days >= 0

  return (
    <article
      className="group relative flex gap-0 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${meta.dot} opacity-70`} />

      <div className="flex-1 p-4 md:p-5 min-w-0">
        {/* Top row — badges */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
            <span className={`size-1.5 rounded-full ${meta.dot}`} />
            {notice.category}
          </span>
          {notice.isOcr && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-600">
              <ScanText className="size-2.5" /> OCR
            </span>
          )}
          {notice.priority === "high" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-600">
              <AlertTriangle className="size-2.5" /> Urgent
            </span>
          )}
          {notice.aiSummary && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="size-2.5" /> AI Summary
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm md:text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {notice.title}
        </h3>

        {/* AI Summary */}
        {notice.aiSummary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {notice.aiSummary}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1 font-medium text-foreground/70">
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
          <div className={`mt-2.5 flex items-center gap-1.5 text-[11px] font-medium ${
            days < 0 ? "text-muted-foreground line-through" :
            urgentDeadline ? "text-red-600" : "text-muted-foreground"
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
      <div className="flex flex-col items-center justify-between gap-2 p-3 border-l border-border/40 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave() }}
          className="p-1.5 rounded-lg hover:bg-accent/60 transition-colors text-muted-foreground hover:text-primary"
          title={saved ? "Remove bookmark" : "Bookmark"}
        >
          {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
        </button>
        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </article>
  )
}

// ─── Notice Detail Panel ──────────────────────────────────────────────────────

function NoticeDetail({
  notice,
  saved,
  onClose,
  onToggleSave,
}: {
  notice: Notice
  saved: boolean
  onClose: () => void
  onToggleSave: () => void
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "content" | "qa" | "source">("summary")
  const [question, setQuestion] = useState("")
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([])
  const [answering, setAnswering] = useState(false)
  const meta = categoryMeta[notice.category] ?? categoryMeta.announcements
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
    // Generic contextual answer
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
    <div className="flex flex-col max-h-[85vh] overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-border/60 shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                {notice.category}
              </span>
              {notice.isOcr && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-600">
                  <ScanText className="size-2.5" /> OCR {notice.ocrConfidence && `${notice.ocrConfidence}%`}
                </span>
              )}
              {notice.priority === "high" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-600">
                  <AlertTriangle className="size-2.5" /> Urgent
                </span>
              )}
            </div>
            <h2 className="font-bold text-sm md:text-base leading-snug">{notice.title}</h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Building2 className="size-3 shrink-0" /> {notice.organization}
            </p>
          </div>
          <button
            onClick={onToggleSave}
            className="p-1.5 rounded-lg hover:bg-accent/60 transition-colors shrink-0"
            title={saved ? "Remove bookmark" : "Bookmark"}
          >
            {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Deadline */}
        {days !== null && days >= 0 && (
          <div className={`mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${
            days <= 7 ? "bg-red-500/10 text-red-700 border border-red-500/20"
                      : "bg-muted/60 text-muted-foreground border border-border/40"
          }`}>
            <Clock className="size-3.5 shrink-0" />
            Deadline: {formatDate(notice.deadline!)} ({days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days left`})
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60 shrink-0 overflow-x-auto">
        {([
          { id: "summary", label: "AI Summary", icon: Sparkles },
          { id: "content", label: "Full Content", icon: FileText },
          { id: "qa",      label: "Ask AI",       icon: MessageSquare },
          { id: "source",  label: "Source",        icon: Globe },
        ] as const).map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3" /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {/* ── AI Summary ── */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {notice.aiSummary ? (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI-Generated Summary</span>
                  </div>
                  <p className="text-sm leading-relaxed">{notice.aiSummary}</p>
                </div>

                {notice.keyFacts && notice.keyFacts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Key Facts</h4>
                    <ul className="space-y-2">
                      {notice.keyFacts.map((fact, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle className="size-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {notice.tags && notice.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {notice.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border/60 text-muted-foreground">
                          <Tag className="size-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Sparkles className="size-8 mx-auto mb-3 opacity-30" />
                <p>AI summary not available for this notice.</p>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              {[
                { label: "Organization", value: notice.organization },
                { label: "Published", value: formatDate(notice.publishedAt) },
                { label: "Views", value: notice.views.toLocaleString() },
                { label: "Author", value: notice.author },
                ...(notice.deadline ? [{ label: "Deadline", value: formatDate(notice.deadline) }] : []),
                ...(notice.scrapedAt ? [{ label: "Scraped at", value: formatDate(notice.scrapedAt) }] : []),
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{item.label}</p>
                  <p className="text-sm font-medium mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full Content ── */}
        {activeTab === "content" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <FileText className="size-3" />
                {notice.isOcr ? `Extracted via OCR from scanned PDF (confidence: ${notice.ocrConfidence ?? "—"}%)` : "Scraped directly from HTML source"}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{notice.content}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              Last updated: {formatDate(notice.updatedAt)} · Author: {notice.author}
            </div>
          </div>
        )}

        {/* ── Ask AI ── */}
        {activeTab === "qa" && (
          <div className="flex flex-col gap-4 h-full">
            {qaHistory.length === 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <MessageSquare className="size-3" /> Ask anything about this notice
                </p>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-colors flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {qaHistory.length > 0 && (
              <div className="flex-1 space-y-4 overflow-y-auto">
                {qaHistory.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="ml-auto max-w-[85%] bg-primary/10 border border-primary/20 rounded-xl rounded-br-sm px-3 py-2 text-sm text-right">
                      {item.q}
                    </div>
                    <div className="mr-auto max-w-[90%] bg-muted/60 border border-border/60 rounded-xl rounded-bl-sm px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="size-3 text-primary" />
                        <span className="text-[10px] font-semibold text-primary">Suchana AI</span>
                      </div>
                      <p className="text-xs leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                ))}
                {answering && (
                  <div className="mr-auto max-w-[90%] bg-muted/60 border border-border/60 rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 mt-auto pt-3 border-t border-border/40">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="Ask a question about this notice…"
                className="h-9 text-sm"
                disabled={answering}
              />
              <Button size="sm" className="h-9 px-3 shrink-0" onClick={handleAsk} disabled={!question.trim() || answering}>
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Source ── */}
        {activeTab === "source" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">Source Portal</p>
                <p className="text-sm font-semibold">{notice.sourcePortal ?? "Unknown"}</p>
              </div>
              {notice.sourceUrl && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">Direct URL</p>
                  <a
                    href={notice.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {notice.sourceUrl} <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
              )}
              {notice.scrapedAt && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">Scraped At</p>
                  <p className="text-sm">{new Date(notice.scrapedAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* OCR info */}
            {notice.isOcr ? (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ScanText className="size-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">OCR Processed Document</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  This notice was originally a scanned PDF. Text was extracted using Tesseract OCR (nep+eng) with
                  {notice.ocrConfidence ? ` ${notice.ocrConfidence}% confidence.` : " high confidence."}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/60 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${notice.ocrConfidence ?? 90}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600">{notice.ocrConfidence ?? 90}%</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="size-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Scraped Directly</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This notice was scraped directly from the HTML source of the official government portal via Scrapy/Selenium. No OCR processing was required.
                </p>
              </div>
            )}

            <div className="text-center">
              {notice.sourceUrl && (
                <a href={notice.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="size-3.5" /> View Original Notice
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border/60 flex gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={onToggleSave}
        >
          {saved ? <><BookmarkCheck className="size-3.5" /> Saved</> : <><Bookmark className="size-3.5" /> Save Notice</>}
        </Button>
        <Link href="/login" className="flex-1">
          <Button size="sm" className="w-full gap-1.5 text-xs">
            <Bell className="size-3.5" /> Set Alert
          </Button>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Public Notices</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Scraped, OCR-processed, and AI-summarized from {mockNotices.filter(n => n.status === "published").length > 0 ? `${new Set(mockNotices.map(n => n.sourcePortal)).size} official government portals` : "official government portals"}
              </p>
            </div>
            <Link href={user ? "/dashboard/alerts" : "/login"}>
              <Button size="sm" className="gap-1.5">
                <Bell className="size-3.5" /> Set Up Alerts
              </Button>
            </Link>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, keyword, organisation, or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-5 items-start">
          {/* ── Left sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-4 w-52 shrink-0 sticky top-20">
            {/* Categories */}
            <div className="rounded-xl border border-border/60 bg-card/80 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">Category</h3>
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedCategory === "all" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
                >
                  <span>All</span>
                  <span className="text-[11px]">{mockNotices.filter(n => n.status === "published").length}</span>
                </button>
                {categories.map((cat) => {
                  const m = categoryMeta[cat.id]
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id as NoticeCategory)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${selectedCategory === cat.id ? `${m.bg} ${m.color} font-medium border` : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${m.dot}`} />
                        {cat.label}
                      </span>
                      <span className="text-[11px]">{categoryCounts[cat.id] ?? 0}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="rounded-xl border border-border/60 bg-card/80 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">Priority</h3>
              <div className="space-y-0.5">
                {(["all", "high", "normal", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(p)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors capitalize ${selectedPriority === p ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
                  >
                    {p === "all" ? "All Priority" : p === "high" ? "⚡ Urgent" : p === "normal" ? "● Normal" : "○ Low"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="rounded-xl border border-border/60 bg-card/80 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">Sort By</h3>
              <div className="space-y-0.5">
                {[{ id: "date", label: "Newest First" }, { id: "views", label: "Most Viewed" }].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id as "date" | "views")}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${sortBy === s.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-border/60 bg-card/80 p-3 space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">Legend</h3>
              {[
                { icon: <Sparkles className="size-3 text-primary" />, label: "AI Summarized" },
                { icon: <ScanText className="size-3 text-indigo-600" />, label: "OCR Extracted" },
                { icon: <AlertTriangle className="size-3 text-red-600" />, label: "Urgent / High Priority" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {item.icon} {item.label}
                </div>
              ))}
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as NoticeCategory | "all")}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs shrink-0"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs shrink-0"
              >
                <option value="all">All Priority</option>
                <option value="high">Urgent</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <button
                onClick={() => setSortBy(sortBy === "date" ? "views" : "date")}
                className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs shrink-0 flex items-center gap-1"
              >
                <Filter className="size-3" /> {sortBy === "date" ? "Newest" : "Popular"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {filteredNotices.length} notice{filteredNotices.length !== 1 ? "s" : ""}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>

            {/* Notice feed — always full width */}
            <div ref={feedRef} className="space-y-2.5">
              {filteredNotices.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Filter className="size-10 mx-auto mb-4 opacity-30" />
                  <h3 className="font-semibold mb-1">No notices found</h3>
                  <p className="text-sm mb-4">Try adjusting your search or filter criteria</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); setSelectedPriority("all") }}>
                    Clear Filters
                  </Button>
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
              <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden">
                {selectedNotice && (
                  <NoticeDetail
                    notice={selectedNotice}
                    saved={savedIds.has(selectedNotice.id)}
                    onClose={() => setSelectedNotice(null)}
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
