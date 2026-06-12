"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Shield, User } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

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
    <div className="flex min-h-screen w-full bg-white font-poppins antialiased">
      {/* Left panel — sign-in */}
      <div className="flex min-h-screen w-full flex-col justify-center px-8 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-10">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex w-fit items-center gap-2 text-base text-vez-mute transition-colors hover:text-vez-ink"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          {/* Brand */}
          <Link href="/" className="text-2xl font-normal text-vez-ink">
            Suchana<span className="text-vez-navy font-medium">&nbsp;AI</span>
          </Link>

          <div>
            <h1 className="text-[clamp(36px,4vw,48px)] font-normal leading-[1.15] tracking-[-0.04em] text-vez-ink">
              Welcome back.
            </h1>
            <p className="mt-3 text-base leading-6 text-vez-mute">
              Sign in to track notices, set alerts, and search documents.
            </p>
          </div>

          {/* Google sign in */}
          <div className="flex flex-col gap-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-vez-line bg-white px-6 py-3.5 text-base text-vez-ink transition-all duration-300 hover:-translate-y-0.5 hover:bg-vez-surface disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-vez-line" />
              <span className="text-sm text-vez-mute">or try a demo</span>
              <div className="h-px flex-1 bg-vez-line" />
            </div>

            {/* Demo login cards */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => demoLogin("admin")}
                disabled={loading}
                className="group flex flex-col items-center gap-3 rounded-[20px] bg-vez-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-vez-sky/30 disabled:opacity-50"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover:scale-110">
                  <Shield className="size-5 text-vez-navy" />
                </div>
                <div className="text-center">
                  <p className="text-base text-vez-ink">Admin</p>
                  <p className="text-sm text-vez-mute">Full access</p>
                </div>
              </button>

              <button
                onClick={() => demoLogin("user")}
                disabled={loading}
                className="group flex flex-col items-center gap-3 rounded-[20px] bg-vez-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-vez-sky/30 disabled:opacity-50"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover:scale-110">
                  <User className="size-5 text-vez-navy" />
                </div>
                <div className="text-center">
                  <p className="text-base text-vez-ink">User</p>
                  <p className="text-sm text-vez-mute">Standard</p>
                </div>
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-[12px] bg-[#fdecec] px-4 py-3 text-sm text-[#b3261e]">
                {error}
              </div>
            )}

            <p className="text-center text-sm leading-6 text-vez-mute">
              New here? Sign in with Google — your account is created automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — sky-blue brand statement */}
      <div className="hidden min-h-screen w-1/2 flex-col justify-between bg-vez-sky p-14 lg:flex">
        <p className="max-w-[14ch] text-[clamp(40px,3.8vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink">
          Every public notice. One place.
        </p>

        <div className="flex flex-col gap-8">
          <div className="max-w-md rounded-[24px] bg-white p-10">
            <blockquote>
              <p className="text-2xl font-normal leading-[1.35] text-vez-ink">
                “Transparent governance starts with accessible public notices.”
              </p>
              <footer className="mt-6 text-base text-vez-mute">
                Suchana AI — Nepal&apos;s AI-powered notice platform
              </footer>
            </blockquote>
          </div>

          <Link
            href="/notices"
            className="flex w-fit items-center gap-1.5 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-all duration-300 hover:-translate-y-0.5 hover:opacity-90"
          >
            Browse notices without signing in
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
