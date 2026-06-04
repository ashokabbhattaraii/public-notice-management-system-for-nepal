import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Suchana AI — Nepal's AI-Powered Public Notice Platform",
  description:
    "Suchana AI aggregates public notices across Nepal's government portals into one searchable platform. AI-powered OCR, NLP classification, and RAG document intelligence — built for every Nepali citizen.",
  keywords: [
    "Nepal government notices",
    "public notice management",
    "PSC notices",
    "Nepal tenders",
    "job vacancies Nepal",
    "AI document search",
    "RAG Nepal",
    "e-governance Nepal",
  ],
  openGraph: {
    title: "Suchana AI — Nepal's AI-Powered Public Notice Platform",
    description:
      "One centralized repository for every government notice across Nepal — searched, classified, and summarized by AI.",
    type: "website",
    images: [{ url: "/og/og-image.png", width: 1200, height: 630 }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
