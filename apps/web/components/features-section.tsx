"use client"

import React, { useRef, useEffect } from "react"

import { type LucideIcon } from "lucide-react"
import gsap from "gsap"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export function FeaturesSection({ features }: { features: Feature[] }) {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const glowOrbs = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !cardsRef.current) return

    const ctx = gsap.context(() => {
      // Set initial hidden states via GSAP (not inline JSX so content is visible if JS fails)
      if (headingRef.current) {
        gsap.set(headingRef.current.children, { opacity: 0, y: 30, filter: "blur(8px)" })
      }
      gsap.set(cardsRef.current?.querySelectorAll(".feature-card") ?? [], { opacity: 0, y: 60, rotateX: 15, scale: 0.9 })

      // Animate background orbs
      if (glowOrbs.current) {
        const orbs = glowOrbs.current.querySelectorAll(".glow-orb")
        gsap.to(orbs, {
          y: "random(-20, 20)",
          x: "random(-15, 15)",
          duration: "random(3, 5)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: { each: 0.5, from: "random" },
        })
      }

      // Scroll-triggered heading reveal
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Heading animation
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

              // Cards stagger in with 3D rotation
              const cards = cardsRef.current?.querySelectorAll(".feature-card")
              if (cards) {
                gsap.fromTo(
                  cards,
                  {
                    opacity: 0,
                    y: 60,
                    rotateX: 15,
                    scale: 0.9,
                  },
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

                // Animate icon containers
                const icons = cardsRef.current?.querySelectorAll(".feature-icon")
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

                // Animated lines inside cards
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
            }
          })
        },
        { threshold: 0.2 }
      )

      observer.observe(sectionRef.current!)

      // 3D tilt on hover
      const cards = cardsRef.current?.querySelectorAll(".feature-card")
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

          // Move glow inside card
          const glow = el.querySelector(".card-glow") as HTMLElement
          if (glow) {
            gsap.to(glow, {
              x: x - rect.width / 2,
              y: y - rect.height / 2,
              opacity: 1,
              duration: 0.3,
            })
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
          if (glow) {
            gsap.to(glow, { opacity: 0, duration: 0.3 })
          }
        }

        el.addEventListener("mousemove", handleMouseMove)
        el.addEventListener("mouseleave", handleMouseLeave)
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="py-20 px-4 relative overflow-hidden bg-muted/20 border-t border-border/40">
      <div ref={glowOrbs} className="absolute inset-0 pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            Everything in one place
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need for <span className="text-primary">public notices</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A comprehensive platform designed for transparency, efficiency, and accessibility in government communication.
          </p>
        </div>

        {/* Cards grid */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ perspective: "1000px" }}>
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={i}
                className="feature-card relative group rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 flex gap-4 cursor-pointer overflow-hidden"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Hover glow */}
                <div className="card-glow absolute w-40 h-40 rounded-full bg-foreground/5 blur-2xl pointer-events-none opacity-0" />

                {/* Animated border highlight on hover */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, transparent, hsl(var(--muted-foreground) / 0.05), transparent)" }}
                />

                {/* Icon */}
                <div className="feature-icon size-12 rounded-xl bg-primary flex items-center justify-center shrink-0 relative">
                  <Icon className="size-6 text-primary-foreground relative z-10" />
                  <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping opacity-0 group-hover:opacity-100" style={{ animationDuration: "2s" }} />
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  <div className="animated-line h-0.5 mt-3 bg-gradient-to-r from-primary/40 to-transparent origin-left" style={{ transform: "scaleX(0)" }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
