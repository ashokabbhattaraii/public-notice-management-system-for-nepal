"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

/**
 * Client-side route guard — the authoritative, session-aware layer behind the
 * edge middleware. Holds rendering until the session is validated, then:
 *   - no session            → /login?redirect=<current path>  (preserves return URL)
 *   - `admin` + non-admin   → /dashboard
 *   - otherwise             → renders children
 *
 * Because it re-evaluates whenever `user` changes, an in-session logout,
 * 401-expiry or cross-tab sign-out instantly bounces the page to /login.
 */
export function RequireAuth({
  admin,
  children,
}: {
  admin?: boolean
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      const target = `/login?redirect=${encodeURIComponent(pathname + (window.location.search ?? ""))}`
      router.replace(target)
      // Clear any forged token that passed the lax edge check but failed API validation
      try { localStorage.removeItem("pnm_token"); document.cookie = "pnm_token=; path=/; max-age=0; SameSite=Lax" } catch {}
    } else if (admin && user.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [isLoading, user, admin, pathname, router])

  if (isLoading || !user || (admin && user.role !== "admin")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-vez-mute">
          <Loader2 className="size-5 animate-spin text-vez-navy" />
          <span>{isLoading ? "Checking session…" : "Redirecting…"}</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}