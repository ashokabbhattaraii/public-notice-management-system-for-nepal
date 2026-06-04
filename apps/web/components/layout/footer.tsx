"use client"

import Link from "next/link"
import Image from "next/image"
import { Sun, Moon, Github } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const footerLinks = {
  Platform: [
    { label: "Browse Notices", href: "/notices" },
    { label: "Document Search (RAG)", href: "/rag" },
    { label: "Set Up Alerts", href: "/signup" },
    { label: "About the Project", href: "/about" },
  ],
  Resources: [
    { label: "API Documentation", href: "#" },
    { label: "Developer Guide", href: "#" },
    { label: "Open Data Access", href: "#" },
    { label: "System Status", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Data Retention Policy", href: "#" },
    { label: "Accessibility", href: "#" },
  ],
}

export function Footer() {
  const { theme, setTheme } = useTheme()

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand column */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center mb-5">
              <div className="dark:bg-white dark:rounded-lg dark:px-2 dark:py-1">
                <Image
                  src="/images/logo1.png"
                  alt="Suchana AI"
                  width={140}
                  height={49}
                  className="h-9 w-auto object-contain"
                />
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              An AI-powered, cloud-based platform aggregating Nepal&apos;s public government
              notices into a single searchable, accessible repository — classified and
              summarized by machine learning.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="size-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Github className="size-4" />
              </a>
              <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-md bg-muted border border-border/60">
                v1.0.0-beta
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/60 mb-4">
                {group}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-2 text-center md:text-left">
            <p className="text-xs text-muted-foreground">
              &copy; 2025 Suchana AI — AI-Powered Public Notice Management System for Nepal.
            </p>
            <span className="hidden md:inline text-muted-foreground/40 text-xs">·</span>
            <p className="text-xs text-muted-foreground">
              B.Sc. (Hons) IT Cloud Engineering — Asia Pacific University
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="gap-2 h-8 px-3 text-xs shrink-0"
            aria-label="Toggle theme"
          >
            <Sun className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="dark:hidden">Light mode</span>
            <span className="hidden dark:inline">Dark mode</span>
          </Button>
        </div>
      </div>
    </footer>
  )
}
