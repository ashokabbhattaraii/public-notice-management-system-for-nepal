"use client"

import React from "react"
import Link from "next/link"
import { mockNotices } from "@/lib/mock-data"
import { Reveal } from "./reveal"
import { CountUp } from "./count-up"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow, ArrowCta } from "./vezigno-ui"

const stats = [
  { value: "50+", label: "Government sources" },
  { value: "10K+", label: "Daily queries" },
  { value: "24/7", label: "Automated monitoring" },
  { value: "2", label: "Languages supported" },
]

const categoryLabels: Record<string, string> = {
  exams: "Exams",
  vacancies: "Vacancies",
  tenders: "Tenders",
  policy: "Policy",
  announcements: "Announcements",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function VezignoNotices() {
  const featured = mockNotices
    .filter((n) => n.status === "published")
    .sort((a, b) => (a.priority === "high" ? -1 : 1) - (b.priority === "high" ? -1 : 1))
    .slice(0, 3)

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        {/* Stats strip */}
        <Reveal>
          <div className="grid grid-cols-2 gap-y-10 border-b border-vez-line pb-16 md:pb-20 lg:grid-cols-4">
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
          </div>
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
              <ArrowCta href="/notices">View all notices</ArrowCta>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:mt-12">
            {featured.map((notice, i) => (
              <Reveal key={notice.id} delay={i * 100}>
                <Link
                  href="/notices"
                  className="vz-sweep group flex h-full flex-col rounded-[20px] bg-vez-surface p-8"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white px-4 py-1.5 text-sm text-vez-ink">
                      {categoryLabels[notice.category] ?? notice.category}
                    </span>
                    {notice.priority === "high" && (
                      <span className="rounded-full bg-vez-navy px-4 py-1.5 text-sm text-white">
                        Priority
                      </span>
                    )}
                  </div>

                  <h3 className="mt-6 text-2xl font-normal leading-[30px] text-vez-ink">
                    {notice.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 flex-1 text-base leading-6 text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/70">
                    {notice.aiSummary ?? notice.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-vez-line pt-5 text-sm text-vez-mute transition-colors duration-300 group-hover:border-vez-ink/10 group-hover:text-vez-ink/70">
                    <span className="line-clamp-1">{notice.organization}</span>
                    <span className="shrink-0">{formatDate(notice.publishedAt)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
