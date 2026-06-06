"use client"

import React, { useRef, useEffect } from "react"
import { Layers, ScanText, Bell, Wifi } from "lucide-react"


import gsap from "gsap"

const solutions = [
  {
    number: "01",
    icon: Layers,
    problem: "Scattered portals",
    title: "One Feed. Every Source.",
    body: "Suchana AI automatically aggregates notices from all major government portals — Public Service Commission, Ministry of Finance, Judicial Service Commission, and more — into a single, unified, always-updated feed.",
    tag: "Centralized Aggregation",
  },
  {
    number: "02",
    icon: ScanText,
    problem: "Unreadable documents",
    title: "AI Makes Every Document Searchable.",
    body: "OCR pipelines extract text from scanned PDFs and image-embedded notices. NLP models classify and summarize content automatically, so you can search the full text of any official notice in plain language.",
    tag: "OCR + NLP Processing",
  },
  {
    number: "03",
    icon: Bell,
    problem: "No alert system",
    title: "Get Notified Before Others.",
    body: "Set keyword, category, or organization alerts. The moment a relevant notice is published — a new exam date, a tender, a job vacancy — you receive an instant notification. No more manual checking.",
    tag: "Smart Subscriptions",
  },
  {
    number: "04",
    icon: Wifi,
    problem: "Geographic inequality",
    title: "Built for Every Bandwidth.",
    body: "A lightweight, fast web application designed for low-bandwidth environments. AI summaries let users understand a notice without opening a heavy PDF, reducing data burden for citizens in rural Nepal.",
    tag: "Accessible by Design",
  },
]

export function SolutionSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])
  const linesRef = useRef<(HTMLDivElement | null)[]>([])
  const nodesRef = useRef<(HTMLDivElement | null)[]>([])
  const ringsRef = useRef<(HTMLDivElement | null)[]>([])
  const dotsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!sectionRef.current) return

    const heading = headingRef.current
    const steps = stepsRef.current.filter(Boolean) as HTMLDivElement[]
    const lines = linesRef.current.filter(Boolean) as HTMLDivElement[]
    const nodes = nodesRef.current.filter(Boolean) as HTMLDivElement[]
    const rings = ringsRef.current.filter(Boolean) as HTMLDivElement[]
    const dots = dotsRef.current.filter(Boolean) as HTMLDivElement[]

    const reset = () => {
      gsap.killTweensOf([heading, ...steps, ...nodes, ...lines, ...rings, ...dots])
      gsap.set(heading, { opacity: 0, y: 20 })
      gsap.set(steps, { opacity: 0, x: 20, filter: "blur(6px)" })
      gsap.set(nodes, { scale: 0, opacity: 0 })
      gsap.set(lines, { scaleY: 0, transformOrigin: "top center" })
      gsap.set(rings, { scale: 1, opacity: 0 })
      gsap.set(dots, { opacity: 0, y: 0 })
    }

    const play = () => {
      // Heading snaps in fast
      gsap.to(heading, { opacity: 1, y: 0, duration: 0.4, ease: "power4.out" })

      const tl = gsap.timeline({ delay: 0.1 })

      nodes.forEach((node, i) => {
        const step = steps[i]
        const line = lines[i]
        const ring = rings[i]
        const dot = dots[i]

        // Node pops in with spring
        tl.to(node, { scale: 1, opacity: 1, duration: 0.16, ease: "back.out(4)" })

        // Ripple ring expands outward from node
        if (ring) {
          tl.fromTo(
            ring,
            { scale: 1, opacity: 0.6 },
            { scale: 2.8, opacity: 0, duration: 0.5, ease: "power2.out" },
            "<"
          )
        }

        // Card snaps in from right with blur clear
        tl.to(
          step,
          { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.22, ease: "power4.out" },
          "<0.04"
        )

        // Line fires down + dot races along it
        if (line) {
          tl.to(line, { scaleY: 1, duration: 0.16, ease: "power4.in" }, "+=0.04")
          if (dot) {
            const lineH = line.parentElement?.offsetHeight ?? 80
            tl.fromTo(
              dot,
              { opacity: 1, y: 0 },
              { opacity: 0, y: lineH, duration: 0.16, ease: "power4.in" },
              "<"
            )
          }
        }
      })
    }

    reset()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            play()
          } else {
            reset()
          }
        })
      },
      { threshold: 0.08 }
    )

    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="relative py-14 md:py-20 px-4 md:px-8 bg-background border-t border-border/40 overflow-hidden">
      {/* Faint grid lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="sol-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sol-grid)" />
        </svg>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            What we did about it
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            One platform that fixes{" "}
            <span className="text-primary">all four problems.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Suchana AI addresses each failure in Nepal&apos;s public information system with a targeted, AI-powered layer.
          </p>
        </div>

        {/* Progress stepper */}
        <div className="relative">
          {solutions.map((s, i) => {
            const Icon = s.icon
            const isLast = i === solutions.length - 1

            return (
              <div key={s.number} className="flex gap-5 md:gap-8">
                {/* Timeline column */}
                <div className="flex flex-col items-center shrink-0">
                  {/* Node */}
                  <div
                    ref={(el) => { nodesRef.current[i] = el }}
                    className="relative z-10 size-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30"
                  >
                    <Icon className="size-4 text-primary-foreground" />
                    {/* Ripple ring */}
                    <div
                      ref={(el) => { ringsRef.current[i] = el }}
                      className="absolute inset-0 rounded-full border-2 border-primary pointer-events-none"
                    />
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className="relative w-px flex-1 mt-1 mb-1 overflow-hidden"
                      style={{ minHeight: "56px" }}
                    >
                      {/* Base track */}
                      <div className="absolute inset-0 bg-border" />
                      {/* Animated fill */}
                      <div
                        ref={(el) => { linesRef.current[i] = el }}
                        className="absolute inset-0 bg-gradient-to-b from-primary to-primary/50"
                      />
                      {/* Traveling dot */}
                      <div
                        ref={(el) => { dotsRef.current[i] = el }}
                        className="absolute left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-primary top-0 opacity-0"
                      />
                    </div>
                  )}
                </div>

                {/* Card */}
                <div
                  ref={(el) => { stepsRef.current[i] = el }}
                  className={`flex-1 group rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 md:p-7 hover:border-primary/30 hover:shadow-md transition-all duration-300 ${!isLast ? "mb-5 md:mb-6" : ""}`}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground border border-border rounded-full px-2.5 py-1">
                        {s.tag}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Solves:</span>
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {s.problem}
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-foreground/10 leading-none select-none tabular-nums">
                      {s.number}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold mb-2 leading-snug">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>

                  {/* Bottom accent line */}
                  <div className="h-0.5 mt-4 rounded-full bg-gradient-to-r from-primary/40 to-transparent scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
