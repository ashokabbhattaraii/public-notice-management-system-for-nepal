"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, FileText, Bell, Sparkles, ArrowRight, BookOpen, Shield, Zap } from "lucide-react"
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
import { AlertCTASection } from "@/components/alert-cta-section"
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
        y: 100,
        rotationX: -20,
        transformPerspective: 1000,
        duration: 1.4,
        delay: 0.3,
      })
        .from(
          subtitleRef.current,
          { opacity: 0, y: 50, scale: 0.9, duration: 1 },
          "-=0.8"
        )
        .from(
          searchBoxRef.current,
          {
            opacity: 0,
            y: 40,
            scale: 0.9,
            rotationX: -10,
            transformPerspective: 1000,
            duration: 1,
          },
          "-=0.6"
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
            delay: i * 0.15,
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
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <Header />

      {/* Hero Section — Advanced GSAP with particles, glow, grid, floating badges */}
      <section
        ref={heroRef}
        className="relative w-full overflow-hidden flex items-center justify-center py-24 md:py-32"
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
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl pointer-events-none opacity-20"
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

        {/* Hero Content — two column */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

            {/* Left — copy */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 bg-muted border border-border rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Nepal&apos;s Unified Public Notice Repository — Live
              </div>

              <h1
                ref={titleRef}
                className="text-foreground text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight"
              >
                Transparent.
                <br />Accessible.
                <br /><span className="gradient-text">AI-Powered.</span>
              </h1>

              <p
                ref={subtitleRef}
                className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md"
              >
                Every government notice across Nepal — aggregated from official portals,
                classified by AI, and made instantly searchable for every citizen.
              </p>

              {/* Search Box */}
              <div ref={searchBoxRef} className="relative">
                <div className="relative bg-background rounded-xl shadow-lg p-3 border border-border">
                  <div className="flex gap-2">
                    <div className="flex-1 relative group">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
                      <Input
                        type="text"
                        placeholder="Search notices, ministries, reference numbers…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 text-sm border-0 bg-muted/40 focus-visible:ring-1"
                      />
                    </div>
                    <Button size="sm" className="h-11 px-5 shrink-0">Search</Button>
                  </div>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {["Tenders", "PSC Exams", "Vacancies", "Policy Updates", "Gazette"].map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer text-xs font-normal hover:bg-accent">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-1">
                {[
                  ["50+", "Government Sources"],
                  ["OCR", "Scanned PDF Support"],
                  ["RAG", "Document Q&A"],
                ].map(([val, label]) => (
                  <div key={label}>
                    <p className="text-base font-bold text-foreground leading-none">{val}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div className="hidden lg:block">
              <NoticesDashboardMockup />
            </div>

          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>


      {/* The Problem */}
      <ProblemSection />

      {/* The Solution */}
      <SolutionSection />

      {/* Features Section */}
      <FeaturesSection features={features} />

      {/* AI Intelligence Section */}
      <section className="relative py-20 px-4 overflow-hidden bg-background border-t border-border/40">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none grayscale">
          <CpuArchitecture />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 border border-primary/20 rounded-full px-3.5 py-1.5 mb-4">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">AI-Powered Engine</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built on Production-Grade AI Infrastructure
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              From Tesseract OCR on scanned PDFs to HuggingFace NLP classification and LangChain RAG pipelines —
              every notice is processed, indexed, and made queryable in plain language.
            </p>
          </div>

          {/* Tech stack grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {[
              { icon: Zap, label: "Scrapy + Selenium", sub: "Automated web scraping" },
              { icon: FileText, label: "Tesseract OCR", sub: "Scanned PDF extraction" },
              { icon: Shield, label: "HuggingFace NLP", sub: "Classification & summarization" },
              { icon: BookOpen, label: "LangChain + ChromaDB", sub: "RAG document Q&A" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 text-center group hover:border-primary/30 transition-colors">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2.5 group-hover:bg-primary/20 transition-colors">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <Link href="/rag">
              <Button size="lg" className="gap-2 h-11 px-8 shadow-lg shadow-primary/20">
                Try Document Search <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Alert CTA Section */}
      <AlertCTASection />

      <Footer />
    </div>
  )
}
