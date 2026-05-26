import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-landing-border">
      {/* Subtle grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #18181b 1px, transparent 1px), linear-gradient(to bottom, #18181b 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 sm:px-8 sm:pt-28 lg:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-landing-border bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-landing-secondary backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-landing-accent" />
          AI-assisted development · case study
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-landing-primary sm:text-5xl lg:text-6xl">
          An AI-built job search pipeline,
          <br className="hidden sm:block" />{' '}
          <span className="text-landing-secondary">shipped end-to-end.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-landing-secondary sm:text-lg">
          Job Engine Web collects postings from Gmail alerts and the Adzuna API,
          scores fit against my profile with Claude, and produces a tailored
          resume per role — straight into a Google Doc.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-landing-subtle">
          Spec-driven and pair-programmed with Claude Code. I owned the
          architecture, schema, and review; the implementation was authored
          under direction.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-landing-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_24px_-4px_rgba(37,99,235,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-accent focus-visible:ring-offset-2"
          >
            Sign in
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            >
              <path
                d="M1 7h12m0 0L8 2m5 5l-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <a
            href="https://github.com/Gyoungd/job-engine-web"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-landing-border bg-white px-5 py-3 text-sm font-medium text-landing-primary transition-all duration-200 hover:scale-[1.02] hover:border-landing-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            View source
          </a>

          <span className="ml-1 inline-flex items-center gap-2 text-xs text-landing-subtle">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live in production
          </span>
        </div>
      </div>
    </section>
  )
}
