import { T } from './tokens'
import { MobileFrame, MockHeader, TabBar, RoleBadge, ScoreBadge, Card, ScrollBody } from './chrome'

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5l3 3 3-3" stroke={T.gray} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FilterPill({ label }: { label: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '6px 8px',
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
      <span>{label}</span>
      <Chevron />
    </div>
  )
}

export function SearchMock() {
  return (
    <MobileFrame>
      <MockHeader title="Search Jobs" />

      <ScrollBody>
        {/* Search input row */}
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <div
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.white,
              fontSize: 9.5,
              color: T.gray,
            }}
          >
            Search by title or company…
          </div>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: T.primary,
              color: 'white',
              fontSize: 9.5,
              fontWeight: 600,
            }}
          >
            Search
          </div>
        </div>

        {/* Filter pills row */}
        <div style={{ display: 'flex', gap: 5 }}>
          <FilterPill label="All Roles" />
          <FilterPill label="All Regions" />
          <FilterPill label="All Sources" />
        </div>

        {/* Result count + sort */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 9.5, color: T.gray }}>487 results</div>
          <div
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: T.white,
              fontSize: 9,
              color: T.dark,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Newest <Chevron />
          </div>
        </div>

        {/* Result card 1 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
            <RoleBadge role="DS" />
            <span style={{ fontSize: 8.5, color: T.gray, background: T.hoverBg, padding: '2px 6px', borderRadius: 4 }}>
              singapore
            </span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark, lineHeight: 1.25, marginBottom: 2 }}>
            Senior Data Scientist (Recommendations)
          </div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Hooli</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, color: T.gray, alignItems: 'center', marginBottom: 7 }}>
            <span>Singapore</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <span>3h ago</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <span>Linkedin</span>
          </div>
          <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${T.hoverBg}`, paddingTop: 6 }}>
            <ScoreBadge score={84} />
            <div style={{ flex: 1 }} />
            <div style={{ padding: '5px 8px', borderRadius: 5, fontSize: 8.5, fontWeight: 600, background: T.light, color: T.primary }}>
              Generate
            </div>
          </div>
        </Card>

        {/* Result card 2 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
            <RoleBadge role="DA" />
            <span style={{ fontSize: 8.5, color: T.gray, background: T.hoverBg, padding: '2px 6px', borderRadius: 4 }}>
              melbourne
            </span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.dark, lineHeight: 1.25, marginBottom: 2 }}>
            Commercial Analyst — SBS Business Dev
          </div>
          <div style={{ fontSize: 9, color: T.primary, fontWeight: 500, marginBottom: 4 }}>Initech</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 8.5, color: T.gray, alignItems: 'center', marginBottom: 7 }}>
            <span>Melbourne</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <span>5h ago</span>
            <span style={{ width: 2, height: 2, background: T.light, borderRadius: '50%' }} />
            <span>Seek</span>
          </div>
          <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${T.hoverBg}`, paddingTop: 6 }}>
            <ScoreBadge score={77} />
            <div style={{ flex: 1 }} />
            <div style={{ padding: '5px 8px', borderRadius: 5, fontSize: 8.5, fontWeight: 600, background: T.light, color: T.primary }}>
              Generate
            </div>
          </div>
        </Card>
      </ScrollBody>

      <TabBar active="search" />
    </MobileFrame>
  )
}
