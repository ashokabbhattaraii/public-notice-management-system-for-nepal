"use client"

import React from "react"
import Link from "next/link"
import { FileText, Trash2, AlertCircle } from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { mockNotices } from "@/lib/mock-data"

export default function SavedNoticesPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Please sign in to view saved notices.</p>
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

  const savedNotices = mockNotices.slice(0, 6)

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Saved notices.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">{savedNotices.length} notices saved</p>
        </div>

        <div className="space-y-3">
          {savedNotices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start gap-4 rounded-[16px] bg-white p-5 transition-colors hover:bg-vez-sky/10"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vez-sky/30">
                <FileText className="size-4 text-vez-navy" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-vez-ink">{notice.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-vez-mute">{notice.description}</p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="rounded-full bg-vez-sky/30 px-3 py-0.5 text-xs capitalize text-vez-navy">{notice.category}</span>
                  <span className="text-xs text-vez-mute">{notice.organization}</span>
                  <span className="text-xs text-vez-mute">· {new Date(notice.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Remove saved notice"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </DashboardLayout>
    </div>
  )
}
