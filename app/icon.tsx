import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 96,
          background: '#1e3a5f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}
      >
        <span style={{ fontSize: 120, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
          JOB
        </span>
        <span style={{ fontSize: 100, fontWeight: 800, color: '#4682bf', lineHeight: 1.2 }}>
          ENGINE
        </span>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#1a8b5f' }} />
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#b8860b' }} />
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#4682bf' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
