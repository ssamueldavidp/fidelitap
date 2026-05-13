import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CtaSection } from '@/components/landing/cta-section'

export default function HomePage() {
  return (
    <div className="bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <CtaSection />
    </div>
  )
}
