'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { PhoneCountrySelect } from '@/components/PhoneCountrySelect';
import { CreditCard, Users, User, ChevronRight, LogOut, Edit2, Check, X } from 'lucide-react';

export default function ProfilePage() {
  useAuthGuard();
  const router = useRouter();
  const qc     = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ firstName: '', lastName: '', phoneCode: '+61', phoneNumber: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/customer-portal/profile').then(r => r.data),
  });

  useEffect(() => {
    if (profile) setForm({
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
      phoneCode: profile.phone_country_code ?? '+61',
      phoneNumber: profile.phone_number ?? '',
    });
  }, [profile]);

  const updateMut = useMutation({
    mutationFn: (data: typeof form) => api.put('/customer-portal/profile', {
      firstName: data.firstName, lastName: data.lastName,
      phoneCountryCode: data.phoneCode, phoneNumber: data.phoneNumber,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditing(false); },
  });

  const handleLogout = () => { clearAuth(); router.push('/login'); };

  const NAV_LINKS = [
    { href: '/passengers',      icon: <Users className="h-5 w-5" />,      label: 'Manage Passengers', desc: 'Saved passenger profiles' },
    { href: '/payment-methods', icon: <CreditCard className="h-5 w-5" />, label: 'Payment Methods',   desc: 'Saved cards & billing' },
  ];

  if (isLoading) return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-gray-100 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[hsl(var(--background))] text-white"
      style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header */}
      <div
        className="border-b border-gray-100"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-4xl mx-auto px-4 pb-5">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-lg font-semibold text-white">Profile</h1>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))] text-xs font-semibold active:scale-95 transition-transform"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.35)] to-[hsl(var(--primary)/0.15)] border-2 border-[hsl(var(--primary)/0.3)] flex items-center justify-center shrink-0">
              <User className="h-8 w-8 text-[hsl(var(--primary))]" />
            </div>

            {editing ? (
              <div className="flex-1 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    className="flex-1 h-11 px-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-white/25 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                  <input
                    className="flex-1 h-11 px-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-white/25 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <PhoneCountrySelect value={form.phoneCode} onChange={v => setForm(f => ({ ...f, phoneCode: v }))} className="w-28 shrink-0" />
                  <input
                    type="tel"
                    className="flex-1 h-11 px-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-white/25 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                    placeholder="4xx xxx xxx"
                    value={form.phoneNumber}
                    onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMut.mutate(form)}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    <Check className="h-4 w-4" /> {updateMut.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-100 text-gray-500 text-sm active:scale-95 transition-transform"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="font-semibold text-[hsl(var(--foreground))] text-base">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-sm text-white/45 mt-0.5 truncate">{profile?.email}</p>
                {profile?.phone_number && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{profile?.phone_country_code} {profile?.phone_number}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-3">
        {/* Nav links */}
        <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] overflow-hidden divide-y divide-white/[0.05]">
          {NAV_LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-4 py-4 min-h-[64px] active:bg-[hsl(var(--card))] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.18)] flex items-center justify-center text-[hsl(var(--primary))] shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{item.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </a>
          ))}
        </div>

        {/* App version / misc */}
        <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-white/25">Customer Portal</span>
          <span className="text-xs text-gray-300">v1.0</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-500/20 text-red-400/70 text-sm font-medium active:bg-red-500/8 active:text-red-400 transition-all min-h-[52px]"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
