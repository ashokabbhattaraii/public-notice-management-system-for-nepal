"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Menu, X, Globe, LogOut, LayoutDashboard, Shield, ArrowUpRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"

const sectionLinks = [
  { id: "#problem", label: "Problem" },
  { id: "#solution", label: "Solution" },
  { id: "#features", label: "Features" },
  { id: "#about", label: "About" },
  { id: "#contact", label: "Contact" },
]

const utilityLinks = [
  { href: "/notices", label: "Notices" },
  { href: "/rag", label: "Documents" },
]

export function Header() {
  const { user, logout } = useAuth()
  const { language, setLanguage } = useLanguage()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isHome = pathname === "/"
  // Transparent over the sky hero at the top of the home page; frosted white everywhere else
  const solid = !isHome || scrolled || mobileOpen

  // Same menu on every page: section anchors resolve to /#section off the home page
  const navLinks = [
    ...sectionLinks.map((s) => ({ href: isHome ? s.id : `/${s.id}`, label: s.label, anchor: true })),
    ...utilityLinks.map((u) => ({ ...u, anchor: false })),
  ]

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, anchor: boolean) => {
    if (anchor && isHome && href.startsWith("#")) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) {
        const top = element.getBoundingClientRect().top + window.pageYOffset - 88
        window.scrollTo({ top, behavior: "smooth" })
      }
    }
    setMobileOpen(false)
  }

  const isActive = (link: { href: string; anchor: boolean }) =>
    !link.anchor && pathname === link.href

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-colors duration-300",
          solid
            ? "bg-white/90 backdrop-blur-[6px] border-b border-vez-line"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-6 md:px-8 lg:px-12">
          {/* Brand — text mark per spec */}
          <Link href="/" className="shrink-0 text-base text-vez-ink">
            Suchana<span className="text-vez-navy font-medium">&nbsp;AI</span>
          </Link>

          {/* Frosted pill nav */}
          <nav
            className={cn(
              "hidden lg:flex items-center gap-1 rounded-full p-2 backdrop-blur-[6px] transition-colors duration-300",
              solid ? "bg-vez-surface" : "bg-white/10"
            )}
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.anchor)}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-base transition-colors",
                  isActive(link)
                    ? "bg-vez-navy text-white"
                    : "text-vez-ink hover:bg-white/60"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === "en" ? "ne" : "en")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base text-vez-ink transition-colors hover:bg-white/60"
            >
              <Globe className="size-4" />
              {language === "en" ? "EN" : "ने"}
            </button>

            {user ? (
              <>
                <button
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full text-vez-ink/70 transition-colors hover:text-vez-navy",
                    solid ? "hover:bg-vez-surface" : "hover:bg-white/40"
                  )}
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-vez-navy text-[9px] text-white">
                    3
                  </span>
                </button>

                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full text-vez-ink/70 transition-colors hover:text-vez-navy",
                      solid ? "hover:bg-vez-surface" : "hover:bg-white/40"
                    )}
                    aria-label="Admin panel"
                  >
                    <Shield className="size-4" />
                  </Link>
                )}

                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>

                <div className="ml-1 flex items-center gap-2 border-l border-vez-ink/15 pl-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-vez-sky">
                    <span className="text-sm text-vez-navy">{user.username[0].toUpperCase()}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex size-9 items-center justify-center rounded-full text-vez-ink/60 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
              >
                Sign in
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            {user && (
              <button className="relative flex size-10 items-center justify-center rounded-full bg-white/40 text-vez-ink backdrop-blur-[6px]" aria-label="Notifications">
                <Bell className="size-4" />
                <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-vez-navy text-[8px] text-white">
                  3
                </span>
              </button>
            )}
            <button
              className="flex size-10 items-center justify-center rounded-full bg-white/40 text-vez-ink backdrop-blur-[6px]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "lg:hidden overflow-hidden transition-all duration-300",
            mobileOpen ? "max-h-[85vh]" : "max-h-0"
          )}
        >
          <nav className="flex max-h-[75vh] flex-col gap-1 overflow-y-auto border-t border-vez-line bg-white px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.anchor)}
                className={cn(
                  "rounded-[12px] px-4 py-3 text-base transition-colors",
                  isActive(link) ? "bg-vez-navy text-white" : "text-vez-ink hover:bg-vez-surface"
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-vez-line" />

            <button
              onClick={() => setLanguage(language === "en" ? "ne" : "en")}
              className="flex items-center gap-2 rounded-[12px] px-4 py-3 text-base text-vez-ink hover:bg-vez-surface"
            >
              <Globe className="size-4" />
              {language === "en" ? "English" : "नेपाली"}
            </button>

            <div className="my-2 h-px bg-vez-line" />

            {user ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vez-sky">
                    <span className="text-sm text-vez-navy">{user.username[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-base text-vez-ink">{user.username}</p>
                    <p className="text-sm capitalize text-vez-mute">{user.role}</p>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-[12px] px-4 py-3 text-base text-vez-ink hover:bg-vez-surface"
                >
                  Dashboard
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-[12px] px-4 py-3 text-base text-vez-ink hover:bg-vez-surface"
                  >
                    Admin panel
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout()
                    setMobileOpen(false)
                  }}
                  className="rounded-[12px] px-4 py-3 text-left text-base text-red-600 hover:bg-red-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white"
              >
                Sign in
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Spacer — only off the home page; the hero supplies its own top padding under the transparent header */}
      {!isHome && <div className="h-20" aria-hidden="true" />}
    </>
  )
}
