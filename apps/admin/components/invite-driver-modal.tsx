'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInvited: (result: { onboard_url: string }) => void;
}

export function InviteDriverModal({ isOpen, onClose, onInvited }: Props) {
  const [inviteType, setInviteType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+61');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDisplayName(''); setEmail(''); setPhone('');
    setInviteType('INTERNAL'); setError(null);
  }

  async function handleSend() {
    if (!email && !phone) {
      setError('Provide at least email or mobile number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/drivers/invitations', {
        display_name: displayName || undefined,
        email: email || undefined,
        phone_country_code: phone ? phoneCountry : undefined,
        phone_number: phone || undefined,
        invite_type: inviteType,
      });
      reset();
      onInvited(res.data);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send invitation.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Invite Driver</h3>
            <p className="text-xs text-gray-400 mt-0.5">Driver will receive a link to complete their registration</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Driver Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Driver Type</label>
            <div className="flex gap-3">
              {(['INTERNAL', 'EXTERNAL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInviteType(t)}
                  className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    inviteType === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t === 'INTERNAL' ? '🏢 Internal' : '🤝 External Partner'}
                </button>
              ))}
            </div>
            {inviteType === 'EXTERNAL' && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                External drivers will also be required to upload a driving record and criminal background check for platform review.
              </p>
            )}
          </div>

          {/* Name (optional hint) */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="driver@example.com"
            />
          </div>

          {/* Mobile (SMS invite) */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Mobile Number <span className="text-xs text-gray-400">(for SMS invite)</span></label>
            <div className="flex gap-2">
              <select
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="+61">🇦🇺 +61</option>
                <option value="+64">🇳🇿 +64</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
              </select>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="4xx xxx xxx"
                className="flex-1"
              />
            </div>
          </div>

          {!email && !phone && (
            <p className="text-xs text-gray-400">Provide at least an email or mobile number to send the invite.</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSend} disabled={saving || (!email && !phone)}>
            {saving ? 'Sending...' : `Send ${phone ? 'SMS ' : ''}${phone && email ? '+ ' : ''}${email ? 'Email ' : ''}Invite`}
          </Button>
        </div>
      </div>
    </div>
  );
}
