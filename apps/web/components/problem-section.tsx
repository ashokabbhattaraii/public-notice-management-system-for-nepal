"use client"

import React, { useRef, useEffect } from "react"
import { Globe, FileX, BellOff, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import gsap from "gsap"

const problems = [
  {
    icon: Globe,
    title: "Scattered Across Dozens of Sites",
    stat: "50+",
    statLabel: "government portals",
    body: "Nepal's notices are spread across independent ministry and commission websites — each with its own format, schedule, and URL. Citizens must visit all of them manually.",
  },
  {
    icon: FileX,
    title: "Documents Machines Can't Read",
    stat: "~70%",
    statLabel: "are image-only PDFs",
    body: "Most official gazettes arrive as scanned images. Search engines can't index them. Screen readers can't parse them. Every file must be opened and read by hand.",
  },
  {
    icon: BellOff,
    title: "No Alerts. No Discovery.",
    stat: "0",
    statLabel: "cross-portal alert systems",
    body: "There is no keyword alert, no category subscription, and no notification in Nepal's public information ecosystem. Repetitive manual checking is the only option.",
  },
  {
    icon: MapPin,
    title: "Information Inequality",
    stat: "2×",
    statLabel: "data burden for rural users",
    body: "Urban citizens with broadband check multiple heavy portals easily. Rural citizens bear a disproportionate cost of data and slow load times for the same public information.",
  },
]

export function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !cardsRef.current) return

    const ctx = gsap.context(() => {
      if (headingRef.current) {
        gsap.set(headingRef.current.children, { opacity: 0, y: 30, filter: "blur(8px)" })
      }
      gsap.set(cardsRef.current?.querySelectorAll(".problem-card") ?? [], {
        opacity: 0,
        y: 60,
        rotateX: 15,
        scale: 0.9,
      })

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return

            if (headingRef.current) {
              gsap.fromTo(
                headingRef.current.children,
                { opacity: 0, y: 30, filter: "blur(8px)" },
                {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  duration: 0.8,
                  stagger: 0.15,
                  ease: "power3.out",
                }
              )
            }

            const cards = cardsRef.current?.querySelectorAll(".problem-card")
            if (cards) {
              gsap.fromTo(
                cards,
                { opacity: 0, y: 60, rotateX: 15, scale: 0.9 },
                {
                  opacity: 1,
                  y: 0,
                  rotateX: 0,
                  scale: 1,
                  duration: 0.9,
                  stagger: 0.12,
                  ease: "back.out(1.2)",
                }
              )

              const icons = cardsRef.current?.querySelectorAll(".problem-icon")
              if (icons) {
                gsap.fromTo(
                  icons,
                  { scale: 0, rotation: -180 },
                  {
                    scale: 1,
                    rotation: 0,
                    duration: 0.7,
                    stagger: 0.12,
                    delay: 0.3,
                    ease: "back.out(2)",
                  }
                )
              }

              const lines = cardsRef.current?.querySelectorAll(".animated-line")
              if (lines) {
                gsap.fromTo(
                  lines,
                  { scaleX: 0 },
                  {
                    scaleX: 1,
                    duration: 0.8,
                    stagger: 0.12,
                    delay: 0.6,
                    ease: "power2.out",
                  }
                )
              }
            }

            observer.disconnect()
          })
        },
        { threshold: 0.2 }
      )

      observer.observe(sectionRef.current!)

      // 3D tilt on hover (matches features section)
      const cards = cardsRef.current?.querySelectorAll(".problem-card")
      cards?.forEach((card) => {
        const el = card as HTMLElement

        const handleMouseMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const centerX = rect.width / 2
          const centerY = rect.height / 2
          const rotateX = ((y - centerY) / centerY) * -8
          const rotateY = ((x - centerX) / centerX) * 8

          gsap.to(el, {
            rotateX,
            rotateY,
            scale: 1.02,
            boxShadow: "0 25px 50px -12px rgba(0, 50, 100, 0.15)",
            duration: 0.3,
            ease: "power2.out",
          })

          const glow = el.querySelector(".card-glow") as HTMLElement
          if (glow) {
            gsap.to(glow, { x: x - rect.width / 2, y: y - rect.height / 2, opacity: 1, duration: 0.3 })
          }
        }

        const handleMouseLeave = () => {
          gsap.to(el, {
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            boxShadow: "0 4px 6px -1px rgba(0, 50, 100, 0.05)",
            duration: 0.5,
            ease: "elastic.out(1, 0.5)",
          })

          const glow = el.querySelector(".card-glow") as HTMLElement
          if (glow) gsap.to(glow, { opacity: 0, duration: 0.3 })
        }

        el.addEventListener("mousemove", handleMouseMove)
        el.addEventListener("mouseleave", handleMouseLeave)
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="py-20 px-4 relative overflow-hidden bg-muted/20 border-t border-border/40">
      {/* Faint grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="prob-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#prob-grid)" />
        </svg>
      </div>

      <div className="max-w-5xl mx-auto relative">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            Why we built this
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Nepal&apos;s public information system{" "}
            <span className="text-primary">is broken.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every day, critical government notices — job vacancies, exam dates, tenders, policy changes — go unseen by the citizens who need them most.
          </p>
        </div>

        {/* Cards grid */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          style={{ perspective: "1000px" }}
        >
          {problems.map((p, i) => {
            const Icon = p.icon
            return (
              <div
                key={i}
                className="problem-card relative group rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 flex gap-4 cursor-default overflow-hidden"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Hover glow */}
                <div className="card-glow absolute w-40 h-40 rounded-full bg-primary/5 blur-2xl pointer-events-none opacity-0" />

                {/* Animated border highlight */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent, hsl(var(--primary) / 0.04), transparent)",
                  }}
                />

                {/* Icon */}
                <div className="problem-icon size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 relative">
                  <Icon className="size-6 text-primary relative z-10" />
                  <div
                    className="absolute inset-0 rounded-xl bg-primary/10 animate-ping opacity-0 group-hover:opacity-100"
                    style={{ animationDuration: "2s" }}
                  />
                </div>

                {/* Content */}
                <div className="relative z-10 flex-1">
                  {/* Stat */}
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-2xl font-black text-foreground tabular-nums leading-none">
                      {p.stat}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{p.statLabel}</span>
                  </div>

                  <h3 className="font-semibold text-base mb-1.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>

                  {/* Animated bottom line */}
                  <div
                    className="animated-line h-0.5 mt-3 bg-gradient-to-r from-primary/40 to-transparent origin-left"
                    style={{ transform: "scaleX(0)" }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
