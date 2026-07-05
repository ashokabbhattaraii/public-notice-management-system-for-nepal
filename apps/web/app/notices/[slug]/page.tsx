"use client"

import React, { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Calendar, Eye, Clock, Bell, FileText,
  ExternalLink, Sparkles, ScanText, Building2,
  AlertTriangle, CheckCircle, Globe, Tag, Share2,
  Bookmark, BookmarkCheck, MessageSquare, Send, ArrowRight,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { mockNotices } from "@/lib/mock-data"
import { Notice } from "@/lib/types"

function generateSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function deadlineDays(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

export default function NoticeDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [saved, setSaved] = useState(false)
  const [question, setQuestion] = useState("")
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([])
  const [answering, setAnswering] = useState(false)

  const notice = mockNotices.find(
    (n) => generateSlug(n.title, n.id) === slug
  ) as Notice | undefined

  if (!notice) {
    return (
      <div className="flex min-h-screen flex-col bg-white font-poppins">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <FileText className="size-16 text-vez-mute/20" />
          <h1 className="text-2xl text-vez-ink">Notice not found</h1>
          <p className="text-vez-mute">The notice you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/notices" className="mt-4 rounded-full bg-vez-navy px-6 py-3 text-sm text-white transition-opacity hover:opacity-90">
            ← Browse all notices
          </Link>
        </div>
      </div>
    )
  }

  const days = notice.deadline ? deadlineDays(notice.deadline) : null

  const mockAnswer = (q: string): string => {
    const ql = q.toLowerCase()
    if (ql.includes("deadline") || ql.includes("when"))
      return notice.deadline ? `The deadline is **${formatDate(notice.deadline)}** - ${days! > 0 ? `${days} days from now` : "already passed"}.` : "No specific deadline mentioned."
    if (ql.includes("eligib") || ql.includes("requirement"))
      return notice.keyFacts?.find(f => f.toLowerCase().includes("qualif")) ?? `Refer to the full content for eligibility details.`
    return `This notice from ${notice.organization}: ${notice.aiSummary ?? notice.description}`
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
    "What is the deadline?",
    "What are the eligibility requirements?",
    "How do I apply for this?",
    "Who published this notice?",
  ]

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />

      {/* Page hero / title section */}
      <section className="border-b border-vez-line bg-vez-surface/50 pt-20 pb-6 md:pt-22 md:pb-8">
        <div className="mx-auto max-w-[1480px] px-6 md:px-8 lg:px-12">
          {/* Breadcrumb */}
          <nav className="mb-3 flex items-center gap-2 text-sm text-vez-mute">
            <Link href="/notices" className="transition-colors hover:text-vez-navy">Notices</Link>
            <span>/</span>
            <span className="capitalize text-vez-ink">{notice.category}</span>
          </nav>

          {/* Badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-4 py-1.5 text-sm capitalize text-vez-navy">
              {notice.category}
            </span>
            {notice.isOcr && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm text-vez-mute border border-vez-line">
                <ScanText className="size-3.5" /> OCR {notice.ocrConfidence && `· ${notice.ocrConfidence}%`}
              </span>
            )}
            {notice.priority === "high" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-1.5 text-sm text-red-700">
                <AlertTriangle className="size-3.5" /> Urgent
              </span>
            )}
            {notice.aiSummary && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm text-vez-mute border border-vez-line">
                <Sparkles className="size-3.5" /> AI summarized
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="max-w-4xl text-2xl leading-tight text-vez-ink md:text-3xl lg:text-4xl">
            {notice.title}
          </h1>

          {/* Meta */}
          <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-vez-mute">
            <span className="flex items-center gap-2">
              <Building2 className="size-4" /> {notice.organization}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="size-4" /> {formatDate(notice.publishedAt)}
            </span>
            <span className="flex items-center gap-2">
              <Eye className="size-4" /> {notice.views.toLocaleString()} views
            </span>
            {notice.sourcePortal && (
              <span className="flex items-center gap-2">
                <Globe className="size-4" /> {notice.sourcePortal}
              </span>
            )}
          </div>

          {/* Deadline banner */}
          {days !== null && days >= 0 && (
            <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm ${
              days <= 7 ? "bg-red-50 text-red-700 border border-red-100" : "bg-white text-vez-ink border border-vez-line"
            }`}>
              <Clock className="size-4 shrink-0" />
              {days === 0 ? "Deadline is today!" : days === 1 ? "Deadline is tomorrow" : `${days} days remaining`}
              <span className="text-vez-mute">· {formatDateShort(notice.deadline!)}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setSaved(!saved)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all ${
                saved ? "bg-vez-navy text-white" : "bg-white text-vez-ink border border-vez-line hover:bg-vez-surface"
              }`}
            >
              {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              {saved ? "Saved" : "Save notice"}
            </button>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
            >
              <Bell className="size-4" /> Set alert
            </Link>
            <button className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-vez-ink border border-vez-line transition-colors hover:bg-vez-surface">
              <Share2 className="size-4" /> Share
            </button>
            {notice.sourceUrl && (
              <a
                href={notice.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-vez-ink border border-vez-line transition-colors hover:bg-vez-surface"
              >
                <ExternalLink className="size-4" /> View original
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Main content area - two columns */}
      <div className="mx-auto max-w-[1480px] px-6 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">

          {/* ── Left: Main content ── */}
          <div className="min-w-0 space-y-8">
            {/* AI Summary section */}
            {notice.aiSummary && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="size-5 text-vez-navy" />
                  <h2 className="text-lg text-vez-ink">AI Summary</h2>
                </div>
                <div className="rounded-[16px] bg-vez-sky/10 p-6 md:p-8">
                  <p className="text-base leading-relaxed text-vez-ink md:text-lg md:leading-relaxed">
                    {notice.aiSummary}
                  </p>
                </div>
              </section>
            )}

            {/* Key Facts */}
            {notice.keyFacts && notice.keyFacts.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg text-vez-ink">Key Facts</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {notice.keyFacts.map((fact, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-[12px] bg-vez-surface p-4">
                      <CheckCircle className="mt-0.5 size-5 shrink-0 text-vez-navy" />
                      <span className="text-sm leading-relaxed text-vez-ink">{fact}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Full Content */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <FileText className="size-5 text-vez-navy" />
                <h2 className="text-lg text-vez-ink">Full Content</h2>
                {notice.isOcr && (
                  <span className="ml-2 text-xs text-vez-mute">(OCR extracted · {notice.ocrConfidence ?? 90}% confidence)</span>
                )}
              </div>
              <div className="rounded-[16px] border border-vez-line bg-white p-6 md:p-8">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-vez-ink">
                  {notice.content}
                </p>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-vez-mute">
                <Calendar className="size-3" /> Last updated: {formatDateShort(notice.updatedAt)} · Author: {notice.author}
              </p>
            </section>

            {/* Ask AI section */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="size-5 text-vez-navy" />
                <h2 className="text-lg text-vez-ink">Ask AI about this notice</h2>
              </div>

              <div className="rounded-[16px] border border-vez-line bg-white p-6">
                {qaHistory.length === 0 && (
                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuestion(q)}
                        className="group flex items-center justify-between rounded-[10px] bg-vez-surface px-4 py-3 text-left text-sm text-vez-ink transition-colors hover:bg-vez-sky/15"
                      >
                        <span>{q}</span>
                        <ArrowRight className="size-3.5 text-vez-mute opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}

                {qaHistory.length > 0 && (
                  <div className="mb-4 max-h-[400px] space-y-4 overflow-y-auto">
                    {qaHistory.map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="ml-auto max-w-[80%] rounded-[14px] rounded-br-[4px] bg-vez-sky/25 px-4 py-3 text-right text-sm text-vez-ink">
                          {item.q}
                        </div>
                        <div className="mr-auto max-w-[85%] rounded-[14px] rounded-bl-[4px] bg-vez-surface px-4 py-3">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="size-3 text-vez-navy" />
                            <span className="text-xs text-vez-navy">Suchana AI</span>
                          </div>
                          <p className="text-sm leading-relaxed text-vez-ink">{item.a}</p>
                        </div>
                      </div>
                    ))}
                    {answering && (
                      <div className="mr-auto rounded-[14px] bg-vez-surface px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="size-1.5 animate-bounce rounded-full bg-vez-navy" />
                          <span className="size-1.5 animate-bounce rounded-full bg-vez-navy [animation-delay:150ms]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-vez-navy [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 border-t border-vez-line pt-4">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                    placeholder="Ask a question about this notice…"
                    className="h-11 w-full rounded-full border border-vez-line bg-vez-surface px-5 text-sm text-vez-ink outline-none placeholder:text-vez-mute focus:border-vez-sky focus:bg-white"
                    disabled={answering}
                  />
                  <button
                    onClick={handleAsk}
                    disabled={!question.trim() || answering}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vez-navy text-white transition-opacity disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* ── Right: Sidebar ── */}
          <aside className="space-y-6">
            {/* Notice metadata card */}
            <div className="sticky top-24 space-y-6">
              <div className="rounded-[16px] border border-vez-line bg-white p-6">
                <h3 className="mb-4 text-sm font-medium text-vez-ink">Notice Details</h3>
                <dl className="space-y-4">
                  {[
                    { label: "Organization", value: notice.organization, icon: Building2 },
                    { label: "Published", value: formatDate(notice.publishedAt), icon: Calendar },
                    { label: "Author", value: notice.author, icon: FileText },
                    { label: "Views", value: notice.views.toLocaleString(), icon: Eye },
                    ...(notice.deadline ? [{ label: "Deadline", value: formatDate(notice.deadline), icon: Clock }] : []),
                    ...(notice.sourcePortal ? [{ label: "Source", value: notice.sourcePortal, icon: Globe }] : []),
                    ...(notice.scrapedAt ? [{ label: "Indexed", value: formatDateShort(notice.scrapedAt), icon: Calendar }] : []),
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="flex items-start gap-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-vez-mute" />
                        <div>
                          <dt className="text-xs text-vez-mute">{item.label}</dt>
                          <dd className="text-sm text-vez-ink">{item.value}</dd>
                        </div>
                      </div>
                    )
                  })}
                </dl>
              </div>

              {/* Source info */}
              {notice.isOcr && (
                <div className="rounded-[16px] border border-vez-line bg-white p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <ScanText className="size-4 text-vez-navy" />
                    <h3 className="text-sm font-medium text-vez-ink">OCR Processing</h3>
                  </div>
                  <p className="mb-3 text-xs text-vez-mute">
                    Text extracted from scanned PDF via Tesseract OCR engine.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-vez-surface">
                      <div className="h-2 rounded-full bg-vez-navy" style={{ width: `${notice.ocrConfidence ?? 90}%` }} />
                    </div>
                    <span className="text-sm font-medium text-vez-navy">{notice.ocrConfidence ?? 90}%</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {notice.tags && notice.tags.length > 0 && (
                <div className="rounded-[16px] border border-vez-line bg-white p-6">
                  <h3 className="mb-3 text-sm font-medium text-vez-ink">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {notice.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/notices?q=${encodeURIComponent(tag)}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-vez-surface px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-vez-sky/20 hover:text-vez-navy"
                      >
                        <Tag className="size-3" /> {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="rounded-[16px] bg-vez-sky/20 p-6">
                <h3 className="mb-2 text-sm font-medium text-vez-ink">Never miss similar notices</h3>
                <p className="mb-4 text-xs text-vez-mute">Get instant alerts when new {notice.category} notices are published.</p>
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-vez-navy px-5 py-3 text-sm text-white transition-opacity hover:opacity-90"
                >
                  <Bell className="size-4" /> Set up alerts
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Back link footer */}
      <div className="border-t border-vez-line bg-vez-surface/50">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-6 md:px-8 lg:px-12">
          <Link href="/notices" className="flex items-center gap-2 text-sm text-vez-mute transition-colors hover:text-vez-navy">
            <ArrowLeft className="size-4" /> Back to all notices
          </Link>
          {notice.sourceUrl && (
            <a
              href={notice.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-vez-navy transition-colors hover:underline"
            >
              View on {notice.sourcePortal ?? "source"} <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
