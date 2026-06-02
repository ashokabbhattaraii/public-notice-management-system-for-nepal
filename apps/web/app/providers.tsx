"use client"

import { AuthProvider } from "@/lib/auth-context"
import { LanguageProvider } from "@/lib/language-context"
import { AlertsProvider } from "@/lib/alerts-context"
import { FloatingChat } from "@/components/floating-chat"
import { AlertCtaBanner } from "@/components/alert-cta-banner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AlertsProvider>
          {children}
          <FloatingChat />
          <AlertCtaBanner />
        </AlertsProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}
