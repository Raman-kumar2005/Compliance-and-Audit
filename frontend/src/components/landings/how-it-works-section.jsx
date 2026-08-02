const steps = [
  {
    number: '01',
    title: 'Connect your systems',
    body: 'Grant read-only access to cloud, identity, code, and ticketing tools. Auditra builds an inventory of controls, owners, and AI systems in minutes.',
    meta: 'Read-only · SSO · no agents',
  },
  {
    number: '02',
    title: 'Map frameworks once',
    body: 'Select the frameworks in scope. The engine aligns each requirement to existing controls and highlights what has no coverage at all.',
    meta: 'SOC 2 · ISO 27001 · HIPAA · GDPR · EU AI Act',
  },
  {
    number: '03',
    title: 'Audit runs continuously',
    body: 'Checks execute on schedule, evidence is refreshed automatically, and findings are scored by audit impact as your environment changes.',
    meta: 'Drift detection · severity scoring',
  },
  {
    number: '04',
    title: 'Export the evidence package',
    body: 'Hand auditors a complete, timestamped package with control narratives, source citations, and a full review trail attached.',
    meta: 'PDF · CSV · JSON',
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
