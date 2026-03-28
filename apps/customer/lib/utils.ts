import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(minor: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function fmtDateTime(iso: string, timezone = 'Australia/Sydney') {
  const isNaive = !/Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const date = isNaive ? toDatePreserveLocal(iso) : new Date(iso);
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: isNaive ? 'UTC' : timezone,
  }).format(date);
}

function toDatePreserveLocal(iso: string): Date {
  const [datePart, timePartRaw] = iso.split('T');
  const timePart = (timePartRaw ?? '00:00:00').slice(0, 8);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y || 0, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0));
}
