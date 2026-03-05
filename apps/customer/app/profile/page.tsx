'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/customer-portal/profile').then((r) => r.data),
  });

  useEffect(() => {
    if (profile) {
      setForm({ firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone ?? '' });
    }
  }, [profile]);

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put('/customer-portal/profile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditing(false); },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {updateMut.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-gray-900">{profile?.first_name} {profile?.last_name}</h2>
                  <p className="text-sm text-gray-500">{profile?.email}</p>
                  {profile?.phone && <p className="text-sm text-gray-500">{profile?.phone}</p>}
                </div>
                <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:underline">Edit</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
