'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Users, Plus, Pencil, Trash2, X, Check,
  Star, Phone, Mail, Thermometer, Music, MessageSquare, Armchair,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Preferences {
  temperature_c?: number;
  music?: 'OFF' | 'JAZZ' | 'CLASSICAL' | 'POP';
  conversation?: 'QUIET' | 'FRIENDLY';
  seat?: 'FRONT' | 'REAR';
  special_notes?: string;
}

interface Passenger {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  relationship: string;
  is_default: boolean;
  preferences: Preferences | null;
}

const RELATIONSHIPS = ['Self', 'Family', 'Colleague', 'VIP Guest', 'Other'];
const MUSIC_OPTIONS = ['OFF', 'JAZZ', 'CLASSICAL', 'POP'];
const CONVERSATION_OPTIONS = ['QUIET', 'FRIENDLY'];
const SEAT_OPTIONS = ['FRONT', 'REAR'];

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone_country_code: '+61',
  phone_number: '',
  relationship: 'Other',
  is_default: false,
  preferences: {
    temperature_c: 22,
    music: 'OFF' as const,
    conversation: 'QUIET' as const,
    seat: 'REAR' as const,
    special_notes: '',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPhone(code: string | null, number: string | null) {
  if (!number) return null;
  return `${code ?? ''} ${number}`.trim();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PassengersPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: passengers = [], isLoading } = useQuery<Passenger[]>({
    queryKey: ['passengers'],
    queryFn: async () => {
      const r = await api.get('/customer-portal/passengers');
      return r.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        email: form.email || null,
        phone_number: form.phone_number || null,
        preferences: {
          temperature_c: Number(form.preferences.temperature_c),
          music: form.preferences.music,
          conversation: form.preferences.conversation,
          seat: form.preferences.seat,
          special_notes: form.preferences.special_notes || null,
        },
      };
      if (editingId === 'new') {
        await api.post('/customer-portal/passengers', payload);
      } else {
        await api.patch(`/passengers/${editingId}`, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['passengers'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/passengers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['passengers'] });
      setDeleteId(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.post(`/passengers/${id}/set-default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passengers'] }),
  });

  const openNew = () => {
    setForm(emptyForm);
    setEditingId('new');
  };

  const openEdit = (p: Passenger) => {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? '',
      phone_country_code: p.phone_country_code ?? '+61',
      phone_number: p.phone_number ?? '',
      relationship: p.relationship ?? 'Other',
      is_default: p.is_default,
      preferences: {
        temperature_c: p.preferences?.temperature_c ?? 22,
        music: (p.preferences?.music as any) ?? 'OFF',
        conversation: (p.preferences?.conversation as any) ?? 'QUIET',
        seat: (p.preferences?.seat as any) ?? 'REAR',
        special_notes: p.preferences?.special_notes ?? '',
      },
    });
    setEditingId(p.id);
  };

  const set = (k: keyof typeof emptyForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setPref = (k: keyof Preferences, v: any) =>
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [k]: v } }));

  // ── Form ──
  const renderForm = () => (
    <Card className="border-[hsl(var(--primary)/0.3)] shadow-lg">
      <CardContent className="p-5 space-y-5">
        <h3 className="font-display text-lg font-medium text-[hsl(var(--foreground))]">
          {editingId === 'new' ? 'Add Passenger' : 'Edit Passenger'}
        </h3>

        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First Name *</Label>
            <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="First name" />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name *</Label>
            <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Last name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <div className="flex gap-2">
              <Input className="w-20 shrink-0" value={form.phone_country_code} onChange={(e) => set('phone_country_code', e.target.value)} placeholder="+61" />
              <Input className="flex-1" value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} placeholder="400 000 000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Relationship</Label>
            <select
              className="flex h-11 w-full rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))]"
              value={form.relationship}
              onChange={(e) => set('relationship', e.target.value)}
            >
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <button
              type="button"
              onClick={() => set('is_default', !form.is_default)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.is_default ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
              )}
            >
              <span className={cn('inline-block h-4 w-4 rounded-full bg-white transition-transform', form.is_default ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <Label className="normal-case text-sm cursor-pointer" onClick={() => set('is_default', !form.is_default)}>
              Set as default passenger
            </Label>
          </div>
        </div>

        {/* Preferences */}
        <div className="border-t border-[hsl(var(--border))] pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Ride Preferences</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp (°C)</Label>
              <Input type="number" min={16} max={26} value={form.preferences.temperature_c} onChange={(e) => setPref('temperature_c', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Music className="h-3 w-3" /> Music</Label>
              <select className="flex h-11 w-full rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))]" value={form.preferences.music} onChange={(e) => setPref('music', e.target.value)}>
                {MUSIC_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Conversation</Label>
              <select className="flex h-11 w-full rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))]" value={form.preferences.conversation} onChange={(e) => setPref('conversation', e.target.value)}>
                {CONVERSATION_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Armchair className="h-3 w-3" /> Seat</Label>
              <select className="flex h-11 w-full rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))]" value={form.preferences.seat} onChange={(e) => setPref('seat', e.target.value)}>
                {SEAT_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Special Notes</Label>
            <Input value={form.preferences.special_notes} onChange={(e) => setPref('special_notes', e.target.value)} placeholder="e.g. Wheelchair accessible, child seat needed..." />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.first_name.trim() || !form.last_name.trim()}
            size="md"
          >
            {saveMutation.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Save Passenger
          </Button>
          <Button variant="ghost" size="md" onClick={() => setEditingId(null)}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
        {saveMutation.isError && (
          <p className="text-sm text-[hsl(var(--destructive))]">Failed to save. Please try again.</p>
        )}
      </CardContent>
    </Card>
  );

  // ── Main render ──
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f14]" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Sticky Header */}
      <div
        className="sticky top-0 z-20 border-b border-white/[0.07] px-4"
        style={{
          background: 'rgba(13,15,20,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <BackButton fallback="/profile" />
          <h1 className="font-semibold text-white">Passengers</h1>
        </div>
        {editingId !== 'new' && (
          <Button size="md" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      <div className="max-w-2xl mx-auto space-y-4 py-5 px-4">

      {/* New passenger form */}
      {editingId === 'new' && renderForm()}

      {/* Empty state */}
      {passengers.length === 0 && editingId !== 'new' && (
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
            <Users className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <div>
            <p className="font-medium text-[hsl(var(--foreground))]">No saved passengers</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Add passengers you frequently book for</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Passenger</Button>
        </div>
      )}

      {/* Passenger list */}
      {passengers.map((p) => (
        <div key={p.id}>
          {editingId === p.id ? (
            renderForm()
          ) : (
            <Card className={cn(p.is_default && 'border-[hsl(var(--primary)/0.4)]')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.is_default && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-2.5 w-2.5" /> Default
                        </Badge>
                      )}
                      {p.relationship && p.relationship !== 'Other' && (
                        <Badge variant="outline">{p.relationship}</Badge>
                      )}
                    </div>

                    {/* Contact */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                          <Mail className="h-3 w-3" /> {p.email}
                        </span>
                      )}
                      {p.phone_number && (
                        <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                          <Phone className="h-3 w-3" /> {fmtPhone(p.phone_country_code, p.phone_number)}
                        </span>
                      )}
                    </div>

                    {/* Preferences */}
                    {p.preferences && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {p.preferences.temperature_c && (
                          <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{p.preferences.temperature_c}°C</span>
                        )}
                        {p.preferences.music && p.preferences.music !== 'OFF' && (
                          <span className="flex items-center gap-1"><Music className="h-3 w-3" />{p.preferences.music}</span>
                        )}
                        {p.preferences.conversation && (
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.preferences.conversation}</span>
                        )}
                        {p.preferences.seat && (
                          <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />{p.preferences.seat}</span>
                        )}
                        {p.preferences.special_notes && (
                          <span className="italic">"{p.preferences.special_notes}"</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!p.is_default && (
                      <button
                        onClick={() => setDefaultMutation.mutate(p.id)}
                        className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] transition-colors"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteId === p.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(p.id)}
                          className="px-2 py-1 text-xs rounded bg-[hsl(var(--destructive))] text-white"
                        >
                          {deleteMutation.isPending ? '...' : 'Confirm'}
                        </button>
                        <button onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs rounded bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
