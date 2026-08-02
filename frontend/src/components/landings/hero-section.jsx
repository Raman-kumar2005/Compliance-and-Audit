import React from 'react'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'

const frameworks = ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'EU AI Act', 'NIST']

const auditRows = [
  {
    control: 'AC-2 · Access reviews',
    framework: 'SOC 2 CC6.1',
    state: 'pass',
    detail: '412 identities reconciled',
  },
  {
    control: 'Model risk classification',
    framework: 'EU AI Act Art. 9',
    state: 'review',
    detail: '2 systems need reclassification',
  },
  {
    control: 'Encryption at rest',
    framework: 'ISO 27001 A.8.24',
    state: 'pass',
    detail: 'Evidence collected 4m ago',
  },
  {
    control: 'Vendor DPA coverage',
    framework: 'GDPR Art. 28',
    state: 'gap',
    detail: '1 processor missing agreement',
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
            Auditra reads your policies, controls, and system evidence, maps
            them to every framework you carry, and surfaces the exact gaps an
            auditor will find — before they do.
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
          <div className="pointer-events-none absolute -inset-x-10 -top-6 bottom-0 rounded-[2rem] bg-primary/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 bg-elevated/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              </div>
              <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
                audit-run · continuous · 2,184 controls
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/25">
                <span className="size-1.5 rounded-full bg-primary" />
                Live
              </span>
            </div>

            <div className="grid gap-px bg-border/50 sm:grid-cols-3">
              {[
                { label: 'Audit readiness', value: '96.4%' },
                { label: 'Open gaps', value: '7' },
                { label: 'Evidence freshness', value: '4m' },
              ].map((stat) => (
                <div key={stat.label} className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <ul className="divide-y divide-border/50">
              {auditRows.map((row) => (
                <li
                  key={row.control}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.control}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {row.framework}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {row.detail}
                    </p>
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${stateStyles[row.state]}`}
                    >
                      {stateLabels[row.state]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}