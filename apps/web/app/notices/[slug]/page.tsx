"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Calendar, Eye, Bell, FileText,
  ExternalLink, Building2, Globe, Share2,
  Bookmark, BookmarkCheck, Loader2, Check,
  Paperclip, FileImage, Download, Sparkles,
  CheckCircle, Tag, MessageSquare, Send, ArrowRight,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { fetchNotice, askNoticeQuestion } from "@/lib/api"
import { categoryLabel } from "@/lib/types"
import type { PublicNoticeDetail } from "@/lib/types"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

function attachmentKind(url: string): "image" | "file" {
  const path = url.toLowerCase().split("?")[0]
  return IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext)) ? "image" : "file"
}

function attachmentLabel(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "attachment")
    return name.length > 40 ? name.slice(0, 37) + "…" : name
  } catch {
    return "Attachment"
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

const SUGGESTED_QUESTIONS = [
  "What is this notice about?",
  "Who does this affect?",
  "Are there any deadlines mentioned?",
  "What should I do next?",
]

export default function NoticeDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  // generateSlug() appends "-" + <uuid>; a UUID is always exactly 36 chars.
  const noticeId = slug.slice(-36)

  const [notice, setNotice] = useState<PublicNoticeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const [question, setQuestion] = useState("")
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([])
  const [answering, setAnswering] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchNotice(noticeId)
      .then((data) => {
        if (!cancelled) setNotice(data)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [noticeId])

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — nothing else to fall back to here.
    }
  }

  async function handleAsk(q?: string) {
    const finalQuestion = (q ?? question).trim()
    if (!finalQuestion || answering || !notice) return
    setAnswering(true)
    setQuestion("")
    try {
      const { answer } = await askNoticeQuestion(notice.id, finalQuestion)
      setQaHistory((prev) => [...prev, { q: finalQuestion, a: answer }])
    } catch {
      setQaHistory((prev) => [
        ...prev,
        { q: finalQuestion, a: "Sorry, I couldn't process that question right now. Please try again." },
      ])
    } finally {
      setAnswering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white font-poppins">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-vez-mute" />
        </div>
      </div>
    )
  }

  if (notFound || !notice) {
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
            <span className="text-vez-ink">{categoryLabel(notice.category)}</span>
          </nav>

          {/* Badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-4 py-1.5 text-sm text-vez-navy">
              {categoryLabel(notice.category)}
            </span>
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
              <Building2 className="size-4" /> {notice.sourceLabel}
            </span>
            {notice.publishedAt && (
              <span className="flex items-center gap-2">
                <Calendar className="size-4" /> {formatDate(notice.publishedAt)}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Eye className="size-4" /> {notice.views.toLocaleString()} views
            </span>
          </div>

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
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-vez-ink border border-vez-line transition-colors hover:bg-vez-surface"
            >
              {copied ? <Check className="size-4 text-vez-navy" /> : <Share2 className="size-4" />}
              {copied ? "Link copied" : "Share"}
            </button>
            <a
              href={notice.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm text-vez-ink border border-vez-line transition-colors hover:bg-vez-surface"
            >
              <ExternalLink className="size-4" /> View original
            </a>
          </div>
        </div>
      </section>

      {/* Main content area - two columns */}
      <div className="mx-auto max-w-[1480px] px-6 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">

          {/* ── Left: Main content ── */}
          <div className="min-w-0 space-y-8">
            {/* AI Summary */}
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

            {/* Attachment */}
            {notice.attachmentUrl && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Paperclip className="size-5 text-vez-navy" />
                  <h2 className="text-lg text-vez-ink">Attachment</h2>
                </div>
                <a
                  href={notice.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-[16px] border border-vez-line bg-white p-5 transition-colors hover:bg-vez-surface"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-vez-sky/30">
                    {attachmentKind(notice.attachmentUrl) === "image" ? (
                      <FileImage className="size-5 text-vez-navy" />
                    ) : (
                      <FileText className="size-5 text-vez-navy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-vez-ink">{attachmentLabel(notice.attachmentUrl)}</p>
                    <p className="text-xs text-vez-mute">Open or download the original file</p>
                  </div>
                  <Download className="size-4 shrink-0 text-vez-mute" />
                </a>
              </section>
            )}

            {/* Full Content */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <FileText className="size-5 text-vez-navy" />
                <h2 className="text-lg text-vez-ink">Full Content</h2>
              </div>
              <div className="rounded-[16px] border border-vez-line bg-white p-6 md:p-8">
                {notice.contentText ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-vez-ink">
                    {notice.contentText}
                  </p>
                ) : notice.attachmentUrl ? (
                  <p className="text-sm text-vez-mute">
                    This notice&apos;s content is provided as an attachment above — see also the original source.
                  </p>
                ) : (
                  <p className="text-sm text-vez-mute">
                    Full content wasn&apos;t captured for this item — view it on the original source.
                  </p>
                )}
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-vez-mute">
                <Calendar className="size-3" /> Last updated: {formatDateShort(notice.updatedAt)}
              </p>
            </section>

            {/* Ask AI section */}
            {notice.contentText && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="size-5 text-vez-navy" />
                  <h2 className="text-lg text-vez-ink">Ask AI about this notice</h2>
                </div>

                <div className="rounded-[16px] border border-vez-line bg-white p-6">
                  {qaHistory.length === 0 && (
                    <div className="mb-4 grid gap-2 sm:grid-cols-2">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleAsk(q)}
                          disabled={answering}
                          className="group flex items-center justify-between rounded-[10px] bg-vez-surface px-4 py-3 text-left text-sm text-vez-ink transition-colors hover:bg-vez-sky/15 disabled:opacity-50"
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
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-vez-ink">{item.a}</p>
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
                      onClick={() => handleAsk()}
                      disabled={!question.trim() || answering}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vez-navy text-white transition-opacity disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ── Right: Sidebar ── */}
          <aside className="space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-[16px] border border-vez-line bg-white p-6">
                <h3 className="mb-4 text-sm font-medium text-vez-ink">Notice Details</h3>
                <dl className="space-y-4">
                  {[
                    { label: "Source", value: notice.sourceLabel, icon: Building2 },
                    ...(notice.publishedAt
                      ? [{ label: "Published", value: formatDate(notice.publishedAt), icon: Calendar }]
                      : []),
                    { label: "Views", value: notice.views.toLocaleString(), icon: Eye },
                    { label: "Indexed", value: formatDateShort(notice.scrapedAt), icon: Globe },
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
                <p className="mb-4 text-xs text-vez-mute">
                  Get instant alerts when new {categoryLabel(notice.category)} notices are published.
                </p>
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
          <a
            href={notice.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-vez-navy transition-colors hover:underline"
          >
            View on {notice.sourceLabel} <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
