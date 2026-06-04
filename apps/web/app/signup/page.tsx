"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function SignupPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_70%)]" />

      <Card className="w-full max-w-md relative z-10 bg-card/95 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="size-10 rounded-xl gradient-primary flex items-center justify-center">
              <FileText className="size-5 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Suchana AI uses Google sign-in only; no email/password signup is required.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Authentication is handled through Google only. Click the button below to sign in and begin using Suchana AI.
            </p>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => router.push("/login")}
            >
              Go to Google login
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in with Google
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
