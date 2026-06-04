"use client"

import React, { useEffect, useRef } from "react"
import {
  FileText, Users, Database, Globe, AlertCircle, Activity,
  CheckCircle, XCircle, ArrowRight, TrendingUp, Zap, Clock,
  Link2, RefreshCw, BarChart3, UserCheck, AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/lib/auth-context"
import { mockNotices, mockUsers, mockDocuments, mockScrapingSources } from "@/lib/mock-data"
import Link from "next/link"
import gsap from "gsap"

function MiniSparkline({ data, color = "stroke-primary" }: { data: number[]; color?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 64
  const height = 20
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(" ")

  return (
    <svg width={width} height={height} className="shrink-0 opacity-70">
      <polyline fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        points={points} className={color} />
    </svg>
  )
}

function PulseDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex size-2">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full size-2 ${active ? "bg-emerald-500" : "bg-destructive"}`} />
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, spark, color, trend, trendUp }: {
  icon: React.ElementType; label: string; value: number
  spark: number[]; color: string; trend: string; trendUp: boolean
}) {
  return (
    <div className="cmd-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="size-4 text-primary" />
        </div>
        <MiniSparkline data={spark} color={color} />
      </div>
      <p className="text-2xl font-bold tracking-tight leading-none mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trendUp ? "text-emerald-600" : "text-muted-foreground"}`}>
          <TrendingUp className="size-3" /> {trend}
        </span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll(".cmd-card")
    gsap.fromTo(cards,
      { opacity: 0, y: 16, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.07, ease: "power3.out" }
    )
  }, [])

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="size-10 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">Access Denied</h2>
            <p className="text-sm text-muted-foreground mb-5">Admin privileges required.</p>
            <Link href="/login"><Button className="w-full">Sign In as Admin</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const activeUsers = mockUsers.filter(u => u.status === "active").length
  const scrapingErrors = mockScrapingSources.filter(s => s.status === "error")
  const healthOk = scrapingErrors.length === 0

  const metrics = [
    { icon: FileText, label: "Total Notices", value: mockNotices.length, spark: [3, 5, 4, 7, 6, 8, 10], color: "stroke-primary", trend: "+3 today", trendUp: true },
    { icon: Users, label: "Active Users", value: activeUsers, spark: [2, 2, 3, 3, 3, 4, 4], color: "stroke-emerald-500", trend: "+1 this week", trendUp: true },
    { icon: Database, label: "Documents", value: mockDocuments.length, spark: [4, 4, 5, 5, 6, 6, 6], color: "stroke-purple-500", trend: "Stable", trendUp: false },
    { icon: Globe, label: "Active Sources", value: mockScrapingSources.filter(s => s.status === "active").length, spark: [3, 3, 4, 4, 4, 4, 4], color: "stroke-amber-500", trend: `${scrapingErrors.length} errors`, trendUp: scrapingErrors.length === 0 },
  ]

  const systemServices = [
    { label: "API Server", ok: true },
    { label: "Scraper", ok: scrapingErrors.length === 0 },
    { label: "Storage", ok: true },
    { label: "Auth", ok: true },
    { label: "RAG Engine", ok: true },
    { label: "Notifier", ok: true },
  ]

  const systemLogs = [
    { time: "08:12", level: "info" as const, msg: "Nepal Gazette scraping done (12 items)" },
    { time: "08:00", level: "info" as const, msg: "Procurement Portal scraping done (8 items)" },
    { time: "07:45", level: "warn" as const, msg: "MoE Portal: timeout (retry 2/3)" },
    { time: "06:30", level: "error" as const, msg: "MoE Portal: ECONNREFUSED" },
    { time: "06:00", level: "info" as const, msg: "Daily scraping cycle started" },
    { time: "05:00", level: "info" as const, msg: "Database backup completed (4.8 MB)" },
  ]

  const recentUsers = mockUsers.slice(0, 4)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>

        {/* System health strip */}
        <div className="cmd-card mb-5 flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="size-4 text-primary" />
            <span className="text-xs font-semibold">System Status</span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          {systemServices.map((svc) => (
            <div key={svc.label} className="flex items-center gap-1.5 shrink-0">
              <PulseDot active={svc.ok} />
              <span className="text-[11px] text-muted-foreground">{svc.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 ${healthOk ? "border-emerald-500/30 text-emerald-600" : "border-destructive/30 text-destructive"}`}
            >
              {healthOk ? <CheckCircle className="size-3" /> : <AlertTriangle className="size-3" />}
              {healthOk ? "All Systems Operational" : `${scrapingErrors.length} Issue${scrapingErrors.length > 1 ? "s" : ""}`}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="size-3" /> 99.9% uptime
            </Badge>
          </div>
        </div>

        <div ref={gridRef} className="space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <MetricCard key={m.label} {...m} />
            ))}
          </div>

          {/* Error banner */}
          {scrapingErrors.length > 0 && (
            <div className="cmd-card rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
              <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="size-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{scrapingErrors.length} source{scrapingErrors.length > 1 ? "s" : ""} failing</p>
                <p className="text-xs text-muted-foreground truncate">{scrapingErrors.map(s => s.name).join(", ")}</p>
              </div>
              <Link href="/admin/scraping">
                <Button variant="outline" size="sm" className="shrink-0 text-xs">Investigate</Button>
              </Link>
            </div>
          )}

          {/* Main content row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Live log — 3 cols */}
            <div className="cmd-card lg:col-span-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="size-4 text-primary" /> Live System Log
                </h3>
                <Badge variant="secondary" className="text-[10px]">Today</Badge>
              </div>
              <div className="space-y-1 font-mono">
                {systemLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/30 text-[11px] transition-colors">
                    {log.level === "info" ? (
                      <CheckCircle className="size-3 text-emerald-500 shrink-0" />
                    ) : log.level === "warn" ? (
                      <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3 text-destructive shrink-0" />
                    )}
                    <span className="text-muted-foreground w-10 shrink-0 tabular-nums">{log.time}</span>
                    <span
                      className={`flex-1 truncate ${log.level === "error" ? "text-destructive" : log.level === "warn" ? "text-amber-600" : "text-foreground/80"}`}
                    >
                      {log.msg}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 px-1.5 shrink-0 ${log.level === "error" ? "border-destructive/30 text-destructive" : log.level === "warn" ? "border-amber-500/30 text-amber-600" : "border-emerald-500/30 text-emerald-600"}`}
                    >
                      {log.level}
                    </Badge>
                  </div>
                ))}
              </div>
              <Link href="/admin/system" className="block mt-3">
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1">
                  Full System Logs <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>

            {/* Right — 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              {/* Source status */}
              <div className="cmd-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="size-4 text-primary" /> Scraping Sources
                  </h3>
                  <Link href="/admin/sources">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      Manage <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {mockScrapingSources.map((src) => (
                    <div key={src.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-accent/20 hover:bg-accent/40 transition-colors">
                      <PulseDot active={src.status === "active"} />
                      <span className="text-xs font-medium flex-1 truncate">{src.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground tabular-nums">{src.itemsScraped.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="cmd-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" /> Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/admin/notices", label: "Notices", icon: FileText },
                    { href: "/admin/users", label: "Users", icon: Users },
                    { href: "/admin/sources", label: "Add Source", icon: Globe },
                    { href: "/admin/alerts", label: "Alerts", icon: Activity },
                  ].map((action) => {
                    const Icon = action.icon
                    return (
                      <Link key={action.href} href={action.href}>
                        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center group cursor-pointer">
                          <div className="size-8 rounded-lg bg-accent/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                            <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Recent users row */}
          <div className="cmd-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="size-4 text-primary" /> Recent Users
              </h3>
              <Link href="/admin/users">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  All Users <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/20 hover:bg-accent/40 transition-colors">
                  <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {u.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{u.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`size-1.5 rounded-full ${u.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      <p className="text-[10px] text-muted-foreground capitalize">{u.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    </div>
  )
}
