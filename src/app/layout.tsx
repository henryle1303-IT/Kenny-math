import type { Metadata, Viewport } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Math Challenge',
  description: 'Grade 5 maths tests, smart review and progress tracking',
  applicationName: 'TuanLeUp',
  appleWebApp: { capable: true, title: 'TuanLeUp', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: { 'apple-mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1d4ed8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
