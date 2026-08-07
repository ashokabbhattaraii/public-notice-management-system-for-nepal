// Server-only loader for the landing page. Fetches the public notice feed,
// category counts and source roster once per request (cached on the edge via
// Next.js fetch revalidation) and flattens them into serializable props for
// the client sections. Returns null on failure so sections can fall back to
// their static defaults instead of breaking the page.
import type { ScrapedItem, PublicNoticeSource } from "./types"

export interface LandingData {
  latest: ScrapedItem[]
  totalNotices: number
  categoryCounts: Record<string, number>
  sources: PublicNoticeSource[]
  sourceCount: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5005"

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function getLandingData(limit = 6): Promise<LandingData | null> {
  try {
    const [noticesRes, countsRes, sourcesRes] = await Promise.all([
      fetch(`${API_URL}/notices?page=1&limit=${limit}&sortBy=publishedAt&sortOrder=desc`, {
        next: { revalidate: 60 },
      }),
      fetch(`${API_URL}/notices/meta/category-counts`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/notices/meta/sources`, { next: { revalidate: 60 } }),
    ])

    const [notices, categoryCounts, sources] = await Promise.all([
      json<{ data: ScrapedItem[]; meta: { total: number } }>(noticesRes),
      json<Record<string, number>>(countsRes),
      json<PublicNoticeSource[]>(sourcesRes),
    ])

    return {
      latest: notices.data,
      totalNotices: notices.meta.total,
      categoryCounts,
      sources,
      sourceCount: sources.length,
    }
  } catch {
    // API unreachable (dev before backend boot, deployment hiccup) - sections
    // keep their static defaults, the landing page still renders.
    return null
  }
}