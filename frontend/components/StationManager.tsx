import React, { useState, useEffect } from 'react';
import { api } from '@/lib/utils';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { Station } from '@/types';

export default function StationManager() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Station>>({});
  
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Station>>({ id: '', name: '', label: '', color: '#6366f1', time_alert_yellow: 300, time_alert_red: 600 });

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations');
      setStations(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar áreas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.id || !addForm.name) return setError('El ID y nombre son requeridos');
    
    try {
      await api.post('/api/stations', { ...addForm, label: addForm.label || addForm.name });
      setShowAdd(false);
      setAddForm({ id: '', name: '', label: '', color: '#6366f1', time_alert_yellow: 300, time_alert_red: 600 });
      fetchStations();
    } catch (err: any) {
      setError(err.message || 'Error al crear área. Asegúrate de que el identificador no exista ya.');
    }
  };

  const startEdit = (st: Station) => {
    setEditingId(st.id);
    setEditForm({ ...st });
  };

  const handleUpdate = async () => {
    try {
      if (!editingId) return;
      await api.put(`/api/stations/${editingId}`, editForm);
      setEditingId(null);
      fetchStations();
    } catch (err: any) {
      setError(err.message || 'Error al editar área');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'all') return alert('No puedes eliminar el área "all" predeterminada.');
    if (!confirm('¿Seguro que deseas eliminar esta área del restaurante? Esto afectará todos los tickets asociados a ella.')) return;
    try {
      await api.delete(`/api/stations/${id}`);
      fetchStations();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar área');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando áreas...</div>;

  return (
    <div style={{ padding: '2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Gestión de Áreas / Estaciones</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Agrega secciones de tu restaurante (ej. Barra, Parrilla, Postres).</p>
        </div>
        <button className="btn btn--primary btn--sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X size={16} /> : <Plus size={16} />} 
          {showAdd ? 'Cancelar' : 'Añadir Área'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>{error}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Identificador (ID Código)</label>
              <input type="text" className="form-input" placeholder="ej: postres" value={addForm.id} onChange={e => setAddForm({...addForm, id: e.target.value})} required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Nombre Completo</label>
              <input type="text" className="form-input" placeholder="ej: Mesa de Postres" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Etiqueta Corta (Label)</label>
              <input type="text" className="form-input" placeholder="ej: Postres" value={addForm.label} onChange={e => setAddForm({...addForm, label: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Color (Hex)</label>
              <input type="color" className="form-input" style={{ padding: '0 0.5rem', cursor: 'pointer', height: '38px', background: 'var(--bg-main)' }} value={addForm.color} onChange={e => setAddForm({...addForm, color: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Alerta Amarilla (seg)</label>
              <input type="number" className="form-input" min="30" value={addForm.time_alert_yellow} onChange={e => setAddForm({...addForm, time_alert_yellow: parseInt(e.target.value, 10)})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Alerta Roja (seg)</label>
              <input type="number" className="form-input" min="60" value={addForm.time_alert_red} onChange={e => setAddForm({...addForm, time_alert_red: parseInt(e.target.value, 10)})} />
            </div>
          </div>
          <button type="submit" className="btn btn--success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={16} /> Guardar Nueva Área</button>
        </form>
      )}

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Identificador</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre / Etiqueta</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Color UI</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Límites de Alerta</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {stations.map(st => (
              <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {editingId === st.id ? (
                  <>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{st.id}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <input type="text" className="form-input" style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem', marginBottom: '0.4rem' }} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                      <input type="text" className="form-input" style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }} value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <input type="color" className="form-input" style={{ padding: '0 0.5rem', cursor: 'pointer', height: '36px', background: 'var(--bg-main)' }} value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" className="form-input" style={{ width: '60px', padding: '0.4rem', fontSize: '0.8rem' }} value={editForm.time_alert_yellow} onChange={e => setEditForm({...editForm, time_alert_yellow: parseInt(e.target.value, 10)})} title="Amarillo" />
                        <input type="number" className="form-input" style={{ width: '60px', padding: '0.4rem', fontSize: '0.8rem' }} value={editForm.time_alert_red} onChange={e => setEditForm({...editForm, time_alert_red: parseInt(e.target.value, 10)})} title="Rojo" />
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                         <button className="btn btn--success btn--icon btn--sm" onClick={handleUpdate} title="Guardar"><Save size={14} /></button>
                         <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditingId(null)} title="Cancelar"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}><code>{st.id}</code></td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
                       <div>{st.name}</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{st.label}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                       <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: st.color, border: '1px solid rgba(255,255,255,0.2)' }} title={st.color} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                       🟡 {st.time_alert_yellow}s<br />🔴 {st.time_alert_red}s
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className="btn btn--primary btn--icon btn--sm" onClick={() => startEdit(st)}><Edit2 size={14} /></button>
                        {st.id !== 'all' && (
                          <button className="btn btn--ghost btn--icon btn--sm" style={{ color: 'var(--red)' }} onClick={() => handleDelete(st.id)}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {stations.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay áreas registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
