import React, { useState, useEffect } from 'react';
import { api } from '@/lib/utils';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { User } from '@/types';

export default function UserManager({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'waiter' });

  const fetchUsers = async () => {
    try {
      const data = await api.get('/api/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/users', addForm);
      setShowAdd(false);
      setAddForm({ username: '', password: '', role: 'waiter' });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm({ username: user.username, role: user.role, password: '' }); 
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.put(`/api/users/${id}`, editForm);
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar usuario');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`¿Eliminar al usuario "${username}"?`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar usuario');
    }
  };

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Cargando usuarios...</div>;

  return (
    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Gestión de Usuarios</h2>
        <button className="btn btn--primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div style={{ maxWidth: '100%', width: '100%' }}>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Añadir Usuario</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Usuario</label>
                <input required type="text" className="form-input" value={addForm.username} onChange={e => setAddForm({...addForm, username: e.target.value})} placeholder="Ej: cajero1" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contraseña</label>
                <input required type="text" className="form-input" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} placeholder="Obligatoria" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Perfil</label>
                <select className="form-input" value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                  <option value="waiter">Mesero</option>
                  <option value="kitchen">Cocina</option>
                  <option value="barista">Barista</option>
                  <option value="admin">Administrador</option>
                  <option value="root">Root (Dueño)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Guardar</button>
            </div>
          </form>
        )}

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Usuario</th>
                <th style={{ padding: '1rem' }}>Perfil</th>
                <th style={{ padding: '1rem' }}>Contraseña</th>
                <th style={{ padding: '1rem', width: '100px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isAdmin = currentUser?.role === 'admin';
                const isRoot = currentUser?.role === 'root';
                const isTargetRoot = u.role === 'root';
                
                // Admin cannot edit or delete root
                const canEdit = isRoot || (isAdmin && !isTargetRoot);
                
                return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {editingId === u.id ? (
                    <>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <input type="text" className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <select className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value as any})}>
                          <option value="waiter">Mesero</option>
                          <option value="kitchen">Cocina</option>
                          <option value="barista">Barista</option>
                          <option value="admin">Administrador</option>
                          <option value="root">Root (Dueño)</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <input type="text" className="form-input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} placeholder="Dejar en blanco para no cambiar" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn--icon btn--ghost" style={{ color: '#ef4444' }} onClick={() => setEditingId(null)}><X size={16} /></button>
                          <button className="btn btn--icon btn--primary" onClick={() => handleUpdate(u.id)}><Save size={16} /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{u.username}</td>
                      <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{u.role}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>••••••••</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn--icon btn--ghost" onClick={() => startEdit(u)}><Edit2 size={16} /></button>
                            <button className="btn btn--icon btn--ghost" style={{ color: '#ef4444' }} onClick={() => handleDelete(u.id, u.username)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
