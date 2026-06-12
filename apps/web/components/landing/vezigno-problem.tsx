"use client"

import React from "react"
import { Reveal } from "./reveal"
import { CountUp } from "./count-up"
import { AnimatedHeading } from "./animated-heading"

const problems = [
  {
    stat: "50+",
    title: "Scattered portals",
    body: "Nepal's notices are spread across independent ministry and commission websites — each with its own format, schedule, and URL. Citizens must visit all of them manually.",
  },
  {
    stat: "~70%",
    title: "Scan-only PDFs",
    body: "Most official gazettes arrive as scanned images. Search engines can't index them. Screen readers can't parse them. Every file must be opened and read by hand.",
  },
  {
    stat: "0",
    title: "Alert systems",
    body: "There is no keyword alert, no category subscription, and no notification in Nepal's public information ecosystem. Repetitive manual checking is the only option.",
  },
  {
    stat: "2×",
    title: "Access burden",
    body: "Urban citizens with broadband check multiple heavy portals easily. Rural citizens bear a disproportionate cost of data and slow load times for the same public information.",
  },
]

export function VezignoProblem() {
  return (
    <section id="problem" className="bg-vez-surface">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <p className="text-base text-vez-mute">The problem</p>
        </Reveal>
        <AnimatedHeading
          text="Public information in Nepal is scattered, scanned, and silent."
          className="mt-4 max-w-[20ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <div className="flex h-full flex-col rounded-[20px] bg-white p-8 transition-transform duration-300 hover:-translate-y-1">
                <p className="text-[clamp(40px,4vw,64px)] font-normal leading-[1.1] tracking-[-0.04em] text-vez-ink">
                  <CountUp value={p.stat} />
                </p>
                <h3 className="mt-5 text-2xl font-normal leading-[30px] text-vez-ink">
                  {p.title}
                </h3>
                <p className="mt-3 text-base leading-6 text-vez-mute">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
