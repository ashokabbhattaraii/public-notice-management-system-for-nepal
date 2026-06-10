"use client"

import React, { useState } from "react"
import {
  Bell,
  Mail,
  MessageCircle,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"

interface AlertChannel {
  id: string
  name: string
  icon: React.ElementType
  enabled: boolean
  status: "connected" | "not_configured" | "error"
  lastTested: string | null
  fields: { key: string; label: string; value: string; placeholder: string }[]
}

export default function AdminAlertChannelsPage() {
  const [channels, setChannels] = useState<AlertChannel[]>([
    {
      id: "email",
      name: "Email (SMTP)",
      icon: Mail,
      enabled: true,
      status: "connected",
      lastTested: "2026-06-01T14:00:00Z",
      fields: [
        { key: "host", label: "SMTP Host", value: "smtp.gmail.com", placeholder: "smtp.example.com" },
        { key: "port", label: "SMTP Port", value: "587", placeholder: "587" },
        { key: "username", label: "Username", value: "notices@suchana.ai", placeholder: "user@example.com" },
        { key: "password", label: "Password", value: "••••••••", placeholder: "App password" },
        { key: "from", label: "From Address", value: "notices@suchana.ai", placeholder: "noreply@example.com" },
      ],
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: Phone,
      enabled: false,
      status: "not_configured",
      lastTested: null,
      fields: [
        { key: "api_key", label: "API Key / Token", value: "", placeholder: "Meta Cloud API or Twilio token" },
        { key: "phone_id", label: "Phone Number ID", value: "", placeholder: "Business phone number ID" },
        { key: "sender", label: "Sender Phone Number", value: "", placeholder: "+977XXXXXXXXXX" },
      ],
    },
    {
      id: "messenger",
      name: "Facebook Messenger",
      icon: MessageCircle,
      enabled: false,
      status: "not_configured",
      lastTested: null,
      fields: [
        { key: "page_token", label: "Page Access Token", value: "", placeholder: "Your page access token" },
        { key: "page_id", label: "Page ID", value: "", placeholder: "Facebook Page ID" },
        { key: "app_secret", label: "App Secret", value: "", placeholder: "Meta app secret" },
      ],
    },
  ])

  const [testingId, setTestingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showFields, setShowFields] = useState<Record<string, boolean>>({})

  const toggleChannel = (id: string) => {
    setChannels(channels.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ))
  }

  const updateField = (channelId: string, fieldKey: string, value: string) => {
    setChannels(channels.map(c =>
      c.id === channelId
        ? { ...c, fields: c.fields.map(f => f.key === fieldKey ? { ...f, value } : f) }
        : c
    ))
  }

  const testChannel = (id: string) => {
    setTestingId(id)
    setTimeout(() => {
      setChannels(channels.map(c =>
        c.id === id ? { ...c, status: "connected", lastTested: new Date().toISOString() } : c
      ))
      setTestingId(null)
    }, 2000)
  }

  const saveChannel = (id: string) => {
    setSavingId(id)
    setTimeout(() => {
      setSavingId(null)
    }, 1000)
  }

  const toggleFieldVisibility = (channelId: string) => {
    setShowFields({ ...showFields, [channelId]: !showFields[channelId] })
  }

  const statusBadge = (status: AlertChannel["status"]) => {
    switch (status) {
      case "connected":
        return <Badge variant="secondary" className="text-green-600 bg-green-500/10 gap-1"><CheckCircle className="size-3" /> Connected</Badge>
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="size-3" /> Error</Badge>
      default:
        return <Badge variant="outline" className="gap-1 text-muted-foreground">Not Configured</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="size-5 text-primary" /> Alert Channels
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure system-wide notification delivery methods for user alerts
          </p>
        </div>

        <div className="space-y-6">
          {channels.map((channel) => {
            const Icon = channel.icon
            return (
              <Card key={channel.id} className={channel.enabled ? "border-primary/20" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg flex items-center justify-center ${
                        channel.enabled ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
                      }`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{channel.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {statusBadge(channel.status)}
                          {channel.lastTested && (
                            <span className="text-[10px] text-muted-foreground">
                              Last tested: {new Date(channel.lastTested).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => toggleChannel(channel.id)}>
                      {channel.enabled ? (
                        <Badge className="bg-primary text-white gap-1">Enabled</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">Disabled</Badge>
                      )}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {channel.fields.map((field) => (
                      <div key={field.key}>
                        <label className="text-sm font-medium mb-1.5 block">{field.label}</label>
                        <div className="relative">
                          <Input
                            type={showFields[channel.id] ? "text" : "password"}
                            placeholder={field.placeholder}
                            value={field.value}
                            onChange={(e) => updateField(channel.id, field.key, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => toggleFieldVisibility(channel.id)}
                    >
                      {showFields[channel.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {showFields[channel.id] ? "Hide" : "Show"} Values
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => testChannel(channel.id)}
                      disabled={testingId === channel.id}
                    >
                      {testingId === channel.id ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Testing...</>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => saveChannel(channel.id)}
                      disabled={savingId === channel.id}
                    >
                      {savingId === channel.id ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="size-3.5" /> Save</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </AdminLayout>
    </div>
  )
}
