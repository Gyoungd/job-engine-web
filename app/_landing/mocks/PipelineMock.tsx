import { T } from './tokens'
import { MobileFrame, MockHeader, TabBar, RoleBadge, Card, ScrollBody, StatusBadge } from './chrome'

const ROWS = [
  {
    company: 'Globex',
    title: 'Data Engineer',
    role: 'DE' as const,
    suit: 78,
    status: 'Submitted',
    variant: 'blue' as const,
    note: '',
  },
  {
    company: 'Hooli',
    title: 'ML Engineer',
    role: 'DS' as const,
    suit: 84,
    status: 'Interview',
    variant: 'green' as const,
    note: 'Tech screen Tue',
  },
  {
    company: 'Soylent',
    title: 'Data Analyst',
    role: 'DA' as const,
    suit: 76,
    status: 'Sent Cold 📧',
    variant: 'purple' as const,
    note: '',
  },
]

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5l3 3 3-3" stroke={T.gray} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PipelineMock() {
  return (
    <MobileFrame>
      <MockHeader title="Pipeline" />

      <ScrollBody>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 2 }}>
          {[
            { num: 12, label: 'Submitted' },
            { num: 5, label: 'Pending' },
            { num: 3, label: 'Response' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: T.white,
                borderRadius: 9,
                padding: '8px 6px',
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

        {/* Filter + Sort row */}
        <div style={{ display: 'flex', gap: 5 }}>
          <div
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 7,
              background: T.white,
              border: `1px solid ${T.border}`,
              fontSize: 9,
              color: T.dark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>All Statuses</span>
            <Chevron />
          </div>
          <div
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 7,
              background: T.white,
              border: `1px solid ${T.border}`,
              fontSize: 9,
              color: T.dark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Newest</span>
            <Chevron />
          </div>
        </div>

        {/* Application rows */}
        {ROWS.map((r) => (
          <Card key={r.company} style={{ padding: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.dark }}>{r.company}</div>
                <div style={{ fontSize: 8.5, color: T.gray, marginTop: 1 }}>{r.title}</div>
              </div>
              <StatusBadge label={r.status} variant={r.variant} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <RoleBadge role={r.role} />
              <span style={{ fontSize: 8.5, color: T.navy, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.suit}%</span>
              {r.note && (
                <span
                  style={{
                    fontSize: 8,
                    color: T.gray,
                    fontStyle: 'italic',
                    background: T.hoverBg,
                    padding: '2px 6px',
                    borderRadius: 4,
                    marginLeft: 'auto',
                  }}
                >
                  {r.note}
                </span>
              )}
            </div>
          </Card>
        ))}
      </ScrollBody>

      <TabBar active="pipeline" />
    </MobileFrame>
  )
}
