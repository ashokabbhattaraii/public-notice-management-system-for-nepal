"use client"

import React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"

export function VezignoCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 pb-16 md:px-8 md:pb-20 lg:px-12 lg:pb-24">
        <Reveal>
          <div className="flex flex-col items-start gap-10 rounded-[24px] bg-vez-sky p-10 md:p-14 lg:flex-row lg:items-end lg:justify-between lg:p-20">
            <AnimatedHeading
              text="Never miss a notice again."
              className="max-w-[14ch] text-[clamp(36px,5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
            />
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
              >
                Get started
                <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href="/notices"
                className="flex items-center gap-1.5 rounded-full bg-white/40 px-6 py-3 text-base text-vez-ink backdrop-blur-[6px] transition-colors hover:bg-white/60"
              >
                Browse notices
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
