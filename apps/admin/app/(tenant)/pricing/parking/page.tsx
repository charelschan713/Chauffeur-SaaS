"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";

type ParkingRule = {
  id: string; name: string; keywords: string[]; fee_minor: number; is_active: boolean;
};

const empty = (): Partial<ParkingRule> => ({
  name: "", keywords: [], fee_minor: 0, is_active: true,
});

export default function ParkingPage() {
  const [rules, setRules] = useState<ParkingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ParkingRule | null>(null);
  const [form, setForm] = useState<Partial<ParkingRule>>(empty());
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get("/surcharges/parking");
    setRules(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(empty());
    setKeywordInput("");
    setShowForm(true);
  }

  function openEdit(r: ParkingRule) {
    setEditing(r);
    setForm({ ...r });
    setKeywordInput(r.keywords.join(", "));
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const keywords = keywordInput.split(",").map(k => k.trim()).filter(Boolean);
    const payload = { ...form, keywords, fee_minor: Number(form.fee_minor ?? 0) };
    if (editing) {
      await api.put(`/surcharges/parking/${editing.id}`, payload);
    } else {
      await api.post("/surcharges/parking", payload);
    }
    await load();
    setShowForm(false);
    setSaving(false);
  }

  async function toggleActive(r: ParkingRule) {
    await api.put(`/surcharges/parking/${r.id}`, { is_active: !r.is_active });
    await load();
  }

  async function remove(id: string) {
    
    await api.delete(`/surcharges/parking/${id}`);
    await load();
  }

  const fmtFee = (minor: number) => `$${(minor / 100).toFixed(2)}`;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Airport Parking Fees"
        subtitle="Applied automatically when pickup address matches a terminal"
        actions={<Button onClick={openCreate}>+ Add Rule</Button>}
      />

      {/* Info banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        💡 Parking fee applies when the <strong>pickup address</strong> matches a terminal keyword. For example: City→T3 does <em>not</em> trigger (city pickup); T3→City <em>does</em> trigger (airport pickup). Return trips charge <strong>once</strong> — only on the leg where driver picks up from the airport.
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {editing ? "Edit Parking Rule" : "New Parking Rule"}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Sydney Airport T1"
                value={form.name ?? ""}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fee ($)</label>
              <input type="number" step="0.01" min="0"
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                value={(Number(form.fee_minor ?? 0) / 100).toFixed(2)}
                onChange={e => setForm(f => ({ ...f, fee_minor: Math.round(Number(e.target.value) * 100) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Active</label>
              <select className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                value={form.is_active ? "true" : "false"}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.value === "true" }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Address Keywords <span className="font-normal text-gray-400">(comma-separated — match any)</span>
              </label>
              <input className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. T1, Terminal 1, International, Mascot"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Case-insensitive partial match on pickup address</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !form.name?.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Terminal / Location</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Keywords</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Fee</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No parking rules yet</td></tr>
              )}
              {rules.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {r.keywords.map(k => (
                        <span key={k} className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-xs">{k}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{fmtFee(r.fee_minor)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                    }`}>{r.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => toggleActive(r)} className="text-gray-500 hover:underline text-sm">
                      {r.is_active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => remove(r.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
