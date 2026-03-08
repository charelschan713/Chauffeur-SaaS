import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { TenantProvider } from '@/components/TenantProvider';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { BottomNav } from '@/components/BottomNav';
import { Sidebar } from '@/components/Sidebar';
import { ScrollToInput } from '@/components/ScrollToInput';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Customer Portal',
  description: 'Book your ride',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevent iOS zoom on input focus
  viewportFit: 'cover', // enable safe-area-inset on notched phones
  themeColor: '#0d0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${playfair.variable} antialiased bg-[#f5f5f5]`}>
        <GlobalErrorBoundary>
          <QueryProvider>
            <TenantProvider>
              <ScrollToInput />
              {/* Desktop: sidebar + content. Mobile: full width + bottom nav */}
              <Sidebar />
              <div className="lg:pl-64">
                {children}
              </div>
              {/* BottomNav only on mobile */}
              <div className="lg:hidden">
                <BottomNav />
              </div>
            </TenantProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
