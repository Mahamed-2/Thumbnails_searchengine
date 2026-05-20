import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Roblox Thumbnail Dataset Tool',
  description: 'Production-grade collection, validation, and analytics of Roblox thumbnails.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
