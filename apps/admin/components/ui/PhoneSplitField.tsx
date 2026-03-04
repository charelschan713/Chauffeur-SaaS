'use client';

import React from 'react';

const COUNTRY_CODES = [
  { code: '+61', label: '+61 🇦🇺 Australia' },
  { code: '+1',  label: '+1  🇺🇸 USA / Canada' },
  { code: '+44', label: '+44 🇬🇧 UK' },
  { code: '+64', label: '+64 🇳🇿 New Zealand' },
  { code: '+65', label: '+65 🇸🇬 Singapore' },
  { code: '+852',label: '+852 🇭🇰 Hong Kong' },
  { code: '+971',label: '+971 🇦🇪 UAE' },
  { code: '+86', label: '+86 🇨🇳 China' },
  { code: '+81', label: '+81 🇯🇵 Japan' },
  { code: '+82', label: '+82 🇰🇷 South Korea' },
  { code: '+91', label: '+91 🇮🇳 India' },
  { code: '+33', label: '+33 🇫🇷 France' },
  { code: '+49', label: '+49 🇩🇪 Germany' },
];

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

interface PhoneSplitFieldProps {
  countryCode: string;
  number: string;
  onCountryCodeChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function PhoneSplitField({
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  label = 'Phone',
  required = false,
  error,
  disabled = false,
}: PhoneSplitFieldProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs text-gray-500">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          disabled={disabled}
          className={`w-36 shrink-0 rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 ${FOCUS}`}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
        </select>
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ''))}
          disabled={disabled}
          placeholder="412 345 678"
          className={`flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 ${FOCUS} ${error ? 'border-red-400' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Display helper: "+61 412345678" */
export function formatPhone(
  countryCode: string | null | undefined,
  number: string | null | undefined,
): string {
  if (!countryCode || !number) return '—';
  return `${countryCode.trim()} ${number.trim()}`;
}
