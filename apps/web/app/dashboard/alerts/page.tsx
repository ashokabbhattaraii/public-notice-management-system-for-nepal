"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Bell, Plus, AlertCircle, Trash2, ToggleLeft, ToggleRight, Zap,
  Search, FolderOpen, Building2, Ban, Gauge, CalendarClock, ChevronDown, ChevronUp, Tag, X,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { WhatsappConnectCard } from "@/components/alerts/whatsapp-connect-card"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"
import { NewAlertRuleInput } from "@/lib/api"
import { AlertRule, AlertUrgency, CATEGORY_ORDER, CANONICAL_TAGS, categoryLabel } from "@/lib/types"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

const URGENCY_OPTIONS: { id: AlertUrgency | ""; label: string }[] = [
  { id: "", label: "Any urgency" },
  { id: "LOW", label: "Low or above" },
  { id: "MEDIUM", label: "Medium or above" },
  { id: "HIGH", label: "High only" },
]

const URGENCY_BADGE: Record<AlertUrgency, string> = { LOW: "🟢 Low+", MEDIUM: "🟡 Medium+", HIGH: "🔴 High" }

const emptyForm = {
  name: "",
  priority: "NORMAL" as "NORMAL" | "HIGH",
  categories: [] as string[],
  tags: [] as string[],
  keywords: "",
  excludeKeywords: "",
  organizations: "",
  minUrgency: "" as AlertUrgency | "",
  deadlineEnabled: false,
  deadlineWithinDays: 7,
}

const parseCsv = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean)

function buildPayload(form: typeof emptyForm): NewAlertRuleInput {
  return {
    name: form.name,
    enabled: true,
    priority: form.priority,
    categories: form.categories as NewAlertRuleInput["categories"],
    tags: form.tags,
    keywords: parseCsv(form.keywords),
    excludeKeywords: parseCsv(form.excludeKeywords),
    organizations: parseCsv(form.organizations),
    minUrgency: form.minUrgency || null,
    deadlineWithinDays: form.deadlineEnabled ? form.deadlineWithinDays : null,
  }
}

// Category and/or tags are the required, easy basis for every alert —
// everything else below is an optional refinement layered on top.
function hasPrimaryDimension(form: typeof emptyForm): boolean {
  return form.categories.length > 0 || form.tags.length > 0
}

export default function AlertsPage() {
  const { user } = useAuth()
  const { alerts, error, addAlert, toggleAlert, deleteAlert } = useAlerts()
  const [showCreate, setShowCreate] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [tagQuery, setTagQuery] = useState("")
  const [creating, setCreating] = useState(false)

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Please sign in to manage alerts.</p>
            <Link
              href="/login"
              className="block w-full rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const canSubmit = !!form.name && hasPrimaryDimension(form)

  const handleCreate = async () => {
    if (!canSubmit) return
    setCreating(true)
    const ok = await addAlert(buildPayload(form))
    setCreating(false)
    if (ok) {
      setForm(emptyForm)
      setTagQuery("")
      setShowAdvanced(false)
      setShowCreate(false)
    }
  }

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }))
  }

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  const matchingTags = tagQuery.trim()
    ? CANONICAL_TAGS.filter((t) => t.includes(tagQuery.trim().toLowerCase()) && !form.tags.includes(t)).slice(0, 12)
    : []

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              My alerts.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">
              {alerts.length} alert rule{alerts.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="size-4" /> New alert
          </button>
        </div>

        <WhatsappConnectCard />

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-full bg-red-50 px-5 py-2.5 text-sm text-red-600">
            <span>{error}</span>
          </div>
        )}

        {/* Create Alert Form */}
        {showCreate && (
          <div className="mb-6 rounded-[20px] bg-vez-sky/25 p-6 md:p-8">
            <h2 className="text-lg text-vez-ink">Create new alert</h2>
            <p className="mt-1 text-sm text-vez-mute">
              Pick a category and/or tag to start — that&apos;s the easy way. Add keywords, organizations, urgency, or a
              deadline window on top if you want more precision.
            </p>
            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Alert name</label>
                <input
                  placeholder="e.g. Vacancy Updates"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-ink">
                  <FolderOpen className="size-3.5" /> Categories <span className="text-vez-mute">(pick at least one, or a tag below)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ORDER.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                        form.categories.includes(cat)
                          ? "bg-vez-navy text-white"
                          : "bg-white text-vez-mute hover:text-vez-navy"
                      }`}
                    >
                      {categoryLabel(cat)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-ink">
                  <Tag className="size-3.5" /> Tags <span className="text-vez-mute">(pick at least one, or a category above)</span>
                </label>
                {form.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {form.tags.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className="flex items-center gap-1 rounded-full bg-vez-navy px-3.5 py-1.5 text-xs text-white"
                      >
                        {t} <X className="size-3" />
                      </button>
                    ))}
                  </div>
                )}
                <input
                  placeholder="Search tags: scholarship, tender, election…"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  className={inputClass}
                />
                {matchingTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matchingTags.map((t) => (
                      <button
                        key={t}
                        onClick={() => { toggleTag(t); setTagQuery("") }}
                        className="rounded-full bg-white px-3.5 py-1.5 text-xs text-vez-mute hover:text-vez-navy"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm text-vez-navy"
              >
                {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {showAdvanced ? "Hide advanced filters" : "Advanced filters (optional — keywords, organization, exclude, urgency, deadline)"}
              </button>

              {showAdvanced && (
                <div className="space-y-5 rounded-[16px] bg-white/60 p-5">
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-mute">
                      <Search className="size-3.5" /> Also require these keywords (comma separated)
                    </label>
                    <input
                      placeholder="section officer, lok sewa, PSC"
                      value={form.keywords}
                      onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-mute">
                      <Building2 className="size-3.5" /> Organizations (comma separated)
                    </label>
                    <input
                      placeholder="Nepal Rastra Bank, Ministry of Education"
                      value={form.organizations}
                      onChange={(e) => setForm({ ...form, organizations: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-mute">
                      <Ban className="size-3.5" /> Exclude if it mentions (comma separated)
                    </label>
                    <input
                      placeholder="cancelled, postponed"
                      value={form.excludeKeywords}
                      onChange={(e) => setForm({ ...form, excludeKeywords: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-mute">
                      <Gauge className="size-3.5" /> Minimum urgency
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {URGENCY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setForm({ ...form, minUrgency: opt.id })}
                          className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                            form.minUrgency === opt.id
                              ? "bg-vez-navy text-white"
                              : "bg-white text-vez-mute hover:text-vez-navy"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm text-vez-mute">
                      <CalendarClock className="size-3.5" /> Only notices with a deadline coming up
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setForm({ ...form, deadlineEnabled: !form.deadlineEnabled })}
                        aria-label={form.deadlineEnabled ? "Disable deadline filter" : "Enable deadline filter"}
                      >
                        {form.deadlineEnabled ? (
                          <ToggleRight className="size-7 text-vez-navy" />
                        ) : (
                          <ToggleLeft className="size-7 text-vez-mute" />
                        )}
                      </button>
                      {form.deadlineEnabled && (
                        <div className="flex items-center gap-2 text-sm text-vez-ink">
                          within
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={form.deadlineWithinDays}
                            onChange={(e) => setForm({ ...form, deadlineWithinDays: Number(e.target.value) || 1 })}
                            className="h-9 w-20 rounded-full border border-vez-line bg-white px-3 text-center text-sm outline-none focus:border-vez-sky"
                          />
                          days
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-vez-mute">Priority</label>
                    <div className="flex gap-2">
                      {(["NORMAL", "HIGH"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setForm({ ...form, priority: p })}
                          className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                            form.priority === p ? "bg-vez-navy text-white" : "bg-white text-vez-mute hover:text-vez-navy"
                          }`}
                        >
                          {p === "HIGH" ? "⚡ High — always instant" : "Normal — respects digest setting"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!hasPrimaryDimension(form) && (
                <p className="text-xs text-vez-mute">
                  Choose at least one category or tag — that&apos;s the basis every alert needs. Everything under
                  Advanced filters is optional, on top of that.
                </p>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCreate}
                  disabled={creating || !canSubmit}
                  className="rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create alert"}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setShowAdvanced(false)
                    setForm(emptyForm)
                    setTagQuery("")
                  }}
                  className="rounded-full px-5 py-2.5 text-sm text-vez-mute transition-colors hover:bg-white hover:text-vez-navy"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {alerts.length === 0 && !showCreate && (
          <div className="rounded-[24px] bg-vez-surface p-12 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-vez-sky/40">
              <Zap className="size-7 text-vez-navy" />
            </div>
            <h3 className="mb-2 text-lg text-vez-ink">Set up your first alert</h3>
            <p className="mx-auto mb-6 max-w-sm text-sm text-vez-mute">
              Start simple with a category or tag, then add keywords, organization, urgency, or a deadline window if
              you want more precision.
            </p>
            <div className="mb-7 flex flex-wrap items-center justify-center gap-5 text-sm text-vez-mute">
              <span className="flex items-center gap-1.5"><FolderOpen className="size-3.5" /> Category</span>
              <span className="flex items-center gap-1.5"><Tag className="size-3.5" /> Tag</span>
              <span className="flex items-center gap-1.5"><Search className="size-3.5" /> Keyword</span>
              <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> Organization</span>
              <span className="flex items-center gap-1.5"><Gauge className="size-3.5" /> Urgency</span>
              <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" /> Deadline</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4" /> Create first alert
            </button>
          </div>
        )}

        {/* Alert List */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onToggle={toggleAlert} onDelete={deleteAlert} />
            ))}
          </div>
        )}
      </DashboardLayout>
    </div>
  )
}

function AlertRow({
  alert,
  onToggle,
  onDelete,
}: {
  alert: AlertRule
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-4 rounded-[16px] bg-white p-5 transition-colors hover:bg-vez-sky/10">
      <button
        onClick={() => onToggle(alert.id)}
        className="mt-0.5 shrink-0"
        aria-label={alert.enabled ? "Disable alert" : "Enable alert"}
      >
        {alert.enabled ? (
          <ToggleRight className="size-7 text-vez-navy" />
        ) : (
          <ToggleLeft className="size-7 text-vez-mute" />
        )}
      </button>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vez-sky/30 text-vez-navy">
        <Bell className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base text-vez-ink">{alert.name}</p>
          {alert.priority === "HIGH" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] text-amber-700">⚡ High priority</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {alert.categories.map((c) => (
            <span key={`cat-${c}`} className="rounded-full bg-vez-sky/40 px-2.5 py-0.5 text-[10px] text-vez-navy">
              {categoryLabel(c)}
            </span>
          ))}
          {alert.tags.map((t) => (
            <span key={`tag-${t}`} className="rounded-full bg-vez-navy px-2.5 py-0.5 text-[10px] text-white">
              #{t}
            </span>
          ))}
          {alert.keywords.map((k) => (
            <span key={`kw-${k}`} className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">
              🔍 {k}
            </span>
          ))}
          {alert.organizations.map((o) => (
            <span key={`org-${o}`} className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">
              🏛️ {o}
            </span>
          ))}
          {alert.minUrgency && (
            <span className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">
              {URGENCY_BADGE[alert.minUrgency]}
            </span>
          )}
          {alert.deadlineWithinDays != null && (
            <span className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">
              ⏰ due ≤{alert.deadlineWithinDays}d
            </span>
          )}
          {alert.excludeKeywords.map((k) => (
            <span key={`ex-${k}`} className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] text-red-600">
              🚫 {k}
            </span>
          ))}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
        {alert.matchCount} matches
      </span>
      <button
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600"
        onClick={() => onDelete(alert.id)}
        aria-label="Delete alert"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
