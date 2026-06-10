"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, Shield, User } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Logo } from "@/components/ui/logo"

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

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

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)
    const success = await loginWithGoogle()
    if (success) {
      router.push("/dashboard")
    } else {
      setError("Google sign-in failed. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="w-full flex flex-row-reverse">
        {/* Left panel - Login Form */}
        <div className="relative w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12 bg-background overflow-hidden min-h-screen">
          {/* Technical grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="login-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#login-grid)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col gap-8 max-w-md mx-auto w-full">
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-indigo-400 transition-colors w-fit font-mono uppercase tracking-wide"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>

            {/* Logo */}
            <div>
              <Logo size="md" />
            </div>

            {/* Tactical container */}
            <div className="relative bg-secondary border border-border p-6 md:p-8">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500" />

              {/* System label */}
              <div className="absolute -top-2.5 left-6 bg-background px-3 text-[10px] font-mono text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-indigo-500" />
                </span>
                [AUTH_INTERFACE]
              </div>

              <div className="space-y-6">
                {/* Heading */}
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground uppercase tracking-tight">
                    Access Portal
                  </h1>
                  <p className="text-sm text-muted-foreground font-mono uppercase tracking-wide">
                    Sign in to continue
                  </p>

                  {/* Scan line */}
                  <div className="flex pt-2">
                    <div className="h-0.5 w-16 bg-indigo-500/30 overflow-hidden relative">
                      <div className="absolute inset-0 bg-indigo-500 w-full h-full animate-[scanline_2s_linear_infinite]" />
                    </div>
                  </div>
                </div>

                {/* Demo login cards */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider font-mono font-semibold">
                    Quick Demo Access
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => demoLogin("admin")}
                      disabled={loading}
                      className="relative group bg-card border border-border p-4 flex flex-col items-center gap-3 hover:border-indigo-500/40 transition-all duration-300 disabled:opacity-50"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-500" />
                      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-500" />
                      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-500" />
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-500" />

                      {/* Hover scan */}
                      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      <div className="relative size-10 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Shield className="size-5 text-indigo-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Admin</p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Full Access</p>
                      </div>
                    </button>

                    <button
                      onClick={() => demoLogin("user")}
                      disabled={loading}
                      className="relative group bg-card border border-border p-4 flex flex-col items-center gap-3 hover:border-indigo-500/40 transition-all duration-300 disabled:opacity-50"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-500" />
                      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-500" />
                      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-500" />
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-500" />

                      {/* Hover scan */}
                      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      <div className="relative size-10 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <User className="size-5 text-indigo-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground uppercase tracking-wide">User</p>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Standard</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Google sign in */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="relative group w-full flex items-center justify-center gap-3 py-3.5 bg-card border border-border hover:border-indigo-500/40 transition-all duration-300 disabled:opacity-50"
                >
                  <div className="absolute top-0 left-0 w-1 h-1 bg-indigo-500" />

                  {/* Hover scan */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <GoogleIcon />
                  <span className="text-sm font-medium text-foreground uppercase tracking-wide">
                    {loading ? "Authenticating..." : "Continue with Google"}
                  </span>
                </button>

                {/* Error message */}
                {error && (
                  <div className="relative bg-destructive/10 border border-destructive/30 p-3">
                    <div className="absolute top-0 left-0 w-1 h-1 bg-destructive" />
                    <p className="text-xs text-destructive font-mono">{error}</p>
                  </div>
                )}

                {/* Info text */}
                <p className="text-[10px] text-muted-foreground text-center font-mono uppercase tracking-wide leading-relaxed">
                  New? Sign in with Google<br />Account created automatically
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Image */}
        <div className="hidden lg:block w-1/2 relative overflow-hidden min-h-screen">
          <Image
            src="https://images.pexels.com/photos/7102037/pexels-photo-7102037.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            loader={({ src }) => src}
            fill
            priority
            alt="Public notices"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-[#0B1220]/40 to-[#0B1220]/80" />

          {/* Quote overlay with tactical design */}
          <div className="absolute inset-0 flex flex-col justify-end p-10">
            <div className="relative bg-card backdrop-blur-xl border border-border p-8 max-w-lg">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400" />

              <blockquote className="text-foreground">
                <p className="text-xl font-semibold leading-snug mb-4 uppercase tracking-tight">
                  "Transparent governance starts with accessible public notices."
                </p>
                <div className="h-0.5 w-16 bg-indigo-500/30 overflow-hidden relative mb-4">
                  <div className="absolute inset-0 bg-indigo-500 w-full h-full animate-[scanline_2s_linear_infinite]" />
                </div>
                <footer className="text-sm text-muted-foreground font-mono uppercase tracking-wide">
                  Suchana AI — Nepal's AI-Powered Notice Platform
                </footer>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
