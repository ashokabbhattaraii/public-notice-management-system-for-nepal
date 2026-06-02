"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileText,
  Bell,
  User,
  Menu,
  X,
  Globe,
  LogOut,
  LayoutDashboard,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"

export function Header() {
  const { user, logout } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/notices", label: t("nav.notices") },
    { href: "/rag", label: t("nav.rag") },
    { href: "/about", label: t("nav.about") },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-xl bg-background/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="size-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
              GovNotice
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === link.href
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ne" : "en")}
            className="hidden md:flex gap-1.5"
          >
            <Globe className="size-4" />
            <span className="text-xs font-medium">{language === "en" ? "EN" : "ने"}</span>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-4" />
                <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold">
                  3
                </span>
              </Button>

              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="icon">
                    <Shield className="size-4" />
                  </Button>
                </Link>
              )}

              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <LayoutDashboard className="size-4" />
                </Button>
              </Link>

              <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-border">
                <div className="size-8 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {user.username[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-medium leading-none">{user.username}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {user.role}
                    </Badge>
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="ml-1">
                  <LogOut className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">{t("nav.login")}</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">{t("nav.signup")}</Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-4 py-2.5 rounded-md text-sm transition-colors",
                  pathname === link.href
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent">
                  {t("nav.dashboard")}
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent">
                    {t("nav.admin")}
                  </Link>
                )}
                <button onClick={() => { logout(); setMobileOpen(false) }} className="px-4 py-2.5 rounded-md text-sm text-left text-destructive hover:bg-destructive/10">
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <div className="flex gap-2 px-4 pt-2">
                <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">{t("nav.login")}</Button>
                </Link>
                <Link href="/signup" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">{t("nav.signup")}</Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
