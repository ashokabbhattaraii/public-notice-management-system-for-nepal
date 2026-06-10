"use client"

import React, { useState } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { categories } from "@/lib/mock-data"

export default function AdminCategoriesPage() {
  const [newCategory, setNewCategory] = useState("")

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Category Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage notice categories</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Existing Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{cat.label}</Badge>
                    <span className="text-sm text-muted-foreground">{cat.count} notices</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-7"><Edit className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive"><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Category Name</label>
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter category name"
                  />
                </div>
                <Button variant="default" className="gap-2 w-full">
                  <Plus className="size-4" /> Add Category
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </div>
  )
}
