import React from 'react'
import { ArrowRight } from 'lucide-react'

export function CtaSection({ onGetStarted }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 py-20 md:py-28">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_50%,black,transparent_70%)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Ready to streamline your compliance audits?
          </h2>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Get instant visibility into control gaps, automated evidence evaluation, and auditor-ready reporting.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none cursor-pointer"
            >
              Get Started Now
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            No credit card required · Free setup support
          </p>
        </div>
      </div>
    </section>
  )
}

export default CtaSection