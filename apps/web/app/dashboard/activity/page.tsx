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
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { mockActivities } from "@/lib/mock-data"

export default function ActivityPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Please sign in to view activity.</p>
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

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Activity.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">Your recent actions and history</p>
        </div>

        <div className="space-y-3">
          {mockActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 rounded-[16px] bg-white p-5 transition-colors hover:bg-vez-sky/10"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vez-sky/30 text-vez-navy">
                {activityIcon(activity.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-vez-ink">{activity.description}</p>
                <p className="mt-0.5 text-xs text-vez-mute">
                  {new Date(activity.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    </div>
  )
}
