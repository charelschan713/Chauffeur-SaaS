'use client';

import { useState } from 'react';
import api from '@/lib/api';

export default function MessagePanel({ assignmentId }: { assignmentId: string }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError('');
    setOk('');
    try {
      await api.post(`/driver-app/assignments/${assignmentId}/messages`, { text: text.trim() });
      setOk('Message sent');
      setText('');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Message Passenger</p>
      <textarea
        className="min-h-[88px] w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-white outline-none focus:border-[hsl(var(--primary))]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a short update..."
      />
      <button
        onClick={sendMessage}
        disabled={sending || !text.trim()}
        className="mt-3 w-full rounded-lg bg-[hsl(var(--secondary))] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {sending ? 'Sending...' : 'Send Message'}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {ok && <p className="mt-2 text-xs text-emerald-400">{ok}</p>}
    </div>
  );
}
