"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/ui/logo"
import {
  LayoutDashboard, FileText, FolderOpen, Users, Globe,
  Settings, ArrowLeft, Menu, X, Link2, Bell, ChevronRight,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { mockScrapingSources } from "@/lib/mock-data"

const navGroups = [
  {
    label: "Overview",
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/notices", label: "Notices", icon: FileText },
      { href: "/admin/categories", label: "Categories", icon: FolderOpen },
      { href: "/admin/sources", label: "Sources", icon: Link2 },
    ],
  },
  {
    label: "Automation",
    links: [
      { href: "/admin/scraping", label: "Web Scraping", icon: Globe, errorBadge: true },
      { href: "/admin/alerts", label: "Alert Channels", icon: Bell },
    ],
  },
  {
    label: "Administration",
    links: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/system", label: "System", icon: Settings },
    ],
  },
]

function SidebarContent({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  const { user } = useAuth()
  const errorSources = mockScrapingSources.filter(s => s.status === "error").length

  return (
    <div className="flex flex-col h-full">
      {/* Brand + back */}
      <div className="px-3 pt-3 pb-2 border-b border-border/60">
        <div className="px-1 py-1.5 mb-1">
          <Logo size="sm" />
          <div className="flex items-center gap-1.5 mt-1.5 pl-0.5">
            <Shield className="size-3 text-primary" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>
        <Link href="/" onClick={onLinkClick}>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground hover:text-foreground h-7 text-[11px]">
            <ArrowLeft className="size-3" />
            Back to Site
          </Button>
        </Link>
      </div>

      {/* Nav */}
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
                const hasError = "errorBadge" in link && link.errorBadge && errorSources > 0
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
                    {hasError && (
                      <Badge className="h-4 px-1.5 text-[9px] rounded-full bg-destructive text-destructive-foreground">
                        {errorSources}
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

      {/* Admin profile footer */}
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
              <div className="flex items-center gap-1 mt-0.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] text-muted-foreground">Admin</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile toggle */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Button size="icon" className="size-12 rounded-full shadow-lg" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Mobile overlay */}
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
