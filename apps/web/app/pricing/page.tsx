"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Sparkles, AlertCircle } from "lucide-react"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/lib/auth-context"
import {
  fetchPlans,
  fetchBillingSummary,
  startCheckout,
  formatPlanPrice,
  type PublicPlan,
  type PlanTier,
} from "@/lib/api"

/** Limits rendered as plain sentences, so a plan reads the same everywhere. */
function limitLines(plan: PublicPlan): string[] {
  const l = plan.limits
  const n = (v: number | null, unit: string) =>
    v === null ? `Unlimited ${unit}` : `${v.toLocaleString()} ${unit}`
  return [
    n(l.maxDocuments, "documents"),
    `${l.maxAiQuestionsPerMonth === null ? "Unlimited" : l.maxAiQuestionsPerMonth.toLocaleString()} AI questions / month`,
    n(l.maxAlertRules, "alert rules"),
    l.maxWhatsappPerMonth === 0
      ? "Daily digest alerts"
      : `${l.maxWhatsappPerMonth === null ? "Unlimited" : l.maxWhatsappPerMonth.toLocaleString()} WhatsApp alerts / month`,
    `Up to ${l.maxUploadMb} MB per upload`,
    l.allowInstantAlerts ? "Instant alert delivery" : "Daily digest delivery",
  ]
}

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [currentTier, setCurrentTier] = useState<PlanTier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<PlanTier | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPlans()
      .then((data) => {
        if (!cancelled) setPlans(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load plans")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Signed-in visitors see which plan they're already on.
  useEffect(() => {
    if (!user) {
      setCurrentTier(null)
      return
    }
    let cancelled = false
    fetchBillingSummary()
      .then((s) => {
        if (!cancelled) setCurrentTier(s.plan.tier)
      })
      .catch(() => {
        /* not fatal — the page still sells */
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const handleChoose = useCallback(
    async (plan: PublicPlan) => {
      if (plan.tier === "FREE") {
        router.push(user ? "/dashboard" : "/login")
        return
      }
      if (!user) {
        // Sign in first; Stripe needs an account to attach the subscription to.
        router.push(`/login?next=${encodeURIComponent("/pricing")}`)
        return
      }

      setCheckingOut(plan.tier)
      setError(null)
      try {
        const { url } = await startCheckout(plan.tier as "PRO" | "MAX")
        window.location.href = url
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start checkout")
        setCheckingOut(null)
      }
    },
    [router, user],
  )

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[clamp(32px,4vw,48px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Plans for every level of attention.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-vez-mute">
            Every plan includes the full archive of Nepalese government notices, news and press
            releases. Paid plans add AI research, instant alerts and bigger document limits.
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-vez-mute">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.tier
              // The middle tier carries the emphasis; it's the intended default.
              const featured = plan.tier === "PRO"

              return (
                <div
                  key={plan.tier}
                  className={`relative flex flex-col rounded-[22px] border p-7 transition-shadow ${
                    featured
                      ? "border-vez-navy bg-vez-navy text-white shadow-xl"
                      : "border-vez-line bg-white hover:shadow-md"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-vez-sky px-3 py-1 text-[11px] font-medium text-vez-navy">
                      <Sparkles className="size-3" /> Most popular
                    </span>
                  )}

                  <h2 className={`text-lg ${featured ? "text-white" : "text-vez-ink"}`}>
                    {plan.name}
                  </h2>
                  {plan.tagline && (
                    <p className={`mt-1 text-xs ${featured ? "text-white/70" : "text-vez-mute"}`}>
                      {plan.tagline}
                    </p>
                  )}

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span
                      className={`text-[34px] leading-none tracking-[-0.02em] ${featured ? "text-white" : "text-vez-ink"}`}
                    >
                      {formatPlanPrice(plan.priceMonthlyCents, plan.currency)}
                    </span>
                    {plan.priceMonthlyCents > 0 && (
                      <span className={`text-sm ${featured ? "text-white/60" : "text-vez-mute"}`}>
                        / month
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleChoose(plan)}
                    disabled={isCurrent || checkingOut !== null}
                    className={`mt-6 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${
                      featured
                        ? "bg-white text-vez-navy hover:opacity-90"
                        : "bg-vez-navy text-white hover:opacity-90"
                    }`}
                  >
                    {checkingOut === plan.tier && <Loader2 className="size-4 animate-spin" />}
                    {isCurrent
                      ? "Your current plan"
                      : plan.tier === "FREE"
                        ? "Get started"
                        : `Upgrade to ${plan.name}`}
                  </button>

                  {plan.tier !== "FREE" && !plan.purchasable && (
                    <p className={`mt-2 text-[11px] ${featured ? "text-white/60" : "text-vez-mute"}`}>
                      Checkout is not configured for this plan yet.
                    </p>
                  )}

                  <ul className="mt-6 space-y-2.5">
                    {(plan.features?.length ? plan.features : limitLines(plan)).map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className={`mt-0.5 size-4 shrink-0 ${featured ? "text-vez-sky" : "text-vez-navy"}`}
                        />
                        <span
                          className={`text-sm leading-relaxed ${featured ? "text-white/90" : "text-vez-ink"}`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* The authoritative numbers, always shown so marketing copy
                      can never drift from what the system actually enforces. */}
                  <div
                    className={`mt-6 space-y-1.5 border-t pt-5 text-xs ${
                      featured ? "border-white/15 text-white/70" : "border-vez-line text-vez-mute"
                    }`}
                  >
                    {limitLines(plan).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-vez-mute">
          Prices in USD. Cancel any time from your billing settings — access continues until the end
          of the paid period.
        </p>
      </main>
    </div>
  )
}
