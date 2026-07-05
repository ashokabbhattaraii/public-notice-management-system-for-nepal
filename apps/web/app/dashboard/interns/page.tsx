"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Search, Users, UserCheck, UserX, AlertTriangle,
  Calendar, ArrowLeft, ChevronRight, Plus, Check, X,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import {
  fetchInternsKpi,
  fetchInternDetails,
  createIntern,
  recordAttendance,
  fetchSaturdayRoster,
  createSaturdayRoster,
  markSaturdayPresence,
  InternWithKpi,
  InternDetails,
  SaturdayRosterEntry,
  InternKpiResponse,
} from "@/lib/interns-api"

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const bgMap: Record<string, string> = {
    green: "bg-emerald-50 border-emerald-200",
    yellow: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
    default: "bg-vez-surface border-vez-line",
  }
  const textMap: Record<string, string> = {
    green: "text-emerald-700",
    yellow: "text-amber-700",
    red: "text-red-700",
    default: "text-vez-ink",
  }
  return (
    <div className={`flex flex-col gap-2 rounded-[16px] border p-5 ${bgMap[color] || bgMap.default}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-vez-mute">{label}</span>
        <div className={`flex size-8 items-center justify-center rounded-full ${textMap[color] || textMap.default}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-medium tabular-nums ${textMap[color] || textMap.default}`}>{value}</p>
    </div>
  )
}

function KpiDot({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" }
  return <span className={`inline-block size-2.5 rounded-full ${colors[status]}`} />
}

function InternRow({ intern, onClick }: { intern: InternWithKpi; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-[14px] border border-vez-line bg-white px-4 py-3 text-left transition-colors hover:border-vez-sky hover:bg-vez-sky/5"
    >
      <KpiDot status={intern.kpiStatus} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-vez-ink">{intern.name}</p>
        <p className="truncate text-xs text-vez-mute">{intern.department || "No department"}</p>
      </div>
      <div className="hidden items-center gap-4 sm:flex">
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums text-vez-ink">{intern.attendancePercentage}%</p>
          <p className="text-[10px] text-vez-mute">attendance</p>
        </div>
        <div className="text-right">
          <p className="text-sm tabular-nums text-vez-ink">{intern.presentDays}/{intern.totalWorkingDays}</p>
          <p className="text-[10px] text-vez-mute">present</p>
        </div>
      </div>
      <ChevronRight className="size-4 text-vez-mute opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function InternDetailView({ details, onBack }: { details: InternDetails; onBack: () => void }) {
  const { intern, stats, attendances, saturdayRosters, compensationLeaves } = details

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-vez-mute hover:text-vez-navy">
        <ArrowLeft className="size-4" /> Back to list
      </button>

      <div className="rounded-[20px] bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-medium text-vez-ink">{intern.name}</h2>
              <KpiDot status={stats.kpiStatus} />
            </div>
            <p className="mt-1 text-sm text-vez-mute">{intern.email}</p>
            {intern.department && <p className="text-sm text-vez-mute">{intern.department}</p>}
          </div>
          <div className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            stats.kpiStatus === "green" ? "bg-emerald-100 text-emerald-700"
            : stats.kpiStatus === "yellow" ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
          }`}>
            {stats.attendancePercentage}% Attendance
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Working Days" value={stats.totalWorkingDays} />
        <StatTile label="Days Present" value={stats.presentDays} />
        <StatTile label="Days Absent" value={stats.absentDays} highlight={stats.absentDays > 5} />
        <StatTile label="Leave Taken" value={stats.leaveDays} />
      </div>

      {/* Saturday & Compensation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[16px] border border-vez-line bg-white p-5">
          <p className="text-xs text-vez-mute">Saturdays Present</p>
          <p className="mt-1 text-2xl font-medium text-vez-ink tabular-nums">{stats.saturdaysPresent}</p>
        </div>
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs text-emerald-600">Comp. Leave Earned</p>
          <p className="mt-1 text-2xl font-medium text-emerald-700 tabular-nums">{stats.compLeaveEarned}</p>
        </div>
        <div className="rounded-[16px] border border-vez-line bg-white p-5">
          <p className="text-xs text-vez-mute">Comp. Leave Used / Remaining</p>
          <p className="mt-1 text-2xl font-medium text-vez-ink tabular-nums">
            {stats.compLeaveUsed} <span className="text-sm text-vez-mute">/ {stats.compLeaveRemaining} left</span>
          </p>
        </div>
      </div>

      {/* Attendance History */}
      <div className="rounded-[20px] bg-white p-6">
        <h3 className="mb-4 text-base font-medium text-vez-ink">Recent Attendance</h3>
        {attendances.length === 0 ? (
          <p className="text-sm text-vez-mute">No attendance records yet.</p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {attendances.slice(0, 30).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-vez-surface px-4 py-2.5">
                <span className="text-sm text-vez-ink">
                  {new Date(a.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium capitalize ${
                  a.status === "present" ? "bg-emerald-100 text-emerald-700"
                  : a.status === "absent" ? "bg-red-100 text-red-700"
                  : a.status === "compensation_leave" ? "bg-blue-100 text-blue-700"
                  : "bg-amber-100 text-amber-700"
                }`}>
                  {a.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saturday Roster History */}
      <div className="rounded-[20px] bg-white p-6">
        <h3 className="mb-4 text-base font-medium text-vez-ink">Saturday Roster History</h3>
        {saturdayRosters.length === 0 ? (
          <p className="text-sm text-vez-mute">No Saturday roster entries.</p>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {saturdayRosters.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-vez-surface px-4 py-2.5">
                <span className="text-sm text-vez-ink">
                  {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                  r.present ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {r.present ? "Present → Comp Leave Earned" : "Absent"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-[16px] border p-5 ${highlight ? "border-red-200 bg-red-50" : "border-vez-line bg-white"}`}>
      <p className="text-xs text-vez-mute">{label}</p>
      <p className={`mt-1 text-2xl font-medium tabular-nums ${highlight ? "text-red-700" : "text-vez-ink"}`}>{value}</p>
    </div>
  )
}

function SaturdayRosterSection({ roster, onTogglePresence, rosterDate, onDateChange, onCreateRoster, allInterns }: {
  roster: SaturdayRosterEntry[]
  onTogglePresence: (internId: string, date: string, present: boolean) => void
  rosterDate: string
  onDateChange: (date: string) => void
  onCreateRoster: (internIds: string[]) => void
  allInterns: InternWithKpi[]
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleInternSelection = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
  }

  return (
    <div className="rounded-[20px] bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-medium text-vez-ink">
          <Calendar className="size-4 text-vez-navy" /> Saturday Roster
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={rosterDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-vez-line px-3 py-1.5 text-sm text-vez-ink"
          />
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 rounded-full bg-vez-navy px-3 py-1.5 text-xs text-white"
          >
            <Plus className="size-3" /> Assign
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-[14px] border border-vez-line bg-vez-surface p-4">
          <p className="mb-2 text-xs text-vez-mute">Select interns to assign for {rosterDate}:</p>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {allInterns.map((intern) => (
              <label key={intern.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(intern.id)}
                  onChange={() => toggleInternSelection(intern.id)}
                  className="size-4 rounded border-vez-line"
                />
                <span className="text-sm text-vez-ink">{intern.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { onCreateRoster(selectedIds); setShowAdd(false); setSelectedIds([]) }}
              disabled={selectedIds.length === 0}
              className="rounded-full bg-vez-navy px-4 py-1.5 text-xs text-white disabled:opacity-40"
            >
              Add to Roster
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-full px-4 py-1.5 text-xs text-vez-mute hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-sm text-vez-mute">No roster entries for this Saturday.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-[14px] border border-vez-line bg-vez-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-vez-ink">{entry.intern.name}</p>
                <p className="text-xs text-vez-mute">{entry.intern.department || "—"}</p>
              </div>
              <button
                onClick={() => onTogglePresence(entry.internId, rosterDate, !entry.present)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  entry.present
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {entry.present ? <Check className="size-3" /> : <X className="size-3" />}
                {entry.present ? "Present" : "Mark Present"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddInternModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: any) => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "", startDate: "" })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-vez-navy/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-6">
        <h3 className="mb-4 text-lg font-medium text-vez-ink">Add New Intern</h3>
        <div className="space-y-3">
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 w-full rounded-lg border border-vez-line px-4 text-sm text-vez-ink outline-none focus:border-vez-sky"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-10 w-full rounded-lg border border-vez-line px-4 text-sm text-vez-ink outline-none focus:border-vez-sky"
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 w-full rounded-lg border border-vez-line px-4 text-sm text-vez-ink outline-none focus:border-vez-sky"
          />
          <input
            placeholder="Department (optional)"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="h-10 w-full rounded-lg border border-vez-line px-4 text-sm text-vez-ink outline-none focus:border-vez-sky"
          />
          <div>
            <label className="mb-1 block text-xs text-vez-mute">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="h-10 w-full rounded-lg border border-vez-line px-4 text-sm text-vez-ink outline-none focus:border-vez-sky"
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onAdd(form)}
            disabled={!form.name || !form.email || !form.startDate}
            className="flex-1 rounded-full bg-vez-navy py-2.5 text-sm text-white disabled:opacity-40"
          >
            Add Intern
          </button>
          <button onClick={onClose} className="flex-1 rounded-full border border-vez-line py-2.5 text-sm text-vez-mute">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InternsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<InternKpiResponse | null>(null)
  const [selectedIntern, setSelectedIntern] = useState<InternDetails | null>(null)
  const [search, setSearch] = useState("")
  const [filterKpi, setFilterKpi] = useState<"all" | "green" | "yellow" | "red">("all")
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Saturday roster state
  const [rosterDate, setRosterDate] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 6 ? 0 : 6 - day
    const saturday = new Date(today)
    saturday.setDate(today.getDate() + diff)
    return saturday.toISOString().split("T")[0]
  })
  const [roster, setRoster] = useState<SaturdayRosterEntry[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchInternsKpi()
      setData(result)
    } catch (err) {
      console.error("Failed to load interns:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRoster = useCallback(async () => {
    try {
      const result = await fetchSaturdayRoster(rosterDate)
      setRoster(result)
    } catch (err) {
      console.error("Failed to load roster:", err)
    }
  }, [rosterDate])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadRoster() }, [loadRoster])

  const handleViewDetails = async (internId: string) => {
    try {
      const details = await fetchInternDetails(internId)
      setSelectedIntern(details)
    } catch (err) {
      console.error("Failed to load intern details:", err)
    }
  }

  const handleAddIntern = async (formData: any) => {
    try {
      await createIntern(formData)
      setShowAddModal(false)
      loadData()
    } catch (err) {
      console.error("Failed to add intern:", err)
    }
  }

  const handleToggleSaturdayPresence = async (internId: string, date: string, present: boolean) => {
    try {
      await markSaturdayPresence({ internId, date, present })
      loadRoster()
    } catch (err) {
      console.error("Failed to update presence:", err)
    }
  }

  const handleCreateRoster = async (internIds: string[]) => {
    try {
      await createSaturdayRoster({ date: rosterDate, internIds })
      loadRoster()
    } catch (err) {
      console.error("Failed to create roster:", err)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <p className="text-vez-mute">Sign in required</p>
        </div>
      </div>
    )
  }

  const filteredInterns = data?.interns.filter((intern) => {
    const matchesSearch = intern.name.toLowerCase().includes(search.toLowerCase()) ||
      intern.email.toLowerCase().includes(search.toLowerCase())
    const matchesKpi = filterKpi === "all" || intern.kpiStatus === filterKpi
    return matchesSearch && matchesKpi
  }) || []

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        {selectedIntern ? (
          <InternDetailView details={selectedIntern} onBack={() => setSelectedIntern(null)} />
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-vez-mute">Intern Management</p>
                <h1 className="mt-1 text-2xl font-normal tracking-tight text-vez-ink">Intern Tracker</h1>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
              >
                <Plus className="size-4" /> Add Intern
              </button>
            </div>

            {/* KPI Summary Cards */}
            {data && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total Interns" value={data.summary.total} color="default" icon={<Users className="size-4" />} />
                <KpiCard label="Good Standing" value={data.summary.green} color="green" icon={<UserCheck className="size-4" />} />
                <KpiCard label="Needs Attention" value={data.summary.yellow} color="yellow" icon={<AlertTriangle className="size-4" />} />
                <KpiCard label="Action Required" value={data.summary.red} color="red" icon={<UserX className="size-4" />} />
              </div>
            )}

            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
                <input
                  placeholder="Search intern by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-full border border-vez-line bg-white pl-11 pr-5 text-sm text-vez-ink outline-none placeholder:text-vez-mute focus:border-vez-sky"
                />
              </div>
              <div className="flex gap-1.5">
                {(["all", "green", "yellow", "red"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterKpi(f)}
                    className={`rounded-full px-4 py-2 text-xs font-medium capitalize transition-colors ${
                      filterKpi === f
                        ? "bg-vez-navy text-white"
                        : "bg-vez-surface text-vez-mute hover:bg-vez-line"
                    }`}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Intern List */}
            <div className="space-y-2">
              {loading ? (
                <div className="py-12 text-center text-sm text-vez-mute">Loading interns...</div>
              ) : filteredInterns.length === 0 ? (
                <div className="py-12 text-center text-sm text-vez-mute">
                  {search ? "No interns match your search." : "No interns found. Add your first intern."}
                </div>
              ) : (
                filteredInterns.map((intern) => (
                  <InternRow key={intern.id} intern={intern} onClick={() => handleViewDetails(intern.id)} />
                ))
              )}
            </div>

            {/* Saturday Roster Section */}
            <SaturdayRosterSection
              roster={roster}
              onTogglePresence={handleToggleSaturdayPresence}
              rosterDate={rosterDate}
              onDateChange={setRosterDate}
              onCreateRoster={handleCreateRoster}
              allInterns={data?.interns || []}
            />
          </div>
        )}

        {showAddModal && <AddInternModal onClose={() => setShowAddModal(false)} onAdd={handleAddIntern} />}
      </DashboardLayout>
    </div>
  )
}
