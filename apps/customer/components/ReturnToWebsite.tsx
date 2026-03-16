'use client';
/**
 * ReturnToWebsite — consistent branded exit link back to the public website.
 * Use on auth screens, booking confirmation, and any dead-end page.
 */
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://aschauffeured.com.au';

interface ReturnToWebsiteProps {
  className?: string;
  label?: string;
}

export function ReturnToWebsite({ className = '', label }: ReturnToWebsiteProps) {
  const tenant = useTenant();
  const websiteUrl = (tenant as any)?.website_url ?? WEBSITE_URL;
  const displayLabel = label ?? `← ${tenant?.name ?? 'ASChauffeured'}.com.au`;

  return (
    <Link
      href={websiteUrl}
      className={`inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 ${className}`}
      style={{ color: '#C8A870' }}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span>{displayLabel}</span>
    </Link>
  );
}
