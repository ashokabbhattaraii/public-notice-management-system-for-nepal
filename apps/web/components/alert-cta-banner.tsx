"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Bell, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"
import { usePathname } from "next/navigation"
import gsap from "gsap"

const DISMISS_STORAGE_KEY = "alertCtaDismissed"

export function AlertCtaBanner() {
  const { user } = useAuth()
  const { alerts } = useAlerts()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  // Load dismissed state once (prevents remount/reset issues)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(DISMISS_STORAGE_KEY)
      if (v === "1") setDismissed(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (bannerRef.current && !dismissed) {
      gsap.fromTo(
        bannerRef.current,
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 5 }
      )
    }
  }, [dismissed])

  // Don't show on admin pages, dashboard, login/signup, or if user already has alerts
  const hideOnPaths = ["/admin", "/dashboard", "/login", "/login", "/rag"]
  const shouldHide = hideOnPaths.some(p => pathname.startsWith(p))
  if (shouldHide) return null
  if (dismissed) return null
  if (user && alerts.length > 0) return null

  return (
    <div
      ref={bannerRef}
      className="fixed bottom-20 left-4 right-20 md:left-auto md:right-24 md:w-[380px] z-50 opacity-0"
    >
      <div className="rounded-xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <button
          onClick={() => {
            setDismissed(true)
            try {
              window.localStorage.setItem(DISMISS_STORAGE_KEY, "1")
            } catch {
              // ignore
            }
          }}
          className="absolute top-2 right-2 size-6 rounded-full bg-accent/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3" />
        </button>
        <div className="relative flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold pr-4">Never miss a notice</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Get alerts for jobs, exams & tenders — straight to your phone or email.
            </p>
            <Link href={user ? "/dashboard/alerts" : "/login"}>
              <Button size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                Set Up Alert <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
