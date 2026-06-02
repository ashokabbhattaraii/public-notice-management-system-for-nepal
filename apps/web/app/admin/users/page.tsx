"use client"

import React, { useState } from "react"
import { Search, UserPlus, Edit, Trash2, Shield, ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{mockUsers.length} registered users</p>
          </div>
          <Button variant="default" className="gap-2">
            <UserPlus className="size-4" /> Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-medium text-muted-foreground">User</th>
                    <th className="pb-3 font-medium text-muted-foreground">Email</th>
                    <th className="pb-3 font-medium text-muted-foreground">Role</th>
                    <th className="pb-3 font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 font-medium text-muted-foreground">Last Login</th>
                    <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full gradient-primary flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{user.username[0].toUpperCase()}</span>
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.role === "admin" ? "gradient" : "secondary"}>{user.role}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.status === "active" ? "secondary" : "outline"} className={user.status === "active" ? "text-green-600 bg-green-500/10" : ""}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">
                        {new Date(user.lastLogin).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-7"><Edit className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-7">
                            {user.role === "admin" ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}
                          </Button>
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
      </AdminLayout>
    </div>
  )
}
