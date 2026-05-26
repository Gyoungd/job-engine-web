'use client'

import { useInView } from './useInView'

const STAGES = [
  {
    label: 'Collect',
    tech: 'GitHub Actions · 8×/day',
    detail: 'Gmail alerts + Adzuna API → Supabase',
  },
  {
    label: 'Rank',
    tech: 'Claude Haiku 4.5',
    detail: 'Score fit against profile skills',
  },
  {
    label: 'Tailor',
    tech: 'Claude Sonnet 4.6',
    detail: '[ORIGINAL] → [REVISED] diff pairs',
  },
  {
    label: 'Apply',
    tech: 'Google Docs API',
    detail: 'batchUpdate replaceAllText',
  },
  {
    label: 'Track',
    tech: 'Supabase + Sheets',
    detail: 'Status, notes, response cycle',
  },
]

export function PipelineDiagram() {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <section ref={ref} className="border-b border-landing-border bg-white">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
            The pipeline
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-landing-primary sm:text-3xl">
            Five stages, fully autonomous between collection and final review.
          </h2>
        </div>

        {/* Desktop: horizontal */}
        <ol className="hidden gap-3 lg:grid lg:grid-cols-5">
          {STAGES.map((s, i) => (
            <li
              key={s.label}
              className="group relative"
              style={{
                transitionDelay: `${i * 120}ms`,
              }}
            >
              <div
                className={`relative rounded-2xl border border-landing-border bg-white p-5 transition-all duration-500 ${
                  inView
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-3 opacity-0'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-landing-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold text-landing-primary">
                    {s.label}
                  </span>
                </div>
                <div className="mt-3 font-mono text-[11px] leading-relaxed text-landing-subtle">
                  {s.tech}
                </div>
                <div className="mt-2 text-xs leading-relaxed text-landing-secondary">
                  {s.detail}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <svg
                  aria-hidden
                  className="absolute -right-2 top-1/2 z-10 -translate-y-1/2"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M2 8h12m0 0l-4-4m4 4l-4 4"
                    stroke="#a1a1aa"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ol>

        {/* Mobile / tablet: vertical */}
        <ol className="space-y-3 lg:hidden">
          {STAGES.map((s, i) => (
            <li
              key={s.label}
              className={`relative flex gap-4 rounded-2xl border border-landing-border bg-white p-4 transition-all duration-500 ${
                inView ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span className="font-mono text-[11px] font-semibold text-landing-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-landing-primary">
                  {s.label}
                </div>
                <div className="mt-1 font-mono text-[11px] text-landing-subtle">
                  {s.tech}
                </div>
                <div className="mt-1 text-xs text-landing-secondary">
                  {s.detail}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
