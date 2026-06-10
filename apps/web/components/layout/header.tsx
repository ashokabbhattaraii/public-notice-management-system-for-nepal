"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/ui/logo"
import { Bell, Menu, X, Globe, LogOut, LayoutDashboard, Shield, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header() {
  const { user, logout } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isHomePage = pathname === "/"

  const mainNavLinks = isHomePage
    ? [
        { href: "/", label: "Home", scroll: false },
        { href: "#problem", label: "Problem", scroll: true },
        { href: "#solution", label: "Solution", scroll: true },
        { href: "#features", label: "Features", scroll: true },
        { href: "#about", label: "About Us", scroll: true },
        { href: "#contact", label: "Contact", scroll: true },
      ]
    : [
        { href: "/", label: "Home", scroll: false },
        { href: "/#problem", label: "Problem", scroll: false },
        { href: "/#solution", label: "Solution", scroll: false },
        { href: "/#features", label: "Features", scroll: false },
        { href: "/#about", label: "About Us", scroll: false },
        { href: "/#contact", label: "Contact", scroll: false },
      ]

  const utilityLinks = [
    { href: "/notices", label: "Notices" },
    { href: "/rag", label: "Documents" },
  ]

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, scroll?: boolean) => {
    if (scroll && href.startsWith("#")) {
      if (isHomePage) {
        e.preventDefault()
        const element = document.querySelector(href)
        if (element) {
          const offset = 80
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          window.scrollTo({ top: elementPosition - offset, behavior: "smooth" })
        }
      }
      // If not on homepage, the Link href="#section" won't work, so we need full path
      setMobileOpen(false)
    }
  }

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "bg-background/95 backdrop-blur-xl shadow-sm"
            : "bg-background/80 backdrop-blur-md"
        )}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border/50" />

        <div className="relative max-w-[1480px] mx-auto flex items-center justify-between h-16 lg:h-[4.5rem] px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="relative shrink-0">
            <Logo size="sm" />
          </Link>

          {/* Desktop Navigation — only visible on lg+ */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3">
            {/* Main nav */}
            <nav className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-card border border-border shadow-sm">
              {mainNavLinks.map((link) => {
                const isActive = link.scroll ? false : pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href, link.scroll)}
                    className={cn(
                      "px-3 xl:px-4 py-1.5 text-[13px] font-medium rounded-full transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            {/* Utility links */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-card border border-border shadow-sm">
              {utilityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 xl:px-4 py-1.5 text-[13px] font-medium rounded-full transition-all duration-200 whitespace-nowrap",
                    pathname === link.href
                      ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-card border border-border shadow-sm">
              {/* Language */}
              <button
                onClick={() => setLanguage(language === "en" ? "ne" : "en")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-full hover:bg-accent transition-colors"
              >
                <Globe className="size-3.5" />
                <span className="font-semibold">{language === "en" ? "EN" : "ने"}</span>
              </button>

              {/* Theme */}
              <ThemeToggle />

              {user ? (
                <>
                  <Button variant="ghost" size="icon" className="relative size-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full">
                    <Bell className="size-4" />
                    <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-indigo-600 text-[9px] text-white flex items-center justify-center font-bold">
                      3
                    </span>
                  </Button>

                  {user.role === "admin" && (
                    <Link href="/admin">
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full">
                        <Shield className="size-4" />
                      </Button>
                    </Link>
                  )}

                  <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full">
                      <LayoutDashboard className="size-4" />
                    </Button>
                  </Link>

                  {/* Avatar + logout */}
                  <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border">
                    <div className="size-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-white">{user.username[0].toUpperCase()}</span>
                    </div>
                    <div className="hidden xl:block text-sm leading-none">
                      <p className="font-medium text-foreground">{user.username}</p>
                      <Badge className="text-[9px] px-1.5 py-0 h-3.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 rounded-full mt-0.5">
                        {user.role}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={logout} className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                      <LogOut className="size-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <Link href="/login">
                  <button className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm">
                    <span>Get Started</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button — visible below lg */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Quick actions on mobile */}
            {user && (
              <Button variant="ghost" size="icon" className="relative size-9 text-muted-foreground hover:text-foreground rounded-full">
                <Bell className="size-4" />
                <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-indigo-600 text-[8px] text-white flex items-center justify-center font-bold">
                  3
                </span>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-foreground hover:bg-accent rounded-full"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-300 ease-out",
            mobileOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="border-t border-border bg-background/98 backdrop-blur-xl">
            <nav className="max-w-[1480px] mx-auto flex flex-col px-4 sm:px-6 py-3 gap-0.5 max-h-[75vh] overflow-y-auto">
              {/* Nav links */}
              {mainNavLinks.map((link) => {
                const isActive = link.scroll ? false : pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      handleNavClick(e, link.href, link.scroll)
                      setMobileOpen(false)
                    }}
                    className={cn(
                      "px-4 py-3 rounded-lg text-[15px] font-medium transition-colors",
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}

              <div className="h-px my-2 bg-border" />

              {/* Utility */}
              {utilityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-[15px] font-medium transition-colors",
                    pathname === link.href
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <div className="h-px my-2 bg-border" />

              {/* Settings row */}
              <div className="flex items-center gap-3 px-4 py-2">
                <button
                  onClick={() => setLanguage(language === "en" ? "ne" : "en")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <Globe className="size-4" />
                  <span className="font-medium">{language === "en" ? "EN" : "ने"}</span>
                </button>
              </div>

              <div className="h-px my-2 bg-border" />

              {/* User section */}
              {user ? (
                <>
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{user.username[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.username}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                    </div>
                  </div>

                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-lg text-[15px] font-medium text-foreground hover:bg-accent transition-colors">
                    Dashboard
                  </Link>
                  {user.role === "admin" && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-lg text-[15px] font-medium text-foreground hover:bg-accent transition-colors">
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false) }}
                    className="px-4 py-3 rounded-lg text-[15px] font-medium text-left text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="px-3 py-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <button className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                      <span>Get Started</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-16 lg:h-[4.5rem]" aria-hidden="true" />
    </>
  )
}
