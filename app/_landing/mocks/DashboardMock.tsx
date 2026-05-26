import { T } from './tokens'
import {
  MobileFrame,
  MockHeader,
  TabBar,
  RoleBadge,
  ScoreBadge,
  ActiveDot,
  Card,
  ScrollBody,
  StatusBadge,
} from './chrome'

const STATS = [
  { num: 126, label: 'Raw' },
  { num: 8, label: 'New' },
  { num: 12, label: 'Target' },
  { num: 9, label: 'Top' },
]

export function DashboardMock() {
  return (
    <MobileFrame>
      <MockHeader title="Job Dashboard" />

      <ScrollBody>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 4 }}>
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                background: T.white,
                borderRadius: 9,
                padding: '8px 4px',
                textAlign: 'center',
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: T.navy, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {s.num}
              </div>
              <div style={{ fontSize: 7, color: T.gray, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            style={{
              flex: 1,
              background: T.white,
              color: T.primary,
              border: `1px solid ${T.light}`,
              padding: '8px 0',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            Refresh queue
          </div>
          <div
            style={{
              flex: 1,
              background: T.primary,
              color: 'white',
              padding: '8px 0',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            ✨ Generate top 10
          </div>
        </div>

        {/* New Jobs heading */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.dark }}>New Jobs</div>
          <div style={{ fontSize: 8.5, color: T.gray, background: T.hoverBg, padding: '2px 7px', borderRadius: 7 }}>5 listed</div>
        </div>

        {/* Job card 1 — Draft ready */}
        <Card style={{ background: '#f8fbff', borderColor: T.light }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <ScoreBadge score={87} />
              <StatusBadge label="✓ Draft ready" variant="blue" />
            </div>
            <RoleBadge role="DA" />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark, lineHeight: 1.25, marginBottom: 2 }}>Data Analyst</div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Acme Corp</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, color: T.gray, alignItems: 'center', marginBottom: 8 }}>
            <span>Melbourne</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <ActiveDot />
          </div>
          <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${T.hoverBg}`, paddingTop: 7 }}>
            <div style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: T.hoverBg, color: T.primary, textAlign: 'center' }}>
              Preview JD
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: T.hoverBg, color: T.gray, border: `1px solid ${T.border}` }}>
              Paste JD
            </div>
            <div style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: T.navy, color: 'white', textAlign: 'center' }}>
              View draft →
            </div>
          </div>
        </Card>

        {/* Job card 2 — idle */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <ScoreBadge score={76} />
            <RoleBadge role="DS" />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark, marginBottom: 2 }}>ML Engineer</div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Globex</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, color: T.gray, alignItems: 'center', marginBottom: 8 }}>
            <span>Sydney</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <span>3h ago</span>
          </div>
          <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${T.hoverBg}`, paddingTop: 7 }}>
            <div style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: T.hoverBg, color: T.primary, textAlign: 'center' }}>
              Preview JD
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: '#f0f2f4', color: T.gray, border: `1px solid ${T.border}` }}>
              Expired
            </div>
            <div style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 8.5, fontWeight: 600, background: T.light, color: T.primary, textAlign: 'center' }}>
              Generate resume
            </div>
          </div>
        </Card>
      </ScrollBody>

      <TabBar active="home" />
    </MobileFrame>
  )
}
