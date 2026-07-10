"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Bell, Menu, X, Globe, LogOut, LayoutDashboard, Shield, ArrowUpRight, ChevronDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { cn } from "@/lib/utils"

const productLinks = [
  { id: "#problem", tKey: "nav.product.problem" },
  { id: "#solution", tKey: "nav.product.solution" },
  { id: "#features", tKey: "nav.product.features" },
]

const resourceLinks = [
  { href: "/notices", tKey: "nav.notices" },
  { href: "/documents", tKey: "nav.rag" },
]

const standaloneLinks = [
  { id: "#pricing", tKey: "nav.pricing", anchor: true },
  { href: "/about", tKey: "nav.about", anchor: false },
]

function Dropdown({ label, children, solid }: { label: string; children: React.ReactNode; solid: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-base transition-colors",
          "text-vez-ink hover:bg-white/60"
        )}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn(
          "absolute top-full left-0 mt-2 min-w-[160px] rounded-xl border p-1.5 shadow-lg backdrop-blur-xl",
          solid ? "bg-white/90 border-white/60" : "bg-white/80 border-white/40"
        )}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { user, logout } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isHome = pathname === "/"
  const solid = !isHome || scrolled || mobileOpen

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


  const isActive = (href: string, anchor: boolean) =>
    !anchor && pathname === href

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
          solid
            ? "bg-white/60 backdrop-blur-xl border-b border-white/50 shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-6 md:px-8 lg:px-12">
          {/* Brand */}
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="Suchana AI"
              width={220}
              height={220}
              className="h-16 w-auto sm:h-[72px]"
              priority
            />
          </Link>

          {/* Frosted pill nav */}
          <nav
            className={cn(
              "hidden lg:flex items-center gap-1 rounded-full p-2 backdrop-blur-md border transition-all duration-300",
              solid ? "bg-white/40 border-white/50" : "bg-white/10 border-white/20"
            )}
          >
            <Dropdown label={t("nav.product")} solid={solid}>
              {productLinks.map((link) => (
                <Link
                  key={link.tKey}
                  href={isHome ? link.id : `/${link.id}`}
                  onClick={(e) => handleNavClick(e, isHome ? link.id : `/${link.id}`, true)}
                  className="block rounded-lg px-3 py-2 text-base text-vez-ink transition-colors hover:bg-vez-sky/40"
                >
                  {t(link.tKey)}
                </Link>
              ))}
            </Dropdown>

            {resourceLinks.map((link) => (
              <Link
                key={link.tKey}
                href={link.href}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-base transition-colors",
                  isActive(link.href, false)
                    ? "bg-vez-navy text-white"
                    : "text-vez-ink hover:bg-white/60"
                )}
              >
                {t(link.tKey)}
              </Link>
            ))}

            {standaloneLinks.map((link) => {
              const href = link.anchor ? (isHome ? link.id! : `/${link.id}`) : link.href!
              return (
                <Link
                  key={link.tKey}
                  href={href}
                  onClick={(e) => handleNavClick(e, href, link.anchor)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-4 py-1.5 text-base transition-colors",
                    isActive(href, link.anchor)
                      ? "bg-vez-navy text-white"
                      : "text-vez-ink hover:bg-white/60"
                  )}
                >
                  {t(link.tKey)}
                </Link>
              )
            })}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Link
              href="/contact"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 text-base font-medium transition-all",
                pathname === "/contact"
                  ? "bg-vez-navy text-white"
                  : "bg-vez-navy/10 text-vez-navy border border-vez-navy/10 hover:bg-vez-navy hover:text-white hover:border-vez-navy"
              )}
            >
              {t("nav.contact")}
              <ArrowUpRight className="size-3.5" />
            </Link>

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
                  {t("nav.dashboard")}
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
                {t("nav.signin")}
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => alert("🔔 Notify button clicked! (dummy test)")}
              className="flex size-10 items-center justify-center rounded-full bg-vez-navy/10 text-vez-navy backdrop-blur-[6px]"
              aria-label="Notify"
            >
              <Bell className="size-4" />
            </button>
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
            <p className="px-4 py-1 text-xs font-medium uppercase tracking-wider text-vez-mute">{t("nav.product")}</p>
            {productLinks.map((link) => {
              const href = isHome ? link.id : `/${link.id}`
              return (
                <Link
                  key={link.tKey}
                  href={href}
                  onClick={(e) => handleNavClick(e, href, true)}
                  className="rounded-[12px] px-4 py-3 text-base text-vez-ink transition-colors hover:bg-vez-surface"
                >
                  {t(link.tKey)}
                </Link>
              )
            })}

            <div className="my-2 h-px bg-vez-line" />

            {resourceLinks.map((link) => (
              <Link
                key={link.tKey}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-[12px] px-4 py-3 text-base transition-colors",
                  isActive(link.href, false) ? "bg-vez-navy text-white" : "text-vez-ink hover:bg-vez-surface"
                )}
              >
                {t(link.tKey)}
              </Link>
            ))}

            <div className="my-2 h-px bg-vez-line" />

            {standaloneLinks.map((link) => {
              const href = link.anchor ? (isHome ? link.id! : `/${link.id}`) : link.href!
              return (
                <Link
                  key={link.tKey}
                  href={href}
                  onClick={(e) => handleNavClick(e, href, link.anchor)}
                  className={cn(
                    "rounded-[12px] px-4 py-3 text-base transition-colors",
                    isActive(href, link.anchor) ? "bg-vez-navy text-white" : "text-vez-ink hover:bg-vez-surface"
                  )}
                >
                  {t(link.tKey)}
                </Link>
              )
            })}

            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "rounded-[12px] px-4 py-3 text-base transition-colors",
                pathname === "/contact" ? "bg-vez-navy text-white" : "text-vez-ink hover:bg-vez-surface"
              )}
            >
              {t("nav.contact")}
            </Link>

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
                  {t("nav.dashboard")}
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-[12px] px-4 py-3 text-base text-vez-ink hover:bg-vez-surface"
                  >
                    {t("nav.adminPanel")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout()
                    setMobileOpen(false)
                  }}
                  className="rounded-[12px] px-4 py-3 text-left text-base text-red-600 hover:bg-red-50"
                >
                  {t("nav.signout")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white"
              >
                {t("nav.signin")}
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Spacer - only off the home page; the hero supplies its own top padding under the transparent header */}
      {!isHome && <div className="h-20" aria-hidden="true" />}
    </>
  )
}
