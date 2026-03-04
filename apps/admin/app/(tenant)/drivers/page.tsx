'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';
import { PhoneSplitField, formatPhone } from '@/components/ui/PhoneSplitField';
import { getVerificationBadge } from '@/lib/badges/getVerificationBadge';
import { formatStatus } from '@/lib/ui/formatStatus';
import { InviteDriverModal } from '@/components/invite-driver-modal';

type MembershipStatus = 'active' | 'inactive' | 'suspended';

const membershipBadge = (status: MembershipStatus): 'success' | 'neutral' | 'danger' => {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  return 'neutral';
};

export default function DriversPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.data ?? []);
    },
  });

  const [form, setForm] = useState({ id: '', full_name: '', email: '', phone_country_code: '+61', phone_number: '' });
  const [statusAction, setStatusAction] = useState<{ id: string; name: string; action: 'deactivate' | 'suspend' | 'reactivate' | 'release' } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function handleCreate() {
    setFormSaving(true);
    try {
      await api.post('/drivers', { full_name: form.full_name, email: form.email, phone_country_code: form.phone_country_code, phone_number: form.phone_number });
      setForm({ id: '', full_name: '', email: '', phone_country_code: '+61', phone_number: '' });
      await refetch();
      setToast({ message: 'Driver created', tone: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to create driver', tone: 'error' });
    } finally {
      setFormSaving(false);
    }
  }

  async function handleUpdate() {
    if (!form.id) return;
    setFormSaving(true);
    try {
      await api.patch(`/drivers/${form.id}`, { full_name: form.full_name, email: form.email, phone_country_code: form.phone_country_code, phone_number: form.phone_number });
      setForm({ id: '', full_name: '', email: '', phone_country_code: '+61', phone_number: '' });
      await refetch();
      setToast({ message: 'Driver updated', tone: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to update driver', tone: 'error' });
    } finally {
      setFormSaving(false);
    }
  }

  async function applyStatusAction() {
    if (!statusAction) return;
    setStatusSaving(true);
    try {
      await api.patch(`/drivers/${statusAction.id}/${statusAction.action}`);
      await refetch();
      const labels = { deactivate: 'deactivated', suspend: 'suspended', reactivate: 'reactivated', release: 'released from tenant' };
      setToast({ message: `${statusAction.name} ${labels[statusAction.action]}`, tone: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to update status', tone: 'error' });
    } finally {
      setStatusSaving(false);
      setStatusAction(null);
    }
  }

  if (error) return <ErrorAlert message="Unable to load drivers" onRetry={refetch} />;

  return (
    <>
    <ListPage
      title="Drivers"
      subtitle="Manage drivers and availability"
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setInviteOpen(true)}>
            ✉️ Invite Driver
          </Button>
          <Button onClick={() => setForm({ id: '', full_name: '', email: '', phone_country_code: '+61', phone_number: '' })}>
            Add Driver
          </Button>
        </div>
      }
      table={
        isLoading ? (
          <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No drivers yet" description="Add your first driver to get started." />
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded border">
              <h3 className="text-sm font-semibold mb-2">{form.id ? 'Edit Driver' : 'Add Driver'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <PhoneSplitField
                  countryCode={form.phone_country_code}
                  number={form.phone_number}
                  onCountryCodeChange={(v) => setForm({ ...form, phone_country_code: v })}
                  onNumberChange={(v) => setForm({ ...form, phone_number: v })}
                />
              </div>
              <div className="flex gap-2 mt-3">
                {form.id ? (
                  <>
                    <Button onClick={handleUpdate} disabled={formSaving}>{formSaving ? <><InlineSpinner />Saving...</> : 'Update Driver'}</Button>
                    <Button variant="secondary" onClick={() => setForm({ id: '', full_name: '', email: '', phone_country_code: '+61', phone_number: '' })}>Cancel</Button>
                  </>
                ) : (
                  <Button onClick={handleCreate} disabled={formSaving}>{formSaving ? <><InlineSpinner />Creating...</> : 'Create Driver'}</Button>
                )}
              </div>
            </div>

            <Table headers={['Name', 'Email', 'Phone', 'Availability', 'Status', '']}>
              {(data ?? []).map((d: any) => {
                const ms: MembershipStatus = d.membership_status ?? 'active';
                const isActive = ms === 'active';
                return (
                  <tr key={d.driver_id} className={`hover:bg-gray-50 ${!isActive ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{d.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatPhone(d.phone_country_code, d.phone_number)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={d.availability_status === 'AVAILABLE' ? 'success' : 'neutral'}>
                        {d.availability_status ?? 'OFFLINE'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={membershipBadge(ms)}>{ms.toUpperCase()}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <Button
                        variant="ghost"
                        onClick={() => setForm({ id: d.driver_id, full_name: d.full_name, email: d.email, phone_country_code: d.phone_country_code ?? '+61', phone_number: d.phone_number ?? '' })}
                      >
                        Edit
                      </Button>
                      {isActive && (
                        <>
                          <Button
                            variant="ghost"
                            className="text-yellow-700 hover:text-yellow-800"
                            onClick={() => setStatusAction({ id: d.driver_id, name: d.full_name, action: 'deactivate' })}
                          >
                            Deactivate
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setStatusAction({ id: d.driver_id, name: d.full_name, action: 'suspend' })}
                          >
                            Suspend
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => setStatusAction({ id: d.driver_id, name: d.full_name, action: 'release' })}
                          >
                            Release
                          </Button>
                        </>
                      )}
                      {!isActive && (
                        <Button
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => setStatusAction({ id: d.driver_id, name: d.full_name, action: 'reactivate' })}
                        >
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )
      }
    />

    <ConfirmModal
      title={`${statusAction?.action === 'suspend' ? 'Suspend' : statusAction?.action === 'reactivate' ? 'Reactivate' : statusAction?.action === 'release' ? 'Release Driver' : 'Deactivate'} driver?`}
      description={
        statusAction?.action === 'suspend'
          ? `${statusAction?.name} will be suspended and blocked from the platform.`
          : statusAction?.action === 'reactivate'
          ? `${statusAction?.name} will be reactivated and can log in again.`
          : statusAction?.action === 'release'
          ? `${statusAction?.name} will be unbound from this tenant. They can then join another company.`
          : `${statusAction?.name} will be deactivated and cannot log in.`
      }
      isOpen={!!statusAction}
      onClose={() => setStatusAction(null)}
      onConfirm={applyStatusAction}
      confirmText={statusSaving ? 'Saving…' : 'Confirm'}
      confirmTone={statusAction?.action === 'reactivate' ? 'primary' : statusAction?.action === 'release' ? 'danger' : 'danger'}
      loading={statusSaving}
    />

    {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

    <InviteDriverModal
      isOpen={inviteOpen}
      onClose={() => setInviteOpen(false)}
      onInvited={(result) => {
        setInviteLink(result.onboard_url);
        setToast({ message: 'Invitation sent successfully', tone: 'success' });
      }}
    />

    {/* Show onboard link after invite (copy-able fallback) */}
    {inviteLink && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-green-200 rounded-xl shadow-xl px-6 py-4 max-w-lg w-full mx-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-green-700 mb-1">✅ Invitation Sent</div>
            <div className="text-xs text-gray-500 mb-2">Share this link if SMS/email not configured:</div>
            <div className="text-xs font-mono bg-gray-100 rounded px-3 py-2 truncate">{inviteLink}</div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => { navigator.clipboard.writeText(inviteLink); }}
              className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium"
            >
              Copy
            </button>
            <button onClick={() => setInviteLink(null)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
