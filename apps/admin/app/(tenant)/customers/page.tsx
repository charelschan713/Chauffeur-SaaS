'use client';

import React, { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

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

  const { data: customers = [], isLoading } = useQuery({
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

  async function deletePassenger(id: string) {
    await api.delete(`/passengers/${id}`);
    await queryClient.invalidateQueries({ queryKey: ['customer-detail', expandedId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <button onClick={openCreateCustomer} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Add Customer</button>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone"
          className="border rounded px-3 py-2 text-sm w-full max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', 'Phone', 'Tier', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c: any) => (
                <Fragment key={c.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3">{c.email ?? '—'}</td>
                    <td className="px-4 py-3">{c.phone_country_code ?? ''} {c.phone_number ?? ''}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${TIER_COLORS[c.tier ?? 'STANDARD'] ?? 'bg-gray-100 text-gray-700'}`}>
                        {c.tier ?? 'STANDARD'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button className="text-blue-600 hover:underline" onClick={() => openEditCustomer(c)}>Edit</button>
                      <button className="text-gray-600 hover:underline" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>Passengers</button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">Passengers</h3>
                            <button className="px-3 py-1.5 rounded border text-sm" onClick={() => openCreatePassenger(c.id)}>Add Passenger</button>
                          </div>
                          {passengers.length === 0 ? (
                            <p className="text-sm text-gray-500">No passengers found.</p>
                          ) : (
                            <div className="space-y-2">
                              {passengers.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between bg-white border rounded p-3">
                                  <div>
                                    <div className="font-medium">{p.first_name} {p.last_name}</div>
                                    <div className="text-xs text-gray-500">{p.phone_country_code ?? ''} {p.phone_number ?? ''}</div>
                                    <div className="text-xs text-gray-500">
                                      🌡 {p.preferences?.temperature_c ?? 22}°C · 🎵 {p.preferences?.music ?? 'OFF'} · 💬 {p.preferences?.conversation ?? 'QUIET'} · 💺 {p.preferences?.seat ?? 'REAR'}
                                    </div>
                                    {p.preferences?.special_notes && (
                                      <div className="text-xs text-gray-500">📝 {p.preferences.special_notes}</div>
                                    )}
                                  </div>
                                  <div className="space-x-2">
                                    <button className="text-blue-600 hover:underline text-sm" onClick={() => openEditPassenger(c.id, p)}>Edit</button>
                                    <button className="text-red-600 hover:underline text-sm" onClick={() => deletePassenger(p.id)}>Delete</button>
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
            </tbody>
          </table>
        </div>
      )}

      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{editingCustomer ? 'Edit Customer' : 'Create Customer'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2 text-sm" placeholder="First Name" value={customerForm.first_name} onChange={(e) => setCustomerForm((p) => ({ ...p, first_name: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Last Name" value={customerForm.last_name} onChange={(e) => setCustomerForm((p) => ({ ...p, last_name: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Phone Country Code" value={customerForm.phone_country_code} onChange={(e) => setCustomerForm((p) => ({ ...p, phone_country_code: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Phone Number" value={customerForm.phone_number} onChange={(e) => setCustomerForm((p) => ({ ...p, phone_number: e.target.value }))} />
              <select className="border rounded px-3 py-2 text-sm" value={customerForm.tier} onChange={(e) => setCustomerForm((p) => ({ ...p, tier: e.target.value }))}>
                {['STANDARD','SILVER','GOLD','PLATINUM','VIP','CUSTOM'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {customerForm.tier === 'CUSTOM' && (
                <>
                  <select className="border rounded px-3 py-2 text-sm" value={customerForm.custom_discount_type} onChange={(e) => setCustomerForm((p) => ({ ...p, custom_discount_type: e.target.value }))}>
                    <option value="">Discount Type</option>
                    <option value="CUSTOM_PERCENT">CUSTOM_PERCENT</option>
                    <option value="CUSTOM_FIXED">CUSTOM_FIXED</option>
                  </select>
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Discount Value" value={customerForm.custom_discount_value} onChange={(e) => setCustomerForm((p) => ({ ...p, custom_discount_value: e.target.value }))} />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCustomerModalOpen(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
              <button onClick={saveCustomer} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {passengerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{editingPassenger ? 'Edit Passenger' : 'Create Passenger'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2 text-sm" placeholder="First Name" value={passengerForm.first_name} onChange={(e) => setPassengerForm((p) => ({ ...p, first_name: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Last Name" value={passengerForm.last_name} onChange={(e) => setPassengerForm((p) => ({ ...p, last_name: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Phone Country Code" value={passengerForm.phone_country_code} onChange={(e) => setPassengerForm((p) => ({ ...p, phone_country_code: e.target.value }))} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Phone Number" value={passengerForm.phone_number} onChange={(e) => setPassengerForm((p) => ({ ...p, phone_number: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">Temperature
                <input type="number" min={16} max={26} className="border rounded px-3 py-2 text-sm w-full" value={passengerForm.temperature_c} onChange={(e) => setPassengerForm((p) => ({ ...p, temperature_c: Number(e.target.value) }))} />
              </label>
              <label className="text-sm">Music
                <select className="border rounded px-3 py-2 text-sm w-full" value={passengerForm.music} onChange={(e) => setPassengerForm((p) => ({ ...p, music: e.target.value }))}>
                  {MUSIC_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-sm">Conversation
                <select className="border rounded px-3 py-2 text-sm w-full" value={passengerForm.conversation} onChange={(e) => setPassengerForm((p) => ({ ...p, conversation: e.target.value }))}>
                  {CONVERSATION_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-sm">Seat
                <select className="border rounded px-3 py-2 text-sm w-full" value={passengerForm.seat} onChange={(e) => setPassengerForm((p) => ({ ...p, seat: e.target.value }))}>
                  {SEAT_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-sm md:col-span-2">Special Notes
                <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3} value={passengerForm.special_notes} onChange={(e) => setPassengerForm((p) => ({ ...p, special_notes: e.target.value }))} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPassengerModalOpen(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
              <button onClick={savePassenger} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
