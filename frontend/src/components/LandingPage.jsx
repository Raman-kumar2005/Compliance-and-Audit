import SiteHeader from './landings/site-header'
import HeroSection from './landings/hero-section'
import  ProblemSection  from './landings/problem-section'
import  FeaturesSection  from './landings/features-section'
import  HowItWorksSection  from './landings/how-it-works-section' // Match your filename without 's'
import  TrustSection  from './landings/trust-section'
import  CtaSection  from './landings/cta-section'
import  SiteFooter  from './landings/site-footer'

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SiteHeader onSignIn={onSignIn} />
      <main>
        <HeroSection onGetStarted={onGetStarted} />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <CtaSection onGetStarted={onGetStarted} />
      </main>
      <SiteFooter />
    </div>
  )
}