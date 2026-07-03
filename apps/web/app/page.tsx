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

export default function HomePage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white font-poppins antialiased">
      <Header />
      <NewsTicker />
      <VezignoHero />
      <VezignoNotices />
      <VezignoProblem />
      <VezignoSolution />
      <VezignoFeatures />
      <VezignoDemo />
      <VezignoPricing />
      <VezignoFeedback />
      <VezignoCta />
      <VezignoFooter />
    </div>
  )
}
