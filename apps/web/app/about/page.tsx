"use client"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Shield, Globe, Zap, Users, Database, Lock } from "lucide-react"

export default function AboutPage() {
  const features = [
    { icon: Shield, title: "Verified & authentic", description: "All notices are sourced directly from official government channels and verified before publication." },
    { icon: Globe, title: "Multilingual support", description: "Available in English and Nepali, with plans to support additional local languages." },
    { icon: Zap, title: "Real-time updates", description: "Automated scraping ensures the latest notices are available within minutes of publication." },
    { icon: Users, title: "500+ institutions", description: "Aggregating notices from ministries, commissions, departments, and local bodies across Nepal." },
    { icon: Database, title: "AI-powered search", description: "RAG-powered document intelligence for natural language queries across all government documents." },
    { icon: Lock, title: "Secure & reliable", description: "Enterprise-grade security with 99.9% uptime and data integrity guarantees." },
  ]

  const steps = [
    { title: "Browse or search", text: "Use the search bar or category filters to find relevant notices." },
    { title: "Create an account", text: "Sign up to save notices, set up alerts, and access personalized features." },
    { title: "Set up alerts", text: "Configure keyword, category, or organization-based alerts to get notified instantly." },
    { title: "Use document search", text: "Ask questions about government policies using our AI-powered document search." },
  ]

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />

      {/* Hero */}
      <section className="bg-vez-sky">
        <div className="mx-auto max-w-[1480px] px-6 py-20 md:px-8 md:py-28 lg:px-12">
          <p className="text-base text-vez-ink/70">About Suchana AI</p>
          <h1 className="mt-4 max-w-[16ch] text-[clamp(40px,5.5vw,80px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink">
            Nepal&apos;s public notice repository.
          </h1>
          <p className="mt-6 max-w-[52ch] text-base leading-6 text-vez-ink/80 md:text-lg">
            A centralized platform making government communication transparent, accessible,
            and searchable for all citizens of Nepal.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <h2 className="text-[clamp(32px,3.5vw,48px)] font-normal leading-[1.15] tracking-[-0.03em] text-vez-ink">
              Our mission.
            </h2>
            <div className="space-y-5 text-base leading-7 text-vez-mute">
              <p>
                Suchana AI was created to bridge the gap between government institutions and citizens.
                In a country where important notices are scattered across hundreds of websites, notice boards,
                and newspapers, finding relevant information has always been a challenge.
              </p>
              <p>
                Our platform aggregates, verifies, and organizes public notices from across all levels of
                government — making it possible for citizens to search, filter, and receive alerts for
                notices that matter to them.
              </p>
              <p>
                Whether you&apos;re a job seeker looking for vacancy announcements, a contractor tracking
                tenders, or a student preparing for competitive exams, Suchana AI ensures you never miss
                an important update.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-vez-surface">
        <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12">
          <h2 className="max-w-[18ch] text-[clamp(32px,3.5vw,48px)] font-normal leading-[1.15] tracking-[-0.03em] text-vez-ink">
            Built for trust, speed, and reach.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="rounded-[20px] bg-white p-8 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-vez-sky/40">
                    <Icon className="size-5 text-vez-navy" />
                  </div>
                  <h3 className="mt-5 text-lg text-vez-ink">{feature.title}</h3>
                  <p className="mt-2 text-base leading-6 text-vez-mute">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12">
          <h2 className="max-w-[16ch] text-[clamp(32px,3.5vw,48px)] font-normal leading-[1.15] tracking-[-0.03em] text-vez-ink">
            How to use.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="border-t border-vez-line pt-6">
                <p className="text-sm text-vez-mute">0{i + 1}</p>
                <h3 className="mt-2 text-lg text-vez-ink">{step.title}</h3>
                <p className="mt-2 text-base leading-6 text-vez-mute">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="bg-vez-surface">
        <div className="mx-auto max-w-[1480px] px-6 py-16 text-center md:px-8 lg:px-12">
          <h3 className="text-2xl font-normal tracking-[-0.02em] text-vez-ink">Contact</h3>
          <p className="mt-3 text-base text-vez-mute">
            For inquiries, contact us at{" "}
            <a href="mailto:info@suchana.ai" className="text-vez-navy hover:underline">info@suchana.ai</a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
