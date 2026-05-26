import fs from 'node:fs'
import path from 'node:path'

const SHOTS = [
  { src: '/landing/dashboard.png', label: 'Dashboard · ranked queue', alt: 'Dashboard preview' },
  { src: '/landing/search.png', label: 'Search · filter + sort', alt: 'Search preview' },
  { src: '/landing/drafts.png', label: 'Drafts · resume diff per role', alt: 'Drafts preview' },
  { src: '/landing/pipeline.png', label: 'Pipeline · status + notes', alt: 'Pipeline preview' },
] as const

function getShots() {
  const publicDir = path.join(process.cwd(), 'public')
  return SHOTS.map((s) => ({
    ...s,
    exists: fs.existsSync(path.join(publicDir, s.src.replace(/^\//, ''))),
  }))
}

export function Gallery() {
  const shots = getShots()

  return (
    <section className="border-b border-landing-border bg-landing-bg">
      <div className="mx-auto max-w-5xl py-20 sm:py-24">
        <div className="mb-10 max-w-2xl px-6 sm:px-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
            See it running
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-landing-primary sm:text-3xl">
            Four surfaces behind the sign-in.
          </h2>
          <p className="mt-3 text-sm text-landing-secondary">
            Anonymized — real company names and scores have been redacted.
          </p>
        </div>

        <div className="overflow-x-auto pb-6">
          <div
            className="flex snap-x snap-mandatory gap-4 px-6 sm:px-8"
            role="region"
            aria-label="App screenshot gallery"
            tabIndex={0}
          >
            {shots.map((s) => (
              <figure
                key={s.src}
                className="snap-center shrink-0 w-[78%] sm:w-[55%] lg:w-[38%]"
              >
                <div className="relative overflow-hidden rounded-2xl border border-landing-border bg-white shadow-sm">
                  {s.exists ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.src}
                      alt={s.alt}
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  ) : (
                    <div
                      aria-label={s.alt}
                      className="flex aspect-[9/16] items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-6 text-center"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                        {s.alt}
                      </span>
                    </div>
                  )}
                </div>
                <figcaption className="mt-3 px-1 font-mono text-[11px] uppercase tracking-wider text-landing-subtle">
                  {s.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <p className="mt-2 px-6 text-center font-mono text-[10px] uppercase tracking-wider text-landing-subtle sm:px-8">
          Scroll →
        </p>
      </div>
    </section>
  )
}
