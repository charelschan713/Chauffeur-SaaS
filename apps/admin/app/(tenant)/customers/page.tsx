'use client';

import React, { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';
import { PhoneSplitField, formatPhone } from '@/components/ui/PhoneSplitField';

const TIER_COLORS: Record<string, string> = {
  STANDARD: 'bg-green-100 text-green-800',
  SILVER: 'bg-gray-100 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-800',
  PLATINUM: 'bg-gray-300 text-gray-800',
  VIP: 'bg-purple-100 text-purple-800',
  CUSTOM: 'bg-blue-100 text-blue-800',
};

const MUSIC_OPTIONS = ['OFF', 'JAZZ', 'CLASSICAL', 'POP'];
const CONVERSATION_OPTIONS = ['QUIET', 'FRIENDLY'];
const SEAT_OPTIONS = ['FRONT', 'REAR'];

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [passengerModalOpen, setPassengerModalOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<any | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [deletePassengerId, setDeletePassengerId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [deleteCustomerConfirmText, setDeleteCustomerConfirmText] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: customers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { search: search || undefined } });
      return res.data?.data ?? [];
    },
  });

  const { data: customerDetail } = useQuery({
    queryKey: ['customer-detail', expandedId],
    queryFn: async () => {
      if (!expandedId) return null;
      const res = await api.get(`/customers/${expandedId}`);
      return res.data;
    },
    enabled: !!expandedId,
  });

  const passengers = customerDetail?.passengers ?? [];

  const [customerForm, setCustomerForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_country_code: '',
    phone_number: '',
    tier: 'STANDARD',
    custom_discount_type: '',
    custom_discount_value: '',
  });

  const [passengerForm, setPassengerForm] = useState({
    first_name: '',
    last_name: '',
    phone_country_code: '',
    phone_number: '',
    temperature_c: 22,
    music: 'OFF',
    conversation: 'QUIET',
    seat: 'REAR',
    special_notes: '',
  });

  function openCreateCustomer() {
    setEditingCustomer(null);
    setCustomerForm({
      first_name: '',
      last_name: '',
      email: '',
      phone_country_code: '',
      phone_number: '',
      tier: 'STANDARD',
      custom_discount_type: '',
      custom_discount_value: '',
    });
    setCustomerModalOpen(true);
  }

  function openEditCustomer(c: any) {
    setEditingCustomer(c);
    setCustomerForm({
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      email: c.email ?? '',
      phone_country_code: c.phone_country_code ?? '',
      phone_number: c.phone_number ?? '',
      tier: c.tier ?? 'STANDARD',
      custom_discount_type: c.custom_discount_type ?? '',
      custom_discount_value: c.custom_discount_value ? String(c.custom_discount_value) : '',
    });
    setCustomerModalOpen(true);
  }

  async function saveCustomer() {
    const payload = {
      ...customerForm,
      custom_discount_type: customerForm.tier === 'CUSTOM' ? customerForm.custom_discount_type : null,
      custom_discount_value: customerForm.tier === 'CUSTOM' && customerForm.custom_discount_value
        ? Number(customerForm.custom_discount_value)
        : null,
    };
    if (editingCustomer) {
      await api.patch(`/customers/${editingCustomer.id}`, payload);
    } else {
      await api.post('/customers', payload);
    }
    setCustomerModalOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  }

  function openCreatePassenger(customerId: string) {
    setActiveCustomerId(customerId);
    setEditingPassenger(null);
    setPassengerForm({
      first_name: '',
      last_name: '',
      phone_country_code: '',
      phone_number: '',
      temperature_c: 22,
      music: 'OFF',
      conversation: 'QUIET',
      seat: 'REAR',
      special_notes: '',
    });
    setPassengerModalOpen(true);
  }

  function openEditPassenger(customerId: string, p: any) {
    setActiveCustomerId(customerId);
    setEditingPassenger(p);
    setPassengerForm({
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      phone_country_code: p.phone_country_code ?? '',
      phone_number: p.phone_number ?? '',
      temperature_c: p.preferences?.temperature_c ?? 22,
      music: p.preferences?.music ?? 'OFF',
      conversation: p.preferences?.conversation ?? 'QUIET',
      seat: p.preferences?.seat ?? 'REAR',
      special_notes: p.preferences?.special_notes ?? '',
    });
    setPassengerModalOpen(true);
  }

  async function savePassenger() {
    if (!activeCustomerId) return;
    const payload = {
      first_name: passengerForm.first_name,
      last_name: passengerForm.last_name,
      phone_country_code: passengerForm.phone_country_code || null,
      phone_number: passengerForm.phone_number || null,
      preferences: {
        temperature_c: Number(passengerForm.temperature_c),
        music: passengerForm.music,
        conversation: passengerForm.conversation,
        seat: passengerForm.seat,
        special_notes: passengerForm.special_notes,
      },
    };
    if (editingPassenger) {
      await api.patch(`/passengers/${editingPassenger.id}`, payload);
    } else {
      await api.post(`/customers/${activeCustomerId}/passengers`, payload);
    }
    setPassengerModalOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['customer-detail', activeCustomerId] });
  }

  async function confirmDeleteCustomer() {
    if (!deleteCustomerId) return;
    setDeletingCustomer(true);
    try {
      await api.delete(`/customers/${deleteCustomerId}`);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      setToast({ message: 'Customer deleted', tone: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to delete customer';
      setToast({ message: msg, tone: 'error' });
    } finally {
      setDeletingCustomer(false);
      setDeleteCustomerId(null);
      setDeleteCustomerConfirmText('');
    }
  }

  async function confirmDeletePassenger() {
    if (!deletePassengerId) return;
    setDeleting(true);
    try {
      await api.delete(`/passengers/${deletePassengerId}`);
      await queryClient.invalidateQueries({ queryKey: ['customer-detail', expandedId] });
      setToast({ message: 'Passenger deleted', tone: 'success' });
    } catch {
      setToast({ message: 'Failed to delete passenger', tone: 'error' });
    } finally {
      setDeleting(false);
      setDeletePassengerId(null);
      setDeleteConfirmText('');
    }
  }

  if (error) return <ErrorAlert message="Unable to load customers" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer profiles and passengers"
        actions={
          <Button onClick={openCreateCustomer}>Add Customer</Button>
        }
      />

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone"
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
      ) : customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Create your first customer to get started." />
      ) : (
        <Table headers={['Name', 'Email', 'Phone', 'Tier', 'Created', '']}>
          {customers.map((c: any) => (
            <Fragment key={c.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="px-4 py-3">{c.email ?? '—'}</td>
                <td className="px-4 py-3">{formatPhone(c.phone_country_code, c.phone_number)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${TIER_COLORS[c.tier ?? 'STANDARD'] ?? 'bg-gray-100 text-gray-700'}`}>
                    {c.tier ?? 'STANDARD'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button variant="ghost" onClick={() => openEditCustomer(c)}>Edit</Button>
                  <Button variant="ghost" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>Passengers</Button>
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => { setDeleteCustomerId(c.id); setDeleteCustomerConfirmText(''); }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
              {expandedId === c.id && (
                <tr>
                  <td colSpan={6} className="bg-gray-50">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Passengers</h3>
                        <Button variant="secondary" onClick={() => openCreatePassenger(c.id)}>Add Passenger</Button>
                      </div>
                      {passengers.length === 0 ? (
                        <p className="text-sm text-gray-500">No passengers found.</p>
                      ) : (
                        <div className="space-y-2">
                          {passengers.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between bg-white border rounded p-3">
                              <div>
                                <div className="font-medium">{p.first_name} {p.last_name}</div>
                                <div className="text-xs text-gray-500">{formatPhone(p.phone_country_code, p.phone_number)}</div>
                                <div className="text-xs text-gray-500">
                                  🌡 {p.preferences?.temperature_c ?? 22}°C · 🎵 {p.preferences?.music ?? 'OFF'} · 💬 {p.preferences?.conversation ?? 'QUIET'} · 💺 {p.preferences?.seat ?? 'REAR'}
                                </div>
                                {p.preferences?.special_notes && (
                                  <div className="text-xs text-gray-500">📝 {p.preferences.special_notes}</div>
                                )}
                              </div>
                              <div className="space-x-2">
                                <Button variant="ghost" onClick={() => openEditPassenger(c.id, p)}>Edit</Button>
                                <Button
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => { setDeletePassengerId(p.id); setDeleteConfirmText(''); }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      )}

      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{editingCustomer ? 'Edit Customer' : 'Create Customer'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="First Name" value={customerForm.first_name} onChange={(e) => setCustomerForm((p) => ({ ...p, first_name: e.target.value }))} />
              <Input placeholder="Last Name" value={customerForm.last_name} onChange={(e) => setCustomerForm((p) => ({ ...p, last_name: e.target.value }))} />
              <Input placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} />
              <PhoneSplitField
                countryCode={customerForm.phone_country_code}
                number={customerForm.phone_number}
                onCountryCodeChange={(v) => setCustomerForm((p) => ({ ...p, phone_country_code: v }))}
                onNumberChange={(v) => setCustomerForm((p) => ({ ...p, phone_number: v }))}
              />
              <Select value={customerForm.tier} onChange={(e) => setCustomerForm((p) => ({ ...p, tier: e.target.value }))}>
                {['STANDARD','SILVER','GOLD','PLATINUM','VIP','CUSTOM'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
              {customerForm.tier === 'CUSTOM' && (
                <>
                  <Select value={customerForm.custom_discount_type} onChange={(e) => setCustomerForm((p) => ({ ...p, custom_discount_type: e.target.value }))}>
                    <option value="">Discount Type</option>
                    <option value="CUSTOM_PERCENT">CUSTOM_PERCENT</option>
                    <option value="CUSTOM_FIXED">CUSTOM_FIXED</option>
                  </Select>
                  <Input placeholder="Discount Value" value={customerForm.custom_discount_value} onChange={(e) => setCustomerForm((p) => ({ ...p, custom_discount_value: e.target.value }))} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCustomerModalOpen(false)}>Cancel</Button>
              <Button onClick={saveCustomer}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        title="Delete customer?"
        description="This will soft-delete the customer. Active bookings will prevent deletion. Type DELETE to confirm."
        isOpen={!!deleteCustomerId}
        onClose={() => { setDeleteCustomerId(null); setDeleteCustomerConfirmText(''); }}
        onConfirm={confirmDeleteCustomer}
        confirmText={deletingCustomer ? 'Deleting…' : 'Delete'}
        confirmTone="danger"
        loading={deletingCustomer || deleteCustomerConfirmText !== 'DELETE'}
      >
        <input
          value={deleteCustomerConfirmText}
          onChange={(e) => setDeleteCustomerConfirmText(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        />
      </ConfirmModal>

      <ConfirmModal
        title="Delete passenger?"
        description='This cannot be undone. Type DELETE to confirm.'
        isOpen={!!deletePassengerId}
        onClose={() => { setDeletePassengerId(null); setDeleteConfirmText(''); }}
        onConfirm={confirmDeletePassenger}
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        confirmTone="danger"
        loading={deleting || deleteConfirmText !== 'DELETE'}
      >
        <input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder='Type DELETE to confirm'
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        />
      </ConfirmModal>

      {passengerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{editingPassenger ? 'Edit Passenger' : 'Create Passenger'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="First Name" value={passengerForm.first_name} onChange={(e) => setPassengerForm((p) => ({ ...p, first_name: e.target.value }))} />
              <Input placeholder="Last Name" value={passengerForm.last_name} onChange={(e) => setPassengerForm((p) => ({ ...p, last_name: e.target.value }))} />
              <PhoneSplitField
                countryCode={passengerForm.phone_country_code}
                number={passengerForm.phone_number}
                onCountryCodeChange={(v) => setPassengerForm((p) => ({ ...p, phone_country_code: v }))}
                onNumberChange={(v) => setPassengerForm((p) => ({ ...p, phone_number: v }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">Temperature
                <Input type="number" min={16} max={26} value={passengerForm.temperature_c} onChange={(e) => setPassengerForm((p) => ({ ...p, temperature_c: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">Music
                <Select value={passengerForm.music} onChange={(e) => setPassengerForm((p) => ({ ...p, music: e.target.value }))}>
                  {MUSIC_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </label>
              <label className="text-sm">Conversation
                <Select value={passengerForm.conversation} onChange={(e) => setPassengerForm((p) => ({ ...p, conversation: e.target.value }))}>
                  {CONVERSATION_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </label>
              <label className="text-sm">Seat
                <Select value={passengerForm.seat} onChange={(e) => setPassengerForm((p) => ({ ...p, seat: e.target.value }))}>
                  {SEAT_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </label>
              <label className="text-sm md:col-span-2">Special Notes
                <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} value={passengerForm.special_notes} onChange={(e) => setPassengerForm((p) => ({ ...p, special_notes: e.target.value }))} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPassengerModalOpen(false)}>Cancel</Button>
              <Button onClick={savePassenger}>Save</Button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
