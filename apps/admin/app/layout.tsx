import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chauffeur Solutions | API Console',
  description: 'SaaS API & Integration Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
