"use client"

import React from "react"
import { Reveal } from "./reveal"
import { CountUp } from "./count-up"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow } from "./vezigno-ui"

const problems = [
  {
    stat: "50+",
    title: "Scattered portals",
    body: "Nepal's notices are spread across independent ministry and commission websites — each with its own format, schedule, and URL. Citizens must visit all of them manually.",
    wide: true,
  },
  {
    stat: "~70%",
    title: "Scan-only PDFs",
    body: "Most official gazettes arrive as scanned images. Search engines can't index them. Screen readers can't parse them.",
    wide: false,
  },
  {
    stat: "0",
    title: "Alert systems",
    body: "No keyword alerts, no category subscriptions, no notifications anywhere in Nepal's public information ecosystem.",
    wide: false,
  },
  {
    stat: "2×",
    title: "Access burden",
    body: "Urban citizens with broadband check multiple heavy portals easily. Rural citizens bear a disproportionate cost of data and slow load times for the same public information.",
    wide: true,
  },
]

export function VezignoProblem() {
  return (
    <section id="problem" className="bg-vez-surface">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
        </Reveal>
        <AnimatedHeading
          text="Public information in Nepal is scattered, scanned, and silent."
          className="mt-4 max-w-[20ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        />

        {/* Asymmetric bento — wide/narrow alternating */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {problems.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 100}
              className={p.wide ? "lg:col-span-2" : ""}
            >
              <div className="vz-sweep group flex h-full flex-col justify-between rounded-[20px] bg-white p-8 md:p-10">
                <div className="flex items-start justify-between gap-6">
                  <p className="text-[clamp(48px,5vw,80px)] font-normal leading-[1.05] tracking-[-0.04em] text-vez-ink">
                    <CountUp value={p.stat} />
                  </p>
                  <span className="mt-2 text-sm text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/60">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-10">
                  <h3 className="text-2xl font-normal leading-[30px] text-vez-ink">
                    {p.title}
                  </h3>
                  <p className="mt-3 max-w-[52ch] text-base leading-6 text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/70">
                    {p.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
