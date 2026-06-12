"use client"

import React, { useState } from "react"
import {
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

const fieldClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

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
        return (
          <span className="flex items-center gap-1 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
            <CheckCircle className="size-3" /> Connected
          </span>
        )
      case "error":
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">
            <XCircle className="size-3" /> Error
          </span>
        )
      default:
        return (
          <span className="rounded-full border border-vez-line px-3 py-1 text-xs text-vez-mute">
            Not configured
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8">
          <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Alert channels.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">
            Configure system-wide notification delivery methods for user alerts
          </p>
        </div>

        <div className="space-y-6">
          {channels.map((channel) => {
            const Icon = channel.icon
            return (
              <div key={channel.id} className="rounded-[20px] bg-white p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex size-11 items-center justify-center rounded-full ${
                      channel.enabled ? "bg-vez-navy text-white" : "bg-vez-surface text-vez-mute"
                    }`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg text-vez-ink">{channel.name}</h2>
                      <div className="mt-1.5 flex items-center gap-2">
                        {statusBadge(channel.status)}
                        {channel.lastTested && (
                          <span className="text-[10px] text-vez-mute">
                            Last tested: {new Date(channel.lastTested).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleChannel(channel.id)}
                    className={`rounded-full px-4 py-2 text-xs transition-colors ${
                      channel.enabled
                        ? "bg-vez-navy text-white hover:opacity-90"
                        : "border border-vez-line text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
                    }`}
                  >
                    {channel.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {channel.fields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-2 block text-sm text-vez-mute">{field.label}</label>
                      <input
                        type={showFields[channel.id] ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={field.value}
                        onChange={(e) => updateField(channel.id, field.key, e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2.5">
                  <button
                    className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
                    onClick={() => toggleFieldVisibility(channel.id)}
                  >
                    {showFields[channel.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showFields[channel.id] ? "Hide" : "Show"} values
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-50"
                    onClick={() => testChannel(channel.id)}
                    disabled={testingId === channel.id}
                  >
                    {testingId === channel.id ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Testing…</>
                    ) : (
                      "Test connection"
                    )}
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded-full bg-vez-navy px-4 py-2 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    onClick={() => saveChannel(channel.id)}
                    disabled={savingId === channel.id}
                  >
                    {savingId === channel.id ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="size-3.5" /> Save</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </AdminLayout>
    </div>
  )
}
