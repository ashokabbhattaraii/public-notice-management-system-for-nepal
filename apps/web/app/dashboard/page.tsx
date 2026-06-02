"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Eye,
  Bookmark,
  Bell,
  Clock,
  TrendingUp,
  FileText,
  Search,
  ArrowRight,
  AlertCircle,
  Plus,
  Zap,
  CheckCircle,
  Sparkles,
  FolderOpen,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"
import { mockNotices, mockActivities } from "@/lib/mock-data"
import gsap from "gsap"

function ProgressRing({ value, max, size = 56, strokeWidth = 5, color = "text-primary" }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string
}) {
  const ringRef = useRef<SVGCircleElement>(null)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = Math.min(value / max, 1)

  useEffect(() => {
    if (ringRef.current) {
      gsap.fromTo(ringRef.current,
        { strokeDashoffset: circumference },
        { strokeDashoffset: circumference * (1 - progress), duration: 1.2, ease: "power2.out", delay: 0.3 }
      )
    }
  }, [circumference, progress])

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
        className="stroke-border" />
      <circle ref={ringRef} cx={size / 2} cy={size / 2} r={radius} fill="none"
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference}
        className={`stroke-current ${color}`} />
    </svg>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { alerts, addAlert } = useAlerts()
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardData, setWizardData] = useState({ name: "", type: "keyword" as "keyword" | "category" | "organization", conditions: "" })
  const bento = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bento.current) return
    const cards = bento.current.querySelectorAll(".bento-card")
    gsap.fromTo(cards,
      { opacity: 0, y: 20, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }
    )
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
              <p className="text-muted-foreground mb-4">Please sign in to access your dashboard</p>
              <Link href="/login"><Button>Sign In</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const hasAlerts = alerts.length > 0
  const recommendedNotices = mockNotices.slice(0, 3)
  const recentActivities = mockActivities.slice(0, 4)

  const activityIcon = (type: string) => {
    switch (type) {
      case "view": return <Eye className="size-3.5 text-blue-500" />
      case "save": return <Bookmark className="size-3.5 text-amber-500" />
      case "alert": return <Bell className="size-3.5 text-red-500" />
      case "search": return <Search className="size-3.5 text-emerald-500" />
      case "document": return <FileText className="size-3.5 text-purple-500" />
      default: return <Clock className="size-3.5 text-muted-foreground" />
    }
  }

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
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Welcome back, <span className="text-primary">{user.username}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your personalized notice command center</p>
        </div>

        {/* Bento Grid */}
        <div ref={bento} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min">

          {/* Stat: Notices Viewed - large */}
          <div className="bento-card col-span-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4">
            <ProgressRing value={47} max={100} color="text-blue-500" />
            <div>
              <p className="text-2xl font-bold">47</p>
              <p className="text-xs text-muted-foreground">Notices Viewed</p>
              <p className="text-[10px] text-blue-500 mt-0.5">+12 this week</p>
            </div>
          </div>

          {/* Stat: Saved */}
          <div className="bento-card col-span-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4">
            <ProgressRing value={8} max={20} color="text-amber-500" />
            <div>
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-muted-foreground">Saved Notices</p>
              <p className="text-[10px] text-amber-500 mt-0.5">+2 new</p>
            </div>
          </div>

          {/* Stat: Alerts */}
          <div className="bento-card col-span-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4">
            <ProgressRing value={alerts.filter(a => a.enabled).length} max={10} color="text-red-500" />
            <div>
              <p className="text-2xl font-bold">{alerts.filter(a => a.enabled).length}</p>
              <p className="text-xs text-muted-foreground">Active Alerts</p>
              <p className="text-[10px] text-red-500 mt-0.5">{alerts.reduce((s, a) => s + a.matchCount, 0)} matches</p>
            </div>
          </div>

          {/* Stat: Member */}
          <div className="bento-card col-span-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4">
            <ProgressRing value={1} max={1} color="text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</p>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-[10px] text-emerald-500 mt-0.5 capitalize">{user.role}</p>
            </div>
          </div>

          {/* Inline Alert Wizard - spans 2 cols */}
          {!hasAlerts ? (
            <div className="bento-card md:col-span-2 lg:col-span-2 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Set up your first alert</h3>
                  <p className="text-[11px] text-muted-foreground">3 quick steps to never miss a notice</p>
                </div>
              </div>

              {wizardStep === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Choose what to track:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "keyword" as const, label: "Keywords", icon: Search },
                      { id: "category" as const, label: "Category", icon: FolderOpen },
                      { id: "organization" as const, label: "Organization", icon: Building2 },
                    ].map((t) => {
                      const Icon = t.icon
                      return (
                        <button key={t.id}
                          onClick={() => { setWizardData({ ...wizardData, type: t.id }); setWizardStep(1) }}
                          className="p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
                        >
                          <Icon className="size-4 mx-auto mb-1 text-primary" />
                          <span className="text-[11px] font-medium">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-3">
                  <Input
                    placeholder="Alert name (e.g. Section Officer Updates)"
                    value={wizardData.name}
                    onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder={wizardData.type === "keyword" ? "Keywords: section officer, PSC" : wizardData.type === "category" ? "Categories: exams, vacancies" : "Orgs: Nepal Rastra Bank"}
                    value={wizardData.conditions}
                    onChange={(e) => setWizardData({ ...wizardData, conditions: e.target.value })}
                    className="h-8 text-sm"
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
            /* Alert Summary when alerts exist */
            <div className="bento-card md:col-span-2 lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Bell className="size-4 text-primary" /> Active Alerts
                </h3>
                <Link href="/dashboard/alerts">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Manage <ArrowRight className="size-3" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {alerts.filter(a => a.enabled).slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-3.5 text-green-500" />
                      <span className="text-xs font-medium">{alert.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{alert.matchCount}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Notices - spans 2 cols */}
          <div className="bento-card md:col-span-2 lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Recommended
              </h3>
              <Link href="/notices">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  All Notices <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {recommendedNotices.map((notice) => (
                <div key={notice.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors">
                  <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="size-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{notice.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{notice.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{notice.views.toLocaleString()} views</span>
                    </div>
                  </div>
                  {notice.priority === "high" && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">Urgent</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed - spans 2 cols on medium */}
          <div className="bento-card md:col-span-1 lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Recent Activity
              </h3>
              <Link href="/dashboard/activity">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  All <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2.5">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2.5">
                  <div className="size-6 rounded-full bg-accent/60 flex items-center justify-center shrink-0 mt-0.5">
                    {activityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] leading-relaxed truncate">{activity.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bento-card md:col-span-1 lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/notices">
                <div className="p-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center cursor-pointer">
                  <Search className="size-4 mx-auto mb-1 text-primary" />
                  <span className="text-[11px] font-medium">Browse</span>
                </div>
              </Link>
              <Link href="/rag">
                <div className="p-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center cursor-pointer">
                  <FileText className="size-4 mx-auto mb-1 text-primary" />
                  <span className="text-[11px] font-medium">Doc Search</span>
                </div>
              </Link>
              <Link href="/dashboard/alerts">
                <div className="p-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center cursor-pointer">
                  <Bell className="size-4 mx-auto mb-1 text-primary" />
                  <span className="text-[11px] font-medium">Alerts</span>
                </div>
              </Link>
              <Link href="/dashboard/saved">
                <div className="p-3 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-center cursor-pointer">
                  <Bookmark className="size-4 mx-auto mb-1 text-primary" />
                  <span className="text-[11px] font-medium">Saved</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  )
}
