"use client"

import React, { useState } from "react"
import { Search, UserPlus, Edit, Trash2, Shield, ShieldOff } from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { mockUsers } from "@/lib/mock-data"

export default function AdminUsersPage() {
  const [search, setSearch] = useState("")

  const filteredUsers = mockUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              User management.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">{mockUsers.length} registered users</p>
          </div>
          <button className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90">
            <UserPlus className="size-4" /> Add user
          </button>
        </div>

        <div className="rounded-[20px] bg-white p-6">
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
            <input
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-full border border-vez-line bg-white pl-11 pr-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vez-line text-left">
                  <th className="pb-3 font-normal text-vez-mute">User</th>
                  <th className="pb-3 font-normal text-vez-mute">Email</th>
                  <th className="pb-3 font-normal text-vez-mute">Role</th>
                  <th className="pb-3 font-normal text-vez-mute">Status</th>
                  <th className="pb-3 font-normal text-vez-mute">Last login</th>
                  <th className="pb-3 font-normal text-vez-mute">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-vez-line/50 transition-colors hover:bg-vez-surface/60">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-vez-sky">
                          <span className="text-xs text-vez-navy">{user.username[0].toUpperCase()}</span>
                        </div>
                        <span className="text-vez-ink">{user.username}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-vez-mute">{user.email}</td>
                    <td className="py-3.5 pr-4">
                      <span className={`rounded-full px-3 py-1 text-xs capitalize ${
                        user.role === "admin"
                          ? "bg-vez-navy text-white"
                          : "bg-vez-surface text-vez-mute"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`rounded-full px-3 py-1 text-xs capitalize ${
                        user.status === "active"
                          ? "bg-vez-sky/30 text-vez-navy"
                          : "border border-vez-line text-vez-mute"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-vez-mute">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1">
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy" aria-label="Edit user"><Edit className="size-3.5" /></button>
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy" aria-label={user.role === "admin" ? "Revoke admin" : "Make admin"}>
                          {user.role === "admin" ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}
                        </button>
                        <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Delete user"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </div>
  )
}
