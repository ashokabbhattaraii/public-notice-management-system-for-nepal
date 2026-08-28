"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Sparkles, AlertCircle, Zap, Crown, Compass, Minus } from "lucide-react"
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

const TIER_ICON: Record<PlanTier, React.ComponentType<{ className?: string }>> = {
  FREE: Compass,
  PRO: Zap,
  MAX: Crown,
}

/** Rows for the detailed comparison table — one entry per metric, values keyed by tier. */
function comparisonRows(plans: PublicPlan[]): { label: string; values: Record<string, string> }[] {
  const num = (v: number | null) => (v === null ? "Unlimited" : v.toLocaleString())
  const byTier = Object.fromEntries(plans.map((p) => [p.tier, p])) as Record<string, PublicPlan>

  const row = (label: string, fn: (p: PublicPlan) => string) => ({
    label,
    values: Object.fromEntries(plans.map((p) => [p.tier, fn(p)])),
  })
  void byTier

  return [
    row("Documents", (p) => num(p.limits.maxDocuments)),
    row("AI questions / month", (p) => num(p.limits.maxAiQuestionsPerMonth)),
    row("Alert rules", (p) => num(p.limits.maxAlertRules)),
    row("WhatsApp alerts / month", (p) =>
      p.limits.maxWhatsappPerMonth === 0 ? "—" : num(p.limits.maxWhatsappPerMonth),
    ),
    row("Max upload size", (p) => `${p.limits.maxUploadMb} MB`),
    row("Alert delivery", (p) => (p.limits.allowInstantAlerts ? "Instant" : "Daily digest")),
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

  const rows = comparisonRows(plans)

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white font-poppins">
      <Header />

      <main className="mx-auto w-full max-w-[1480px] px-6 py-14 md:px-8 md:py-20 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-vez-sky/25 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-vez-navy">
            <Sparkles className="size-3" /> Pricing
          </span>
          <h1 className="mt-4 text-[clamp(32px,4.5vw,52px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Plans for every level of attention.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-vez-mute sm:text-base">
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
          <>
            <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 lg:max-w-none lg:grid-cols-3 lg:gap-8">
              {plans.map((plan) => {
                const isCurrent = currentTier === plan.tier
                // The middle tier carries the emphasis; it's the intended default.
                const featured = plan.tier === "PRO"
                const Icon = TIER_ICON[plan.tier] ?? Compass

                return (
                  <div
                    key={plan.tier}
                    className={`relative flex flex-col rounded-[26px] border p-8 transition-all lg:p-9 ${
                      featured
                        ? "border-transparent bg-gradient-to-b from-vez-navy to-[#0b2a52] text-white shadow-2xl shadow-vez-navy/20 lg:-translate-y-3"
                        : "border-vez-line bg-white hover:-translate-y-1 hover:shadow-lg"
                    }`}
                  >
                    {featured && (
                      <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-vez-sky px-3.5 py-1.5 text-[11px] font-medium text-vez-navy shadow-md">
                        <Sparkles className="size-3" /> Most popular
                      </span>
                    )}

                    <div
                      className={`flex size-11 items-center justify-center rounded-2xl ${
                        featured ? "bg-white/15" : "bg-vez-sky/20"
                      }`}
                    >
                      <Icon className={`size-5 ${featured ? "text-white" : "text-vez-navy"}`} />
                    </div>

                    <h2 className={`mt-5 text-xl ${featured ? "text-white" : "text-vez-ink"}`}>
                      {plan.name}
                    </h2>
                    {plan.tagline && (
                      <p className={`mt-1 text-xs ${featured ? "text-white/70" : "text-vez-mute"}`}>
                        {plan.tagline}
                      </p>
                    )}

                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span
                        className={`text-[40px] leading-none tracking-[-0.02em] ${featured ? "text-white" : "text-vez-ink"}`}
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
                      className={`mt-7 flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${
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
                      <p className={`mt-2 text-center text-[11px] ${featured ? "text-white/60" : "text-vez-mute"}`}>
                        Checkout is not configured for this plan yet.
                      </p>
                    )}

                    <div
                      className={`mt-7 border-t pt-6 ${featured ? "border-white/15" : "border-vez-line"}`}
                    >
                      <ul className="space-y-3">
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
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detailed comparison */}
            <div className="mt-20">
              <h2 className="text-center text-2xl font-normal tracking-[-0.02em] text-vez-ink">
                Compare plans in detail
              </h2>
              <div className="mx-auto mt-8 w-full max-w-5xl overflow-x-auto rounded-[22px] border border-vez-line">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-vez-line bg-vez-surface/60">
                      <th className="px-5 py-4 text-left font-medium text-vez-mute">Feature</th>
                      {plans.map((plan) => (
                        <th
                          key={plan.tier}
                          className={`px-5 py-4 text-left font-medium ${
                            plan.tier === "PRO" ? "bg-vez-sky/15 text-vez-navy" : "text-vez-ink"
                          }`}
                        >
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.label}
                        className={i % 2 === 1 ? "bg-vez-surface/30" : undefined}
                      >
                        <td className="border-t border-vez-line px-5 py-3.5 text-vez-mute">
                          {row.label}
                        </td>
                        {plans.map((plan) => {
                          const value = row.values[plan.tier]
                          return (
                            <td
                              key={plan.tier}
                              className={`border-t border-vez-line px-5 py-3.5 ${
                                plan.tier === "PRO" ? "bg-vez-sky/10 font-medium text-vez-navy" : "text-vez-ink"
                              }`}
                            >
                              {value === "—" ? (
                                <Minus className="size-3.5 text-vez-mute/60" />
                              ) : (
                                value
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <p className="mt-12 text-center text-xs text-vez-mute">
          Prices in USD. Cancel any time from your billing settings — access continues until the end
          of the paid period.
        </p>
      </main>
    </div>
  )
}
