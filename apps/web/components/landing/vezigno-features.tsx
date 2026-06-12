"use client"

import React from "react"
import { Search, Shield, Zap, BookOpen } from "lucide-react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow, SwapArrow } from "./vezigno-ui"

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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Reveal>
              <Eyebrow>Features</Eyebrow>
            </Reveal>
            <AnimatedHeading
              text="Everything a citizen needs, in one calm interface."
              className="mt-4 max-w-[20ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
            />
          </div>
          <Reveal delay={200}>
            <p className="max-w-sm text-base leading-6 text-vez-mute">
              Four capabilities, one pipeline — from scraping the source portal to
              answering your question in plain language.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <Reveal key={f.title} delay={i * 100}>
                <div className="vz-sweep group flex h-full flex-col rounded-[20px] bg-white p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-full bg-vez-sky/40 transition-colors duration-300 group-hover:bg-white">
                      <Icon className="size-5 text-vez-navy" />
                    </div>
                    <span className="text-sm text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/60">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-normal leading-[30px] text-vez-ink">
                    {f.title}
                  </h3>
                  <p className="mt-3 flex-1 text-base leading-6 text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/70">
                    {f.body}
                  </p>
                  <div className="mt-8 flex items-center justify-between border-t border-vez-line pt-5 transition-colors duration-300 group-hover:border-vez-ink/10">
                    <span className="text-sm text-vez-mute transition-colors duration-300 group-hover:text-vez-ink">
                      Learn more
                    </span>
                    <SwapArrow className="text-vez-mute transition-colors duration-300 group-hover:text-vez-navy" />
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
