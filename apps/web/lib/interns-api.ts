import { apiFetch } from "./api"

export interface Intern {
  id: string
  name: string
  email: string
  phone?: string
  department?: string
  startDate: string
  endDate?: string
  status: "active" | "inactive" | "completed"
  createdAt: string
  updatedAt: string
}

export interface InternWithKpi extends Intern {
  totalWorkingDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  compLeaveDays: number
  attendancePercentage: number
  kpiStatus: "green" | "yellow" | "red"
}

export interface InternKpiResponse {
  interns: InternWithKpi[]
  summary: {
    total: number
    green: number
    yellow: number
    red: number
  }
}

export interface AttendanceRecord {
  id: string
  internId: string
  date: string
  status: "present" | "absent" | "leave" | "compensation_leave"
  remarks?: string
  createdAt: string
}

export interface SaturdayRosterEntry {
  id: string
  internId: string
  date: string
  present: boolean
  intern: { id: string; name: string; department?: string }
}

export interface CompensationLeaveRecord {
  id: string
  internId: string
  earnedDate: string
  usedDate?: string
  createdAt: string
}

export interface InternDetails {
  intern: Intern
  stats: {
    totalWorkingDays: number
    presentDays: number
    absentDays: number
    leaveDays: number
    compLeaveDays: number
    saturdaysPresent: number
    compLeaveEarned: number
    compLeaveUsed: number
    compLeaveRemaining: number
    attendancePercentage: number
    kpiStatus: "green" | "yellow" | "red"
  }
  attendances: AttendanceRecord[]
  saturdayRosters: { id: string; date: string; present: boolean }[]
  compensationLeaves: CompensationLeaveRecord[]
}

export async function fetchInternsKpi(): Promise<InternKpiResponse> {
  return apiFetch<InternKpiResponse>("/interns/kpi")
}

export async function fetchInternDetails(id: string): Promise<InternDetails> {
  return apiFetch<InternDetails>(`/interns/${id}/details`)
}

export async function createIntern(data: {
  name: string
  email: string
  phone?: string
  department?: string
  startDate: string
  endDate?: string
}): Promise<Intern> {
  return apiFetch<Intern>("/interns", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function recordAttendance(data: {
  internId: string
  date: string
  status: "present" | "absent" | "leave" | "compensation_leave"
  remarks?: string
}): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>("/interns/attendance", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function bulkRecordAttendance(data: {
  date: string
  records: { internId: string; status: "present" | "absent" | "leave" | "compensation_leave"; remarks?: string }[]
}): Promise<AttendanceRecord[]> {
  return apiFetch<AttendanceRecord[]>("/interns/attendance/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function fetchSaturdayRoster(date: string): Promise<SaturdayRosterEntry[]> {
  return apiFetch<SaturdayRosterEntry[]>(`/interns/saturday-roster?date=${date}`)
}

export async function createSaturdayRoster(data: {
  date: string
  internIds: string[]
}): Promise<void> {
  await apiFetch("/interns/saturday-roster", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function markSaturdayPresence(data: {
  internId: string
  date: string
  present: boolean
}): Promise<void> {
  await apiFetch("/interns/saturday-roster/presence", {
    method: "POST",
    body: JSON.stringify(data),
  })
}
