"use client"

import React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"
import { SwapArrow } from "./vezigno-ui"
import { Magnetic, Parallax } from "./motion"

export function VezignoCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 pb-16 md:px-8 md:pb-20 lg:px-12 lg:pb-24">
        <Reveal>
          <div className="group/cta relative overflow-hidden rounded-[24px] bg-vez-sky vz-noise p-10 md:p-14 lg:p-20">
            {/* Oversized arrow accent - parallax drift on scroll, nudges on hover */}
            <Parallax speed={26} className="pointer-events-none absolute -right-8 -top-8">
              <ArrowUpRight
                className="size-48 text-white/25 transition-transform duration-700 ease-out group-hover/cta:translate-x-3 group-hover/cta:-translate-y-3 md:size-64"
                strokeWidth={1}
              />
            </Parallax>

            <div className="relative flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <AnimatedHeading
                  text="Never miss a notice again."
                  className="max-w-[14ch] text-[clamp(36px,5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
                />
                <p className="mt-5 max-w-md text-base leading-6 text-vez-ink/70">
                  Free for every citizen. Set your first alert in under a minute.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Magnetic>
                  <Link
                    href="/login"
                    className="group flex items-center gap-2 rounded-full bg-vez-navy px-7 py-3.5 text-base text-white transition-all duration-300 hover:scale-[1.03]"
                  >
                    Get started
                    <SwapArrow />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    href="/notices"
                    className="group flex items-center gap-2 rounded-full bg-white/30 px-7 py-3.5 text-base text-vez-ink backdrop-blur-md border border-white/50 transition-all duration-300 hover:bg-white/60 hover:shadow-md"
                  >
                    Browse notices
                    <SwapArrow />
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
