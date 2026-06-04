"use client"

import React, { useRef, useEffect } from "react"
import {
  Newspaper,
  Search,
  Bell,
  Home,
  Settings,
  Eye,
  Clock,
  ChevronRight,
  LayoutDashboard,
  FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import gsap from "gsap"
import { mockNotices } from "@/lib/mock-data"

const recentNotices = mockNotices.slice(0, 6)

const sidebarItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Newspaper, label: "Notices", href: "/notices", active: true },
  { icon: Search, label: "Search", href: "/rag" },
  { icon: Bell, label: "Alerts", href: "/signup" },
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
]

export function NoticesDashboardMockup() {
  const windowRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!windowRef.current) return

    gsap.set(windowRef.current, { opacity: 0, y: 48, scale: 0.97 })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          gsap.to(windowRef.current, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "power3.out",
          })

          if (rowsRef.current) {
            gsap.fromTo(
              Array.from(rowsRef.current.children),
              { opacity: 0, x: -16 },
              {
                opacity: 1,
                x: 0,
                duration: 0.5,
                stagger: 0.08,
                ease: "power2.out",
                delay: 0.4,
              }
            )
          }

          observer.disconnect()
        })
      },
      { threshold: 0.15 }
    )

    observer.observe(windowRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={windowRef}
      className="w-full rounded-xl border border-border shadow-2xl overflow-hidden bg-background"
      style={{ boxShadow: "0 32px 80px -16px rgba(0,0,0,0.18), 0 0 0 1px hsl(var(--border))" }}
    >
      {/* ── Title bar ── */}
      <div className="flex items-center justify-between px-4 h-10 bg-muted/60 border-b border-border select-none">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-red-400/80 dark:bg-red-500/70" />
          <span className="size-3 rounded-full bg-yellow-400/80 dark:bg-yellow-500/70" />
          <span className="size-3 rounded-full bg-green-400/80 dark:bg-green-500/70" />
        </div>

        {/* Window title */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="size-3.5" />
          GovNotice — Dashboard
        </div>

        {/* Spacer */}
        <div className="w-14" />
      </div>

      {/* ── Window body ── */}
      <div className="flex" style={{ height: "420px" }}>

        {/* ── Sidebar ── */}
        <div className="hidden sm:flex w-44 flex-col border-r border-border bg-muted/20 shrink-0">
          {/* App logo */}
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center">
              <FileText className="size-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">GovNotice</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 p-2 flex-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    item.active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </div>
              )
            })}
          </nav>

          {/* Bottom settings */}
          <div className="p-2 border-t border-border">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors">
              <Settings className="size-4 shrink-0" />
              Settings
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Content header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/60 shrink-0">
            <div className="flex items-center gap-2">
              <Newspaper className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Latest Notices</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-[10px] h-5 px-1.5">
                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {mockNotices.length} total
              </Badge>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-muted/10 shrink-0">
            {["All", "Urgent", "Tenders", "Exams", "Jobs"].map((tab, i) => (
              <span
                key={tab}
                className={`text-[11px] px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  i === 0
                    ? "bg-background border border-border text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>

          {/* Notices list */}
          <div ref={rowsRef} className="flex-1 overflow-y-auto divide-y divide-border/60">
            {recentNotices.map((notice, i) => (
              <Link key={notice.id} href="/notices" className="block group">
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40 transition-colors">
                  {/* Row number */}
                  <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Badges + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <Badge
                        variant={notice.priority === "high" ? "default" : "secondary"}
                        className="text-[9px] px-1.5 py-0 h-4"
                      >
                        {notice.category}
                      </Badge>
                      {notice.priority === "high" && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                          Urgent
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">{notice.organization}</span>
                    </div>
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                      {notice.title}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Eye className="size-2.5" />
                      {notice.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {new Date(notice.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-muted/10 shrink-0">
            <span className="text-[10px] text-muted-foreground">
              Showing {recentNotices.length} of {mockNotices.length} notices
            </span>
            <Link href="/notices">
              <span className="text-[10px] text-primary hover:underline cursor-pointer font-medium">
                View all →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
