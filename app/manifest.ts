import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Job Engine',
    short_name: 'Job Engine',
    description: 'Personal job application dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafb',
    theme_color: '#1e3a5f',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
