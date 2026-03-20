'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Star, PlayCircle, CheckCircle2, Send, Check, AlertTriangle, Clock,
  Flame, Snowflake, UtensilsCrossed
} from 'lucide-react';
import { Ticket, TicketItem } from '@/types';
import { api, getAlertLevel, formatElapsed, ORDER_TYPE_LABELS, ORDER_TYPE_COLORS, playSound } from '@/lib/utils';

interface Props {
  ticket: Ticket;
  onUpdated: (t: Ticket) => void;
  onCompleted: (t: Ticket) => void;
  yellowThreshold?: number;
  redThreshold?: number;
  selectedStation?: string;
}

export default function TicketCard({ ticket, onUpdated, onCompleted, yellowThreshold = 300, redThreshold = 600, selectedStation }: Props) {
  const [elapsed, setElapsed] = useState('0:00');
  const [alertLevel, setAlertLevel] = useState(getAlertLevel(ticket, yellowThreshold, redThreshold));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tick = () => {
      setElapsed(formatElapsed(ticket.created_at));
      setAlertLevel(getAlertLevel(ticket, yellowThreshold, redThreshold));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ticket.created_at, yellowThreshold, redThreshold]);

  const handleSetStatus = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const updated = await api.patch(`/api/tickets/${ticket.id}/status`, { status });
      if (status === 'completed') {
        onCompleted(ticket);
      } else {
        onUpdated(updated);
      }
    } finally {
      setLoading(false);
    }
  }, [ticket, onUpdated, onCompleted]);

  const handleItemToggle = useCallback(async (item: TicketItem) => {
    const newStatus = item.status === 'pending' ? 'ready' : 'pending';
    if (newStatus === 'ready') {
      playSound('item_ready');
    }
    const updated = await api.patch(`/api/tickets/${ticket.id}/items/${item.id}/status`, { status: newStatus });
    onUpdated(updated);
  }, [ticket.id, onUpdated]);

  const handlePriority = useCallback(async () => {
    const updated = await api.patch(`/api/tickets/${ticket.id}/priority`, { priority: ticket.priority === 1 ? 0 : 1 });
    onUpdated(updated);
  }, [ticket, onUpdated]);

  const typeColor = ORDER_TYPE_COLORS[ticket.order_type] || '#6366f1';
  
  const visibleItems = selectedStation && selectedStation !== 'all' 
    ? ticket.items.filter(item => {
        if (selectedStation === 'bar') {
          return item.station === 'bar' || item.station === 'bar_hot' || item.station === 'bar_cold';
        }
        return item.station === selectedStation || item.station === 'all';
      })
    : ticket.items;

  // Si no hay items visibles (ej. un ticket que era solo bebidas y estoy en comida), regresamos null
  if (visibleItems.length === 0) return null;

  const allVisibleItemsReady = visibleItems.every(i => i.status === 'ready');
  const typeLabel = ORDER_TYPE_LABELS[ticket.order_type] || ticket.order_type;
  const isVip = ticket.order_type === 'vip';
  const isDelivery = ticket.order_type === 'delivery';

  const AlertIcon = alertLevel === 'red' ? AlertTriangle : Clock;

  return (
    <div className={[
      'ticket-card',
      `ticket-card--${alertLevel}`,
      ticket.priority === 1 ? 'ticket-card--priority' : '',
    ].filter(Boolean).join(' ')}>

      {/* Header */}
      <div className="ticket-card__header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span className="ticket-card__order">{ticket.order_number}</span>
          <div className="ticket-card__meta">
            {ticket.table_number && (
              <span className="badge badge--table">{ticket.table_number}</span>
            )}
            <span
              className={`badge ${isVip ? 'badge--vip' : isDelivery ? 'badge--delivery' : 'badge--type'}`}
              style={{ borderColor: `${typeColor}40`, color: typeColor }}
            >
              {typeLabel}
            </span>
            {ticket.priority === 1 && (
              <span className="badge badge--priority">
                <Star size={10} strokeWidth={2.5} style={{ display: 'inline', marginRight: 2 }} />
                URGENTE
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <span className={`ticket-card__timer ticket-card__timer--${alertLevel}`}>
            {elapsed}
          </span>
          <span className={`badge badge--${alertLevel}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertIcon size={10} strokeWidth={2.5} />
            {alertLevel === 'green' ? 'A tiempo' : alertLevel === 'yellow' ? 'Atención' : 'Atrasado'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{
            width: `${Math.min(100, (visibleItems.filter(i => i.status === 'ready').length / Math.max(1, visibleItems.length)) * 100)}%`,
            background: alertLevel === 'green' ? 'var(--green)' : alertLevel === 'yellow' ? 'var(--yellow)' : 'var(--red)',
          }}
        />
      </div>

      {/* Items */}
      <div className="ticket-card__items">
        {visibleItems.map(item => (
          <div
            key={item.id}
            className={`ticket-item ${item.status === 'ready' ? 'ticket-item--ready' : ''}`}
            onClick={() => handleItemToggle(item)}
            title="Toca para marcar como listo"
          >
            <div className="ticket-item__qty">{item.quantity}</div>
            <div className="ticket-item__content">
              <div className="ticket-item__name" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {/* Station badge inline with item name */}
                {item.station === 'bar_hot' && (
                  <span title="Bebida caliente" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <Flame size={12} color="#ef4444" strokeWidth={2} />
                  </span>
                )}
                {item.station === 'bar_cold' && (
                  <span title="Bebida fría" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <Snowflake size={12} color="#06b6d4" strokeWidth={2} />
                  </span>
                )}
                {item.station === 'food' && (
                  <span title="Comida" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: 0.45 }}>
                    <UtensilsCrossed size={11} color="#f59e0b" strokeWidth={2} />
                  </span>
                )}
                {item.name}
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="ticket-item__modifiers">
                  {item.modifiers.map((m, i) => (
                    <span key={i} className="modifier-tag">{m}</span>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="ticket-item__notes">
                  <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3 }} />
                  {item.notes}
                </div>
              )}
            </div>
            {item.status === 'ready' && (
              <Check size={14} className="ticket-item__check" strokeWidth={3} />
            )}
          </div>
        ))}

        {ticket.notes && (
          <div style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(234,179,8,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(234,179,8,0.3)',
            fontSize: '0.8rem',
            color: 'var(--yellow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {ticket.notes}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="ticket-card__footer">
        <button
          className="btn btn--warning btn--sm btn--icon"
          onClick={handlePriority}
          title={ticket.priority === 1 ? 'Quitar prioridad' : 'Marcar como urgente'}
        >
          <Star size={14} strokeWidth={ticket.priority === 1 ? 0 : 2} fill={ticket.priority === 1 ? 'currentColor' : 'none'} />
        </button>

        {ticket.status === 'pending' && (
          <button
            className="btn btn--primary btn--sm"
            style={{ flex: 1 }}
            onClick={() => handleSetStatus('in-progress')}
            disabled={loading}
          >
            <PlayCircle size={14} />
            Iniciar
          </button>
        )}

        {ticket.status === 'in-progress' && (
          <button
            className={`btn btn--sm ${allVisibleItemsReady ? 'btn--success' : 'btn--ghost'}`}
            style={{ flex: 1 }}
            onClick={() => handleSetStatus('ready')}
            disabled={loading}
          >
            <CheckCircle2 size={14} />
            {allVisibleItemsReady ? 'Lista' : 'En Proceso'}
          </button>
        )}

        {ticket.status === 'ready' && (
          <button
            className="btn btn--success btn--sm"
            style={{ flex: 1 }}
            onClick={() => handleSetStatus('completed')}
            disabled={loading}
          >
            <Send size={14} />
            Despachar
          </button>
        )}

        {(ticket.status === 'pending' || ticket.status === 'in-progress') && (
          <button
            className="btn btn--success btn--sm"
            title="Marcar ticket como listo"
            onClick={() => handleSetStatus('ready')}
            disabled={loading}
          >
            <Check size={16} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}
