const STACK = [
  'Next.js 16',
  'TypeScript',
  'Tailwind v4',
  'Supabase',
  'Vercel',
  'Anthropic Claude',
  'Google APIs',
  'GitHub Actions',
]

export function StackStrip() {
  return (
    <section className="border-b border-landing-border bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
              How it&apos;s built
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-landing-primary">
              Standard stack, spec-driven workflow.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-landing-secondary">
              No exotic frameworks. The interesting part is the workflow:
              every feature starts as a spec in{' '}
              <a
                href="https://github.com/Gyoungd/job-engine-web/blob/main/PRODUCT_SPEC.md"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-landing-muted px-1 py-0.5 font-mono text-[12px] text-landing-primary underline decoration-landing-border underline-offset-2 transition-colors hover:bg-landing-border hover:decoration-landing-accent"
              >
                PRODUCT_SPEC.md
              </a>
              , then Claude Code authors the implementation under direction.
              I own the architecture, schema, and review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span
                key={s}
                className="rounded-lg border border-landing-border bg-landing-bg px-3 py-1.5 font-mono text-xs font-medium text-landing-primary transition-colors hover:border-zinc-300 hover:bg-white"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
