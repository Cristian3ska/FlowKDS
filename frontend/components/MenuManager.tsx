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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal / Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('food');
  const [price, setPrice] = useState(0);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [modInput, setModInput] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/menu');
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(0);
    setName('');
    setCategory('food');
    setPrice(0);
    setModifiers([]);
    setModInput('');
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price || 0);
    setModifiers(item.modifiers);
    setModInput('');
  };

  const closeForm = () => {
    setEditingId(null);
  };

  const addModifier = () => {
    const val = modInput.trim();
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

  const stationIcon = (st: string) =>
    st === 'food' ? <UtensilsCrossed size={16} />
    : st === 'bar_hot' ? <Flame size={16} />
    : <Snowflake size={16} />;

  // Group items by category and filter by search term
  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const foodItems = filteredItems.filter(i => i.category === 'food');
  const hotDrinks = filteredItems.filter(i => i.category === 'bar_hot');
  const coldDrinks = filteredItems.filter(i => i.category === 'bar_cold');

  const renderTable = (list: MenuItem[], title: string, stId: string) => (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: STATION_COLORS[stId], marginBottom: '1rem' }}>
        {stationIcon(stId)} {title} ({list.length})
      </h3>
      {list.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
          No hay elementos en esta categoría.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {list.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem', background: 'var(--bg-secondary)',
              border: `1px solid ${STATION_COLORS[stId]}40`,
              borderRadius: '12px',
              borderLeft: `4px solid ${STATION_COLORS[stId]}`
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

      <div className="form-group" style={{ marginBottom: '2rem', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" className="form-input" 
          placeholder="Buscar platillo o bebida..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ paddingLeft: '2.8rem' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando menú...</div>
      ) : (
        <>
          {renderTable(foodItems, 'Comida', 'food')}
          {renderTable(hotDrinks, 'Bebidas Calientes', 'bar_hot')}
          {renderTable(coldDrinks, 'Bebidas Frías', 'bar_cold')}
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
                  <option value="food">Comida 🍴</option>
                  <option value="bar_hot">Bebida Caliente 🔥</option>
                  <option value="bar_cold">Bebida Fría ❄️</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Precio ($)</label>
                <input type="number" step="0.5" className="form-input" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Modificadores (Opcional)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="text" className="form-input" 
                  value={modInput} 
                  onChange={e => setModInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addModifier()}
                  placeholder="Ej: Sin cebolla, Extra queso..." 
                />
                <button className="btn btn--secondary" onClick={addModifier}>Agregar</button>
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
