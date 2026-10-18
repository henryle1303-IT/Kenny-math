import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TuanLeUp',
    short_name: 'TuanLeUp',
    description: 'Học tập, luyện tập và theo dõi tiến độ cá nhân.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#eff6ff',
    theme_color: '#1d4ed8',
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
