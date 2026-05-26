import { T } from './tokens'
import { MobileFrame, MockHeader, TabBar, RoleBadge, Card, ScrollBody, StatusBadge } from './chrome'

function StatusPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 600,
        background: active ? T.primary : T.white,
        color: active ? 'white' : T.gray,
        border: `1px solid ${active ? T.primary : T.border}`,
      }}
    >
      {label}
    </div>
  )
}

export function DraftsMock() {
  return (
    <MobileFrame>
      <MockHeader title="Resume Drafts" />

      <ScrollBody>
        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
          <StatusPill label="All" active />
          <StatusPill label="Draft" />
          <StatusPill label="Docs Ready" />
          <StatusPill label="Submitted" />
        </div>

        {/* Draft card 1 — expanded */}
        <Card style={{ borderLeft: `3px solid ${T.secondary}`, padding: '10px 10px 10px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark, lineHeight: 1.2 }}>ML Engineer [Commerce]</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <RoleBadge role="DS" />
              <StatusBadge label="Draft" variant="gold" />
            </div>
          </div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Pied Piper</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, marginBottom: 7, alignItems: 'center' }}>
            <span style={{ color: T.warn, fontWeight: 600 }}>52% fit</span>
            <span style={{ color: T.gray }}>Just now</span>
            <span style={{ color: T.success, fontWeight: 500 }}>✓ Ready</span>
          </div>

          {/* Resume changes preview */}
          <div
            style={{
              background: T.hoverBg,
              borderRadius: 6,
              padding: 6,
              fontSize: 8,
              color: T.gray,
              lineHeight: 1.35,
              marginBottom: 7,
            }}
          >
            <div style={{ fontSize: 7.5, fontWeight: 600, color: T.primary, letterSpacing: 0.4, marginBottom: 3 }}>
              RESUME CHANGES
            </div>
            <div>
              --- ROLE CLASSIFICATION Best fit: DS Confidence: High Reason: The role is a Machine Learning Engineer position
              focused on commerce recommen…
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${T.hoverBg}`, paddingTop: 6 }}>
            <div style={{ padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: T.hoverBg, color: T.primary }}>
              View JD
            </div>
            <div style={{ padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: T.light, color: T.primary }}>
              Generate Docs
            </div>
            <div style={{ padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: T.navy, color: 'white' }}>
              Mark Applied
            </div>
            <div style={{ padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: '#f0f2f4', color: T.gray, border: `1px solid ${T.border}` }}>
              Withdraw
            </div>
          </div>
        </Card>

        {/* Draft card 2 — compact, docs ready */}
        <Card style={{ borderLeft: `3px solid ${T.warn}`, padding: '10px 10px 10px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark }}>Data Operations Specialist</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <RoleBadge role="DA" />
              <StatusBadge label="Docs Ready" variant="gold" />
            </div>
          </div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Soylent</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, marginBottom: 7, alignItems: 'center' }}>
            <span style={{ color: T.warn, fontWeight: 600 }}>62% fit</span>
            <span style={{ color: T.gray }}>2h ago</span>
            <span style={{ color: T.success, fontWeight: 500 }}>✓ Ready</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1, padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: T.hoverBg, color: T.primary, textAlign: 'center' }}>
              View JD
            </div>
            <div style={{ flex: 1, padding: '5px 7px', borderRadius: 5, fontSize: 8, fontWeight: 600, background: T.navy, color: 'white', textAlign: 'center' }}>
              Open doc →
            </div>
          </div>
        </Card>
      </ScrollBody>

      <TabBar active="drafts" />
    </MobileFrame>
  )
}
