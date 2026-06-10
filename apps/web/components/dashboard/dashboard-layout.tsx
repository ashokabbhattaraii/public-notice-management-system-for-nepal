"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Bookmark,
  Bell,
  Clock,
  Settings,
  Menu,
  X,
  ArrowLeft,
  FileSearch,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"

const navGroups = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "My Content",
    links: [
      { href: "/dashboard/saved", label: "Saved Notices", icon: Bookmark },
      { href: "/dashboard/alerts", label: "My Alerts", icon: Bell, badge: true },
      { href: "/rag", label: "Document Search", icon: FileSearch },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/dashboard/activity", label: "Activity", icon: Clock },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
]

function SidebarContent({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  const { user } = useAuth()
  const { alerts } = useAlerts()
  const activeAlerts = alerts.filter(a => a.enabled).length

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tactical back button */}
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <Link href="/" onClick={onLinkClick}>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground hover:text-indigo-500 hover:bg-accent h-9 text-xs font-mono uppercase tracking-wide">
            <ArrowLeft className="size-4" />
            Back to Site
          </Button>
        </Link>
      </div>

      {/* Tactical nav groups */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm transition-all group relative",
                      isActive
                        ? "bg-indigo-500/10 text-indigo-400 font-semibold border-l-2 border-indigo-500"
                        : "text-muted-foreground hover:text-indigo-500 hover:bg-accent border-l-2 border-transparent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 font-mono uppercase tracking-wide">{link.label}</span>
                    {"badge" in link && link.badge && activeAlerts > 0 && (
                      <Badge className="h-4 px-1.5 text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        {activeAlerts}
                      </Badge>
                    )}
                    {isActive && <ChevronRight className="size-3.5 opacity-70" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Tactical user profile footer */}
      {user && (
        <div className="p-3 border-t border-border">
          <div className="relative flex items-center gap-3 px-2 py-2 bg-card border border-border">
            <div className="absolute top-0 left-0 w-1 h-1 bg-indigo-500" />
            <div className="size-8 bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-400">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{user.username}</p>
              <p className="text-[10px] text-muted-foreground capitalize font-mono uppercase tracking-wide">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Button
          size="icon"
          className="size-12 rounded-full shadow-lg"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Tactical mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-background border-r border-border shadow-xl">
            <div className="flex items-center justify-end p-2 border-b border-border">
              <Button variant="ghost" size="icon" className="size-7 hover:bg-accent" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <SidebarContent pathname={pathname} onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Tactical desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-background shrink-0">
        <SidebarContent pathname={pathname} />
      </aside>

      <main className="flex-1 overflow-auto bg-background">
        <div className="p-5 md:p-7">
          {children}
        </div>
      </main>
    </div>
  )
}
