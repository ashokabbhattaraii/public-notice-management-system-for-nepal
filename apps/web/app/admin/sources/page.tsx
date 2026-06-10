"use client"

import React, { useState } from "react"
import {
  Plus,
  Play,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  Link2,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"

interface ScrapingSource {
  id: string
  name: string
  url: string
  category: string
  frequency: string
  status: "active" | "inactive"
  lastScraped: string | null
  notes: string
}

const defaultSources: ScrapingSource[] = [
  {
    id: "src-1",
    name: "Ministry of Foreign Affairs",
    url: "https://mofa.gov.np/",
    category: "Policy / Administrative",
    frequency: "Daily",
    status: "active",
    lastScraped: "2026-06-02T06:00:00Z",
    notes: "Official MoFA notices and circulars",
  },
  {
    id: "src-2",
    name: "Nepal Gazette Online",
    url: "https://rajpatra.dop.gov.np",
    category: "Policy",
    frequency: "Daily",
    status: "active",
    lastScraped: "2026-06-02T06:00:00Z",
    notes: "Government gazette publications",
  },
  {
    id: "src-3",
    name: "Public Procurement Portal",
    url: "https://bolpatra.gov.np",
    category: "Tender",
    frequency: "Every 6 hours",
    status: "active",
    lastScraped: "2026-06-02T08:00:00Z",
    notes: "All public procurement notices",
  },
  {
    id: "src-4",
    name: "PSC Official Website",
    url: "https://psc.gov.np",
    category: "Exam",
    frequency: "Daily",
    status: "active",
    lastScraped: "2026-06-01T22:00:00Z",
    notes: "Public Service Commission exam notices",
  },
  {
    id: "src-5",
    name: "MoE Job Portal",
    url: "https://education.gov.np/vacancies",
    category: "Job",
    frequency: "Every 12 hours",
    status: "inactive",
    lastScraped: "2026-05-30T12:00:00Z",
    notes: "Education ministry vacancies (currently down)",
  },
]

const categoryOptions = ["Job", "Exam", "Tender", "Policy", "Policy / Administrative", "Other"]
const frequencyOptions = ["Daily", "Every 6 hours", "Every 12 hours", "Weekly", "Manual"]

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<ScrapingSource[]>(defaultSources)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    url: "",
    category: "Job",
    frequency: "Daily",
    notes: "",
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = "Source name is required"
    if (!form.url.trim()) errors.url = "URL is required"
    else {
      try {
        new URL(form.url)
      } catch {
        errors.url = "Please enter a valid URL"
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    if (editingId) {
      setSources(sources.map(s =>
        s.id === editingId ? { ...s, name: form.name, url: form.url, category: form.category, frequency: form.frequency, notes: form.notes } : s
      ))
    } else {
      setSources([...sources, {
        id: `src-${Date.now()}`,
        name: form.name,
        url: form.url,
        category: form.category,
        frequency: form.frequency,
        status: "active",
        lastScraped: null,
        notes: form.notes,
      }])
    }
    resetForm()
  }

  const resetForm = () => {
    setForm({ name: "", url: "", category: "Job", frequency: "Daily", notes: "" })
    setFormErrors({})
    setShowForm(false)
    setEditingId(null)
  }

  const startEdit = (source: ScrapingSource) => {
    setForm({ name: source.name, url: source.url, category: source.category, frequency: source.frequency, notes: source.notes })
    setEditingId(source.id)
    setShowForm(true)
  }

  const toggleSource = (id: string) => {
    setSources(sources.map(s =>
      s.id === id ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s
    ))
  }

  const deleteSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id))
    setDeleteConfirm(null)
  }

  const triggerScrape = (id: string) => {
    setScrapingId(id)
    setTimeout(() => {
      setSources(sources.map(s =>
        s.id === id ? { ...s, lastScraped: new Date().toISOString() } : s
      ))
      setScrapingId(null)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scraping Sources</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage URLs to scrape for notices</p>
          </div>
          <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="size-4" /> Add Source
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="size-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              More sources can be added here. Each source will be scraped on schedule and notices will be automatically classified and indexed.
            </p>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        {showForm && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{editingId ? "Edit Source" : "Add New Source"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={resetForm}><X className="size-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Source Name *</label>
                  <Input
                    placeholder="e.g. Ministry of Foreign Affairs"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">URL *</label>
                  <Input
                    placeholder="https://example.gov.np/"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                  {formErrors.url && <p className="text-xs text-destructive mt-1">{formErrors.url}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notice Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Scrape Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {frequencyOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes / Description</label>
                <Input
                  placeholder="Brief description of this source..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit}>{editingId ? "Save Changes" : "Add Source"}</Button>
                <Button variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sources Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium text-muted-foreground">Source</th>
                    <th className="p-4 font-medium text-muted-foreground">Category</th>
                    <th className="p-4 font-medium text-muted-foreground">Frequency</th>
                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                    <th className="p-4 font-medium text-muted-foreground">Last Scraped</th>
                    <th className="p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{source.url}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{source.category}</Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{source.frequency}</td>
                      <td className="p-4">
                        <button onClick={() => toggleSource(source.id)} className="flex items-center gap-1.5">
                          {source.status === "active" ? (
                            <>
                              <ToggleRight className="size-5 text-primary" />
                              <span className="text-xs text-green-600">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="size-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {source.lastScraped
                          ? new Date(source.lastScraped).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Never"
                        }
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 text-xs"
                            onClick={() => triggerScrape(source.id)}
                            disabled={scrapingId === source.id || source.status === "inactive"}
                          >
                            {scrapingId === source.id ? (
                              <><Loader2 className="size-3 animate-spin" /> Scraping...</>
                            ) : (
                              <><Play className="size-3" /> Scrape</>
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(source)}>
                            <Edit className="size-3.5" />
                          </Button>
                          {deleteConfirm === source.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => deleteSource(source.id)}>
                                Confirm
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(source.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </AdminLayout>
    </div>
  )
}
