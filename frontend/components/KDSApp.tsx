'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChefHat, Wifi, WifiOff, Bell, BellOff, BarChart2,
  PanelRightClose, PanelRightOpen, ClipboardList, Flame,
  CheckSquare, Zap, Timer, MonitorPlay, ListOrdered, History,
  Circle, X, UtensilsCrossed, Snowflake, CupSoda, Settings as SettingsIcon, ImagePlus, Save, Crop, ZoomIn, Users, LogOut
} from 'lucide-react';
import { useRef } from 'react';
import { Ticket, Station } from '@/types';
import { useKDSSocket } from '@/hooks/useKDSSocket';
import { api, STATION_LABELS, STATION_COLORS, playSound } from '@/lib/utils';
import TicketCard from '@/components/TicketCard';
import HistoryPanel from '@/components/HistoryPanel';
import ConsolidationPanel from '@/components/ConsolidationPanel';
import PosSimulator from '@/components/PosSimulator';
import AnalyticsPage from '@/components/AnalyticsPage';
import MenuManager from '@/components/MenuManager';
import UserManager from '@/components/UserManager';
import StationManager from '@/components/StationManager';

type SidebarTab = 'simulator' | 'consolidation' | 'history';
type View = 'kds' | 'analytics' | 'menu' | 'users';

type Role = 'root' | 'admin' | 'waiter' | 'kitchen' | 'barista';

const DEFAULT_ROLES: Record<Role, string> = {
  root: 'Root (Dueño)',
  admin: 'Administrador',
  kitchen: 'Cocina',
  barista: 'Barista',
  waiter: 'Mesero'
};

const LoginScreen = ({ onLogin, appLogo }: { onLogin: (user: any) => void, appLogo: string }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { username, password });
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'white' }}>
      <form onSubmit={handleSubmit} style={{ 
        background: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '16px', 
        width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '1.25rem',
        border: '1px solid var(--border-bright)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          {appLogo ? (
            <div style={{ padding: '0.2rem', height: '64px', display: 'flex', justifyContent: 'center' }}>
              <img src={appLogo} alt="Logo" style={{ objectFit: 'contain', height: '100%', maxWidth: '240px' }} />
            </div>
          ) : (
            <div style={{ background: '#6366f122', padding: '0.75rem', borderRadius: '12px' }}>
              <ChefHat size={32} color="#818cf8" />
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Iniciar Sesión</h2>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Usuario</label>
          <input 
            type="text" className="form-input" required 
            value={username} onChange={e => setUsername(e.target.value)} 
            placeholder="Ej: mesero" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Contraseña</label>
          <input 
            type="password" className="form-input" required 
            value={password} onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••" 
          />
        </div>

        <button type="submit" className="btn btn--primary" style={{ marginTop: '0.75rem', padding: '0.85rem' }} disabled={loading}>
          {loading ? 'Validando...' : 'Entrar al Sistema'}
        </button>
      </form>
    </div>
  );
};

export default function KDSApp() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [view, setView] = useState<View>('kds');
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [stations, setStations] = useState<Station[]>([]);
  
  const [appName, setAppName] = useState('Flow KDS');
  const [appLogo, setAppLogo] = useState('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'system'|'users'|'areas'>('system');
  const [appNameConfig, setAppNameConfig] = useState('');
  const [appLogoConfig, setAppLogoConfig] = useState('');
  
  const [soundNewConfig, setSoundNewConfig] = useState('new_order');
  const [soundDelayedConfig, setSoundDelayedConfig] = useState('delayed');
  const [soundCompleteConfig, setSoundCompleteConfig] = useState('complete');
  const [soundItemReadyConfig, setSoundItemReadyConfig] = useState('item_ready');

  // Logo Editor State
  const [rawLogo, setRawLogo] = useState<string | null>(null);
  const [logoFit, setLogoFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [logoZoom, setLogoZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('simulator');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sortMode, setSortMode] = useState<'time' | 'priority'>('priority');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Station-specific thresholds stored in state so the hook can read them via ref
  const [redThreshold,    setRedThreshold]    = useState(600);
  const [yellowThreshold, setYellowThreshold] = useState(300);

  // Hook reads redThreshold via ref internally — passes the latest value on each render
  const { tickets, setTickets, connected } = useKDSSocket(soundEnabled, redThreshold);

  useEffect(() => {
    api.get('/api/stations').then(setStations);
    api.get('/api/settings').then((s) => {
      setSoundEnabled(s.sound_enabled === 'true');
      if (s.app_name) setAppName(s.app_name);
      if (s.app_logo) {
        setAppLogo(s.app_logo);
        // Sync favicon on initial load
        updateFavicon(s.app_logo);
      }
    });
  }, []);

  const updateFavicon = (dataUrl: string) => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = dataUrl;
  };

  // Sync favicon whenever appLogo changes
  useEffect(() => {
    if (appLogo) updateFavicon(appLogo);
  }, [appLogo]);


  // Update thresholds whenever the selected station changes
  useEffect(() => {
    const station = stations.find(s => s.id === selectedStation);
    setYellowThreshold(station?.time_alert_yellow ?? 300);
    setRedThreshold(station?.time_alert_red ?? 600);
  }, [selectedStation, stations]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];
    if (selectedStation === 'bar') {
      // Barra parent: show tickets with any bar item (hot or cold)
      result = result.filter(t =>
        t.items.some(i => i.station === 'bar' || i.station === 'bar_hot' || i.station === 'bar_cold')
      );
    } else if (selectedStation !== 'all') {
      result = result.filter(t =>
        t.items.some(i => i.station === selectedStation || i.station === 'all')
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }
    result.sort((a, b) => {
      if (sortMode === 'priority') {
        if (b.priority !== a.priority) return b.priority - a.priority;
      }
      return a.created_at - b.created_at;
    });
    return result;
  }, [tickets, selectedStation, filterStatus, sortMode]);

  const handleTicketUpdated = useCallback((updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, [setTickets]);

  const handleTicketCompleted = useCallback((ticket: Ticket) => {
    setTickets(prev => prev.filter(t => t.id !== ticket.id));
  }, [setTickets]);

  const handleRestore = useCallback((ticket: Ticket) => {
    setTickets(prev => {
      if (prev.find(t => t.id === ticket.id)) return prev;
      return [ticket, ...prev];
    });
  }, [setTickets]);

  const toggleSound = async () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    await api.patch('/api/settings', { sound_enabled: String(newVal) });
  };

  const openSettings = () => {
    setAppNameConfig(appName);
    setAppLogoConfig(appLogo);
    setSettingsTab('system');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    await api.patch('/api/settings', {
      app_name: appNameConfig,
      app_logo: appLogoConfig,
    });
    setAppName(appNameConfig);
    setAppLogo(appLogoConfig);
    setShowSettingsModal(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setRawLogo(ev.target.result as string);
        setLogoFit('contain');
        setLogoZoom(1);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    const r = user.role;
    if (r === 'kitchen') setSelectedStation('food');
    if (r === 'barista') setSelectedStation('bar');
    if (r === 'waiter') {
      setSidebarOpen(true);
      setSidebarTab('simulator');
    }
  };

  const activeRole = currentUser?.role;
  const canAccessFull = activeRole === 'root' || activeRole === 'admin';

  useEffect(() => {
    if (!rawLogo || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.src = rawLogo;
    img.onload = () => {
      const cw = 120;
      const ch = 120;
      ctx.clearRect(0, 0, cw, ch);
      
      let drawW = cw;
      let drawH = ch;
      const imgRatio = img.width / img.height;
      
      if (logoFit === 'contain') {
        if (imgRatio > 1) drawH = cw / imgRatio;
        else drawW = ch * imgRatio;
      } else if (logoFit === 'cover') {
        if (imgRatio > 1) drawW = ch * imgRatio;
        else drawH = cw / imgRatio;
      }
      
      drawW *= logoZoom;
      drawH *= logoZoom;
      
      const cx = cw / 2;
      const cy = ch / 2;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };
  }, [rawLogo, logoFit, logoZoom]);

  const confirmLogoCrop = () => {
    if (!canvasRef.current) return;
    setAppLogoConfig(canvasRef.current.toDataURL('image/png'));
    setRawLogo(null);
  };

  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const inProgressCount = tickets.filter(t => t.status === 'in-progress').length;
  const readyCount = tickets.filter(t => t.status === 'ready').length;

  if (!activeRole) {
    return <LoginScreen onLogin={handleLogin} appLogo={appLogo} />;
  }

  if (view === 'analytics' && canAccessFull) {
    return <AnalyticsPage onBack={() => setView('kds')} />;
  }

  if (view === 'menu' && canAccessFull) {
    return <MenuManager onBack={() => setView('kds')} />;
  }

  const SIDEBAR_TABS = [
    { key: 'simulator' as const,     label: 'POS',       Icon: MonitorPlay  },
    { key: 'consolidation' as const, label: 'Contar',    Icon: ListOrdered  },
    { key: 'history' as const,       label: 'Historial', Icon: History      },
  ];

  return (
    <div className="kds-app">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="kds-header">
        <div className="kds-header__logo">
          <div 
            className="kds-header__logo-icon" 
            style={appLogo ? { overflow: 'hidden', background: 'transparent' } : { overflow: 'hidden' }}
          >
            {appLogo ? (
              <img src={appLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <ChefHat size={18} color="white" strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="kds-header__title">{appName}</div>
            {(!appLogo && appName === 'Flow KDS') && (
              <div className="kds-header__subtitle">Kitchen Display System</div>
            )}
          </div>
        </div>

        {/* Status counters */}
        <div className="kds-header__center">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(99,102,241,0.15)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ClipboardList size={12} />
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
            <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Flame size={12} />
              {inProgressCount} en proceso
            </span>
            <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(34,197,94,0.15)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#86efac', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckSquare size={12} />
              {readyCount} listo{readyCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="kds-header__right">
          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: connected ? 'var(--green)' : 'var(--red)' }}>
            <div className={`status-dot ${connected ? '' : 'offline'}`} />
            {connected
              ? <><Wifi size={12} /> En línea</>
              : <><WifiOff size={12} /> Sin conexión</>
            }
          </div>

          <button
            className="btn btn--icon btn--ghost btn--sm"
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
          >
            {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>

          {canAccessFull && (
            <>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setView('menu')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <UtensilsCrossed size={14} /> Menú
              </button>

              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setView('analytics')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <BarChart2 size={14} />
                Analítica
              </button>

              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={openSettings}
                title="Configuración"
              >
                <SettingsIcon size={15} />
              </button>
            </>
          )}

          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={() => setSidebarOpen(o => !o)}
            title="Panel lateral"
          >
            {sidebarOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>

          <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.2rem' }} />

          <button
            className="btn btn--ghost btn--icon btn--sm"
            style={{ color: 'var(--red)' }}
            onClick={() => {
              setCurrentUser(null);
              setView('kds');
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ── Station Tabs ───────────────────────────────── */}
      <div style={{ padding: '0.75rem 1.25rem 0', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        {/* Primary station tabs */}
        <div className="station-tabs" style={{ paddingBottom: '0.5rem' }}>
          {/* Todas */}
          <button
            className={`station-tab ${selectedStation === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStation('all')}
          >
            <span className="station-tab__dot" style={{ background: '#6366f1' }} />
            Todas
          </button>

          {/* Comida */}
          <button
            className={`station-tab ${selectedStation === 'food' ? 'active' : ''}`}
            onClick={() => setSelectedStation('food')}
            style={selectedStation === 'food' ? {
              background: 'rgba(245,158,11,0.15)',
              borderColor: 'rgba(245,158,11,0.5)',
              color: '#fcd34d',
            } : {}}
          >
            <UtensilsCrossed size={13} style={{ opacity: 0.8 }} />
            Comida
          </button>

          {/* Barra (parent — selects all bar items) */}
          <button
            className={`station-tab ${
              selectedStation === 'bar' || selectedStation === 'bar_hot' || selectedStation === 'bar_cold'
                ? 'active' : ''
            }`}
            onClick={() => setSelectedStation('bar')}
            style={
              (selectedStation === 'bar' || selectedStation === 'bar_hot' || selectedStation === 'bar_cold')
                ? { background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.5)', color: '#c4b5fd' }
                : {}
            }
          >
            <CupSoda size={13} style={{ opacity: 0.8 }} />
            Barra
          </button>
        </div>

        {/* Sub-tabs: only visible when Barra is active */}
        {(selectedStation === 'bar' || selectedStation === 'bar_hot' || selectedStation === 'bar_cold') && (
          <div style={{ display: 'flex', gap: '0.35rem', paddingBottom: '0.625rem', paddingLeft: '0.25rem' }}>
            <button
              onClick={() => setSelectedStation('bar')}
              className={`btn btn--sm ${selectedStation === 'bar' ? '' : 'btn--ghost'}`}
              style={{
                fontSize: '0.72rem', gap: '0.3rem',
                background:  selectedStation === 'bar' ? 'rgba(139,92,246,0.2)' : undefined,
                borderColor: selectedStation === 'bar' ? 'rgba(139,92,246,0.5)' : undefined,
                color:       selectedStation === 'bar' ? '#c4b5fd' : undefined,
              }}
            >
              <CupSoda size={11} /> Todas Barra
            </button>
            <button
              onClick={() => setSelectedStation('bar_hot')}
              className={`btn btn--sm ${selectedStation === 'bar_hot' ? '' : 'btn--ghost'}`}
              style={{
                fontSize: '0.72rem', gap: '0.3rem',
                background:  selectedStation === 'bar_hot' ? 'rgba(239,68,68,0.15)' : undefined,
                borderColor: selectedStation === 'bar_hot' ? 'rgba(239,68,68,0.4)' : undefined,
                color:       selectedStation === 'bar_hot' ? '#fca5a5' : undefined,
              }}
            >
              <Flame size={11} /> Calientes
            </button>
            <button
              onClick={() => setSelectedStation('bar_cold')}
              className={`btn btn--sm ${selectedStation === 'bar_cold' ? '' : 'btn--ghost'}`}
              style={{
                fontSize: '0.72rem', gap: '0.3rem',
                background:  selectedStation === 'bar_cold' ? 'rgba(6,182,212,0.15)' : undefined,
                borderColor: selectedStation === 'bar_cold' ? 'rgba(6,182,212,0.4)' : undefined,
                color:       selectedStation === 'bar_cold' ? '#67e8f9' : undefined,
              }}
            >
              <Snowflake size={11} /> Frías
            </button>
          </div>
        )}
      </div>

      {/* ── Controls Bar ────────────────────────────────────── */}
      <div className="controls-bar">
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredTickets.length} comanda{filteredTickets.length !== 1 ? 's' : ''}
        </span>

        <div className="divider" style={{ width: '1px', height: '20px', margin: '0 0.25rem' }} />

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtrar:</span>
        {(['all', 'pending', 'in-progress', 'ready'] as const).map(s => (
          <button
            key={s}
            className={`btn btn--sm ${filterStatus === s ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendiente' : s === 'in-progress' ? 'En Proceso' : 'Listo'}
          </button>
        ))}

        <div className="divider" style={{ width: '1px', height: '20px', margin: '0 0.25rem' }} />

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Orden:</span>
        <button
          className={`btn btn--sm ${sortMode === 'priority' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setSortMode('priority')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Zap size={12} /> Prioridad
        </button>
        <button
          className={`btn btn--sm ${sortMode === 'time' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setSortMode('time')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Timer size={12} /> Tiempo
        </button>
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Tickets grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredTickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <ClipboardList size={64} strokeWidth={1} style={{ opacity: 0.2 }} />
              </div>
              <div className="empty-state__title">Sin comandas activas</div>
              <p style={{ fontSize: '0.85rem', maxWidth: '300px' }}>
                {connected
                  ? 'Usa el simulador POS en el panel lateral para crear un pedido de prueba.'
                  : 'Verifica que el servidor backend esté corriendo en el puerto 4000.'}
              </p>
            </div>
          ) : (
            <div className="tickets-grid">
              {filteredTickets.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onUpdated={handleTicketUpdated}
                  onCompleted={handleTicketCompleted}
                  yellowThreshold={yellowThreshold}
                  redThreshold={redThreshold}
                  selectedStation={selectedStation}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        {/* Backdrop (mobile only, dismisses bottom sheet) */}
        <div
          className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar — always in DOM; CSS handles show/hide on each breakpoint */}
        <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
            {/* Sidebar Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {SIDEBAR_TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`btn btn--sm ${sidebarTab === key ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}
                  onClick={() => setSidebarTab(key)}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            <div className="divider" />

            {sidebarTab === 'simulator' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className="section-label" style={{ marginBottom: '0.5rem' }}>Simulador POS</div>
                <PosSimulator />
              </div>
            )}

            {sidebarTab === 'consolidation' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div className="section-label">Consolidación</div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{STATION_LABELS[selectedStation] || 'Todas'}</span>
                </div>
                <ConsolidationPanel station={selectedStation} />
              </div>
            )}

            {sidebarTab === 'history' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <HistoryPanel onRestore={handleRestore} />
              </div>
            )}

            {/* Quick stats */}
            <div className="divider" />
            <div className="section-label">Estado del Sistema</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Conexión</span>
                <span style={{ color: connected ? 'var(--green)' : 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Circle size={7} fill="currentColor" strokeWidth={0} />
                  {connected ? 'En línea' : 'Desconectado'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Comandas activas</span>
                <span style={{ fontWeight: 700 }}>{tickets.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sonido</span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: soundEnabled ? 'var(--green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={toggleSound}
                >
                  {soundEnabled ? <><Bell size={12} /> Activo</> : <><BellOff size={12} /> Silenciado</>}
                </button>
              </div>
            </div>
          </aside>
      </div>

      {/* ── Mobile bottom navigation bar ──────────────────────── */}
      <nav className="mobile-bottom-bar">
        <button
          className={`btn ${sidebarTab === 'simulator' && sidebarOpen ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => { setSidebarTab('simulator'); setSidebarOpen(o => sidebarTab === 'simulator' ? !o : true); }}
        >
          <MonitorPlay size={18} />
          POS
        </button>
        <button
          className={`btn ${sidebarTab === 'consolidation' && sidebarOpen ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => { setSidebarTab('consolidation'); setSidebarOpen(o => sidebarTab === 'consolidation' ? !o : true); }}
        >
          <ListOrdered size={18} />
          Contar
        </button>
        <button
            className={`btn ${sidebarTab === 'history' && sidebarOpen ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setSidebarTab('history'); setSidebarOpen(o => sidebarTab === 'history' ? !o : true); }}
          >
            <History size={18} />
            Historial
          </button>
          
          {canAccessFull && (
            <button
              className="btn btn--ghost"
              onClick={() => setView('analytics')}
            >
              <BarChart2 size={18} />
              Stats
            </button>
          )}

          <button
          className={`btn ${soundEnabled ? 'btn--ghost' : 'btn--ghost'}`}
          onClick={toggleSound}
          style={{ color: soundEnabled ? 'var(--green)' : 'var(--text-muted)' }}
        >
          {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          {soundEnabled ? 'Sonido' : 'Mudo'}
        </button>
      </nav>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)', width: '100%', maxWidth: '850px', height: '85vh',
            borderRadius: '16px', border: '1px solid var(--border-bright)', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '0 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', background: 'var(--bg-main)' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button 
                  onClick={() => setSettingsTab('system')}
                  style={{ 
                    padding: '1rem 1.5rem', background: settingsTab === 'system' ? 'var(--bg-card)' : 'transparent',
                    color: settingsTab === 'system' ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: settingsTab === 'system' ? 700 : 500, fontSize: '0.95rem', cursor: 'pointer',
                    borderTopLeftRadius: '12px', borderTopRightRadius: '12px',
                    border: settingsTab === 'system' ? '1px solid var(--border)' : '1px solid transparent',
                    borderBottom: 'none', marginBottom: '-1px'
                  }}
                >
                  Sistema
                </button>
                <button 
                  onClick={() => setSettingsTab('areas')}
                  style={{ 
                    padding: '1rem 1.5rem', background: settingsTab === 'areas' ? 'var(--bg-card)' : 'transparent',
                    color: settingsTab === 'areas' ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: settingsTab === 'areas' ? 700 : 500, fontSize: '0.95rem', cursor: 'pointer',
                    borderTopLeftRadius: '12px', borderTopRightRadius: '12px',
                    border: settingsTab === 'areas' ? '1px solid var(--border)' : '1px solid transparent',
                    borderBottom: 'none', marginBottom: '-1px'
                  }}
                >
                  Áreas
                </button>
                <button 
                  onClick={() => setSettingsTab('users')}
                  style={{ 
                    padding: '1rem 1.5rem', background: settingsTab === 'users' ? 'var(--bg-card)' : 'transparent',
                    color: settingsTab === 'users' ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: settingsTab === 'users' ? 700 : 500, fontSize: '0.95rem', cursor: 'pointer',
                    borderTopLeftRadius: '12px', borderTopRightRadius: '12px',
                    border: settingsTab === 'users' ? '1px solid var(--border)' : '1px solid transparent',
                    borderBottom: 'none', marginBottom: '-1px'
                  }}
                >
                  Usuarios
                </button>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm" style={{ marginBottom: '0.75rem' }} onClick={() => setShowSettingsModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            {settingsTab === 'system' ? (
              <>
                <div style={{ padding: '2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="form-group" style={{ maxWidth: '400px' }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>Nombre del Restaurante / Aplicación</label>
                    <input 
                      type="text" className="form-input" 
                      value={appNameConfig} 
                      onChange={e => setAppNameConfig(e.target.value)} 
                      placeholder="Ej: KDS Pro"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>Logo del Restaurante</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                      <div style={{ 
                        width: '80px', height: '80px', borderRadius: '12px', background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0
                      }}>
                        {appLogoConfig ? (
                          <img src={appLogoConfig} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <ChefHat size={32} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 600 }}>
                          <ImagePlus size={18} /> Subir Nueva Imagen
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                        </label>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                          Sube el logo principal de tu restaurante.<br />Recomendado: 256x256px (PNG transpartente).
                        </div>
                      </div>
                    </div>
                    {appLogoConfig && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button className="btn btn--ghost btn--sm" style={{ fontSize: '0.75rem', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => setAppLogoConfig('')}>
                          Remover logo
                        </button>
                        <button className="btn btn--ghost btn--sm" style={{ fontSize: '0.75rem' }} onClick={() => { setAppLogoConfig(''); setAppNameConfig('KDS Pro'); }}>
                          Restablecer nombre y logo
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                       <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Sonidos de Notificación</h4>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                         <input 
                           type="checkbox" 
                           checked={soundEnabled} 
                           onChange={e => {
                             setSoundEnabled(e.target.checked);
                             api.patch('/api/settings', { sound_enabled: String(e.target.checked) });
                           }}
                           style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                         />
                         Activar Sonidos Principales
                       </label>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', opacity: soundEnabled ? 1 : 0.5, pointerEvents: soundEnabled ? 'auto' : 'none' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Nueva Comanda</label>
                          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => playSound(soundNewConfig as any)} title="Probar sonido"><Bell size={14} color="var(--accent)" /></button>
                        </div>
                        <select className="form-input" style={{ fontSize: '0.85rem' }} value={soundNewConfig} onChange={e => { setSoundNewConfig(e.target.value); playSound(e.target.value as any); }}>
                           <option value="new_order">Campana de Servicio</option>
                           <option value="digital">Timbre Digital</option>
                           <option value="pop">Burbuja Pop</option>
                           <option value="ping">Ping Suave</option>
                           <option value="item_ready">Pop Corto</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Orden Atrasada</label>
                          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => playSound(soundDelayedConfig as any)} title="Probar sonido"><Bell size={14} color="var(--accent)" /></button>
                        </div>
                        <select className="form-input" style={{ fontSize: '0.85rem' }} value={soundDelayedConfig} onChange={e => { setSoundDelayedConfig(e.target.value); playSound(e.target.value as any); }}>
                           <option value="delayed">Doble Campana Alerta</option>
                           <option value="buzzer">Zumbador Industrial</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Orden Completada</label>
                          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => playSound(soundCompleteConfig as any)} title="Probar sonido"><Bell size={14} color="var(--accent)" /></button>
                        </div>
                        <select className="form-input" style={{ fontSize: '0.85rem' }} value={soundCompleteConfig} onChange={e => { setSoundCompleteConfig(e.target.value); playSound(e.target.value as any); }}>
                           <option value="complete">Campanada de Éxito</option>
                           <option value="digital">Timbre Digital</option>
                           <option value="ping">Ping Suave</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Artículo Listo (Individual)</label>
                          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => playSound(soundItemReadyConfig as any)} title="Probar sonido"><Bell size={14} color="var(--accent)" /></button>
                        </div>
                        <select className="form-input" style={{ fontSize: '0.85rem' }} value={soundItemReadyConfig} onChange={e => { setSoundItemReadyConfig(e.target.value); playSound(e.target.value as any); }}>
                           <option value="item_ready">Pop Corto</option>
                           <option value="pop">Burbuja</option>
                           <option value="ping">Ping Suave</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn--ghost" onClick={() => setShowSettingsModal(false)}>Cancelar</button>
                  <button className="btn btn--primary" onClick={handleSaveSettings} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Save size={15} /> Confirmar Cambios
                  </button>
                </div>
              </>
            ) : settingsTab === 'users' ? (
              <UserManager currentUser={currentUser} />
            ) : (
              <StationManager />
            )}
          </div>
        </div>
      )}

      {/* CROPPER / SCALER MODAL */}
      {rawLogo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000, 
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)', width: '100%', maxWidth: '360px', 
            borderRadius: '16px', border: '1px solid var(--border-bright)', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Crop size={16} /> Ajustar Imagen
              </h3>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              
              <div style={{ 
                width: '120px', height: '120px', background: 'var(--bg-secondary)', 
                borderRadius: '12px', overflow: 'hidden', border: '1px dashed var(--border-bright)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
              }}>
                <canvas ref={canvasRef} width={120} height={120} />
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'stretch' }}>
                  <button className={`btn btn--sm ${logoFit === 'contain' ? 'btn--primary' : 'btn--ghost'}`} style={{ flex: 1 }} onClick={() => setLogoFit('contain')}>Adaptar</button>
                  <button className={`btn btn--sm ${logoFit === 'cover' ? 'btn--primary' : 'btn--ghost'}`} style={{ flex: 1 }} onClick={() => setLogoFit('cover')}>Llenar</button>
                  <button className={`btn btn--sm ${logoFit === 'fill' ? 'btn--primary' : 'btn--ghost'}`} style={{ flex: 1 }} onClick={() => setLogoFit('fill')}>Estirar</button>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ZoomIn size={14} /> Zoom</span>
                    <span>{Math.round(logoZoom * 100)}%</span>
                  </label>
                  <input 
                    type="range" min="0.1" max="3" step="0.1" 
                    value={logoZoom} 
                    onChange={e => setLogoZoom(parseFloat(e.target.value))} 
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setRawLogo(null)}>Cancelar</button>
              <button className="btn btn--success" style={{ flex: 1 }} onClick={confirmLogoCrop}>Guardar Corte</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
