import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { TenantProvider } from '@/components/TenantProvider';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Customer Portal',
  description: 'Book your ride',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased bg-gray-50`}>
        <QueryProvider>
          <TenantProvider>{children}</TenantProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
