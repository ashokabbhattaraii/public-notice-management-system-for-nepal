"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Search } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { DemoPlayer } from "./demo/demo-player"
import { Reveal } from "./reveal"

gsap.registerPlugin(ScrollTrigger)

const headlineWords = ["Every", "public", "notice.", "One", "place."]
const quickTags = ["Tenders", "PSC Exams", "Vacancies", "Policy Updates", "Gazette"]

export function VezignoHero() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const sectionRef = useRef<HTMLElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    const ctx = gsap.context(() => {
      // Word-by-word headline rise
      const words = headlineRef.current?.querySelectorAll(".vz-word")
      if (words?.length) {
        gsap.fromTo(
          words,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.9, stagger: 0.09, ease: "power4.out", delay: 0.15 }
        )
      }

      // Gentle parallax: mockup drifts within the clipped preview card
      if (previewRef.current) {
        gsap.fromTo(
          previewRef.current,
          { y: 32, scale: 1.02 },
          {
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: previewRef.current,
              start: "top bottom",
              end: "top 30%",
              scrub: 1,
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(query.trim() ? `/notices?q=${encodeURIComponent(query.trim())}` : "/notices")
  }

  return (
    <section ref={sectionRef} className="bg-vez-sky">
      <div className="mx-auto max-w-[1480px] px-6 pt-[160px] md:px-8 md:pt-[190px] lg:px-12 lg:pt-[220px]">
        {/* Display statement */}
        <h1
          ref={headlineRef}
          className="max-w-[15ch] text-[clamp(44px,7.5vw,96px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        >
          {headlineWords.map((word, i) => (
            <span key={i} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom">
              <span className="vz-word inline-block">{word}&nbsp;</span>
            </span>
          ))}
        </h1>

        <Reveal delay={120}>
          <div className="mt-8 flex flex-col gap-10 lg:mt-12 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-base leading-6 text-vez-ink md:text-lg md:leading-7">
              Suchana AI aggregates government notices from 50+ official portals across
              Nepal — classified, summarized, and made instantly searchable for every citizen.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/notices"
                className="flex items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-all duration-300 hover:-translate-y-0.5 hover:opacity-90"
              >
                Browse notices
                <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href="/rag"
                className="flex items-center gap-1.5 rounded-full bg-white/40 px-6 py-3 text-base text-vez-ink backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/60"
              >
                Explore documents
              </Link>
            </div>
          </div>
        </Reveal>

        {/* Search */}
        <Reveal delay={200}>
          <form onSubmit={handleSearch} className="mt-10 max-w-2xl lg:mt-12">
            <div className="flex items-center gap-2 rounded-full bg-white p-2 transition-transform duration-300 focus-within:scale-[1.01]">
              <Search className="ml-4 size-5 shrink-0 text-vez-mute" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notices, ministries, reference numbers…"
                className="h-11 w-full bg-transparent text-base text-vez-ink outline-none placeholder:text-vez-mute"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/notices?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-white/40 px-4 py-1.5 text-sm text-vez-ink backdrop-blur-[6px] transition-colors hover:bg-white/70"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </form>
        </Reveal>

        {/* Preview card — rounded top corners, emerges below the fold */}
        <Reveal delay={280} className="mt-16 lg:mt-24">
          <div className="overflow-hidden rounded-t-[24px] bg-white">
            {/* Inner wrapper parallaxes within the clipped card */}
            <div ref={previewRef}>
              <DemoPlayer />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
