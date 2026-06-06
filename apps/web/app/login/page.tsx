"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Shield, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { loginWithGoogle } = useAuth()
  const router = useRouter()

  const demoLogin = async (role: "admin" | "user") => {
    setError("")
    setLoading(true)
    const success = await loginWithGoogle(role)

    if (success) {
      router.push(role === "admin" ? "/admin" : "/dashboard")
    } else {
      setError("Demo login failed.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 bg-muted/30" />

      <Card className="w-full max-w-md relative z-10 bg-card/95 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="size-10 rounded-xl gradient-primary flex items-center justify-center">
              <FileText className="size-5 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in with Google to access Suchana AI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground text-center mb-3">Quick demo login</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2 h-auto py-3 flex-col"
                  onClick={() => demoLogin("admin")}
                  disabled={loading}
                >
                  <Shield className="size-5 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Admin</p>
                    <p className="text-[10px] text-muted-foreground">Full access</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-auto py-3 flex-col"
                  onClick={() => demoLogin("user")}
                  disabled={loading}
                >
                  <User className="size-5 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium">User</p>
                    <p className="text-[10px] text-muted-foreground">Standard access</p>
                  </div>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or sign in with</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={async () => {
                setError("")
                setLoading(true)
                const success = await loginWithGoogle()
                if (success) {
                  router.push("/dashboard")
                } else {
                  setError("Google sign-in failed. Please try again.")
                }
                setLoading(false)
              }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Continue with Google"}
            </Button>

            <p className="text-sm text-muted-foreground">
              Suchana AI only supports Google login. No username or password is required.
            </p>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
            )}

            <p className="text-center text-sm text-muted-foreground mt-2">
              New to Suchana AI? Just use Google to sign in — no separate signup needed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
