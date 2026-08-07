"use client"

import React from "react"
import Link from "next/link"
import { mockNotices } from "@/lib/mock-data"
import type { ScrapedItem } from "@/lib/types"
import { Reveal } from "./reveal"
import { CountUp } from "./count-up"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow, ArrowCta } from "./vezigno-ui"
import { Magnetic, StaggerGrid, TiltCard } from "./motion"

const fallbackStats = [
  { value: "50+", label: "Government sources" },
  { value: "10K+", label: "Daily queries" },
  { value: "24/7", label: "Automated monitoring" },
  { value: "2", label: "Languages supported" },
]

function generateSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id
}

const categoryLabels: Record<string, string> = {
  NOTICE: "Notice",
  NEWS: "News",
  PRESS_RELEASE: "Press Release",
  CIRCULAR: "Circular",
  TENDER: "Tender",
  VACANCY: "Vacancy",
  JOB: "Job",
  INTERNSHIP: "Internship",
  OTHER: "Other",
}

function formatDate(iso: string | null) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function VezignoNotices({
  latest,
  totalNotices,
  sourceCount,
  categoryCounts,
}: {
  latest?: ScrapedItem[]
  totalNotices?: number | null
  sourceCount?: number | null
  categoryCounts?: Record<string, number> | null
}) {
  // Real feed first; static showcase cards as the no-API fallback
  const featured: ScrapedItem[] =
    latest && latest.length > 0 ? latest.slice(0, 3) : (mockNotices.slice(0, 3) as unknown as ScrapedItem[])

  const stats = [
    { value: `${sourceCount ?? 50}+`, label: "Government sources" },
    { value: `${totalNotices ?? "10K+"}`, label: "Notices indexed" },
    { value: "24/7", label: "Automated monitoring" },
    { value: `${categoryCounts ? Object.keys(categoryCounts).length : 2}`, label: "Categories tracked" },
  ]

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        {/* Stats strip */}
        <Reveal>
          <StaggerGrid amount={0.4} className="grid grid-cols-2 gap-y-10 border-b border-vez-line pb-16 md:pb-20 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={i > 0 ? "lg:border-l lg:border-vez-line lg:pl-10" : ""}
              >
                <p className="text-[clamp(36px,4vw,64px)] font-normal leading-[1.1] tracking-[-0.04em] text-vez-ink">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-2 text-base text-vez-mute">{stat.label}</p>
              </div>
            ))}
          </StaggerGrid>
        </Reveal>

        {/* Featured notices */}
        <div className="mt-16 md:mt-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Reveal>
                <Eyebrow>Live feed</Eyebrow>
              </Reveal>
              <AnimatedHeading
                text="Latest from the portals."
                className="mt-4 max-w-[18ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
              />
            </div>
            <Reveal delay={250}>
              <Magnetic>
                <ArrowCta href="/notices">View all notices</ArrowCta>
              </Magnetic>
            </Reveal>
          </div>

          <StaggerGrid className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:mt-12">
            {featured.map((notice) => (
              <TiltCard key={notice.id}>
                <Link
                  href={`/notices/${generateSlug(notice.title, notice.id)}`}
                  className="vz-sweep vz-glass group flex h-full flex-col rounded-[20px] p-8"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/50 px-4 py-1.5 text-sm text-vez-ink backdrop-blur-sm border border-white/50">
                      {categoryLabels[notice.category] ?? notice.category}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-normal leading-[30px] text-vez-ink">
                    {notice.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 flex-1 text-base leading-6 text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/70">
                    {notice.aiSummary ?? notice.summary}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-vez-line pt-5 text-sm text-vez-mute transition-colors duration-300 group-hover:border-vez-ink/10 group-hover:text-vez-ink/70">
                    <span className="line-clamp-1">{notice.sourceLabel}</span>
                    <span className="shrink-0">
                      {formatDate(notice.publishedAt) || formatDate(notice.scrapedAt)}
                    </span>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </StaggerGrid>
        </div>
      </div>
    </section>
  )
}
