const steps = [
  {
    number: '01',
    title: 'Upload corporate documents & logs',
    body: 'Upload security policy guidelines alongside raw server logs, authentication records, or timecards to begin evaluation.',
    meta: 'PDF policy uploads · JSON/CSV log drops · demo simulation',
  },
  {
    number: '02',
    title: 'AI reasoning engine scans content',
    body: 'Our Gemini-powered compliance engine parses logs in real-time, mapping entries against corporate guidelines to locate gaps.',
    meta: 'Gemini reasoning · automatic mapping · zero config coding',
  },
  {
    number: '03',
    title: 'Assess risk scores & summaries',
    body: 'Review your visual compliance breakdown card, overall risk gauge, and read plain-English executive summary insight panels.',
    meta: '0-100 radial risk gauges · 5 core compliance pillars',
  },
  {
    number: '04',
    title: 'Drill down & resolve alerts',
    body: 'Click any violation to inspect code blocks of raw log evidence, log mitigation updates, and instantly generate PDF audit reports.',
    meta: 'Drill-Down Modal · auditor note signatures · PDF export templates',
  },
]

export default function HowItWorksSection({ onGetStarted }) {
  return (
    <section
      id="how-it-works"
      className="relative border-b border-border/60 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
            How it works
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
            From first connection to audit-ready in four steps
          </h2>
        </div>

        <ol className="relative mt-14 grid gap-5 lg:grid-cols-2">
          {steps.map((step) => (
            <li
              key={step.number}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-7 transition-colors hover:border-primary/35"
            >
              <span
                className="pointer-events-none absolute top-4 right-6 font-mono text-6xl font-semibold text-primary/10 select-none"
                aria-hidden="true"
              >
                {step.number}
              </span>
              <div className="relative flex flex-col gap-3">
                <span className="inline-flex w-fit items-center rounded-md bg-primary/12 px-2 py-1 font-mono text-[11px] font-medium text-primary ring-1 ring-primary/25">
                  Step {step.number}
                </span>
                <h3 className="text-lg font-medium tracking-tight">
                  {step.title}
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <p className="mt-2 border-t border-border/60 pt-3 font-mono text-[11px] tracking-wide text-muted-foreground/80">
                  {step.meta}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
