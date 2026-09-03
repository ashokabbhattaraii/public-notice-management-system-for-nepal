import type { Metadata } from "next"
import { notFound } from "next/navigation"
import NoticeDetailClient from "./notice-detail-client"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://suchanaai.tech"
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5005"

// The route encodes the notice uuid as the last 36 characters of the slug.
const idFromSlug = (slug: string) => slug.slice(-36)

interface NoticeMeta {
  id: string
  title: string
  aiSummary: string | null
  summary: string | null
  category: string
  sourceLabel: string | null
  publishedAt: string | null
  updatedAt: string | null
}

/**
 * Server-side existence check. Returns null for a genuinely missing notice
 * and throws for anything transient, so a brief API blip never gets cached
 * as a 404.
 */
async function loadNotice(id: string): Promise<NoticeMeta | null> {
  const res = await fetch(`${apiUrl}/notices/${id}`, { next: { revalidate: 300 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Notice lookup failed: ${res.status}`)
  return res.json()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  let notice: NoticeMeta | null = null
  try {
    notice = await loadNotice(idFromSlug(slug))
  } catch {
    // Fall through to generic metadata rather than failing the render.
  }
  if (!notice) return { title: "Notice not found", robots: { index: false } }

  const description = (notice.aiSummary ?? notice.summary ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)

  return {
    title: notice.title,
    description: description || undefined,
    alternates: { canonical: `${siteUrl}/notices/${slug}` },
    openGraph: {
      type: "article",
      title: notice.title,
      description: description || undefined,
      url: `${siteUrl}/notices/${slug}`,
      publishedTime: notice.publishedAt ?? undefined,
      modifiedTime: notice.updatedAt ?? undefined,
    },
  }
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // A deleted notice must answer 404, not a 200 page that says "not found" —
  // the client component alone renders after hydration, so crawlers saw a
  // soft 404 and kept the dead URL indexed.
  let notice: NoticeMeta | null = null
  try {
    notice = await loadNotice(idFromSlug(slug))
  } catch {
    // Transient failure: let the client component load and offer a retry.
    return <NoticeDetailClient />
  }
  if (!notice) notFound()

  return <NoticeDetailClient />
}
