"use client"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Globe, Zap, Users, Database, Lock } from "lucide-react"

export default function AboutPage() {
  const features = [
    { icon: Shield, title: "Verified & Authentic", description: "All notices are sourced directly from official government channels and verified before publication." },
    { icon: Globe, title: "Multilingual Support", description: "Available in English and Nepali, with plans to support additional local languages." },
    { icon: Zap, title: "Real-time Updates", description: "Automated scraping ensures the latest notices are available within minutes of publication." },
    { icon: Users, title: "500+ Institutions", description: "Aggregating notices from ministries, commissions, departments, and local bodies across Nepal." },
    { icon: Database, title: "AI-Powered Search", description: "RAG-powered document intelligence for natural language queries across all government documents." },
    { icon: Lock, title: "Secure & Reliable", description: "Enterprise-grade security with 99.9% uptime and data integrity guarantees." },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary/20">About GovNotice</Badge>
          <h1 className="text-4xl font-bold mb-4">
            Nepal&apos;s <span className="gradient-text">Public Notice</span> Repository
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A centralized platform making government communication transparent, accessible,
            and searchable for all citizens of Nepal.
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none mb-16">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                GovNotice was created to bridge the gap between government institutions and citizens.
                In a country where important notices are scattered across hundreds of websites, notice boards,
                and newspapers, finding relevant information has always been a challenge.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Our platform aggregates, verifies, and organizes public notices from across all levels of
                government — making it possible for citizens to search, filter, and receive alerts for
                notices that matter to them.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Whether you&apos;re a job seeker looking for vacancy announcements, a contractor tracking
                tenders, or a student preparing for competitive exams, GovNotice ensures you never miss
                an important update.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <Card key={i} className="bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all">
                <CardContent className="p-6">
                  <div className="size-10 rounded-lg gradient-primary flex items-center justify-center mb-4">
                    <Icon className="size-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-4">How to Use</h2>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="size-6 rounded-full gradient-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span><strong className="text-foreground">Browse or Search:</strong> Use the search bar or category filters to find relevant notices.</span>
              </li>
              <li className="flex gap-3">
                <span className="size-6 rounded-full gradient-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span><strong className="text-foreground">Create an Account:</strong> Sign up to save notices, set up alerts, and access personalized features.</span>
              </li>
              <li className="flex gap-3">
                <span className="size-6 rounded-full gradient-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span><strong className="text-foreground">Set Up Alerts:</strong> Configure keyword, category, or organization-based alerts to get notified instantly.</span>
              </li>
              <li className="flex gap-3">
                <span className="size-6 rounded-full gradient-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span><strong className="text-foreground">Use Document Search:</strong> Ask questions about government policies using our AI-powered document search.</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="text-center mt-16">
          <h3 className="text-lg font-semibold mb-2">Contact</h3>
          <p className="text-sm text-muted-foreground">
            For inquiries, contact us at <span className="text-primary">info@govnotice.gov.np</span>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
