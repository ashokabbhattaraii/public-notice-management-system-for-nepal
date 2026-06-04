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
    <div className="flex flex-col h-full">
      {/* Back to site */}
      <div className="px-3 pt-3 pb-2 border-b border-border/60">
        <Link href="/" onClick={onLinkClick}>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs">
            <ArrowLeft className="size-3.5" />
            Back to Site
          </Button>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{link.label}</span>
                    {"badge" in link && link.badge && activeAlerts > 0 && (
                      <Badge className="h-4 px-1.5 text-[10px] rounded-full bg-primary text-primary-foreground">
                        {activeAlerts}
                      </Badge>
                    )}
                    {isActive && <ChevronRight className="size-3 opacity-50" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      {user && (
        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-accent/40">
            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.username}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
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

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-card border-r border-border shadow-xl">
            <div className="flex items-center justify-end p-2 border-b border-border/60">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <SidebarContent pathname={pathname} onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card/50 shrink-0">
        <SidebarContent pathname={pathname} />
      </aside>

      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="p-5 md:p-7">
          {children}
        </div>
      </main>
    </div>
  )
}
