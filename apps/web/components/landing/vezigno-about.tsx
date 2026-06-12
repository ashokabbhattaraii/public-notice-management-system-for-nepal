"use client"

import React from "react"
import { Reveal } from "./reveal"
import { CountUp } from "./count-up"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow } from "./vezigno-ui"

const values = [
  {
    title: "Mission-driven",
    body: "Democratizing access to public information across Nepal through AI-powered technology.",
  },
  {
    title: "Transparency first",
    body: "Building trust through verified sources and open data practices.",
  },
  {
    title: "Citizen-centric",
    body: "Every feature designed with the needs of Nepali citizens at its core.",
  },
  {
    title: "Innovation",
    body: "Leveraging cutting-edge AI to solve real-world governance challenges.",
  },
]

const stats = [
  { value: "2024", label: "Founded" },
  { value: "50+", label: "Gov sources" },
  { value: "10K+", label: "Daily queries" },
  { value: "99.9%", label: "Uptime" },
]

export function VezignoAbout() {
  return (
    <section id="about" className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>About us</Eyebrow>
            </Reveal>
            <AnimatedHeading
              text="Building the future of public information."
              className="mt-4 max-w-[16ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
            />
            <Reveal delay={150}>
            <p className="mt-8 text-base leading-6 text-vez-mute md:text-lg md:leading-7">
              Suchana AI is a mission-driven technology platform addressing Nepal&apos;s
              fragmented public information ecosystem. We aggregate official government
              notices from 50+ portals, process them with AI, and make every document
              instantly searchable in plain language.
            </p>
            <p className="mt-4 text-base leading-6 text-vez-mute md:text-lg md:leading-7">
              From job vacancies and exam schedules to tenders and policy updates — we
              ensure no citizen misses critical information that impacts their life,
              education, or livelihood.
            </p>
            </Reveal>
          </div>

          <div className="flex flex-col justify-end">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 80}>
                <div className="border-t border-vez-line">
                  <div className="vz-sweep group -mx-5 rounded-[16px] px-5 py-6">
                    <div className="flex items-baseline gap-4">
                      <span className="size-2.5 shrink-0 translate-y-[-2px] rounded-full bg-vez-sky transition-colors duration-300 group-hover:bg-vez-navy" />
                      <div>
                        <h3 className="text-2xl font-normal leading-[30px] text-vez-ink">
                          {v.title}
                        </h3>
                        <p className="mt-2 text-base leading-6 text-vez-mute transition-colors duration-300 group-hover:text-vez-ink/70">{v.body}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Stats band */}
        <Reveal className="mt-16 lg:mt-20">
          <div className="grid grid-cols-2 gap-y-10 rounded-[24px] bg-vez-sky p-10 md:p-12 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-[clamp(36px,4vw,64px)] font-normal leading-[1.1] tracking-[-0.04em] text-vez-navy">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-2 text-base text-vez-ink">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
