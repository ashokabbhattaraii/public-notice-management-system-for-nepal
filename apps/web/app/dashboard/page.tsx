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
    <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-muted-foreground">{sub}</span>
          {trend && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${trendUp ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
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
    view: "bg-blue-500",
    save: "bg-amber-500",
    alert: "bg-primary",
    search: "bg-emerald-500",
    document: "bg-purple-500",
  }
  return <span className={`size-2 rounded-full shrink-0 mt-1.5 ${map[type] ?? "bg-muted-foreground"}`} />
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
        {/* Page header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Good morning, {user.username} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Link href="/notices">
            <Button size="sm" className="gap-1.5 shrink-0">
              <Search className="size-3.5" />
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

          {/* Urgent notices banner */}
          {urgentNotices.length > 0 && (
            <div className="dash-card rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="size-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Urgent Notices</span>
                <Badge className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 border-0 h-4 px-1.5">
                  {urgentNotices.length} active
                </Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {urgentNotices.map((n) => (
                  <Link key={n.id} href="/notices" className="flex items-center gap-2.5 p-2.5 rounded-lg bg-background/60 hover:bg-background transition-colors border border-border/40 group">
                    <div className="size-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                      <FileText className="size-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground">{n.organization}</p>
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left — 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              {/* Alert setup wizard or alert summary */}
              {!hasAlerts ? (
                <div className="dash-card rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Set up your first alert</p>
                      <p className="text-xs text-muted-foreground">Get notified the moment relevant notices are published</p>
                    </div>
                  </div>
                  {wizardStep === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: "keyword" as const, label: "Keywords", icon: Search, desc: "Match by text" },
                        { id: "category" as const, label: "Category", icon: FolderOpen, desc: "Filter by type" },
                        { id: "organization" as const, label: "Organization", icon: Building2, desc: "By ministry" },
                      ].map((t) => {
                        const Icon = t.icon
                        return (
                          <button key={t.id}
                            onClick={() => { setWizardData({ ...wizardData, type: t.id }); setWizardStep(1) }}
                            className="p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                          >
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                              <Icon className="size-4 text-primary" />
                            </div>
                            <p className="text-xs font-medium">{t.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
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
                <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
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
                          <span className="size-2 rounded-full bg-emerald-500" />
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

              {/* Recommended notices */}
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" /> Recommended for You
                  </h3>
                  <Link href="/notices">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      View All <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-1">
                  {recommendedNotices.map((notice) => (
                    <Link key={notice.id} href="/notices" className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors group">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="size-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notice.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground truncate">{notice.organization}</span>
                          <span className="text-muted-foreground/40 text-[10px]">·</span>
                          <span className="text-[11px] text-muted-foreground">{notice.views.toLocaleString()} views</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-[10px] h-5">{notice.category}</Badge>
                        {notice.priority === "high" && (
                          <span className="size-1.5 rounded-full bg-amber-500" />
                        )}
                        <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Engagement summary */}
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">This Month</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Searches", value: "23", icon: Search, color: "bg-blue-500/10 text-blue-600" },
                    { label: "Docs Read", value: "14", icon: FileText, color: "bg-purple-500/10 text-purple-600" },
                    { label: "Alerts Fired", value: totalMatches.toString(), icon: Bell, color: "bg-primary/10 text-primary" },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-accent/30 text-center">
                        <div className={`size-8 rounded-lg flex items-center justify-center ${item.color}`}>
                          <Icon className="size-4" />
                        </div>
                        <p className="text-lg font-bold">{item.value}</p>
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right — 1 col */}
            <div className="space-y-4">
              {/* Activity feed */}
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-primary" /> Activity
                  </h3>
                  <Link href="/dashboard/activity">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      All <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
                <div className="relative space-y-0">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 py-2.5 pl-1">
                      <ActivityDot type={activity.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">{activity.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
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
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
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
              <div className="dash-card rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5">
                <h3 className="text-sm font-semibold mb-3">Browse by Category</h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Vacancies", count: 14, color: "bg-blue-500" },
                    { label: "Tenders", count: 8, color: "bg-amber-500" },
                    { label: "Exams", count: 11, color: "bg-primary" },
                    { label: "Policy", count: 5, color: "bg-purple-500" },
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
