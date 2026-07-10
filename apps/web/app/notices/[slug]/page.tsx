"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Calendar, Eye, Bell, FileText,
  ExternalLink, Building2, Globe, Share2,
  Bookmark, BookmarkCheck, Loader2, Check,
  Paperclip, FileImage, Download,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { fetchNotice } from "@/lib/api"
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
            <span className="capitalize text-vez-ink">{notice.category.toLowerCase()}</span>
          </nav>

          {/* Badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/30 px-4 py-1.5 text-sm capitalize text-vez-navy">
              {notice.category.toLowerCase()}
            </span>
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

              {/* CTA */}
              <div className="rounded-[16px] bg-vez-sky/20 p-6">
                <h3 className="mb-2 text-sm font-medium text-vez-ink">Never miss similar notices</h3>
                <p className="mb-4 text-xs text-vez-mute">
                  Get instant alerts when new {notice.category.toLowerCase()} notices are published.
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
