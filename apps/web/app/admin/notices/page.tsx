"use client"

import React, { useState } from "react"
import { Plus, Search, Edit, Trash2, Eye, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function AdminNoticesPage() {
  const [search, setSearch] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredNotices = mockNotices.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notice Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{mockNotices.length} total notices</p>
          </div>
          <Button variant="default" className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="size-4" /> Create Notice
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search notices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Title</th>
                    <th className="pb-3 font-medium text-muted-foreground">Category</th>
                    <th className="pb-3 font-medium text-muted-foreground">Organization</th>
                    <th className="pb-3 font-medium text-muted-foreground">Priority</th>
                    <th className="pb-3 font-medium text-muted-foreground">Views</th>
                    <th className="pb-3 font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotices.map((notice) => (
                    <tr key={notice.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-3 pr-4 max-w-[200px] truncate font-medium">{notice.title}</td>
                      <td className="py-3 pr-4"><Badge variant="secondary">{notice.category}</Badge></td>
                      <td className="py-3 pr-4 text-muted-foreground max-w-[150px] truncate">{notice.organization}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={notice.priority === "high" ? "destructive" : "outline"}>{notice.priority}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{notice.views.toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="text-green-600 bg-green-500/10">{notice.status}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-7"><Eye className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-7"><Edit className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-7"><Copy className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-7 text-destructive"><Trash2 className="size-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Create Notice Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Notice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title</label>
                <Input placeholder="Notice title" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="Brief description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Category</label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option>Exams</option>
                    <option>Vacancies</option>
                    <option>Tenders</option>
                    <option>Policy</option>
                    <option>Announcements</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Priority</label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option>Normal</option>
                    <option>High</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Organization</label>
                <Input placeholder="Publishing organization" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Content</label>
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]" placeholder="Full notice content..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button variant="default" onClick={() => setShowCreateDialog(false)}>Publish Notice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </div>
  )
}
