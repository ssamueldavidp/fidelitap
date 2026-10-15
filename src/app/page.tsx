import { DM_Sans, Outfit } from 'next/font/google'
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { PricingSection } from '@/components/landing/pricing-section'
import { CtaSection } from '@/components/landing/cta-section'
import '@/components/landing/landing.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-outfit', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm', display: 'swap' })

export default function HomePage() {
  return (
    <div className={`lp ${outfit.variable} ${dmSans.variable}`}>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingSection />
      <CtaSection />
    </div>
  )
}
