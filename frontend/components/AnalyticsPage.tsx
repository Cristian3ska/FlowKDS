'use client';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Package, CheckCircle2, Timer, AlertTriangle,
  TrendingUp, Factory, UtensilsCrossed, Loader2, DollarSign
} from 'lucide-react';
import { AnalyticsSummary, AnalyticsPrepTime, PeakHour, StationPerformance } from '@/types';
import { api, formatPrepTime, STATION_LABELS, STATION_COLORS } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface Props {
  onBack: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AnalyticsPage({ onBack }: Props) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [prepTimes, setPrepTimes] = useState<AnalyticsPrepTime[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [stationPerf, setStationPerf] = useState<StationPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, pt, ph, sp] = await Promise.all([
          api.get('/api/analytics/summary'),
          api.get('/api/analytics/prep-times'),
          api.get('/api/analytics/peak-hours'),
          api.get('/api/analytics/station-performance'),
        ]);
        setSummary(s);
        setPrepTimes(pt.slice(0, 10));
        setPeakHours(ph);
        setStationPerf(sp);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const peakData = HOURS.map(h => {
    const found = peakHours.find(p => p.hour_of_day === h);
    return {
      hour: `${h.toString().padStart(2, '0')}:00`,
      pedidos: found?.order_count || 0,
      prep: found?.avg_prep_seconds ? Math.round(found.avg_prep_seconds / 60) : 0,
    };
  }).filter(d => (d.pedidos > 0 || (d.hour >= '07:00' && d.hour <= '23:00')));

  const STAT_CARDS = [
    { label: 'Ventas Totales',  value: summary ? `$${summary.sales_today.toFixed(2)}` : '--',          Icon: DollarSign,    color: '#fbbf24' },
    { label: 'Pedidos Hoy',   value: summary?.total_today ?? '--',                                      Icon: Package,       color: '#6366f1' },
    { label: 'Completados',  value: summary?.completed_today ?? '--',                                   Icon: CheckCircle2,  color: '#22c55e' },
    { label: 'Tiempo Prom.', value: summary ? formatPrepTime(summary.avg_prep_time_seconds) : '--',     Icon: Timer,         color: '#06b6d4' },
    { label: 'Atrasados',    value: summary?.delayed_count ?? '--',                                     Icon: AlertTriangle, color: '#ef4444' },
  ];

  const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
  };

  return (
    <div className="kds-app">
      <div className="kds-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn--ghost btn--icon" onClick={onBack}><ArrowLeft size={16} /></button>
          <div>
            <div className="kds-header__title">Analítica</div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Se actualiza cada 30s
        </div>
      </div>

      {loading && !summary ? (
        <div className="empty-state">
          <div className="empty-state__icon"><Loader2 size={64} strokeWidth={1} style={{ opacity: 0.25 }} /></div>
          <div className="empty-state__title">Cargando datos...</div>
          <p style={{ fontSize: '0.85rem' }}>Procesa tus primeros pedidos para generar analítica.</p>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1.25rem 1.25rem 0' }}>
            {STAT_CARDS.map(({ label, value, Icon, color }) => (
              <div key={label} className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
                <div className="stat-card__icon"><Icon size={22} color={color} strokeWidth={1.75} /></div>
                <div className="stat-card__value" style={{ color }}>{value}</div>
                <div className="stat-card__label">{label}</div>
              </div>
            ))}
          </div>

          <div className="analytics-grid">
            {/* Peak Hours */}
            <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
              <div className="analytics-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={14} /> Horas Pico — Volumen de Pedidos</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={peakData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-primary)' }} />
                  <Bar dataKey="pedidos" name="Pedidos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Station Performance Pie */}
            <div className="analytics-card">
              <div className="analytics-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Factory size={14} /> Rendimiento por Estación</div>
              {stationPerf.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
                  Sin datos aún
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stationPerf}
                        dataKey="total_items"
                        nameKey="station"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ station, percent }: any) => `${STATION_LABELS[station] || station} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {stationPerf.map((entry) => (
                          <Cell key={entry.station} fill={STATION_COLORS[entry.station] || '#6366f1'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                    {stationPerf.map(s => (
                      <div key={s.station} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATION_COLORS[s.station] || '#6366f1', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{STATION_LABELS[s.station] || s.station}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatPrepTime(s.avg_seconds)}</span>
                        {s.delayed_count > 0 && (
                          <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>({s.delayed_count} atraso{s.delayed_count > 1 ? 's' : ''})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Prep times per dish */}
            <div className="analytics-card">
              <div className="analytics-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UtensilsCrossed size={14} /> Tiempo de Preparación por Platillo</div>
              {prepTimes.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Sin datos aún</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {prepTimes.map((item, i) => {
                    const maxSecs = prepTimes[0].avg_seconds || 1;
                    const pct = (item.avg_seconds / maxSecs) * 100;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</span>
                          <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{formatPrepTime(item.avg_seconds)} × {item.count}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{
                            width: `${pct}%`,
                            background: pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Avg prep time trend */}
            <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
              <div className="analytics-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Timer size={14} /> Tiempo Promedio de Preparación por Hora</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={peakData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="m" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [`${v} min`, 'Tiempo Prep.']}
                  />
                  <Line type="monotone" dataKey="prep" stroke="#06b6d4" strokeWidth={2} dot={false} name="Tiempo Prep. (min)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
