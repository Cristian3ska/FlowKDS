'use client';
import { useState, useEffect } from 'react';
import { ConsolidationItem } from '@/types';
import { api, STATION_LABELS, STATION_COLORS } from '@/lib/utils';

interface Props {
  station: string;
}

export default function ConsolidationPanel({ station }: Props) {
  const [items, setItems] = useState<ConsolidationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const url = station !== 'all' ? `/api/consolidation?station=${station}` : '/api/consolidation';
        const data = await api.get(url);
        setItems(data);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [station]);

  if (items.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
        {loading ? 'Cargando...' : 'Sin ítems pendientes'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.625rem 0.75rem',
          background: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}>
          <span style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            color: STATION_COLORS[item.station] || 'var(--accent)',
            minWidth: '3rem',
            fontVariantNumeric: 'tabular-nums',
          }}>
            ×{item.total_quantity}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {STATION_LABELS[item.station] || item.station}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
