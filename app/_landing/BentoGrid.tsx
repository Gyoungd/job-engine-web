import { ScoreCard } from './ScoreCard'
import { DiffCard } from './DiffCard'
import { PipelineCard } from './PipelineCard'
import { CronCard, DocsCard, MobileCard } from './SmallCards'

export function BentoGrid() {
  return (
    <section className="border-b border-landing-border bg-landing-bg">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 sm:py-24">
        <div className="mb-12 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
            Features
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-landing-primary sm:text-3xl">
            What it actually does.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-landing-secondary">
            Every card below is a working surface in the app. The numbers and
            company names shown here are placeholders — the real pipeline
            stays behind the sign-in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto]">
          {/* Score card — 2 cols × 2 rows on desktop */}
          <div className="lg:col-span-2 lg:row-span-2">
            <ScoreCard />
          </div>

          {/* Diff card — 2 cols × 1 row */}
          <div className="lg:col-span-2">
            <DiffCard />
          </div>

          {/* Cron — 1 col */}
          <div>
            <CronCard />
          </div>

          {/* Mobile — 1 col */}
          <div>
            <MobileCard />
          </div>

          {/* Docs auto-apply — 2 cols */}
          <div className="lg:col-span-2">
            <DocsCard />
          </div>

          {/* Pipeline kanban — 2 cols */}
          <div className="lg:col-span-2">
            <PipelineCard />
          </div>
        </div>
      </div>
    </section>
  )
}
