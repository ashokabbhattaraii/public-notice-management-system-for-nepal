"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="size-[34px]" />

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-all duration-200 px-3 py-1.5 rounded-full hover:bg-accent"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span className="font-semibold tracking-wide">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  )
}
