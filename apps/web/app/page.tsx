"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, FileText, Bell, ArrowRight, BookOpen, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CpuArchitecture } from "@/components/ui/cpu-architecture"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { mockNotices } from "@/lib/mock-data"
import Link from "next/link"
import gsap from "gsap"
import { FeaturesSection } from "@/components/features-section"
import { ContactSection } from "@/components/contact-section"
import { AboutSection } from "@/components/about-section"
import { NoticesDashboardMockup } from "@/components/notices-dashboard-mockup"
import { ProblemSection } from "@/components/problem-section"
import { SolutionSection } from "@/components/solution-section"

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const bgGridRef = useRef<HTMLDivElement>(null)

  // Mouse tracking for radial glow
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = heroRef.current?.getBoundingClientRect()
      if (rect) {
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    }

    const heroElement = heroRef.current
    if (heroElement) {
      heroElement.addEventListener("mousemove", handleMouseMove)
      return () => heroElement.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  // Main GSAP hero animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } })

      // Title entrance with 3D perspective
      tl.from(titleRef.current, {
        opacity: 0,
        y: 60,
        rotationX: -10,
        transformPerspective: 1000,
        duration: 0.7,
        delay: 0.1,
      })
        .from(
          subtitleRef.current,
          { opacity: 0, y: 30, scale: 0.95, duration: 0.5 },
          "-=0.4"
        )
        .from(
          searchBoxRef.current,
          {
            opacity: 0,
            y: 25,
            scale: 0.95,
            duration: 0.5,
          },
          "-=0.3"
        )
      // Animated grid background drift
      if (bgGridRef.current) {
        gsap.to(bgGridRef.current, {
          backgroundPosition: "100px 100px",
          duration: 20,
          repeat: -1,
          ease: "none",
        })
      }

      // Glow pulse
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          scale: 1.2,
          opacity: 0.6,
          duration: 3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      }

      // Particle animation
      const particles = particlesRef.current?.children
      if (particles) {
        Array.from(particles).forEach((particle, i) => {
          gsap.to(particle, {
            y: `random(-80, 80)`,
            x: `random(-40, 40)`,
            opacity: `random(0.2, 0.7)`,
            scale: `random(0.5, 1.5)`,
            duration: `random(3, 6)`,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.05,
          })
        })
      }

      // Search box focus animation
      const searchInput = searchBoxRef.current?.querySelector("input")
      if (searchInput) {
        searchInput.addEventListener("focus", () => {
          gsap.to(searchBoxRef.current, {
            scale: 1.02,
            duration: 0.3,
            ease: "power2.out",
          })
        })
        searchInput.addEventListener("blur", () => {
          gsap.to(searchBoxRef.current, {
            scale: 1,
            duration: 0.3,
          })
        })
      }
    }, heroRef)

    return () => ctx.revert()
  }, [])

  const features = [
    {
      icon: Search,
      title: "Unified Search",
      description: "Query every government notice — vacancies, tenders, exam dates, policy updates — from a single interface with natural language support.",
    },
    {
      icon: Shield,
      title: "Verified Sources Only",
      description: "All notices are sourced directly from official government portals via Scrapy and Selenium pipelines. No third-party aggregators.",
    },
    {
      icon: Zap,
      title: "Instant Smart Alerts",
      description: "Subscribe to keywords, categories, or specific ministries. Receive notifications the moment a matching notice is published.",
    },
    {
      icon: BookOpen,
      title: "RAG Document Intelligence",
      description: "Ask questions in plain language against indexed government documents. Powered by LangChain, ChromaDB, and HuggingFace NLP models.",
    },
  ]


  return (
    <div className="min-h-screen w-full bg-background relative overflow-x-hidden">
      <Header />

      {/* Hero Section — Advanced GSAP with particles, glow, grid, floating badges */}
      <section
        ref={heroRef}
        className="relative w-full overflow-hidden flex items-center justify-center pt-8 pb-16 md:pt-12 md:pb-20 lg:pt-16 lg:pb-24"
      >
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div
            ref={bgGridRef}
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, hsl(var(--muted-foreground) / 0.2) 1px, transparent 0),
                               radial-gradient(circle at 75px 75px, hsl(var(--muted-foreground) / 0.12) 1px, transparent 0)`,
              backgroundSize: "100px 100px",
            }}
          />
        </div>

        {/* Subtle ambient orb */}
        <div
          ref={glowRef}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(700px,90vw)] h-[min(700px,90vw)] rounded-full blur-3xl pointer-events-none opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12), transparent)",
          }}
        />

        {/* Floating Particles */}
        <div ref={particlesRef} className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-muted-foreground/20 rounded-full"
              style={{
                left: `${5 + (i * 5.2) % 90}%`,
                top: `${8 + (i * 7.3) % 85}%`,
              }}
            />
          ))}
        </div>

        {/* Animated Lines */}
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-foreground to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-foreground/40 to-transparent" />
          <div className="absolute left-0 top-1/4 w-full h-px bg-gradient-to-r from-transparent via-foreground to-transparent" />
          <div className="absolute left-0 top-3/4 w-full h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
        </div>

        {/* SVG Grid with Mouse-following Glow */}
        <div className="absolute inset-0 z-0 h-full w-full pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1220 810"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
          >
            <g clipPath="url(#clip0)">
              <mask id="mask0" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="10" y="-1" width="1200" height="812">
                <rect x="10" y="-0.84668" width="1200" height="811.693" fill="url(#paint0_linear)" />
              </mask>
              <g mask="url(#mask0)">
                {[...Array(35)].map((_, i) => (
                  <React.Fragment key={`row-${i}`}>
                    {[...Array(23)].map((_, j) => (
                      <rect
                        key={`${i}-${j}`}
                        x={-20.0891 + i * 36}
                        y={9.2 + j * 36}
                        width="35.6"
                        height="35.6"
                        stroke="hsl(var(--foreground))"
                        strokeOpacity="0.06"
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                      />
                    ))}
                  </React.Fragment>
                ))}
                <rect x="699.711" y="81" width="36" height="36" fill="hsl(var(--primary))" fillOpacity="0.08" />
                <rect x="195.711" y="153" width="36" height="36" fill="hsl(var(--primary))" fillOpacity="0.1" />
                <rect x="1023.71" y="153" width="36" height="36" fill="hsl(var(--primary))" fillOpacity="0.06" />
                <rect x="447.711" y="369" width="36" height="36" fill="hsl(var(--primary))" fillOpacity="0.07" />
                <rect x="879.711" y="513" width="36" height="36" fill="hsl(var(--primary))" fillOpacity="0.09" />
              </g>

              {/* Mouse-following radial glow */}
              <circle
                cx={mousePosition.x}
                cy={mousePosition.y}
                r="150"
                fill="url(#mouseGradient)"
                opacity="0.08"
                className="pointer-events-none"
              />

              <g filter="url(#filter0_f)">
                <path
                  d="M1447.45 -87.0203V-149.03H1770V1248.85H466.158V894.269C1008.11 894.269 1447.45 454.931 1447.45 -87.0203Z"
                  fill="url(#paint1_linear)"
                  opacity="0.35"
                />
              </g>
            </g>

            <defs>
              <radialGradient id="mouseGradient" cx="0" cy="0" r="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <filter id="filter0_f" x="147.369" y="-467.818" width="1941.42" height="2035.46" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feGaussianBlur stdDeviation="159.394" result="effect1_foregroundBlur" />
              </filter>
              <linearGradient id="paint0_linear" x1="35.0676" y1="23.6807" x2="903.8" y2="632.086" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--foreground))" stopOpacity="0" />
                <stop offset="1" stopColor="hsl(var(--muted-foreground))" />
              </linearGradient>
              <linearGradient id="paint1_linear" x1="1118.08" y1="-149.03" x2="1118.08" y2="1248.85" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--primary))" />
                <stop offset="0.578125" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>
              <clipPath id="clip0">
                <rect width="1220" height="810" rx="16" fill="hsl(var(--foreground))" />
              </clipPath>
            </defs>
          </svg>
        </div>

        {/* Hero Content — tactical layout */}
        <div className="relative z-10 w-full max-w-[1480px] mx-auto px-6 md:px-8 lg:px-12">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 xl:gap-20 items-center">

            {/* Left — copy with tactical styling */}
            <div className="space-y-8 relative">
              {/* System status badge */}
              <div className="inline-flex items-center gap-2.5 bg-card border border-border px-4 py-2 text-[11px] font-mono font-semibold text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-xl uppercase tracking-wider relative">
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-400" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-400" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-400" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-400" />

                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-sm bg-indigo-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex size-2 rounded-sm bg-indigo-500" />
                </span>
                [SYS_ONLINE // NEPAL_PUBLIC_NOTICE_NET]
              </div>

              <h1
                ref={titleRef}
                className="text-foreground text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight uppercase"
              >
                Transparent.
                <br />Accessible.
                <br /><span className="text-indigo-400">AI-Powered.</span>
              </h1>

              {/* Scan line divider */}
              <div className="flex gap-4 items-center">
                <div className="h-0.5 w-16 bg-indigo-500/30 overflow-hidden relative">
                  <div className="absolute inset-0 bg-indigo-500 w-full h-full animate-[scanline_2s_linear_infinite]" />
                </div>
              </div>

              <p
                ref={subtitleRef}
                className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl font-light"
              >
                Every government notice across Nepal — aggregated from official portals,
                classified by AI, and made instantly searchable for every citizen.
              </p>

              {/* Search Box — tactical interface */}
              <div ref={searchBoxRef} className="relative max-w-2xl">
                <div className="relative bg-card shadow-2xl shadow-black/20 p-4 border border-border backdrop-blur-xl">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

                  {/* Query label */}
                  <div className="absolute -top-2.5 left-4 bg-background px-2 text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                    QUERY_INTERFACE
                  </div>

                  <div className="relative flex gap-2.5">
                    <div className="flex-1 relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4 transition-colors group-focus-within:text-indigo-400" />
                      <Input
                        type="text"
                        placeholder="Search notices, ministries, reference numbers…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 text-sm border border-border bg-background/80 focus-visible:ring-1 focus-visible:ring-indigo-500/40 font-light"
                      />
                    </div>
                    <Button size="sm" className="h-12 px-7 shrink-0 font-semibold shadow-lg shadow-indigo-500/20 uppercase tracking-wide text-xs bg-indigo-600 hover:bg-indigo-500 text-white">
                      Execute
                    </Button>
                  </div>

                  <div className="flex gap-2 mt-3.5 flex-wrap">
                    {["Tenders", "PSC Exams", "Vacancies", "Policy Updates", "Gazette"].map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer text-[10px] font-mono font-medium hover:bg-accent px-3 py-1 bg-secondary text-secondary-foreground border border-border hover:border-indigo-500/40 transition-all duration-200 uppercase tracking-wider"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tactical metrics */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {[
                  ["50+", "GOV_SOURCES"],
                  ["OCR", "PDF_PARSE"],
                  ["RAG", "DOC_Q&A"],
                ].map(([val, label]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-4 py-2 bg-card border border-border backdrop-blur-xl relative"
                  >
                    {/* Corner accent */}
                    <div className="absolute top-0 left-0 w-1 h-1 bg-indigo-500" />
                    <p className="text-base font-bold text-indigo-400 leading-none tabular-nums">{val}</p>
                    <div className="w-px h-5 bg-border" />
                    <p className="text-[10px] text-muted-foreground leading-tight font-mono uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — dashboard mockup with tactical frame */}
            <div className="hidden lg:block relative">
              <div className="relative overflow-hidden border border-border shadow-2xl shadow-black/30 bg-card backdrop-blur-xl">
                {/* Tactical corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500 z-20" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500 z-20" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500 z-20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500 z-20" />

                {/* HUD overlay */}
                <div className="absolute top-2 left-2 z-20 text-[9px] font-mono text-indigo-400/60 uppercase tracking-wider">
                  LIVE_PREVIEW
                </div>
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-indigo-500" />
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">SYNC</span>
                </div>

                <NoticesDashboardMockup />
              </div>
            </div>

          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>


      {/* The Problem */}
      <div id="problem">
        <ProblemSection />
      </div>

      {/* The Solution */}
      <div id="solution">
        <SolutionSection />
      </div>

      {/* Features Section */}
      <div id="features">
        <FeaturesSection features={features} />
      </div>

      {/* About Section */}
      <AboutSection />

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  )
}
