"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Eye, Bookmark, Bell, TrendingUp, FileText, Search,
  ArrowRight, AlertCircle, Zap, CheckCircle, FolderOpen,
  Building2, CalendarClock, Activity, BarChart3,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"
import { mockNotices, mockActivities } from "@/lib/mock-data"
import gsap from "gsap"

function StatCard({
  label, value, sub, icon, trend,
}: {
  label: string; value: string; sub: string
  icon: React.ReactNode; trend?: string; trendUp?: boolean
}) {
  return (
    <div className="dash-card flex flex-col gap-4 rounded-[20px] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-vez-mute">{label}</span>
        <div className="flex size-9 items-center justify-center rounded-full bg-vez-sky/30 text-vez-navy">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl leading-none tracking-[-0.02em] text-vez-ink tabular-nums">{value}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-vez-mute">{sub}</span>
          {trend && (
            <span className="rounded-full bg-vez-sky/30 px-2.5 py-0.5 text-[10px] text-vez-navy">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

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
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" }
    )
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Access your personalised notice feed and alerts.</p>
            <Link
              href="/login"
              className="block w-full rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
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
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-vez-mute">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Good morning, {user.username}.
            </h1>
          </div>

          <Link
            href="/notices"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
          >
            <Search className="size-4" />
            Browse notices
          </Link>
        </div>

        <div ref={gridRef} className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Notices viewed"
              value="47"
              sub="this month"
              trend="+12 this week"
              icon={<Eye className="size-4" />}
            />
            <StatCard
              label="Saved"
              value="8"
              sub="notices bookmarked"
              trend="+2 new"
              icon={<Bookmark className="size-4" />}
            />
            <StatCard
              label="Active alerts"
              value={String(activeAlertCount)}
              sub={`${totalMatches} total matches`}
              trend={activeAlertCount > 0 ? "Active" : "None set"}
              icon={<Bell className="size-4" />}
            />
            <StatCard
              label="Member since"
              value={new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              sub={user.role}
              icon={<CheckCircle className="size-4" />}
            />
          </div>

          {/* Urgent notices banner */}
          {urgentNotices.length > 0 && (
            <div className="dash-card rounded-[20px] bg-vez-navy p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <CalendarClock className="size-5 text-vez-sky" />
                <span className="text-base text-white">Urgent notices</span>
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs text-white">
                  {urgentNotices.length} active
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {urgentNotices.map((n) => (
                  <Link
                    key={n.id}
                    href="/notices"
                    className="group flex items-center gap-3 rounded-[16px] bg-white/10 p-4 transition-colors hover:bg-white/20"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vez-sky/30">
                      <FileText className="size-4 text-vez-sky" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{n.title}</p>
                      <p className="truncate text-xs text-white/60">{n.organization}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-vez-sky opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left — 2 cols */}
            <div className="space-y-6 lg:col-span-2">
              {/* Alert setup wizard */}
              {!hasAlerts ? (
                <div className="dash-card rounded-[20px] bg-vez-sky/25 p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white">
                      <Zap className="size-4 text-vez-navy" />
                    </div>
                    <div>
                      <p className="text-base text-vez-ink">Set up your first alert</p>
                      <p className="mt-0.5 text-sm text-vez-mute">Get notified the moment relevant notices are published</p>
                    </div>
                  </div>
                  {wizardStep === 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { id: "keyword" as const, label: "Keywords", icon: Search, desc: "Match by text" },
                        { id: "category" as const, label: "Category", icon: FolderOpen, desc: "Filter by type" },
                        { id: "organization" as const, label: "Organization", icon: Building2, desc: "By ministry" },
                      ].map((t) => {
                        const Icon = t.icon
                        return (
                          <button key={t.id}
                            onClick={() => { setWizardData({ ...wizardData, type: t.id }); setWizardStep(1) }}
                            className="group rounded-[16px] bg-white p-5 text-left transition-transform duration-300 hover:-translate-y-1"
                          >
                            <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-vez-sky/30 transition-colors group-hover:bg-vez-sky/50">
                              <Icon className="size-4 text-vez-navy" />
                            </div>
                            <p className="text-sm text-vez-ink">{t.label}</p>
                            <p className="mt-1 text-xs text-vez-mute">{t.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <input
                        placeholder="Alert name (e.g. Section Officer Updates)"
                        value={wizardData.name}
                        onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        placeholder={
                          wizardData.type === "keyword" ? "Keywords: section officer, PSC, loksewa"
                          : wizardData.type === "category" ? "Categories: exams, vacancies, tenders"
                          : "Orgs: Nepal Rastra Bank, MoE"
                        }
                        value={wizardData.conditions}
                        onChange={(e) => setWizardData({ ...wizardData, conditions: e.target.value })}
                        className={inputClass}
                      />
                      <div className="flex gap-2.5">
                        <button
                          onClick={handleWizardSubmit}
                          disabled={!wizardData.name || !wizardData.conditions}
                          className="rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          Create alert
                        </button>
                        <button
                          onClick={() => setWizardStep(0)}
                          className="rounded-full px-5 py-2.5 text-sm text-vez-mute transition-colors hover:bg-white hover:text-vez-navy"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dash-card rounded-[20px] bg-vez-surface p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-base text-vez-ink">
                      <Bell className="size-4 text-vez-navy" /> Active alerts
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-vez-navy px-1.5 text-[10px] text-white">{activeAlertCount}</span>
                    </h3>
                    <Link
                      href="/dashboard/alerts"
                      className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-white hover:text-vez-navy"
                    >
                      Manage <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {alerts.filter(a => a.enabled).slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="size-2 rounded-full bg-vez-navy" />
                          <span className="text-sm text-vez-ink">{alert.name}</span>
                          <span className="rounded-full bg-vez-sky/30 px-2.5 py-0.5 text-[10px] capitalize text-vez-navy">{alert.type}</span>
                        </div>
                        <span className="text-xs text-vez-mute">{alert.matchCount} matches</span>
                      </div>
                    ))}
                    {alerts.length > 3 && (
                      <p className="pt-1 text-center text-xs text-vez-mute">+{alerts.length - 3} more alerts</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recommended notices */}
              <div className="dash-card rounded-[20px] bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base text-vez-ink">
                    <TrendingUp className="size-4 text-vez-navy" /> Recommended for you
                  </h3>
                  <Link
                    href="/notices"
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                  >
                    View all <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="space-y-1">
                  {recommendedNotices.map((notice) => (
                    <Link
                      key={notice.id}
                      href="/notices"
                      className="group -mx-2 flex items-center gap-3 rounded-[14px] border-b border-vez-line/50 px-2 py-3 transition-colors last:border-0 hover:bg-vez-surface"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vez-sky/30">
                        <FileText className="size-4 text-vez-navy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-vez-ink">{notice.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-vez-mute">{notice.organization}</span>
                          <span className="text-xs text-vez-mute/60">·</span>
                          <span className="text-xs text-vez-mute">{notice.views.toLocaleString()} views</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] capitalize text-vez-mute">{notice.category}</span>
                        {notice.priority === "high" && (
                          <span className="size-2 rounded-full bg-vez-navy" />
                        )}
                        <ArrowRight className="size-3.5 text-vez-navy opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Engagement summary */}
              <div className="dash-card rounded-[20px] bg-white p-6">
                <div className="mb-5 flex items-center gap-2.5">
                  <BarChart3 className="size-5 text-vez-navy" />
                  <h3 className="text-base text-vez-ink">This month</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Searches", value: "23", icon: Search },
                    { label: "Docs read", value: "14", icon: FileText },
                    { label: "Alerts fired", value: totalMatches.toString(), icon: Bell },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-2 rounded-[16px] bg-vez-surface p-5 text-center">
                        <div className="flex size-9 items-center justify-center rounded-full bg-white">
                          <Icon className="size-4 text-vez-navy" />
                        </div>
                        <p className="text-2xl text-vez-ink tabular-nums">{item.value}</p>
                        <p className="text-xs text-vez-mute">{item.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right — 1 col */}
            <div className="space-y-6">
              {/* Activity feed */}
              <div className="dash-card rounded-[20px] bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base text-vez-ink">
                    <Activity className="size-4 text-vez-navy" /> Activity log
                  </h3>
                  <Link
                    href="/dashboard/activity"
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                  >
                    All <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute bottom-2 left-[5px] top-2 w-px bg-vez-line" />
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="relative flex items-start gap-3 py-2.5">
                      <span className="z-10 mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-white bg-vez-sky" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-vez-ink/90">{activity.description}</p>
                        <p className="mt-1 text-xs text-vez-mute">
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
              <div className="dash-card rounded-[20px] bg-vez-surface p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base text-vez-ink">
                  <TrendingUp className="size-4 text-vez-navy" /> Quick actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { href: "/notices", label: "Browse", icon: Search },
                    { href: "/rag", label: "Doc search", icon: FileText },
                    { href: "/dashboard/alerts", label: "My alerts", icon: Bell },
                    { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
                  ].map((action) => {
                    const Icon = action.icon
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="group flex flex-col items-center gap-2.5 rounded-[16px] bg-white p-4 text-center transition-transform duration-300 hover:-translate-y-1"
                      >
                        <div className="flex size-9 items-center justify-center rounded-full bg-vez-sky/30 transition-colors group-hover:bg-vez-sky/50">
                          <Icon className="size-4 text-vez-navy" />
                        </div>
                        <span className="text-xs text-vez-ink">{action.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Notice categories */}
              <div className="dash-card rounded-[20px] bg-white p-6">
                <h3 className="mb-4 text-base text-vez-ink">Browse by category</h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Vacancies", count: 14 },
                    { label: "Tenders", count: 8 },
                    { label: "Exams", count: 11 },
                    { label: "Policy", count: 5 },
                  ].map((cat) => (
                    <Link
                      key={cat.label}
                      href="/notices"
                      className="group flex items-center gap-3 rounded-full px-3 py-2 transition-colors hover:bg-vez-surface"
                    >
                      <span className="size-2 shrink-0 rounded-full bg-vez-sky" />
                      <span className="flex-1 text-sm text-vez-ink">{cat.label}</span>
                      <span className="text-xs text-vez-mute">{cat.count}</span>
                      <ArrowRight className="size-3 text-vez-mute opacity-0 transition-opacity group-hover:opacity-100" />
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
