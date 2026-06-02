"use client"

import React, { useEffect, useRef } from "react"
import {
  FileText,
  Users,
  Database,
  Globe,
  AlertCircle,
  Activity,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Zap,
  Clock,
  Link2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const width = 80
  const height = 24
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(" ")

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        points={points} className={color} />
    </svg>
  )
}

function PulseDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex size-2.5">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full size-2.5 ${active ? "bg-green-500" : "bg-red-500"}`} />
    </span>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll(".cmd-card")
    gsap.fromTo(cards,
      { opacity: 0, y: 15, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" }
    )
  }, [])

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-4">You need admin privileges to access this page</p>
              <Link href="/login"><Button>Sign In as Admin</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const stats = [
    { icon: FileText, label: "Notices", value: mockNotices.length, spark: [3, 5, 4, 7, 6, 8, 10], color: "stroke-blue-500", trend: "+3" },
    { icon: Users, label: "Users", value: mockUsers.filter(u => u.status === "active").length, spark: [2, 2, 3, 3, 3, 4, 4], color: "stroke-emerald-500", trend: "+1" },
    { icon: Database, label: "Documents", value: mockDocuments.length, spark: [4, 4, 5, 5, 6, 6, 6], color: "stroke-purple-500", trend: "+0" },
    { icon: Globe, label: "Sources", value: mockScrapingSources.length, spark: [3, 3, 4, 4, 4, 4, 4], color: "stroke-amber-500", trend: "+0" },
  ]

  const systemLogs = [
    { time: "08:12", level: "info" as const, msg: "Nepal Gazette scraping done (12 items)" },
    { time: "08:00", level: "info" as const, msg: "Procurement Portal scraping done (8 items)" },
    { time: "07:45", level: "warn" as const, msg: "MoE Portal: timeout (retry 2/3)" },
    { time: "06:30", level: "error" as const, msg: "MoE Portal: ECONNREFUSED" },
    { time: "06:00", level: "info" as const, msg: "Daily scraping cycle started" },
    { time: "05:00", level: "info" as const, msg: "Database backup (4.8 MB)" },
  ]

  const scrapingErrors = mockScrapingSources.filter(s => s.status === "error")

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        {/* System Health Strip */}
        <div className="flex items-center gap-4 mb-6 p-3 rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="size-4 text-primary" />
            <span className="text-xs font-medium">System Health</span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          {[
            { label: "API", ok: true },
            { label: "Scraper", ok: scrapingErrors.length === 0 },
            { label: "Storage", ok: true },
            { label: "Auth", ok: true },
            { label: "RAG", ok: true },
          ].map((svc) => (
            <div key={svc.label} className="flex items-center gap-1.5 shrink-0">
              <PulseDot active={svc.ok} />
              <span className="text-[11px] text-muted-foreground">{svc.label}</span>
            </div>
          ))}
          <div className="ml-auto shrink-0">
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="size-3" /> Uptime 99.9%
            </Badge>
          </div>
        </div>

        <div ref={gridRef}>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className="cmd-card rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="size-8 rounded-lg bg-accent/60 flex items-center justify-center">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <MiniSparkline data={stat.spark} color={stat.color} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                      <TrendingUp className="size-3" /> {stat.trend}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Error Banner */}
          {scrapingErrors.length > 0 && (
            <div className="cmd-card mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
              <AlertCircle className="size-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{scrapingErrors.length} source{scrapingErrors.length > 1 ? "s" : ""} failing</p>
                <p className="text-xs text-muted-foreground truncate">{scrapingErrors.map(s => s.name).join(", ")}</p>
              </div>
              <Link href="/admin/scraping">
                <Button variant="outline" size="sm" className="shrink-0">View</Button>
              </Link>
            </div>
          )}

          {/* Main Content: Logs + Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Live Log Stream - 3 cols */}
            <div className="cmd-card lg:col-span-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="size-4 text-primary" /> Live System Log
                </h3>
                <Badge variant="secondary" className="text-[10px]">Today</Badge>
              </div>
              <div className="space-y-1.5 font-mono">
                {systemLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/30 text-[11px]">
                    {log.level === "info" ? (
                      <CheckCircle className="size-3 text-emerald-500 shrink-0" />
                    ) : log.level === "warn" ? (
                      <AlertCircle className="size-3 text-amber-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3 text-destructive shrink-0" />
                    )}
                    <span className="text-muted-foreground w-10 shrink-0">{log.time}</span>
                    <span className="flex-1 truncate">{log.msg}</span>
                  </div>
                ))}
              </div>
              <Link href="/admin/system" className="block mt-3">
                <Button variant="ghost" size="sm" className="text-xs gap-1 w-full">
                  Full System Logs <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>

            {/* Right column: Sources + Quick Actions */}
            <div className="lg:col-span-2 space-y-4">
              {/* Source Status Grid */}
              <div className="cmd-card rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Link2 className="size-4 text-primary" /> Sources
                  </h3>
                  <Link href="/admin/sources">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                      Manage <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2">
                  {mockScrapingSources.map((src) => (
                    <div key={src.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <PulseDot active={src.status === "active"} />
                        <span className="text-xs font-medium truncate">{src.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{src.itemsScraped.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="cmd-card rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
                <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Link href="/admin/notices" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                      <FileText className="size-3.5" /> Manage Notices
                    </Button>
                  </Link>
                  <Link href="/admin/users" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                      <Users className="size-3.5" /> Manage Users
                    </Button>
                  </Link>
                  <Link href="/admin/sources" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                      <Globe className="size-3.5" /> Add Source
                    </Button>
                  </Link>
                  <Link href="/admin/alerts" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                      <Activity className="size-3.5" /> Alert Channels
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </div>
  )
}
