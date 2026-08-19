"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { UsageMeterBar } from "@/components/billing/upgrade-prompt"
import {
  fetchBillingSummary,
  openBillingPortal,
  formatPlanPrice,
  type BillingSummary,
} from "@/lib/api"

const STATUS_COPY: Record<BillingSummary["status"], { label: string; tone: string }> = {
  ACTIVE: { label: "Active", tone: "bg-emerald-50 text-emerald-700" },
  TRIALING: { label: "Trial", tone: "bg-vez-sky/30 text-vez-navy" },
  PAST_DUE: { label: "Payment failed", tone: "bg-amber-50 text-amber-700" },
  CANCELED: { label: "Canceled", tone: "bg-vez-line/60 text-vez-mute" },
  INCOMPLETE: { label: "Incomplete", tone: "bg-amber-50 text-amber-700" },
}

function BillingPageContent() {
  const searchParams = useSearchParams()
  const justCheckedOut = searchParams.get("checkout") === "success"

  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)

  const load = useCallback(async () => {
    try {
      setSummary(await fetchBillingSummary())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your plan")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Stripe's webhook lands a moment after the redirect back, so the first read
  // can still show the old plan. One delayed refresh covers that gap.
  useEffect(() => {
    if (!justCheckedOut) return
    const timer = setTimeout(() => void load(), 2500)
    return () => clearTimeout(timer)
  }, [justCheckedOut, load])

  const handlePortal = async () => {
    setOpeningPortal(true)
    setError(null)
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal")
      setOpeningPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-vez-mute">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="rounded-[16px] bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? "Your plan could not be loaded."}
      </div>
    )
  }

  const status = STATUS_COPY[summary.status]
  const periodEnd = summary.currentPeriodEnd ? new Date(summary.currentPeriodEnd) : null
  const usage = summary.usage

  return (
    <div className="space-y-6">
      {justCheckedOut && (
        <div className="flex items-center gap-2 rounded-[14px] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="size-4 shrink-0" />
          Payment received — welcome to {summary.plan.name}. It can take a few seconds to appear.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Current plan */}
      <section className="rounded-[20px] border border-vez-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl text-vez-ink">{summary.plan.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.tone}`}>
                {status.label}
              </span>
              {summary.cancelAtPeriodEnd && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  Cancels at period end
                </span>
              )}
            </div>
            {summary.plan.tagline && (
              <p className="mt-1 text-sm text-vez-mute">{summary.plan.tagline}</p>
            )}
            <p className="mt-2 text-sm text-vez-ink">
              {formatPlanPrice(summary.plan.priceMonthlyCents, summary.plan.currency)}
              {summary.plan.priceMonthlyCents > 0 && (
                <span className="text-vez-mute"> / month</span>
              )}
              {periodEnd && (
                <span className="text-vez-mute">
                  {" · "}
                  {summary.cancelAtPeriodEnd ? "ends" : "renews"} {periodEnd.toLocaleDateString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
            >
              {summary.plan.tier === "MAX" ? "Compare plans" : "Upgrade"}
              <ArrowUpRight className="size-3.5" />
            </Link>
            {/* Only a real Stripe customer has a portal to open. */}
            {!summary.isDefault && summary.paymentsConfigured && (
              <button
                onClick={handlePortal}
                disabled={openingPortal}
                className="flex items-center gap-1.5 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-60"
              >
                {openingPortal ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CreditCard className="size-3.5" />
                )}
                Manage billing
              </button>
            )}
          </div>
        </div>

        {summary.status === "PAST_DUE" && (
          <p className="mt-4 rounded-[12px] bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            We couldn't take the last payment. Your plan keeps working until the end of the current
            period — update your card in "Manage billing" to avoid losing access.
          </p>
        )}
      </section>

      {/* Usage */}
      <section className="rounded-[20px] border border-vez-line bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-base text-vez-ink">This month's usage</h3>
            <p className="mt-0.5 text-xs text-vez-mute">
              Resets {new Date(usage.periodEnd).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-full border border-vez-line px-3.5 py-1.5 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
          >
            <RefreshCw className="size-3" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <UsageMeterBar
            label="AI questions"
            used={usage.aiQuestions.used}
            limit={usage.aiQuestions.limit}
          />
          <UsageMeterBar
            label="Documents"
            used={usage.documents.used}
            limit={usage.documents.limit}
          />
          <UsageMeterBar
            label="Alert rules"
            used={usage.alertRules.used}
            limit={usage.alertRules.limit}
          />
          <UsageMeterBar
            label="WhatsApp alerts"
            used={usage.whatsappNotifications.used}
            limit={usage.whatsappNotifications.limit}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-vez-line pt-5 text-xs text-vez-mute sm:grid-cols-4">
          <div>
            <p className="text-vez-ink">{summary.limits.maxUploadMb} MB</p>
            <p>Max upload size</p>
          </div>
          <div>
            <p className="text-vez-ink">
              {summary.limits.allowInstantAlerts ? "Instant" : "Daily digest"}
            </p>
            <p>Alert delivery</p>
          </div>
          <div>
            <p className="text-vez-ink">
              {summary.limits.maxDocuments === null ? "Unlimited" : summary.limits.maxDocuments}
            </p>
            <p>Document limit</p>
          </div>
          <div>
            <p className="text-vez-ink">
              {summary.limits.maxAiQuestionsPerMonth === null
                ? "Unlimited"
                : summary.limits.maxAiQuestionsPerMonth}
            </p>
            <p>AI questions / month</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-vez-surface/30 font-poppins">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-[clamp(26px,3vw,36px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Plan &amp; usage.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">
            What your membership includes, and what you've used this month.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24 text-vez-mute">
              <Loader2 className="size-6 animate-spin" />
            </div>
          }
        >
          <BillingPageContent />
        </Suspense>
      </main>
    </div>
  )
}
