'use client';
/**
 * GuestForm — guest passenger details form for the booking flow.
 * Shown when user selects "Continue as Guest" at the AuthGate step.
 * Extracted from BookPageClient.tsx.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneCountrySelect } from '@/components/PhoneCountrySelect';

interface GuestFormProps {
  onSuccess: (guestData: GuestData) => void;
  onBack:    () => void;
}

export interface GuestData {
  firstName:   string;
  lastName:    string;
  email:       string;
  phoneCode:   string;
  phoneNumber: string;
  phone:       string; // combined: phoneCode + phoneNumber
}

export function GuestForm({ onSuccess, onBack }: GuestFormProps) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phoneCode: '+61', phoneNumber: '',
  });
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSuccess({ ...form, phone: `${form.phoneCode}${form.phoneNumber}` });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input value={form.firstName} onChange={f('firstName')} required />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name *</Label>
          <Input value={form.lastName} onChange={f('lastName')} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email *</Label>
        <Input type="email" value={form.email} onChange={f('email')} required />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <div className="flex gap-2">
          <PhoneCountrySelect
            value={form.phoneCode}
            onChange={v => setForm(p => ({ ...p, phoneCode: v }))}
            className="w-28 shrink-0"
          />
          <Input
            type="tel"
            className="flex-1"
            value={form.phoneNumber}
            onChange={f('phoneNumber')}
            placeholder="400 000 000"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1">Continue</Button>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}
