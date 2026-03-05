import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { TenantProvider } from '@/components/TenantProvider';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${playfair.variable} antialiased`}>
        <QueryProvider>
          <TenantProvider>{children}</TenantProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
