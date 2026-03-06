'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { CreditCard, Users, User, ChevronRight, LogOut, Edit2, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ firstName: '', lastName: '', phone: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/customer-portal/profile').then(r => r.data),
  });

  useEffect(() => {
    if (profile) setForm({ firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone ?? '' });
  }, [profile]);

  const updateMut = useMutation({
    mutationFn: (data: typeof form) => api.put('/customer-portal/profile', {
      firstName: data.firstName, lastName: data.lastName, phone: data.phone,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditing(false); },
  });

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const NAV_LINKS = [
    { href: '/passengers',       icon: <Users className="h-5 w-5" />,      label: 'Manage Passengers',   desc: 'Saved passenger profiles' },
    { href: '/payment-methods',  icon: <CreditCard className="h-5 w-5" />, label: 'Payment Methods',     desc: 'Saved cards & billing' },
  ];

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="px-4 pt-12 pb-6 bg-gradient-to-b from-[hsl(var(--primary)/0.08)] to-transparent">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-white">Profile</h1>
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] font-medium">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.4)] to-[hsl(var(--primary)/0.2)] border border-[hsl(var(--primary)/0.3)] flex items-center justify-center">
            <User className="h-7 w-7 text-[hsl(var(--primary))]" />
          </div>
          {editing ? (
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input className="flex-1 h-9 px-3 rounded-lg bg-white/8 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                  placeholder="First" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                <input className="flex-1 h-9 px-3 rounded-lg bg-white/8 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                  placeholder="Last" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <input className="w-full h-9 px-3 rounded-lg bg-white/8 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--primary)/0.5)]"
                placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div className="flex gap-2">
                <button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-semibold disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> {updateMut.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white/50 text-xs">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-white text-base">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-sm text-white/50">{profile?.email}</p>
              {profile?.phone && <p className="text-sm text-white/40">{profile?.phone}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-3">
        {/* Nav links */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden divide-y divide-white/6">
          {NAV_LINKS.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-4 px-4 py-4 hover:bg-white/4 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[hsl(var(--primary))]">
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/85">{item.label}</p>
                <p className="text-xs text-white/35">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/40" />
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/20 text-red-400/80 text-sm font-medium hover:bg-red-500/8 hover:text-red-400 transition-all">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
