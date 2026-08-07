import { Header } from "@/components/layout/header"
import { NewsTicker } from "@/components/landing/news-ticker"
import { VezignoHero } from "@/components/landing/vezigno-hero"
import { VezignoNotices } from "@/components/landing/vezigno-notices"
import { VezignoProblem } from "@/components/landing/vezigno-problem"
import { VezignoSolution } from "@/components/landing/vezigno-solution"
import { VezignoFeatures } from "@/components/landing/vezigno-features"
import { VezignoDemo } from "@/components/landing/vezigno-demo"
import { VezignoPricing } from "@/components/landing/vezigno-pricing"
import { VezignoFeedback } from "@/components/landing/vezigno-feedback"
import { VezignoCta } from "@/components/landing/vezigno-cta"
import { VezignoFooter } from "@/components/landing/vezigno-footer"
import { getLandingData } from "@/lib/landing-data"

export default async function HomePage() {
  const data = await getLandingData()

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white font-poppins antialiased">
      <Header />
      <NewsTicker headlines={data?.latest} />
      <VezignoHero sourceCount={data?.sourceCount ?? null} categories={data?.categoryCounts ?? null} />
      <VezignoNotices latest={data?.latest ?? []} totalNotices={data?.totalNotices ?? null} sourceCount={data?.sourceCount ?? null} categoryCounts={data?.categoryCounts ?? null} />
      <VezignoProblem />
      <VezignoSolution />
      <VezignoFeatures />
      <VezignoDemo notices={data?.latest} />
      <VezignoPricing />
      <VezignoFeedback />
      <VezignoCta />
      <VezignoFooter />
    </div>
  )
}
