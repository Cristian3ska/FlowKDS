'use client';
import { useState, useEffect } from 'react';
import { RotateCcw, RefreshCw } from 'lucide-react';
import { Ticket } from '@/types';
import { api, ORDER_TYPE_LABELS } from '@/lib/utils';

interface Props {
  onRestore: (ticket: Ticket) => void;
}

export default function HistoryPanel({ onRestore }: Props) {
  const [history, setHistory] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/tickets/history?limit=15');
      setHistory(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (ticket: Ticket) => {
    const restored = await api.patch(`/api/tickets/${ticket.id}/restore`, {});
    onRestore(restored);
    setHistory(prev => prev.filter(t => t.id !== ticket.id));
  };

  const getPrepTime = (ticket: Ticket): string => {
    if (!ticket.started_at || !ticket.completed_at) return '--';
    const secs = Math.floor((ticket.completed_at - ticket.started_at) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m${s}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-label">Historial</span>
        <button
          className="btn btn--ghost btn--sm"
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
          Recargar
        </button>
      </div>

      {history.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
          Sin historial reciente
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {history.map(ticket => (
            <div key={ticket.id} className="history-item">
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {ticket.order_number}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {ORDER_TYPE_LABELS[ticket.order_type]} • {getPrepTime(ticket)}
                </span>
              </div>
              <button
                className="btn btn--warning btn--sm btn--icon"
                onClick={() => handleRestore(ticket)}
                title="Restaurar ticket"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
