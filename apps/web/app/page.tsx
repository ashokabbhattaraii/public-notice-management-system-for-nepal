"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, TrendingUp, Calendar, FileText, Bell, Sparkles, ArrowRight, BookOpen, Shield, Zap, Eye, Clock, Newspaper, ChevronRight, CheckCircle, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CpuArchitecture } from "@/components/ui/cpu-architecture"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { mockNotices } from "@/lib/mock-data"
import Link from "next/link"
import gsap from "gsap"
import { FeaturesSection } from "@/components/features-section"

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const bgGridRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)

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
        .from(
          statsRef.current?.children ? Array.from(statsRef.current.children) : [],
          {
            opacity: 0,
            y: 30,
            scale: 0.8,
            rotation: -5,
            stagger: 0.12,
            duration: 0.8,
            ease: "back.out(1.7)",
          },
          "-=0.5"
        )

      // Floating badges animation
      gsap.to(".floating-badge", {
        y: -15,
        rotation: 3,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.3,
      })

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

      // Stat cards hover interactions
      const statCards = statsRef.current?.children
      if (statCards) {
        Array.from(statCards).forEach((card) => {
          const icon = card.querySelector(".stat-icon")
          const value = card.querySelector(".stat-value")

          card.addEventListener("mouseenter", () => {
            gsap.to(card, {
              y: -8,
              scale: 1.05,
              duration: 0.3,
              ease: "power2.out",
            })
            if (icon) {
              gsap.to(icon, {
                rotation: 360,
                scale: 1.2,
                duration: 0.5,
                ease: "back.out(2)",
              })
            }
            if (value) {
              gsap.to(value, { scale: 1.1, duration: 0.3 })
            }
          })

          card.addEventListener("mouseleave", () => {
            gsap.to(card, { y: 0, scale: 1, duration: 0.3 })
            if (icon) {
              gsap.to(icon, { rotation: 0, scale: 1, duration: 0.3 })
            }
            if (value) {
              gsap.to(value, { scale: 1, duration: 0.3 })
            }
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

  // Metrics scroll animation
  useEffect(() => {
    if (!metricsRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = metricsRef.current?.children
            if (children) {
              gsap.fromTo(
                Array.from(children),
                { opacity: 0, y: 40, scale: 0.9 },
                {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  duration: 0.7,
                  stagger: 0.15,
                  ease: "back.out(1.4)",
                }
              )
            }
            observer.disconnect()
          }
        })
      },
      { threshold: 0.3 }
    )
    observer.observe(metricsRef.current)
    return () => observer.disconnect()
  }, [])

  const stats = [
    { icon: TrendingUp, label: "Tenders", value: "234", color: "text-blue-600" },
    { icon: Bell, label: "New Today", value: "45", color: "text-emerald-600" },
    { icon: FileText, label: "Contracts", value: "89", color: "text-sky-600" },
    { icon: Bell, label: "Announcements", value: "12", color: "text-amber-600" },
  ]

  const metrics = [
    { value: "2.5M+", label: "Documents" },
    { value: "500+", label: "Institutions" },
    { value: "99.9%", label: "Verified" },
  ]

  const features = [
    { icon: Search, title: "Smart Search", description: "AI-powered search across all government notices with natural language queries." },
    { icon: Shield, title: "Verified Sources", description: "Every notice authenticated and verified from official government channels." },
    { icon: Zap, title: "Real-time Alerts", description: "Custom notifications for keywords, categories, and organizations you follow." },
    { icon: BookOpen, title: "Document Intelligence", description: "RAG-powered Q&A system for querying government policies and documents." },
  ]

  const recentNotices = mockNotices.slice(0, 5)
  const newsDashboardRef = useRef<HTMLDivElement>(null)
  const newsItemsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!newsDashboardRef.current || !newsItemsRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = newsItemsRef.current?.children
            if (!items) return

            gsap.fromTo(
              newsDashboardRef.current,
              { opacity: 0, y: 40 },
              { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
            )

            gsap.fromTo(
              Array.from(items),
              { opacity: 0, x: -30, scale: 0.98 },
              {
                opacity: 1,
                x: 0,
                scale: 1,
                duration: 0.6,
                stagger: 0.12,
                ease: "power2.out",
                delay: 0.3,
              }
            )

            observer.disconnect()
          }
        })
      },
      { threshold: 0.2 }
    )

    observer.observe(newsDashboardRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <Header />

      {/* Hero Section — Advanced GSAP with particles, glow, grid, floating badges */}
      <section
        ref={heroRef}
        className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      >
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div
            ref={bgGridRef}
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, hsl(var(--primary) / 0.15) 1.5px, transparent 0),
                               radial-gradient(circle at 75px 75px, hsl(var(--primary) / 0.1) 1.5px, transparent 0)`,
              backgroundSize: "100px 100px",
            }}
          />
        </div>

        {/* Animated Glow Orb */}
        <div
          ref={glowRef}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl pointer-events-none opacity-40"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.08), transparent)",
          }}
        />

        {/* Floating Particles */}
        <div ref={particlesRef} className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-primary/30 rounded-full"
              style={{
                left: `${5 + (i * 5.2) % 90}%`,
                top: `${8 + (i * 7.3) % 85}%`,
              }}
            />
          ))}
        </div>

        {/* Animated Lines */}
        <div className="absolute inset-0 overflow-hidden opacity-15 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-primary to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-primary/60 to-transparent" />
          <div className="absolute left-0 top-1/4 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute left-0 top-3/4 w-full h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
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

        {/* Floating Badges */}
        <div className="absolute top-16 left-8 md:left-16 floating-badge z-20">
          <Badge variant="outline" className="bg-background/90 backdrop-blur-md border-primary/30 shadow-lg px-3 py-1.5">
            <FileText className="w-3 h-3 mr-1.5" />
            Official
          </Badge>
        </div>
        <div className="absolute top-16 right-8 md:right-16 floating-badge z-20">
          <Badge variant="outline" className="bg-background/90 backdrop-blur-md border-emerald-500/30 shadow-lg px-3 py-1.5">
            <CheckCircle className="w-3 h-3 mr-1.5 text-emerald-500" />
            Verified
          </Badge>
        </div>
        <div className="absolute top-36 left-12 md:left-28 floating-badge z-20">
          <Badge variant="outline" className="bg-background/90 backdrop-blur-md border-sky-500/30 shadow-lg px-3 py-1.5">
            <Shield className="w-3 h-3 mr-1.5 text-sky-500" />
            Secure
          </Badge>
        </div>
        <div className="absolute top-36 right-12 md:right-28 floating-badge z-20">
          <Badge variant="outline" className="bg-background/90 backdrop-blur-md border-amber-500/30 shadow-lg px-3 py-1.5">
            <Zap className="w-3 h-3 mr-1.5 text-amber-500" />
            Fast
          </Badge>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
              <Building2 className="w-4 h-4" />
              <span>Centralized Government Repository</span>
            </div>

            <h1
              ref={titleRef}
              className="text-foreground text-4xl md:text-5xl lg:text-7xl font-bold leading-tight"
            >
              Transparent. Accessible. Official
              <br />
              <span className="gradient-text">Public Information.</span>
            </h1>

            <p
              ref={subtitleRef}
              className="text-muted-foreground text-lg md:text-xl lg:text-2xl font-normal leading-relaxed max-w-3xl mx-auto"
            >
              A centralized institutional repository for all government and public sector notices.
              <br />
              Search, filter, and access authenticated documents efficiently.
            </p>

            {/* Search Box */}
            <div ref={searchBoxRef} className="max-w-3xl mx-auto mt-12 relative">
              <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl scale-105" />
              <div className="relative bg-background/90 backdrop-blur-xl rounded-2xl shadow-2xl p-4 md:p-6 border border-primary/15">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 transition-all group-focus-within:text-primary group-focus-within:scale-110" />
                    <Input
                      type="text"
                      placeholder="Search notices, keywords, or reference numbers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 md:h-14 text-base md:text-lg border-border/50 bg-background/50 focus-visible:border-primary focus-visible:ring-primary/30"
                    />
                  </div>
                  <Button
                    size="lg"
                    className="h-12 md:h-14 px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    Search
                  </Button>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {["Government Tenders", "Contracts", "Public Notices", "Regulations"].map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/15 hover:text-primary transition-colors"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Stat Cards */}
            <div
              ref={statsRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto mt-12"
            >
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div
                    key={index}
                    className="bg-card/80 backdrop-blur-sm rounded-xl p-5 md:p-6 shadow-lg border border-border/50 cursor-pointer transition-all relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative text-center">
                      <div className="flex items-center justify-center mb-3">
                        <Icon className={`stat-icon w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
                      </div>
                      <div className="stat-value text-2xl md:text-3xl font-bold text-foreground mb-1">
                        {stat.value}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Metrics */}
            <div
              ref={metricsRef}
              className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-10"
            >
              {metrics.map((metric, index) => (
                <div
                  key={index}
                  className="relative bg-card/60 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-border/50 overflow-hidden group cursor-pointer opacity-0"
                >
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative text-center">
                    <div className="text-3xl md:text-4xl font-bold text-primary mb-1 group-hover:scale-105 transition-transform duration-300">
                      {metric.value}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* News Dashboard Section */}
      <section className="py-24 px-4">
        <div ref={newsDashboardRef} className="max-w-5xl mx-auto opacity-0">
          <Card className="overflow-hidden border-border/60 shadow-xl bg-card/80 backdrop-blur-sm">
            {/* Dashboard Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary flex items-center justify-center">
                  <Newspaper className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Latest Notices</h2>
                  <p className="text-xs text-muted-foreground">Live updates from government sources</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </Badge>
                <Badge variant="secondary" className="text-xs">{mockNotices.length} total</Badge>
              </div>
            </div>

            {/* Notice Items */}
            <div ref={newsItemsRef} className="divide-y divide-border">
              {recentNotices.map((notice, i) => (
                <Link key={notice.id} href="/notices" className="block">
                  <div className="group flex items-center gap-4 px-6 py-4 hover:bg-accent/40 transition-all duration-200 cursor-pointer">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <span className="text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={notice.priority === "high" ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {notice.category}
                        </Badge>
                        {notice.priority === "high" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgent</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{notice.organization}</span>
                      </div>
                      <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {notice.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{notice.description}</p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="size-3" />
                        {notice.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {new Date(notice.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Dashboard Footer — View More */}
            <div className="px-6 py-4 border-t border-border bg-muted/20">
              <Link href="/notices">
                <Button className="w-full gap-2 h-11">
                  <Newspaper className="size-4" />
                  View All Notices
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <FeaturesSection features={features} />

      {/* CPU Architecture Decoration */}
      <section className="py-16 px-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-accent/20 border border-border/50 p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-60">
              <CpuArchitecture />
            </div>
            <div className="relative z-10 text-center py-12">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">Powered by AI Intelligence</h3>
              <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                Our RAG-powered document intelligence system processes millions of government documents for instant, accurate answers.
              </p>
              <Link href="/rag">
                <Button size="lg" className="gap-2">
                  Try Document Search <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Alert CTA Section - High Visibility */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rounded-2xl bg-primary p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent)]" />
            <div className="absolute top-6 right-6 size-20 rounded-full bg-white/5 blur-xl" />
            <div className="absolute bottom-8 left-8 size-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative z-10">
              <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Bell className="size-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Never Miss an Important Notice
              </h2>
              <p className="text-primary-foreground/80 max-w-lg mx-auto mb-4">
                Get instant alerts for job vacancies, exam dates, tenders, and government updates — directly to your phone or email.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8 text-sm text-primary-foreground/70">
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="size-3.5" /> Job Alerts
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="size-3.5" /> Exam Dates
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="size-3.5" /> Tender Notices
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="size-3.5" /> Policy Updates
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/signup">
                  <Button size="xl" className="bg-white text-foreground hover:bg-white/90 gap-2">
                    <Bell className="size-4" /> Set Up Your First Alert
                  </Button>
                </Link>
                <Link href="/notices">
                  <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Browse Notices
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
