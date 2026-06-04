"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Bell, Menu, X, Globe, LogOut, LayoutDashboard, Shield, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"

export function Header() {
  const { user, logout } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()
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

        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center shrink-0 group">
            <div className="dark:bg-white dark:rounded-lg dark:px-2 dark:py-1 transition-all">
              <Image
                src="/images/logo1.png"
                alt="Suchana AI — Nepal Public Notice Platform"
                width={160}
                height={56}
                priority
                className="h-10 w-auto object-contain transition-opacity group-hover:opacity-80"
              />
            </div>
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

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="size-9"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ne" : "en")}
            className="hidden md:flex gap-1.5 h-9 px-2.5"
          >
            <Globe className="size-3.5" />
            <span className="text-xs font-medium">{language === "en" ? "EN" : "ने"}</span>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" size="icon" className="relative size-9">
                <Bell className="size-4" />
                <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                  3
                </span>
              </Button>

              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="icon" className="size-9">
                    <Shield className="size-4" />
                  </Button>
                </Link>
              )}

              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="size-9">
                  <LayoutDashboard className="size-4" />
                </Button>
              </Link>

              <div className="hidden md:flex items-center gap-2 ml-1.5 pl-2.5 border-l border-border">
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {user.username[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-sm leading-none">
                  <p className="font-medium">{user.username}</p>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-0.5 h-4">
                    {user.role}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="size-8 ml-0.5">
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2 ml-1">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-9">{t("nav.login")}</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="h-9">{t("nav.signup")}</Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-9"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
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
                <button
                  onClick={() => { logout(); setMobileOpen(false) }}
                  className="px-4 py-2.5 rounded-md text-sm text-left text-destructive hover:bg-destructive/10"
                >
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
