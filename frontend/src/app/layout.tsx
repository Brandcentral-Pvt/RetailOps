import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'BrandCentral - RetailOps Dashboard',
    template: '%s | BrandCentral',
  },
  description: 'RetailOps Dashboard - Amazon Marketplace Analytics & Management',
  keywords: ['retail', 'analytics', 'amazon', 'marketplace', 'dashboard', 'seller'],
  authors: [{ name: 'BrandCentral Team' }],
  creator: 'BrandCentral',
  publisher: 'BrandCentral',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://data.brandcentral.in',
    siteName: 'BrandCentral',
    title: 'BrandCentral - RetailOps Dashboard',
    description: 'RetailOps Dashboard - Amazon Marketplace Analytics & Management',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BrandCentral Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrandCentral - RetailOps Dashboard',
    description: 'RetailOps Dashboard - Amazon Marketplace Analytics & Management',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}