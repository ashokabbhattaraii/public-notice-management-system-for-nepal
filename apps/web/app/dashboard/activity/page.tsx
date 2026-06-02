"use client"

import React from "react"
import Link from "next/link"
import {
  Clock,
  Eye,
  Bookmark,
  Bell,
  Search,
  FileText,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { mockActivities } from "@/lib/mock-data"

export default function ActivityPage() {
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
              <p className="text-muted-foreground mb-4">Please sign in to view activity</p>
              <Link href="/login"><Button>Sign In</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const activityIcon = (type: string) => {
    switch (type) {
      case "view": return <Eye className="size-4" />
      case "save": return <Bookmark className="size-4" />
      case "alert": return <Bell className="size-4" />
      case "search": return <Search className="size-4" />
      case "document": return <FileText className="size-4" />
      default: return <Clock className="size-4" />
    }
  }

  const activityColor = (type: string) => {
    switch (type) {
      case "view": return "bg-blue-500/10 text-blue-600"
      case "save": return "bg-amber-500/10 text-amber-600"
      case "alert": return "bg-red-500/10 text-red-600"
      case "search": return "bg-emerald-500/10 text-emerald-600"
      case "document": return "bg-purple-500/10 text-purple-600"
      default: return "bg-accent text-muted-foreground"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="size-5 text-primary" /> Activity
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your recent actions and history</p>
        </div>

        <div className="space-y-2">
          {mockActivities.map((activity) => (
            <Card key={activity.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${activityColor(activity.type)}`}>
                  {activityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(activity.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
      
    </div>
  )
}
