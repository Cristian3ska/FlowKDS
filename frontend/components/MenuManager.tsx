'use client';
import { useState, useEffect } from 'react';
import { api, STATION_COLORS, STATION_LABELS } from '@/lib/utils';
import { Plus, Edit2, Trash2, ArrowLeft, Save, X, UtensilsCrossed, Flame, Snowflake, Search } from 'lucide-react';

interface MenuItem {
  id: number;
  name: string;
  category: string;
  modifiers: string[];
  price?: number;
}

export default function MenuManager({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'food' | 'drink'>('all');
  const [selectedStationId, setSelectedStationId] = useState<string>('all');
  
  // Modal / Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('food');
  const [price, setPrice] = useState(0);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [modInput, setModInput] = useState('');
  const [isCombo, setIsCombo] = useState(false);
  const [groupName, setGroupName] = useState('');

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [menuData, statData] = await Promise.all([
        api.get('/api/menu'),
        api.get('/api/stations')
      ]);
      setItems(menuData);
      setStations(statData.filter((s: any) => s.id !== 'all'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    const data = await api.get('/api/menu');
    setItems(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedStationId('all');
  }, [filterType]);

  const openNew = () => {
    setEditingId(0);
    setName('');
    setCategory(stations[0]?.id || 'food');
    setPrice(0);
    setModifiers([]);
    setModInput('');
    setIsCombo(false);
    setGroupName('');
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price || 0);
    setModifiers(item.modifiers);
    setModInput('');
    setIsCombo(false);
    setGroupName('');
  };

  const closeForm = () => {
    setEditingId(null);
    setIsCombo(false);
    setGroupName('');
  };

  const addModifier = () => {
    let val = modInput.trim();
    if (isCombo && groupName.trim()) {
      val = `COMBO_${groupName.trim()}:${val}`;
    }
    if (val && !modifiers.includes(val)) {
      setModifiers([...modifiers, val]);
      setModInput('');
    }
  };

  const removeMod = (mod: string) => {
    setModifiers(modifiers.filter(m => m !== mod));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), category, modifiers, price };
      if (editingId === 0) {
        await api.post('/api/menu', payload);
      } else {
        await api.put(`/api/menu/${editingId}`, payload);
      }
      await fetchItems();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este platillo?')) return;
    await api.delete(`/api/menu/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  const stationIcon = (stId: string) => {
    const st = stations.find(s => s.id === stId);
    if (!st || st.type === 'food') return <UtensilsCrossed size={16} />;
    return <Snowflake size={16} />;
  };

  // Group items by category and filter by search term and type
  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Find station to check type
    const st = stations.find(s => s.id === i.category);
    const matchesType = filterType === 'all' || (st && st.type === filterType);
    
    const matchesStation = selectedStationId === 'all' || i.category === selectedStationId;
    
    return matchesSearch && matchesType && matchesStation;
  });

  const renderTable = (list: MenuItem[], station: any) => {
    const color = station.color || 'var(--primary)';
    return (
    <div key={station.id} style={{ marginBottom: '2rem' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: color, marginBottom: '1rem' }}>
        {stationIcon(station.id)} {station.label || station.name} ({list.length})
      </h3>
      {list.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
          No hay elementos en esta área.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {list.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem', background: 'var(--bg-secondary)',
              border: `1px solid ${color}40`,
              borderRadius: '12px',
              borderLeft: `4px solid ${color}`
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {item.name}
                  <span style={{ fontSize: '0.8rem', color: 'var(--green, #22c55e)' }}>${(item.price || 0).toFixed(2)}</span>
                </div>
                {item.modifiers.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    {item.modifiers.map(m => (
                      <span key={m} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn--icon btn--ghost" onClick={() => openEdit(item)}>
                  <Edit2 size={16} />
                </button>
                <button className="btn btn--icon btn--danger" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  };

  return (
    <div style={{ padding: '2rem', height: '100vh', overflowY: 'auto' }}>
      <button className="btn btn--ghost" onClick={onBack} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Gestión de Menú</h2>
        <button className="btn btn--primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> Nuevo Artículo
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" className="form-input" 
            placeholder="Buscar platillo o bebida..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.8rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.35rem', borderRadius: '10px', height: 'fit-content' }}>
          <button 
            onClick={() => setFilterType('all')}
            className={`btn btn--sm ${filterType === 'all' ? 'active' : 'btn--ghost'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            Todas
          </button>
          <button 
            onClick={() => setFilterType('food')}
            className={`btn btn--sm ${filterType === 'food' ? 'active' : 'btn--ghost'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', gap: '0.3rem' }}
          >
            <UtensilsCrossed size={12} /> Comida
          </button>
          <button 
            onClick={() => setFilterType('drink')}
            className={`btn btn--sm ${filterType === 'drink' ? 'active' : 'btn--ghost'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', gap: '0.3rem' }}
          >
            <Flame size={12} /> Bebidas
          </button>
        </div>
      </div>

      <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setSelectedStationId('all')}
          style={{
            padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
            background: selectedStationId === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: selectedStationId === 'all' ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          Categorías: Todas
        </button>
        {stations.filter(s => filterType === 'all' || s.type === filterType).map(st => (
          <button 
            key={st.id}
            onClick={() => setSelectedStationId(st.id)}
            style={{
              padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
              background: selectedStationId === st.id ? (st.color || 'var(--accent)') : 'var(--bg-secondary)',
              color: selectedStationId === st.id ? 'white' : 'var(--text-muted)',
              border: `1px solid ${selectedStationId === st.id ? (st.color || 'var(--accent)') : 'var(--border)'}`, 
              cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}
          >
            {st.label || st.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando menú...</div>
      ) : (
        <>
          {stations
            .filter(st => (filterType === 'all' || st.type === filterType) && (selectedStationId === 'all' || st.id === selectedStationId))
            .map(st => renderTable(filteredItems.filter(i => i.category === st.id), st))}
        </>
      )}

      {/* ── MODAL NUEVO/EDITAR ── */}
      {editingId !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)', width: '100%', maxWidth: '450px',
            borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-bright)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{editingId === 0 ? 'Nuevo Platillo' : 'Editar Platillo'}</h3>
              <button className="btn btn--icon btn--ghost" onClick={closeForm}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Nombre del Platillo / Bebida</label>
              <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Huevos Rancheros" />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Estación / Categoría</label>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {stations.map(st => (
                    <option key={st.id} value={st.id}>{st.label || st.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Precio ($)</label>
                <input type="number" step="0.5" className="form-input" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Modificadores / Opciones</label>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  Tip: Usa <b>COMBO_Grupo:Opción</b> para grupos obligatorios
                </div>
              </div>
              <div style={{ padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <input type="checkbox" id="isCombo" checked={isCombo} onChange={e => setIsCombo(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="isCombo" style={{ fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>¿Es una elección obligatoria? (Ej. Paquete o Paso)</label>
                </div>
                
                {isCombo && (
                  <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                    <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nombre del Grupo / Paso (Ej. "Tipo de Huevo", "Bebida")</label>
                    <input type="text" className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder='Ej. Paso 1: Huevo' />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" className="form-input" 
                    value={modInput} 
                    onChange={e => setModInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addModifier()}
                    placeholder={isCombo ? "Nombre de la opción (Ejem: Revueltos)" : "Ej: Sin cebolla, Extra queso..."} 
                  />
                  <button className="btn btn--secondary" onClick={addModifier}>Agregar</button>
                </div>
              </div>
              {modifiers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  {modifiers.map(m => (
                    <span key={m} style={{ 
                      fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.3rem' 
                    }}>
                      {m}
                      <X size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removeMod(m)} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={closeForm}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !name.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
