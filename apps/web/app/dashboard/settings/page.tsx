"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Settings,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
              <p className="text-muted-foreground mb-4">Please sign in to access settings</p>
              <Link href="/login"><Button>Sign In</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="size-5 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account and alert preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="size-4" /> Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="mt-1 font-medium">{user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="mt-1 font-medium">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <p className="mt-1 font-medium capitalize">{user.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Member since</label>
                  <p className="mt-1 font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alert Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="size-4" /> Alert Preferences
              </CardTitle>
              <CardDescription>Choose how you want to receive notice alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  You will only receive alerts through channels your administrator has configured.
                </p>
              </div>

              {/* Email - always available */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">{alertPrefs.email.value}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-green-600 bg-green-500/10 gap-1 text-xs">
                    <CheckCircle className="size-3" /> Available
                  </Badge>
                  <Button
                    variant={alertPrefs.email.enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAlertPrefs({ ...alertPrefs, email: { ...alertPrefs.email, enabled: !alertPrefs.email.enabled } })}
                  >
                    {alertPrefs.email.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>

              {/* WhatsApp - only if admin enabled */}
              {adminChannels.whatsapp && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Phone className="size-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">WhatsApp</p>
                      {alertPrefs.whatsapp.enabled ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            className="h-7 text-xs w-40"
                            placeholder="+977XXXXXXXXXX"
                            value={alertPrefs.whatsapp.value}
                            onChange={(e) => setAlertPrefs({ ...alertPrefs, whatsapp: { ...alertPrefs.whatsapp, value: e.target.value } })}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Receive alerts on WhatsApp</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-green-600 bg-green-500/10 gap-1 text-xs">
                      <CheckCircle className="size-3" /> Available
                    </Badge>
                    <Button
                      variant={alertPrefs.whatsapp.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAlertPrefs({ ...alertPrefs, whatsapp: { ...alertPrefs.whatsapp, enabled: !alertPrefs.whatsapp.enabled } })}
                    >
                      {alertPrefs.whatsapp.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Facebook Messenger */}
              {adminChannels.messenger ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <MessageCircle className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Facebook Messenger</p>
                      <p className="text-xs text-muted-foreground">
                        {alertPrefs.messenger.connected ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alertPrefs.messenger.connected ? (
                      <Button
                        variant={alertPrefs.messenger.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAlertPrefs({ ...alertPrefs, messenger: { ...alertPrefs.messenger, enabled: !alertPrefs.messenger.enabled } })}
                      >
                        {alertPrefs.messenger.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setAlertPrefs({ ...alertPrefs, messenger: { ...alertPrefs.messenger, connected: true, enabled: true } })}>
                        Connect Facebook
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-accent flex items-center justify-center">
                      <MessageCircle className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Facebook Messenger</p>
                      <p className="text-xs text-muted-foreground">Not enabled by administrator</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">Unavailable</Badge>
                </div>
              )}

              <Button className="mt-2">Save Preferences</Button>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="size-4" /> Language
              </CardTitle>
              <CardDescription>Choose your preferred language</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  variant={language === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("en")}
                >
                  English
                </Button>
                <Button
                  variant={language === "ne" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("ne")}
                >
                  नेपाली
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
      
    </div>
  )
}
