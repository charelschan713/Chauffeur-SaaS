"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";

type TimeSurcharge = {
  id: string; name: string; day_type: string;
  start_time: string; end_time: string;
  surcharge_type: string; surcharge_value: string; is_active: boolean;
};
type Holiday = {
  id: string; name: string; date: string; recurring: boolean;
  surcharge_type: string; surcharge_value: string; is_active: boolean;
};

const emptyTime = (): Partial<TimeSurcharge> => ({
  name:"", day_type:"ALL", start_time:"23:00", end_time:"05:00",
  surcharge_type:"PERCENTAGE", surcharge_value:"20", is_active: true,
});
const emptyHoliday = (): Partial<Holiday> => ({
  name:"", date:"", recurring:true,
  surcharge_type:"PERCENTAGE", surcharge_value:"25", is_active:true,
});

export default function SurchargesPage() {
  const [timeSurcharges, setTimeSurcharges] = useState<TimeSurcharge[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [showTimeForm, setShowTimeForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [editingTime, setEditingTime] = useState<TimeSurcharge|null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday|null>(null);
  const [timeForm, setTimeForm] = useState<Partial<TimeSurcharge>>(emptyTime());
  const [holidayForm, setHolidayForm] = useState<Partial<Holiday>>(emptyHoliday());
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{id: string; type: 'time'|'holiday'} | null>(null);

  const loadTime = useCallback(async () => {
    const r = await api.get("/surcharges/time");
    setTimeSurcharges(r.data);
  }, []);

  const loadHolidays = useCallback(async () => {
    const r = await api.get("/surcharges/holidays");
    setHolidays(r.data);
  }, []);

  useEffect(() => { loadTime(); loadHolidays(); }, [loadTime, loadHolidays]);

  // ── Time Surcharge save ──────────────────────────────────────────
  const saveTime = async () => {
    setSaving(true);
    if (editingTime) {
      await api.put(`/surcharges/time/${editingTime.id}`, timeForm);
    } else {
      await api.post("/surcharges/time", timeForm);
    }
    setSaving(false); setShowTimeForm(false); setEditingTime(null);
    setTimeForm(emptyTime()); loadTime();
  };

  const deleteTime = async (id: string) => {
    await api.delete(`/surcharges/time/${id}`);
    setConfirmDeleteId(null);
    loadTime();
  };

  const toggleTime = async (s: TimeSurcharge) => {
    await api.put(`/surcharges/time/${s.id}`, { is_active: !s.is_active });
    loadTime();
  };

  // ── Holiday save ─────────────────────────────────────────────────
  const saveHoliday = async () => {
    setSaving(true);
    if (editingHoliday) {
      await api.put(`/surcharges/holidays/${editingHoliday.id}`, holidayForm);
    } else {
      await api.post("/surcharges/holidays", holidayForm);
    }
    setSaving(false); setShowHolidayForm(false); setEditingHoliday(null);
    setHolidayForm(emptyHoliday()); loadHolidays();
  };

  const deleteHoliday = async (id: string) => {
    await api.delete(`/surcharges/holidays/${id}`);
    setConfirmDeleteId(null);
    loadHolidays();
  };

  const toggleHoliday = async (h: Holiday) => {
    await api.put(`/surcharges/holidays/${h.id}`, { is_active: !h.is_active });
    loadHolidays();
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const fmtTime = (t: string) => t?.slice(0,5) ?? "";
  const fmtDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" });
  };
  const surchargeLabel = (type: string, value: string) =>
    type === "PERCENTAGE" ? `+${value}%` : `+$${value}`;

  const statusPill = (active: boolean) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
    }`}>{active ? "Active" : "Inactive"}</span>
  );

  const inputCls = "w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="p-6 space-y-8">
      {/* ── Time Surcharges ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Time-Based Surcharges</h2>
            <p className="text-sm text-gray-500">Late night, early morning, weekend premiums</p>
          </div>
          <Button onClick={() => { setEditingTime(null); setTimeForm(emptyTime()); setShowTimeForm(true); }}>
            + Add Rule
          </Button>
        </div>

        {showTimeForm && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingTime ? "Edit Time Rule" : "New Time Rule"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Rule Name</label>
                <input className={inputCls} value={timeForm.name ?? ""} onChange={e => setTimeForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Late Night Surcharge" />
              </div>
              <div>
                <label className={labelCls}>Applies To</label>
                <select className={inputCls} value={timeForm.day_type ?? "ALL"} onChange={e => setTimeForm(f=>({...f,day_type:e.target.value}))}>
                  <option value="ALL">All Days</option>
                  <option value="WEEKDAY">Weekdays Only</option>
                  <option value="WEEKEND">Weekends Only</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Time</label>
                  <input type="time" className={inputCls} value={timeForm.start_time ?? ""} onChange={e => setTimeForm(f=>({...f,start_time:e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input type="time" className={inputCls} value={timeForm.end_time ?? ""} onChange={e => setTimeForm(f=>({...f,end_time:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Surcharge Type</label>
                <select className={inputCls} value={timeForm.surcharge_type ?? "PERCENTAGE"} onChange={e => setTimeForm(f=>({...f,surcharge_type:e.target.value}))}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{timeForm.surcharge_type === "FIXED" ? "Amount ($)" : "Percentage (%)"}</label>
                <input type="number" className={inputCls} value={timeForm.surcharge_value ?? ""} onChange={e => setTimeForm(f=>({...f,surcharge_value:e.target.value}))} placeholder="20" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveTime} disabled={saving}>{saving ? "Saving…" : editingTime ? "Update" : "Create"}</Button>
              <button onClick={() => { setShowTimeForm(false); setEditingTime(null); }} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Rule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Time Window</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Surcharge</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {timeSurcharges.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No time rules yet</td></tr>
              ) : timeSurcharges.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{s.day_type === "ALL" ? "All days" : s.day_type.charAt(0)+s.day_type.slice(1).toLowerCase()+"s"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</td>
                  <td className="px-4 py-3 text-primary font-semibold">{surchargeLabel(s.surcharge_type, s.surcharge_value)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleTime(s)}>{statusPill(s.is_active)}</button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => { setEditingTime(s); setTimeForm({...s}); setShowTimeForm(true); }} className="text-xs text-primary hover:text-primary/80 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDeleteId({id: s.id, type: 'time'})} className="text-xs text-destructive hover:text-destructive/80 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">💡 Overnight ranges work automatically — e.g. 23:00–05:00 wraps midnight correctly.</p>
      </div>

      {/* ── Public Holidays ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Public Holidays</h2>
            <p className="text-sm text-gray-500">Holiday surcharges applied automatically on matching dates</p>
          </div>
          <Button onClick={() => { setEditingHoliday(null); setHolidayForm(emptyHoliday()); setShowHolidayForm(true); }}>
            + Add Holiday
          </Button>
        </div>

        {showHolidayForm && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingHoliday ? "Edit Holiday" : "New Holiday"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Holiday Name</label>
                <input className={inputCls} value={holidayForm.name ?? ""} onChange={e => setHolidayForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Christmas Day" />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" className={inputCls} value={holidayForm.date?.slice(0,10) ?? ""} onChange={e => setHolidayForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Recurs Annually</label>
                <select className={inputCls} value={holidayForm.recurring ? "true" : "false"} onChange={e => setHolidayForm(f=>({...f,recurring:e.target.value==="true"}))}>
                  <option value="true">Yes — every year (same day/month)</option>
                  <option value="false">No — one-time only</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Type</label>
                  <select className={inputCls} value={holidayForm.surcharge_type ?? "PERCENTAGE"} onChange={e => setHolidayForm(f=>({...f,surcharge_type:e.target.value}))}>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed ($)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{holidayForm.surcharge_type === "FIXED" ? "Amount ($)" : "Rate (%)"}</label>
                  <input type="number" className={inputCls} value={holidayForm.surcharge_value ?? ""} onChange={e => setHolidayForm(f=>({...f,surcharge_value:e.target.value}))} placeholder="25" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveHoliday} disabled={saving}>{saving ? "Saving…" : editingHoliday ? "Update" : "Create"}</Button>
              <button onClick={() => { setShowHolidayForm(false); setEditingHoliday(null); }} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Holiday</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Recurring</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Surcharge</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {holidays.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No holidays yet</td></tr>
              ) : holidays.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(h.date)}</td>
                  <td className="px-4 py-3 text-gray-500">{h.recurring ? "↻ Annual" : "Once"}</td>
                  <td className="px-4 py-3 text-primary font-semibold">{surchargeLabel(h.surcharge_type, h.surcharge_value)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleHoliday(h)}>{statusPill(h.is_active)}</button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => { setEditingHoliday(h); setHolidayForm({...h}); setShowHolidayForm(true); }} className="text-xs text-primary hover:text-primary/80 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDeleteId({id: h.id, type: 'holiday'})} className="text-xs text-destructive hover:text-destructive/80 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">💡 Recurring holidays match by month/day each year. Non-recurring apply once on the exact date.</p>
      </div>

      {/* Inline delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Confirm Delete</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this {confirmDeleteId.type === 'time' ? 'time surcharge' : 'holiday'}? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteId.type === 'time'
                  ? deleteTime(confirmDeleteId.id)
                  : deleteHoliday(confirmDeleteId.id)
                }
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
