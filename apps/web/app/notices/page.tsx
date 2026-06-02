"use client"

import React, { useState, useMemo } from "react"
import { Search, Filter, Calendar, Eye, Clock, ArrowUpDown, Bell, FileText, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { useAuth } from "@/lib/auth-context"
import { mockNotices, categories } from "@/lib/mock-data"
import { Notice, NoticeCategory } from "@/lib/types"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export default function NoticesPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory | "all">("all")
  const [selectedPriority, setSelectedPriority] = useState<"all" | "high" | "normal" | "low">("all")
  const [sortBy, setSortBy] = useState<"date" | "views">("date")
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [showEmptyState] = useState(false) // Toggle to simulate empty state

  const filteredNotices = useMemo(() => {
    let results = mockNotices.filter((n) => n.status === "published")

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.organization.toLowerCase().includes(q)
      )
    }

    if (selectedCategory !== "all") {
      results = results.filter((n) => n.category === selectedCategory)
    }

    if (selectedPriority !== "all") {
      results = results.filter((n) => n.priority === selectedPriority)
    }

    results.sort((a, b) => {
      if (sortBy === "views") return b.views - a.views
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    return results
  }, [searchQuery, selectedCategory, selectedPriority, sortBy])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Public Notices</h1>
          <p className="text-muted-foreground">Browse and search all published government notices</p>
        </div>

        {/* Alert CTA - always visible */}
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Get notified about new notices</p>
              <p className="text-xs text-muted-foreground">Set up keyword, category, or organization alerts and never miss an update.</p>
            </div>
          </div>
          <Link href={user ? "/dashboard/alerts" : "/signup"}>
            <Button size="sm" className="gap-1.5 shrink-0">
              <Bell className="size-3.5" /> Set Up Alert
            </Button>
          </Link>
        </div>

        {/* Empty State - shown when no notices exist */}
        {(showEmptyState || filteredNotices.length === 0) && !searchQuery && selectedCategory === "all" && selectedPriority === "all" && showEmptyState && (
          <div className="text-center py-20">
            <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="size-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">No notices yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Notices from government portals will appear here once scraping begins. Check back soon.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/dashboard/alerts">
                <Button size="lg" className="gap-2">
                  <Bell className="size-4" /> Add Your First Alert
                </Button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin/sources">
                  <Button variant="outline" size="lg" className="gap-2">
                    <Settings className="size-4" /> Configure Sources
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as NoticeCategory | "all")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSortBy(sortBy === "date" ? "views" : "date")}
            >
              <ArrowUpDown className="size-3.5" />
              {sortBy === "date" ? "By Date" : "By Views"}
            </Button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredNotices.length} notice{filteredNotices.length !== 1 ? "s" : ""}
        </p>

        {/* Notice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotices.map((notice) => (
            <Card
              key={notice.id}
              className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedNotice(notice)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge variant={notice.priority === "high" ? "default" : "secondary"}>
                    {notice.category}
                  </Badge>
                  {notice.priority === "high" && (
                    <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {notice.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                  {notice.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formatDate(notice.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    {notice.views.toLocaleString()}
                  </span>
                </div>
                {notice.deadline && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <Clock className="size-3" />
                      Deadline: {formatDate(notice.deadline)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredNotices.length === 0 && !showEmptyState && (
          <div className="text-center py-16">
            <Filter className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No notices found</h3>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>
            <Link href="/dashboard/alerts">
              <Button variant="outline" className="gap-2">
                <Bell className="size-4" /> Set Alert for This Search
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Notice Detail Dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedNotice && (
            <>
              <DialogHeader>
                <div className="flex gap-2 mb-2">
                  <Badge variant={selectedNotice.priority === "high" ? "default" : "secondary"}>
                    {selectedNotice.category}
                  </Badge>
                  <Badge variant="outline">{selectedNotice.priority} priority</Badge>
                </div>
                <DialogTitle className="text-xl">{selectedNotice.title}</DialogTitle>
                <DialogDescription>{selectedNotice.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Organization</span>
                    <p className="font-medium">{selectedNotice.organization}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Published</span>
                    <p className="font-medium">{formatDate(selectedNotice.publishedAt)}</p>
                  </div>
                  {selectedNotice.deadline && (
                    <div>
                      <span className="text-muted-foreground">Deadline</span>
                      <p className="font-medium text-destructive">{formatDate(selectedNotice.deadline)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Views</span>
                    <p className="font-medium">{selectedNotice.views.toLocaleString()}</p>
                  </div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-semibold mb-2">Full Content</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedNotice.content}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Author: {selectedNotice.author} | Last updated: {formatDate(selectedNotice.updatedAt)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
