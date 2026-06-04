"use client"

import React, { useEffect, useRef } from "react"
import { Bell, CheckCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin)

export function AlertCTASection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current || !svgRef.current) return

    const ctx = gsap.context(() => {
      // Draw SVG paths on scroll
      const paths = svgRef.current!.querySelectorAll(".draw")
      gsap.set(paths, { drawSVG: "0%" })

      gsap.to(paths, {
        drawSVG: "100%",
        ease: "none",
        stagger: 0.1,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          end: "center center",
          scrub: 1,
        },
      })

      // Set initial state via GSAP
      gsap.set(contentRef.current, { opacity: 0, y: 60 })

      // Content reveal on scroll
      gsap.to(contentRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: contentRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      })

      // Bell entrance with ScrollTrigger
      if (bellRef.current) {
        gsap.fromTo(
          bellRef.current,
          { scale: 0, rotation: -15 },
          {
            scale: 1,
            rotation: 0,
            duration: 0.8,
            ease: "back.out(2)",
            scrollTrigger: {
              trigger: bellRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        )

        // Continuous bell swing after reveal
        gsap.to(bellRef.current, {
          rotation: 8,
          yoyo: true,
          repeat: -1,
          duration: 1.2,
          ease: "sine.inOut",
          delay: 1.5,
        })
      }

      // Pills stagger on scroll
      const pills = contentRef.current!.querySelectorAll(".alert-pill")
      gsap.fromTo(
        Array.from(pills),
        { opacity: 0, y: 25, scale: 0.85 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "back.out(1.5)",
          scrollTrigger: {
            trigger: pills[0],
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      )

      // Buttons entrance
      const buttons = contentRef.current!.querySelectorAll(".cta-btn")
      gsap.fromTo(
        Array.from(buttons),
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: buttons[0],
            start: "top 90%",
            toggleActions: "play none none none",
          },
        }
      )

      // Animated glow pulse on the SVG decorative circles
      const glowCircles = svgRef.current!.querySelectorAll(".glow-dot")
      gsap.fromTo(
        Array.from(glowCircles),
        { opacity: 0, scale: 0 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          stagger: 0.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            toggleActions: "play none none none",
          },
        }
      )

      // Pulsing glow on dots
      gsap.to(Array.from(glowCircles), {
        opacity: 0.4,
        scale: 1.3,
        yoyo: true,
        repeat: -1,
        duration: 2,
        stagger: 0.4,
        ease: "sine.inOut",
        delay: 1.5,
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative py-24 px-4 overflow-hidden bg-muted/20">

      {/* SVG decorative circuit lines — drawn on scroll, full-width */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1400 500"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="draw"
          d="M 0 80 h 400 q 10 0 10 10 v 60 q 0 10 10 10 h 280"
          stroke="url(#cta-line-grad-1)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          className="draw"
          d="M 1400 120 h -380 q -10 0 -10 10 v 40 q 0 10 -10 10 h -200"
          stroke="url(#cta-line-grad-2)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          className="draw"
          d="M 0 400 h 250 q 10 0 10 -10 v -50 q 0 -10 10 -10 h 160"
          stroke="url(#cta-line-grad-3)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <path
          className="draw"
          d="M 1400 380 h -300 q -10 0 -10 -10 v -30 q 0 -10 -10 -10 h -200"
          stroke="url(#cta-line-grad-4)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Endpoint dots */}
        <circle className="glow-dot" cx="700" cy="160" r="3" fill="hsl(var(--muted-foreground))" opacity="0" />
        <circle className="glow-dot" cx="690" cy="180" r="3" fill="hsl(var(--muted-foreground))" opacity="0" />
        <circle className="glow-dot" cx="430" cy="330" r="2.5" fill="hsl(var(--muted-foreground))" opacity="0" />
        <circle className="glow-dot" cx="680" cy="330" r="2.5" fill="hsl(var(--muted-foreground))" opacity="0" />
        <circle className="glow-dot" cx="260" cy="80" r="2" fill="hsl(var(--muted-foreground))" opacity="0" />
        <circle className="glow-dot" cx="1140" cy="420" r="2" fill="hsl(var(--muted-foreground))" opacity="0" />

        <defs>
          <linearGradient id="cta-line-grad-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="hsl(var(--border))" stopOpacity="0.6" />
            <stop offset="70%" stopColor="hsl(var(--border))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="cta-line-grad-2" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="hsl(var(--border))" stopOpacity="0.5" />
            <stop offset="70%" stopColor="hsl(var(--border))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="cta-line-grad-3" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="hsl(var(--border))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="cta-line-grad-4" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="hsl(var(--border))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>


      {/* Content */}
      <div ref={contentRef} className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Bell icon */}
        <div ref={bellRef} className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
          <Bell className="size-8 text-primary" />
        </div>

        <h2 ref={headingRef} className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 text-foreground leading-tight">
          Never Miss an Important Notice
        </h2>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Get instant alerts for job vacancies, exam dates, tenders, and government updates — directly to your phone or email.
        </p>

        {/* Category pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          <span className="alert-pill flex items-center gap-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
            <CheckCircle className="size-4 text-muted-foreground" /> Job Alerts
          </span>
          <span className="alert-pill flex items-center gap-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
            <CheckCircle className="size-4 text-muted-foreground" /> Exam Dates
          </span>
          <span className="alert-pill flex items-center gap-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
            <CheckCircle className="size-4 text-muted-foreground" /> Tender Notices
          </span>
          <span className="alert-pill flex items-center gap-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
            <CheckCircle className="size-4 text-muted-foreground" /> Policy Updates
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="cta-btn gap-2 h-13 px-8 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
              <Bell className="size-4" /> Set Up Your First Alert
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/notices">
            <Button size="lg" variant="outline" className="cta-btn h-13 px-8 text-base border-border/60 hover:bg-accent/60 hover:border-primary/30 transition-all">
              Browse Notices
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
