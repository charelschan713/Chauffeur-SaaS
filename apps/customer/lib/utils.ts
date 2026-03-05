import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(minor: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function fmtDateTime(iso: string, timezone = 'Australia/Sydney') {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso));
}
