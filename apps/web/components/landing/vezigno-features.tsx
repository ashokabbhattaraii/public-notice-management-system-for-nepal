"use client"

import React from "react"
import { Search, Shield, Zap, BookOpen } from "lucide-react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"

const features = [
  {
    icon: Search,
    title: "Unified search",
    body: "Query every government notice — vacancies, tenders, exam dates, policy updates — from a single interface with natural language support.",
  },
  {
    icon: Shield,
    title: "Verified sources only",
    body: "All notices are sourced directly from official government portals via Scrapy and Selenium pipelines. No third-party aggregators.",
  },
  {
    icon: Zap,
    title: "Instant smart alerts",
    body: "Subscribe to keywords, categories, or specific ministries. Receive notifications the moment a matching notice is published.",
  },
  {
    icon: BookOpen,
    title: "RAG document intelligence",
    body: "Ask questions in plain language against indexed government documents. Powered by LangChain, ChromaDB, and HuggingFace NLP models.",
  },
]

export function VezignoFeatures() {
  return (
    <section id="features" className="bg-vez-surface">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <p className="text-base text-vez-mute">Features</p>
        </Reveal>
        <AnimatedHeading
          text="Everything a citizen needs, in one calm interface."
          className="mt-4 max-w-[20ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <Reveal key={f.title} delay={i * 100}>
                <div className="group flex h-full flex-col rounded-[20px] bg-white p-8 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex size-12 items-center justify-center rounded-full bg-vez-sky/40 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-5 text-vez-navy" />
                  </div>
                  <h3 className="mt-6 text-2xl font-normal leading-[30px] text-vez-ink">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-base leading-6 text-vez-mute">{f.body}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
