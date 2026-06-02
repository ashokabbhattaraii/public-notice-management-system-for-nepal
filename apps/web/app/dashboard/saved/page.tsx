"use client"

import React from "react"
import Link from "next/link"
import { Bookmark, FileText, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { mockNotices } from "@/lib/mock-data"

export default function SavedNoticesPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
              <p className="text-muted-foreground mb-4">Please sign in to view saved notices</p>
              <Link href="/login"><Button>Sign In</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const savedNotices = mockNotices.slice(0, 6)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="size-5 text-primary" /> Saved Notices
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{savedNotices.length} notices saved</p>
        </div>

        <div className="space-y-3">
          {savedNotices.map((notice) => (
            <Card key={notice.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{notice.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notice.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{notice.category}</Badge>
                    <span className="text-xs text-muted-foreground">{notice.organization}</span>
                    <span className="text-xs text-muted-foreground">• {new Date(notice.publishedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
      
    </div>
  )
}
