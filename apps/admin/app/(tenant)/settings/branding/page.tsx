'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

export default function BrandingPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    logoUrl: '',
    primaryColor: '#2563eb',
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    customDomain: '',
  });
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: branding } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: () => api.get('/tenant-branding').then((r) => r.data),
  });

  useEffect(() => {
    if (branding) {
      setForm({
        logoUrl: branding.logo_url ?? '',
        primaryColor: branding.primary_color ?? '#2563eb',
        companyName: branding.company_name ?? '',
        contactEmail: branding.contact_email ?? '',
        contactPhone: branding.contact_phone ?? '',
        customDomain: branding.custom_domain ?? '',
      });
    }
  }, [branding]);

  const saveMut = useMutation({
    mutationFn: () => api.put('/tenant-branding', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      setToast({ message: 'Branding saved', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to save branding', tone: 'error' }),
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" description="Customise your customer portal appearance" />

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <Card title="Brand Settings">
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.companyName} onChange={f('companyName')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.logoUrl} onChange={f('logoUrl')} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary colour</label>
            <div className="flex gap-3 items-center">
              <input type="color" className="h-10 w-14 rounded border border-gray-300 cursor-pointer" value={form.primaryColor} onChange={f('primaryColor')} />
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" value={form.primaryColor} onChange={f('primaryColor')} placeholder="#2563eb" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact email</label>
            <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contactEmail} onChange={f('contactEmail')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone</label>
            <input type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contactPhone} onChange={f('contactPhone')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom domain</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.customDomain} onChange={f('customDomain')} placeholder="book.yourdomain.com" />
            <p className="text-xs text-gray-400 mt-1">Set a CNAME pointing to the customer portal host</p>
          </div>
          <Button onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Saving...' : 'Save branding'}
          </Button>
        </div>
      </Card>

      {form.primaryColor && (
        <Card title="Preview">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="max-w-xs bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="h-2 rounded-full mb-3" style={{ backgroundColor: form.primaryColor }} />
              {form.companyName && <p className="font-semibold text-gray-900 mb-1">{form.companyName}</p>}
              <button className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: form.primaryColor }}>
                Book a ride
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
