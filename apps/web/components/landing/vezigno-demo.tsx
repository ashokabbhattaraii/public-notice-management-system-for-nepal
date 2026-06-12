"use client"

import React from "react"
import { NoticesDashboardMockup } from "@/components/notices-dashboard-mockup"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"
import { Eyebrow } from "./vezigno-ui"

const steps = [
  { number: "01", label: "Aggregate 50+ portals" },
  { number: "02", label: "OCR + AI summaries" },
  { number: "03", label: "Instant alerts" },
  { number: "04", label: "Plain-language answers" },
]

export function VezignoDemo() {
  return (
    <section id="demo" className="bg-vez-navy">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <Eyebrow dark>The product</Eyebrow>
        </Reveal>
        <AnimatedHeading
          text="One dashboard for every portal."
          className="mt-4 max-w-[18ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-white"
        />

        <Reveal delay={150} className="mt-12 lg:mt-16">
          <div className="overflow-hidden rounded-[24px] bg-white">
            <NoticesDashboardMockup />
          </div>
        </Reveal>

        {/* Step legend */}
        <Reveal delay={250}>
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="border-t border-white/15">
                <div className="vz-sweep group -mx-3 rounded-[14px] px-3 pb-3 pt-5">
                  <p className="text-sm text-vez-sky transition-colors duration-300 group-hover:text-vez-navy">{step.number}</p>
                  <p className="mt-1 text-base text-white/80 transition-colors duration-300 group-hover:text-vez-ink">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
