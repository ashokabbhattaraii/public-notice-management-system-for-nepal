"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  User,
  Globe,
  Bell,
  AlertCircle,
  Mail,
  Phone,
  MessageCircle,
  CheckCircle,
  Info,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"

export default function SettingsPage() {
  const { user } = useAuth()
  const { language, setLanguage } = useLanguage()

  const [alertPrefs, setAlertPrefs] = useState({
    email: { enabled: true, value: user?.email || "" },
    whatsapp: { enabled: false, value: "+977" },
    messenger: { enabled: false, connected: false },
  })

  // Simulating admin-enabled channels
  const adminChannels = {
    email: true,
    whatsapp: true,
    messenger: false,
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Please sign in to access settings.</p>
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

  const toggleButton = (enabled: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs transition-colors ${
        enabled
          ? "bg-vez-navy text-white hover:opacity-90"
          : "border border-vez-line text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </button>
  )

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        <div className="mb-8">
          <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            Settings.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">Manage your account and alert preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <div className="rounded-[20px] bg-white p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg text-vez-ink">
              <User className="size-4 text-vez-navy" /> Profile
            </h2>
            <p className="mt-1 text-sm text-vez-mute">Your account information</p>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { label: "Username", value: user.username },
                { label: "Email", value: user.email },
                { label: "Role", value: user.role, capitalize: true },
                { label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-sm text-vez-mute">{item.label}</p>
                  <p className={`mt-1 text-base text-vez-ink ${item.capitalize ? "capitalize" : ""}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Preferences */}
          <div className="rounded-[20px] bg-white p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg text-vez-ink">
              <Bell className="size-4 text-vez-navy" /> Alert preferences
            </h2>
            <p className="mt-1 text-sm text-vez-mute">Choose how you want to receive notice alerts</p>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2.5 rounded-[14px] bg-vez-surface px-4 py-3">
                <Info className="mt-0.5 size-4 shrink-0 text-vez-mute" />
                <p className="text-xs text-vez-mute">
                  You will only receive alerts through channels your administrator has configured.
                </p>
              </div>

              {/* Email - always available */}
              <div className="flex items-center justify-between rounded-[16px] bg-vez-surface p-5">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-white">
                    <Mail className="size-4 text-vez-navy" />
                  </div>
                  <div>
                    <p className="text-sm text-vez-ink">Email</p>
                    <p className="text-xs text-vez-mute">{alertPrefs.email.value}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
                    <CheckCircle className="size-3" /> Available
                  </span>
                  {toggleButton(alertPrefs.email.enabled, () =>
                    setAlertPrefs({ ...alertPrefs, email: { ...alertPrefs.email, enabled: !alertPrefs.email.enabled } })
                  )}
                </div>
              </div>

              {/* WhatsApp - only if admin enabled */}
              {adminChannels.whatsapp && (
                <div className="flex items-center justify-between rounded-[16px] bg-vez-surface p-5">
                  <div className="flex flex-1 items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white">
                      <Phone className="size-4 text-vez-navy" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-vez-ink">WhatsApp</p>
                      {alertPrefs.whatsapp.enabled ? (
                        <input
                          className="mt-1.5 h-8 w-44 rounded-full border border-vez-line bg-white px-3.5 text-xs text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
                          placeholder="+977XXXXXXXXXX"
                          value={alertPrefs.whatsapp.value}
                          onChange={(e) => setAlertPrefs({ ...alertPrefs, whatsapp: { ...alertPrefs.whatsapp, value: e.target.value } })}
                        />
                      ) : (
                        <p className="text-xs text-vez-mute">Receive alerts on WhatsApp</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
                      <CheckCircle className="size-3" /> Available
                    </span>
                    {toggleButton(alertPrefs.whatsapp.enabled, () =>
                      setAlertPrefs({ ...alertPrefs, whatsapp: { ...alertPrefs.whatsapp, enabled: !alertPrefs.whatsapp.enabled } })
                    )}
                  </div>
                </div>
              )}

              {/* Facebook Messenger */}
              {adminChannels.messenger ? (
                <div className="flex items-center justify-between rounded-[16px] bg-vez-surface p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white">
                      <MessageCircle className="size-4 text-vez-navy" />
                    </div>
                    <div>
                      <p className="text-sm text-vez-ink">Facebook Messenger</p>
                      <p className="text-xs text-vez-mute">
                        {alertPrefs.messenger.connected ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {alertPrefs.messenger.connected ? (
                    toggleButton(alertPrefs.messenger.enabled, () =>
                      setAlertPrefs({ ...alertPrefs, messenger: { ...alertPrefs.messenger, enabled: !alertPrefs.messenger.enabled } })
                    )
                  ) : (
                    <button
                      className="rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
                      onClick={() => setAlertPrefs({ ...alertPrefs, messenger: { ...alertPrefs.messenger, connected: true, enabled: true } })}
                    >
                      Connect Facebook
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-[16px] bg-vez-surface p-5 opacity-60">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white">
                      <MessageCircle className="size-4 text-vez-mute" />
                    </div>
                    <div>
                      <p className="text-sm text-vez-mute">Facebook Messenger</p>
                      <p className="text-xs text-vez-mute">Not enabled by administrator</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-vez-line px-3 py-1 text-xs text-vez-mute">Unavailable</span>
                </div>
              )}

              <button className="mt-2 rounded-full bg-vez-navy px-6 py-3 text-sm text-white transition-opacity hover:opacity-90">
                Save preferences
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="rounded-[20px] bg-white p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg text-vez-ink">
              <Globe className="size-4 text-vez-navy" /> Language
            </h2>
            <p className="mt-1 text-sm text-vez-mute">Choose your preferred language</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setLanguage("en")}
                className={`rounded-full px-5 py-2.5 text-sm transition-colors ${
                  language === "en"
                    ? "bg-vez-navy text-white"
                    : "border border-vez-line text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("ne")}
                className={`rounded-full px-5 py-2.5 text-sm transition-colors ${
                  language === "ne"
                    ? "bg-vez-navy text-white"
                    : "border border-vez-line text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
                }`}
              >
                नेपाली
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  )
}
