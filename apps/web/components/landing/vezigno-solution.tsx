"use client"

import React from "react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"

const solutions = [
  {
    number: "01",
    tag: "Centralized aggregation",
    solves: "Scattered portals",
    title: "One feed. Every source.",
    body: "Suchana AI automatically aggregates notices from all major government portals — Public Service Commission, Ministry of Finance, Judicial Service Commission, and more — into a single, unified, always-updated feed.",
  },
  {
    number: "02",
    tag: "OCR + NLP processing",
    solves: "Unreadable documents",
    title: "AI makes every document searchable.",
    body: "OCR pipelines extract text from scanned PDFs and image-embedded notices. NLP models classify and summarize content automatically, so you can search the full text of any official notice in plain language.",
  },
  {
    number: "03",
    tag: "Smart subscriptions",
    solves: "No alert system",
    title: "Get notified before others.",
    body: "Set keyword, category, or organization alerts. The moment a relevant notice is published — a new exam date, a tender, a job vacancy — you receive an instant notification. No more manual checking.",
  },
  {
    number: "04",
    tag: "Accessible by design",
    solves: "Geographic inequality",
    title: "Built for every bandwidth.",
    body: "A lightweight, fast web application designed for low-bandwidth environments. AI summaries let users understand a notice without opening a heavy PDF, reducing data burden for citizens in rural Nepal.",
  },
]

export function VezignoSolution() {
  return (
    <section id="solution" className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <p className="text-base text-vez-mute">The solution</p>
        </Reveal>
        <AnimatedHeading
          text="One platform that answers all four problems."
          className="mt-4 max-w-[20ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        />

        <div className="mt-12 lg:mt-16">
          {solutions.map((s, i) => (
            <Reveal key={s.number} delay={i * 80}>
              <div className="grid gap-6 border-t border-vez-line py-10 md:py-12 lg:grid-cols-[80px_1fr_1.2fr] lg:gap-12">
                <p className="text-2xl font-normal leading-[30px] text-vez-mute">{s.number}</p>

                <div>
                  <h3 className="text-[clamp(28px,2.8vw,36px)] font-normal leading-[1.33] text-vez-ink">
                    {s.title}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-vez-sky/40 px-4 py-1.5 text-sm text-vez-ink">
                      {s.tag}
                    </span>
                    <span className="rounded-full bg-vez-surface px-4 py-1.5 text-sm text-vez-mute">
                      Solves: {s.solves}
                    </span>
                  </div>
                </div>

                <p className="text-base leading-6 text-vez-mute md:text-lg md:leading-7">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
