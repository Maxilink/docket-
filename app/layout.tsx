import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Court diary and case tracker for law firms.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2E1A5C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
