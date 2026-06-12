"use client"

import React, { useState } from "react"
import { Plus, Search, Edit, Trash2, Eye, Copy } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { mockNotices } from "@/lib/mock-data"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

const fieldClass =
  "w-full rounded-[12px] border border-vez-line bg-white px-4 py-3 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

export default function AdminNoticesPage() {
  const [search, setSearch] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredNotices = mockNotices.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Notice management.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">{mockNotices.length} total notices</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="size-4" /> Create notice
          </button>
        </div>

        <div className="rounded-[20px] bg-white p-6">
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
            <input
              placeholder="Search notices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-11`}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vez-line text-left">
                  <th className="pb-3 font-normal text-vez-mute">Title</th>
                  <th className="pb-3 font-normal text-vez-mute">Category</th>
                  <th className="pb-3 font-normal text-vez-mute">Organization</th>
                  <th className="pb-3 font-normal text-vez-mute">Priority</th>
                  <th className="pb-3 font-normal text-vez-mute">Views</th>
                  <th className="pb-3 font-normal text-vez-mute">Status</th>
                  <th className="pb-3 font-normal text-vez-mute">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotices.map((notice) => (
                  <tr key={notice.id} className="border-b border-vez-line/50 transition-colors hover:bg-vez-surface/60">
                    <td className="max-w-[200px] truncate py-3.5 pr-4 text-vez-ink">{notice.title}</td>
                    <td className="py-3.5 pr-4">
                      <span className="rounded-full bg-vez-sky/30 px-3 py-1 text-xs capitalize text-vez-navy">{notice.category}</span>
                    </td>
                    <td className="max-w-[150px] truncate py-3.5 pr-4 text-vez-mute">{notice.organization}</td>
                    <td className="py-3.5 pr-4">
                      <span className={`rounded-full px-3 py-1 text-xs capitalize ${
                        notice.priority === "high"
                          ? "bg-vez-navy text-white"
                          : "border border-vez-line text-vez-mute"
                      }`}>
                        {notice.priority}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-vez-mute">{notice.views.toLocaleString()}</td>
                    <td className="py-3.5 pr-4">
                      <span className="rounded-full bg-vez-sky/20 px-3 py-1 text-xs capitalize text-vez-navy">{notice.status}</span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1">
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy" aria-label="View notice"><Eye className="size-3.5" /></button>
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy" aria-label="Edit notice"><Edit className="size-3.5" /></button>
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy" aria-label="Duplicate notice"><Copy className="size-3.5" /></button>
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Delete notice"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Notice Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg rounded-[24px] border-vez-line">
            <DialogHeader>
              <DialogTitle className="font-normal tracking-[-0.02em] text-vez-ink">Create new notice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Title</label>
                <input placeholder="Notice title" className={fieldClass} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Description</label>
                <textarea className={`${fieldClass} min-h-[80px] resize-none`} placeholder="Brief description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Category</label>
                  <select className={`${fieldClass} h-11 py-0`}>
                    <option>Exams</option>
                    <option>Vacancies</option>
                    <option>Tenders</option>
                    <option>Policy</option>
                    <option>Announcements</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Priority</label>
                  <select className={`${fieldClass} h-11 py-0`}>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Organization</label>
                <input placeholder="Publishing organization" className={fieldClass} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Content</label>
                <textarea className={`${fieldClass} min-h-[120px] resize-none`} placeholder="Full notice content…" />
              </div>
            </div>
            <DialogFooter>
              <button
                className="rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
                onClick={() => setShowCreateDialog(false)}
              >
                Publish notice
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </div>
  )
}
