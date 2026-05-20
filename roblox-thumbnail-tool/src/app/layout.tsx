import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Roblox Thumbnail Engine',
    template: '%s | Roblox Thumbnail Engine',
  },
  description:
    'Production-grade collection, deduplication, processing, and analytics of Roblox avatar thumbnails. Build ML-ready datasets in minutes.',
  keywords: ['roblox', 'thumbnail', 'dataset', 'machine learning', 'avatar', 'image collection'],
  authors: [{ name: 'Roblox Thumbnail Engine' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Roblox Thumbnail Engine',
    description: 'Collect, deduplicate, and export Roblox avatar thumbnails at scale.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roblox Thumbnail Engine',
    description: 'Collect, deduplicate, and export Roblox avatar thumbnails at scale.',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 4000,
            className: '',
            style: {
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.9rem',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
