import React from 'react'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import LiveAuditPreview from './LiveAuditPreview'

const frameworks = ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'EU AI Act', 'NIST']

const auditRows = [
  {
    control: 'Access Control',
    framework: 'Policy 2.1 · Access Reviews',
    state: 'gap',
    detail: 'Unauthorized S3 resource sharing detected',
  },
  {
    control: 'Data Protection',
    framework: 'Policy 3.2 · API Keys Exposure',
    state: 'gap',
    detail: 'GitHub commit sk_live_...2ross exposed',
  },
  {
    control: 'Employee Classification',
    framework: 'Policy 4.3 · Training Schedule',
    state: 'review',
    detail: 'Employee Ross exceeds 60-day training buffer',
  },
  {
    control: 'Working Hours',
    framework: 'Policy 5.1 · Shift Allocation',
    state: 'pass',
    detail: 'All shifts reconcile with timecard limits',
  },
]

const stateStyles = {
  pass: 'bg-primary/15 text-primary ring-primary/30',
  review: 'bg-accent/15 text-accent ring-accent/30',
  gap: 'bg-destructive/15 text-destructive ring-destructive/30',
}

const stateLabels = {
  pass: 'Passing',
  review: 'Review',
  gap: 'Gap',
}

export default function HeroSection({ onGetStarted }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            AI-native compliance auditing
          </span>

          <h1 className="mt-7 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Continuous compliance audits,{' '}
            <span className="text-primary">run by AI</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
            AI Compliance Auditor scans corporate policies and raw system logs, maps 
            them to core organizational guidelines, and surfaces severity gaps 
            and violations instantly using advanced Gemini reasoning.
          </p>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none cursor-pointer"
            >
              Get Started
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
            <p className="text-xs text-muted-foreground">
              Read-only integrations · No agents to install
            </p>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {frameworks.map((framework) => (
              <li
                key={framework}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                <CheckCircle2
                  className="size-3.5 text-primary/70"
                  aria-hidden="true"
                />
                {framework}
              </li>
            ))}
          </ul>
        </div>

        {/* Product visual */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <LiveAuditPreview />
        </div>
      </div>
    </section>
  )
}