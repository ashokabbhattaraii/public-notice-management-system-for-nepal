"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Eye, Bookmark, Bell, Clock, TrendingUp, FileText, Search,
  ArrowRight, AlertCircle, Zap, CheckCircle, FolderOpen,
  Building2, CalendarClock, Activity, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"
import { mockNotices, mockActivities } from "@/lib/mock-data"
import gsap from "gsap"

function StatCard({
  label, value, sub, icon, trend, trendUp,
}: {
  label: string; value: string; sub: string
  icon: React.ReactNode; trend?: string; trendUp?: boolean
}) {
  return (
    <div className="dash-card bg-card backdrop-blur-xl p-4 flex flex-col gap-3 relative group hover:bg-card transition-all duration-300">
      {/* Tactical border with corner brackets */}
      <div className="absolute inset-0 border border-border pointer-events-none" />
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

      {/* Hover scan effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex items-center justify-between">
        <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="size-8 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          {icon}
        </div>
      </div>
      <div className="relative">
        <p className="text-3xl font-black tracking-tight leading-none text-foreground tabular-nums">{value}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{sub}</span>
          {trend && (
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 uppercase tracking-wider ${trendUp ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-slate-800/40 text-muted-foreground border border-border"}`}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityDot({ type }: { type: string }) {
  const map: Record<string, string> = {
    view: "bg-blue-400 border-blue-500",
    save: "bg-red-300 border-destructive",
    alert: "bg-indigo-400 border-indigo-500",
    search: "bg-indigo-400 border-indigo-500",
    document: "bg-indigo-400 border-indigo-500",
  }
  return <span className={`size-2 shrink-0 mt-1.5 border ${map[type] ?? "bg-muted-foreground/60 border-border"}`} />
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { alerts, addAlert } = useAlerts()
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardData, setWizardData] = useState({
    name: "", type: "keyword" as "keyword" | "category" | "organization", conditions: "",
  })
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll(".dash-card")
    gsap.fromTo(cards,
      { opacity: 0, y: 20, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
    )
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="size-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">Sign in required</h2>
            <p className="text-sm text-muted-foreground mb-5">Access your personalised notice feed and alerts.</p>
            <Link href="/login"><Button className="w-full">Sign In</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const hasAlerts = alerts.length > 0
  const activeAlertCount = alerts.filter(a => a.enabled).length
  const totalMatches = alerts.reduce((s, a) => s + a.matchCount, 0)
  const recommendedNotices = mockNotices.slice(0, 5)
  const urgentNotices = mockNotices.filter(n => n.priority === "high").slice(0, 2)
  const recentActivities = mockActivities.slice(0, 6)

  const handleWizardSubmit = () => {
    if (!wizardData.name || !wizardData.conditions) return
    addAlert({
      userId: user.id,
      type: wizardData.type,
      name: wizardData.name,
      conditions: wizardData.conditions.split(",").map(s => s.trim()),
      enabled: true,
    })
    setWizardData({ name: "", type: "keyword", conditions: "" })
    setWizardStep(0)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardLayout>
        {/* Tactical page header */}
        <div className="flex items-start justify-between mb-6 gap-4 border-l-2 border-indigo-500 pl-4 relative">
          <div className="absolute -left-[2px] top-0 w-3 h-px bg-indigo-500" />
          <div className="absolute -left-[2px] bottom-0 w-3 h-px bg-indigo-500" />

          <div>
            {/* System status */}
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-sm bg-indigo-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-sm bg-indigo-500" />
              </span>
              <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.2em] text-indigo-400">
                [SESSION_ACTIVE // USER_{user.id}]
              </span>
            </div>

            <h1 className="text-3xl font-bold text-foreground tracking-tight uppercase">
              Good morning, <span className="text-indigo-400">{user.username}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wide">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>

          <Link href="/notices">
            <Button size="sm" className="gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 uppercase tracking-wide text-xs font-semibold">
              <Search className="size-4" />
              Browse Notices
            </Button>
          </Link>
        </div>

        <div ref={gridRef} className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Notices Viewed"
              value="47"
              sub="this month"
              trend="+12 this week"
              trendUp
              icon={<Eye className="size-4" />}
            />
            <StatCard
              label="Saved"
              value="8"
              sub="notices bookmarked"
              trend="+2 new"
              trendUp
              icon={<Bookmark className="size-4" />}
            />
            <StatCard
              label="Active Alerts"
              value={String(activeAlertCount)}
              sub={`${totalMatches} total matches`}
              trend={activeAlertCount > 0 ? "Active" : "None set"}
              trendUp={activeAlertCount > 0}
              icon={<Bell className="size-4" />}
            />
            <StatCard
              label="Member Since"
              value={new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              sub={user.role}
              icon={<CheckCircle className="size-4" />}
            />
          </div>

          {/* Tactical urgent notices banner */}
          {urgentNotices.length > 0 && (
            <div className="dash-card bg-destructive/[0.08] backdrop-blur-xl p-4 relative">
              <div className="absolute inset-0 border border-destructive/20 pointer-events-none" />
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-destructive" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-destructive" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-destructive" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-destructive" />

              <div className="relative flex items-center gap-2 mb-3">
                <CalendarClock className="size-5 text-destructive" />
                <span className="text-sm font-mono font-semibold text-destructive uppercase tracking-wider">Urgent Notices</span>
                <Badge className="text-[10px] font-mono bg-destructive/20 text-destructive border border-destructive/30 h-5 px-2 uppercase tracking-wider">
                  {urgentNotices.length} active
                </Badge>
              </div>
              <div className="relative grid sm:grid-cols-2 gap-2">
                {urgentNotices.map((n) => (
                  <Link key={n.id} href="/notices" className="flex items-center gap-2.5 p-2.5 bg-card hover:bg-accent transition-colors border border-border group relative">
                    <div className="absolute top-0 left-0 w-1 h-1 bg-destructive" />
                    <div className="size-7 bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                      <FileText className="size-3.5 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{n.organization}</p>
                    </div>
                    <ArrowRight className="size-3 text-destructive opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left — 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              {/* Tactical alert setup wizard */}
              {!hasAlerts ? (
                <div className="dash-card bg-indigo-500/[0.08] backdrop-blur-xl p-5 relative">
                  <div className="absolute inset-0 border border-indigo-500/20 pointer-events-none" />
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

                  <div className="relative flex items-center gap-3 mb-4">
                    <div className="size-9 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Zap className="size-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-base font-semibold uppercase tracking-wide text-foreground">Set up your first alert</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide mt-0.5">Get notified the moment relevant notices are published</p>
                    </div>
                  </div>
                  {wizardStep === 0 && (
                    <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: "keyword" as const, label: "Keywords", icon: Search, desc: "Match by text" },
                        { id: "category" as const, label: "Category", icon: FolderOpen, desc: "Filter by type" },
                        { id: "organization" as const, label: "Organization", icon: Building2, desc: "By ministry" },
                      ].map((t) => {
                        const Icon = t.icon
                        return (
                          <button key={t.id}
                            onClick={() => { setWizardData({ ...wizardData, type: t.id }); setWizardStep(1) }}
                            className="relative p-4 bg-card border border-border hover:border-indigo-500/40 hover:bg-accent transition-all text-left group"
                          >
                            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-500" />
                            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-500" />
                            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-500" />
                            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-500" />

                            <div className="size-8 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-2 group-hover:bg-indigo-500/20 transition-colors">
                              <Icon className="size-4 text-indigo-400" />
                            </div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-foreground">{t.label}</p>
                            <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-wide">{t.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {wizardStep === 1 && (
                    <div className="space-y-2.5">
                      <Input
                        placeholder="Alert name (e.g. Section Officer Updates)"
                        value={wizardData.name}
                        onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder={
                          wizardData.type === "keyword" ? "Keywords: section officer, PSC, loksewa"
                          : wizardData.type === "category" ? "Categories: exams, vacancies, tenders"
                          : "Orgs: Nepal Rastra Bank, MoE"
                        }
                        value={wizardData.conditions}
                        onChange={(e) => setWizardData({ ...wizardData, conditions: e.target.value })}
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleWizardSubmit} disabled={!wizardData.name || !wizardData.conditions}>
                          Create Alert
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setWizardStep(0)}>Back</Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Bell className="size-4 text-primary" /> Active Alerts
                      <Badge className="text-[10px] h-4 px-1.5 rounded-full">{activeAlertCount}</Badge>
                    </h3>
                    <Link href="/dashboard/alerts">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        Manage <ArrowRight className="size-3" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {alerts.filter(a => a.enabled).slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-indigo-500" />
                          <span className="text-sm">{alert.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{alert.type}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{alert.matchCount} matches</span>
                      </div>
                    ))}
                    {alerts.length > 3 && (
                      <p className="text-[11px] text-muted-foreground text-center pt-1">+{alerts.length - 3} more alerts</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tactical recommended notices */}
              <div className="dash-card bg-card backdrop-blur-xl p-5 relative">
                <div className="absolute inset-0 border border-border pointer-events-none" />
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

                <div className="relative flex items-center justify-between mb-3">
                  <h3 className="text-sm font-mono font-semibold flex items-center gap-2 uppercase tracking-wider text-foreground">
                    <TrendingUp className="size-4 text-indigo-400" /> Recommended for You
                  </h3>
                  <Link href="/notices">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 font-mono uppercase tracking-wide hover:text-indigo-500 hover:bg-accent">
                      View All <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="relative space-y-1">
                  {recommendedNotices.map((notice) => (
                    <Link key={notice.id} href="/notices" className="flex items-center gap-3 py-2.5 px-2 -mx-2 bg-transparent hover:bg-accent transition-colors group border-b border-border/40 last:border-0">
                      <div className="size-8 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <FileText className="size-3.5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{notice.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-muted-foreground truncate font-mono uppercase tracking-wide">{notice.organization}</span>
                          <span className="text-muted-foreground/60 text-xs">·</span>
                          <span className="text-xs text-muted-foreground font-mono">{notice.views.toLocaleString()} views</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-[10px] h-5 font-mono bg-slate-800/40 text-muted-foreground border-border uppercase tracking-wider">{notice.category}</Badge>
                        {notice.priority === "high" && (
                          <span className="size-2 bg-destructive border border-red-300" />
                        )}
                        <ArrowRight className="size-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Tactical engagement summary */}
              <div className="dash-card bg-card backdrop-blur-xl p-5 relative">
                <div className="absolute inset-0 border border-border pointer-events-none" />
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

                <div className="relative flex items-center gap-2 mb-4">
                  <BarChart3 className="size-5 text-indigo-400" />
                  <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-foreground">This Month</h3>
                </div>
                <div className="relative grid grid-cols-3 gap-3">
                  {[
                    { label: "Searches", value: "23", icon: Search, color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
                    { label: "Docs Read", value: "14", icon: FileText, color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" },
                    { label: "Alerts Fired", value: totalMatches.toString(), icon: Bell, color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 bg-muted/20 border border-border text-center relative">
                        <div className="absolute top-0 left-0 w-1 h-1 bg-indigo-500" />
                        <div className={`size-8 border flex items-center justify-center ${item.color}`}>
                          <Icon className="size-4" />
                        </div>
                        <p className="text-2xl font-black tabular-nums text-foreground">{item.value}</p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">{item.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right — 1 col */}
            <div className="space-y-4">
              {/* Tactical activity feed */}
              <div className="dash-card bg-card backdrop-blur-xl p-5 relative">
                <div className="absolute inset-0 border border-border pointer-events-none" />
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

                <div className="relative flex items-center justify-between mb-3">
                  <h3 className="text-sm font-mono font-semibold flex items-center gap-2 uppercase tracking-wider text-foreground">
                    <Activity className="size-4 text-indigo-400" /> Activity Log
                  </h3>
                  <Link href="/dashboard/activity">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 font-mono uppercase tracking-wide hover:text-indigo-500 hover:bg-accent">
                      All <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="relative space-y-0">
                  {/* Tactical vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-indigo-500/20" />
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 py-2.5 pl-1 relative">
                      <ActivityDot type={activity.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed text-foreground/80">{activity.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-wide">
                          {new Date(activity.timestamp).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/notices", label: "Browse", icon: Search },
                    { href: "/rag", label: "Doc Search", icon: FileText },
                    { href: "/dashboard/alerts", label: "My Alerts", icon: Bell },
                    { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
                  ].map((action) => {
                    const Icon = action.icon
                    return (
                      <Link key={action.href} href={action.href}>
                        <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center group cursor-pointer">
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

              {/* Notice categories */}
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-5">
                <h3 className="text-sm font-semibold mb-3">Browse by Category</h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Vacancies", count: 14, color: "bg-blue-500" },
                    { label: "Tenders", count: 8, color: "bg-destructive" },
                    { label: "Exams", count: 11, color: "bg-primary" },
                    { label: "Policy", count: 5, color: "bg-indigo-500" },
                  ].map((cat) => (
                    <Link key={cat.label} href="/notices">
                      <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/40 transition-colors group cursor-pointer">
                        <span className={`size-2 rounded-full ${cat.color} shrink-0`} />
                        <span className="text-sm flex-1">{cat.label}</span>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{cat.count}</span>
                        <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  )
}
