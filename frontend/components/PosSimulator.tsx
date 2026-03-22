'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Minus, X, Send, Zap, Check, Flame, Snowflake, UtensilsCrossed, ShoppingBag, ChevronRight, Search, DollarSign, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/utils';

// Menu fetched from backend

interface MenuItem {
  id: number;
  name: string;
  category: string;
  modifiers: string[];
  price?: number;
}

const DRINK_SIZES = ['Chico', 'Mediano', 'Grande'];

// ── Definición de mesas y mostradores ─────────────────────────────────────
const TABLES = [
  { id: 'Mesa 1',       type: 'dine-in', icon: '1' },
  { id: 'Mesa 2',       type: 'dine-in', icon: '2' },
  { id: 'Mesa 3',       type: 'dine-in', icon: '3' },
  { id: 'Mesa 4',       type: 'dine-in', icon: '4' },
  { id: 'Mesa 5',       type: 'dine-in', icon: '5' },
  { id: 'Mesa 6',       type: 'dine-in', icon: '6' },
  { id: 'Mesa 7',       type: 'dine-in', icon: '7' },
  { id: 'Mesa 8',       type: 'dine-in', icon: '8' },
  { id: 'Para Llevar 1', type: 'takeout', icon: '🛍️' },
  { id: 'Para Llevar 2', type: 'takeout', icon: '🛍️' },
];

type Category = 'food' | 'bar_hot' | 'bar_cold';

interface OrderItem {
  name: string;
  quantity: number;
  station: string;
  modifiers: string[];
  price: number;
}

// State per table slot
interface TableOrder {
  items: OrderItem[];
  notes: string;
  priority: number;
}

const emptyOrder = (): TableOrder => ({ items: [], notes: '', priority: 0 });

// ── Component ─────────────────────────────────────────────────────────────
export default function PosSimulator({ accounts = [] }: { accounts?: any[] }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  useEffect(() => {
    api.get('/api/menu').then(setMenuItems);
  }, []);

  const foodItems = menuItems.filter(i => i.category === 'food');
  const hotDrinks = menuItems.filter(i => i.category === 'bar_hot');
  const coldDrinks = menuItems.filter(i => i.category === 'bar_cold');

  // Which table is currently selected (null = none)
  const [activeTable, setActiveTable] = useState<string | null>(null);

  // Per-table order state; key = table id
  const [tableOrders, setTableOrders] = useState<Record<string, TableOrder>>({});

  // Category panel
  const categoriesList = useMemo(() => {
    const raw = Array.from(new Set(menuItems.map(i => i.category)));
    return ['todos', ...(raw.length > 0 ? raw : ['food', 'bar_hot', 'bar_cold'])];
  }, [menuItems]);

  const getCategoryInfo = (cat: string) => {
    if (cat === 'todos') return { label: 'Todos', Icon: LayoutGrid, colorVar: 'var(--green)' };
    if (cat === 'food') return { label: 'Comida', Icon: UtensilsCrossed, colorVar: 'var(--yellow)' };
    if (cat === 'bar_hot') return { label: 'Caliente', Icon: Flame, colorVar: 'var(--red)' };
    if (cat === 'bar_cold') return { label: 'Frío', Icon: Snowflake, colorVar: 'var(--accent)' };
    return { label: cat.charAt(0).toUpperCase() + cat.slice(1), Icon: ShoppingBag, colorVar: 'var(--text-primary)' };
  };

  const [category, setCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Item builder (generalized for food & drinks)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSize,  setSelectedSize]  = useState('Mediano');
  const [selectedMods,  setSelectedMods]  = useState<string[]>([]);

  // Sending state and last-order feedback
  const [loading,   setLoading]   = useState(false);
  const [lastOrder, setLastOrder] = useState<{ table: string; num: string } | null>(null);

  // Table cumulative bill (Now derived from props)
  const tableBills      = useMemo(() => Object.fromEntries(accounts.map(a => [a.table_id, a.total])), [accounts]);
  const tableSentItems  = useMemo(() => Object.fromEntries(accounts.map(a => [a.table_id, a.items])), [accounts]);
  
  const [showBillModalFor, setShowBillModalFor] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'total' | 'parts' | 'items'>('total');
  const [splitParts, setSplitParts] = useState(2);
  const [selectedItemsCount, setSelectedItemsCount] = useState<Record<number, number>>({});

  const totalBill = showBillModalFor ? (tableBills[showBillModalFor] || 0) : 0;
  let paymentAmount = totalBill;
  if (splitMode === 'parts') paymentAmount = totalBill / splitParts;
  if (splitMode === 'items' && showBillModalFor) {
    let sum = 0;
    const items = tableSentItems[showBillModalFor] || [];
    items.forEach((item: any, idx: number) => sum += (selectedItemsCount[idx] || 0) * (item.price || 0));
    paymentAmount = sum;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getOrder = useCallback(
    (tableId: string): TableOrder => tableOrders[tableId] ?? emptyOrder(),
    [tableOrders]
  );

  const setOrder = (tableId: string, fn: (prev: TableOrder) => TableOrder) => {
    setTableOrders(prev => ({
      ...prev,
      [tableId]: fn(prev[tableId] ?? emptyOrder()),
    }));
  };

  const currentMenu = useMemo(() => {
    if (category === 'todos') return menuItems;
    return menuItems.filter(item => item.category === category);
  }, [menuItems, category]);

  const filteredMenu = currentMenu.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stationColor = (st: string) =>
    st === 'food' ? '#f59e0b' : st === 'bar_hot' ? '#ef4444' : '#06b6d4';

  const stationLabel = (st: string) =>
    st === 'food' ? 'Comida' : st === 'bar_hot' ? 'Caliente' : 'Frío';

  const stationIcon = (st: string) =>
    st === 'food' ? <UtensilsCrossed size={11} />
    : st === 'bar_hot' ? <Flame size={11} />
    : <Snowflake size={11} />;

  const tableHasItems = (id: string) => (tableOrders[id]?.items?.length ?? 0) > 0;
  const tableTotalItems = (id: string) => (tableOrders[id]?.items ?? []).reduce((s, i) => s + i.quantity, 0);
  const tableIsUrgent = (id: string) => (tableOrders[id]?.priority ?? 0) === 1;

  // ── Item operations ───────────────────────────────────────────────────────

  const addItemDirectly = (item: MenuItem) => {
    if (!activeTable) return;
    setOrder(activeTable, prev => {
      const exists = prev.items.find(i => i.name === item.name && i.station === 'food' && i.modifiers.length === 0);
      if (exists) return {
        ...prev,
        items: prev.items.map(i =>
          i.name === item.name && i.station === 'food' && i.modifiers.length === 0 ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
      return { ...prev, items: [...prev.items, { name: item.name, quantity: 1, station: 'food', modifiers: [], price: item.price || 0 }] };
    });
  };

  const openItemBuilder = (item: MenuItem) => {
    if (!activeTable) return;
    setSelectedItem(item);
    setSelectedMods([]);
    setSelectedSize('Mediano');
  };

  const handleItemClick = (item: MenuItem) => {
    // Si es comida y no tiene modificadores, agregar directo
    if (category === 'food' && (!item.modifiers || item.modifiers.length === 0)) {
      addItemDirectly(item);
    } else {
      openItemBuilder(item);
    }
  };

  const confirmItem = () => {
    if (!selectedItem || !activeTable) return;
    
    // Si es bebida, agregar el tamaño como modificador principal
    const isDrink = ['bar_hot', 'bar_cold'].includes(category);
    const rawMods = isDrink ? [selectedSize, ...selectedMods].filter(Boolean) : [...selectedMods];
    
    // Limpiar artefactos del UI para combos
    const finalMods = rawMods.map(m => m.replace(/^COMBO_[^:]+:\s*/, ''));

    const station = category;

    setOrder(activeTable, prev => {
      const key = `${selectedItem.name}|${finalMods.join(',')}|${station}`;
      const exists = prev.items.find(i => `${i.name}|${i.modifiers.join(',')}|${i.station}` === key);
      if (exists) return {
        ...prev,
        items: prev.items.map(i =>
          `${i.name}|${i.modifiers.join(',')}|${i.station}` === key
            ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
      return { ...prev, items: [...prev.items, { name: selectedItem.name, quantity: 1, station, modifiers: finalMods, price: selectedItem.price || 0 }] };
    });
    setSelectedItem(null);
  };

  const toggleMod = (mod: string) => {
    setSelectedMods(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const removeItem = (tableId: string, idx: number) => {
    setOrder(tableId, prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateQuantity = (tableId: string | null, idx: number, delta: number) => {
    if (!tableId) return;
    setOrder(tableId, prev => {
      const nextItems = [...prev.items];
      nextItems[idx].quantity += delta;
      if (nextItems[idx].quantity <= 0) {
        nextItems.splice(idx, 1);
      }
      return { ...prev, items: nextItems };
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!activeTable) return;
    const order = getOrder(activeTable);
    if (order.items.length === 0) return;

    const tableInfo = TABLES.find(t => t.id === activeTable)!;
    setLoading(true);
    try {
      const orderNum = `#${Math.floor(1000 + Math.random() * 9000)}`;
      const ticket = await api.post('/api/tickets', {
        order_number: orderNum,
        table_number: activeTable,
        order_type:   tableInfo.type,
        priority:     order.priority,
        notes:        order.notes || null,
        items:        order.items,
      });

      setLastOrder({ table: activeTable, num: ticket.order_number });
      
      // Clear this table's order
      setTableOrders(prev => {
        const next = { ...prev };
        delete next[activeTable];
        return next;
      });
    } catch (err) {
      console.error(err);
      alert('Error al enviar la comanda');
    } finally {
      setLoading(false);
    }
  };

  const activeOrder = activeTable ? getOrder(activeTable) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="simulator-panel">

      {/* ── TABLE GRID ─────────────────────────────────────────────── */}
      <div className="section-label" style={{ marginBottom: '0.5rem' }}>Seleccionar Mesa</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
        {TABLES.map(table => {
          const isActive  = activeTable === table.id;
          const hasItems  = tableHasItems(table.id);
          const isUrgent  = tableIsUrgent(table.id);
          const count     = tableTotalItems(table.id);
          const isTakeout = table.type === 'takeout';

          return (
            <button
              key={table.id}
              onClick={() => setActiveTable(isActive ? null : table.id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: isTakeout ? '52px' : '62px',
                borderRadius: '10px',
                border: `1.5px solid ${
                  isActive  ? (isTakeout ? '#a78bfa' : '#6366f1') :
                  hasItems  ? (isTakeout ? 'rgba(167,139,250,0.4)' : 'rgba(99,102,241,0.4)') :
                  'var(--border)'
                }`,
                background: isActive
                  ? (isTakeout ? 'rgba(167,139,250,0.2)' : 'rgba(99,102,241,0.2)')
                  : hasItems
                    ? (isTakeout ? 'rgba(167,139,250,0.08)' : 'rgba(99,102,241,0.08)')
                    : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive
                  ? `0 0 12px ${isTakeout ? 'rgba(167,139,250,0.3)' : 'rgba(99,102,241,0.3)'}`
                  : 'none',
                gridColumn: isTakeout ? 'span 2' : 'span 1',
              }}
            >
              {/* Item count badge */}
              {hasItems && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-5px',
                  background: isUrgent ? 'var(--yellow)' : (isTakeout ? '#a78bfa' : 'var(--accent)'),
                  color: isUrgent ? '#000' : 'white',
                  borderRadius: '999px',
                  fontSize: '0.6rem', fontWeight: 800,
                  minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}>
                  {count}
                </span>
              )}

              {/* Urgent dot */}
              {isUrgent && (
                <span style={{
                  position: 'absolute', top: '-5px', left: '-5px',
                  width: '8px', height: '8px',
                  background: 'var(--yellow)',
                  borderRadius: '50%',
                  boxShadow: '0 0 6px var(--yellow)',
                }} />
              )}

              {isTakeout ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShoppingBag size={14} style={{ color: isActive ? '#a78bfa' : 'var(--text-muted)' }} />
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    color: isActive ? '#c4b5fd' : hasItems ? '#a78bfa' : 'var(--text-muted)',
                  }}>
                    {table.id}
                  </span>
                </div>
              ) : (
                <>
                  <span style={{
                    fontSize: '1.2rem', fontWeight: 900,
                    color: isActive ? '#c7d2fe' : hasItems ? '#a5b4fc' : 'var(--text-secondary)',
                    lineHeight: 1,
                    marginBottom: '0.2rem'
                  }}>
                    {table.icon}
                  </span>
                  {(tableBills[table.id] || 0) > 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--green, #22c55e)', fontWeight: 600, marginTop: '2px' }}>
                      ${tableBills[table.id].toFixed(2)}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 600,
                    color: isActive ? '#a5b4fc' : 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    marginTop: '0.15rem',
                  }}>
                    Mesa
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* ── NO TABLE SELECTED ──────────────────────────────────────── */}
      {!activeTable && (
        <div style={{
          textAlign: 'center', padding: '1rem 0.5rem',
          color: 'var(--text-muted)', fontSize: '0.78rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
        }}>
          <ChevronRight size={18} style={{ opacity: 0.4 }} />
          Toca una mesa o mostrador para agregar productos
        </div>
      )}

      {/* ── ORDER PANEL (when table is selected) ──────────────────── */}
      {activeTable && activeOrder && (
        <>
          <div className="divider" />

          {/* Table header + notes + urgent */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, minWidth: 0 }}>
              <div style={{
                background: 'var(--accent)', color: 'white', width: '22px', height: '22px',
                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0
              }}>
                {TABLES.find(t => t.id === activeTable)?.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, minWidth: 0 }}>
                {(() => {
                  const lastSpace = activeTable.lastIndexOf(' ');
                  if (lastSpace === -1) return <span>{activeTable}</span>;
                  return (
                    <>
                      <span style={{ fontSize: '0.8rem' }}>{activeTable.substring(0, lastSpace)}</span>
                      <span style={{ fontSize: '1.05rem', marginTop: '-0.1rem' }}>{activeTable.substring(lastSpace + 1)}</span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Cobrar btn si hay cuenta abierta */}
            {(tableBills[activeTable] || 0) > 0 && (
              <button 
                className="btn btn--sm btn--success" 
                onClick={() => setShowBillModalFor(activeTable!)} 
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}
              >
                Cobrar ${(tableBills[activeTable] || 0).toFixed(2)}
              </button>
            )}
            
            <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setActiveTable(null)}>
              <X size={16} />
            </button>
          </div>

          {/* Notes field */}
          <div className="form-group" style={{ marginTop: '0.25rem' }}>
            <input
              className="form-input"
              type="text"
              placeholder="Notas / alergias..."
              value={activeOrder.notes}
              onChange={e => setOrder(activeTable, prev => ({ ...prev, notes: e.target.value }))}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            />
          </div>

          {/* Category tabs */}
          <div className="no-scrollbar" style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {categoriesList.map(cat => {
              const info = getCategoryInfo(cat);
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setSelectedItem(null); setSearchTerm(''); }}
                  className={`btn btn--sm ${isSelected ? '' : 'btn--ghost'}`}
                  style={{
                    flexDirection: 'column', gap: '0.15rem', height: '46px', flex: '0 0 auto', minWidth: '70px',
                    background:  isSelected ? `color-mix(in srgb, ${info.colorVar} 15%, transparent)` : undefined,
                    borderColor: isSelected ? info.colorVar : undefined,
                    color:       isSelected ? info.colorVar : 'var(--text-muted)',
                    fontSize: '0.68rem',
                  }}
                >
                  <info.Icon size={13} />
                  {info.label}
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          {!selectedItem && (
            <div className="form-group" style={{ position: 'relative', marginTop: '0.25rem' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" className="form-input" 
                placeholder="Buscar (Ej: Chilaquiles)..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.1rem', fontSize: '0.75rem', height: '32px' }}
              />
            </div>
          )}

          {/* Item builder */}
          {selectedItem && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-bright)',
              borderRadius: '10px',
              padding: '0.75rem',
              display: 'flex', flexDirection: 'column', gap: '0.55rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {category === 'food' ? <UtensilsCrossed size={13} color="#f59e0b" />
                   : category === 'bar_hot' ? <Flame size={13} color="#ef4444" /> : <Snowflake size={13} color="#06b6d4" />}
                  {selectedItem.name}
                </span>
                <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setSelectedItem(null)}>
                  <X size={12} />
                </button>
              </div>

              {(() => {
                const normalMods = selectedItem.modifiers.filter(m => !m.startsWith('COMBO_'));
                const comboMods = selectedItem.modifiers.filter(m => m.startsWith('COMBO_'));
                
                const comboGroups: Record<string, string[]> = {};
                comboMods.forEach(mod => {
                  const arr = mod.split(':');
                  const groupLabel = arr[0].replace('COMBO_', '');
                  const opt = arr.slice(1).join(':');
                  if (!comboGroups[groupLabel]) comboGroups[groupLabel] = [];
                  comboGroups[groupLabel].push(opt);
                });

                const isComboValid = Object.keys(comboGroups).every(groupLabel => 
                   selectedMods.some(m => m.startsWith(`COMBO_${groupLabel}:`))
                );

                return (
                  <>
                    {['bar_hot', 'bar_cold'].includes(selectedItem.category) && (
                      <div>
                        <div className="form-label" style={{ marginBottom: '0.3rem' }}>Tamaño</div>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          {DRINK_SIZES.map(s => (
                            <button key={s}
                              onClick={() => setSelectedSize(s)}
                              className={`btn btn--sm ${selectedSize === s ? 'btn--primary' : 'btn--ghost'}`}
                              style={{ flex: 1, fontSize: '0.7rem' }}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {Object.keys(comboGroups).sort().map(groupLabel => (
                      <div key={groupLabel} style={{ marginBottom: '0.2rem' }}>
                        <div className="form-label" style={{ marginBottom: '0.3rem', fontSize: '0.73rem', fontWeight: 700 }}>
                          {groupLabel.replace(/^\d+\.\s*/, '')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {comboGroups[groupLabel].map(option => {
                            const modKey = `COMBO_${groupLabel}:${option}`;
                            const isSelected = selectedMods.includes(modKey);
                            return (
                              <button key={option} onClick={() => {
                                 setSelectedMods(prev => {
                                    const withoutGroup = prev.filter(m => !m.startsWith(`COMBO_${groupLabel}:`));
                                    return [...withoutGroup, modKey];
                                 });
                              }}
                                className={`btn btn--sm ${isSelected ? 'btn--success' : 'btn--ghost'}`}
                                style={{ fontSize: '0.68rem', flex: 1, minWidth: '45%', whiteSpace: 'normal', height: 'auto', padding: '0.45rem', lineHeight: '1.3' }}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />} {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {normalMods.length > 0 && (
                      <div>
                        <div className="form-label" style={{ marginBottom: '0.3rem' }}>Personalizar</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {normalMods.map(mod => (
                            <button key={mod} onClick={() => toggleMod(mod)}
                              className={`btn btn--sm ${selectedMods.includes(mod) ? 'btn--success' : 'btn--ghost'}`}
                              style={{ fontSize: '0.68rem', flex: '1 1 45%', whiteSpace: 'normal', height: 'auto', padding: '0.45rem', lineHeight: '1.3' }}
                            >
                              {selectedMods.includes(mod) && <Check size={9} strokeWidth={3} />}{mod}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button className="btn btn--primary btn--full" onClick={confirmItem}
                      disabled={!isComboValid}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                      <Plus size={13} /> Agregar a la orden
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          {/* Item grid */}
          {!selectedItem && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.3rem', maxHeight: '45vh', overflowY: 'auto', paddingRight: '0.3rem' }}>
              {filteredMenu.map(item => {
                const qtyAdded = activeOrder.items.reduce((sum, i) => i.name === item.name ? sum + i.quantity : sum, 0);
                return (
                  <button
                    key={item.name}
                    className="btn btn--ghost btn--sm menu-item-btn"
                    style={{ 
                      justifyContent: 'flex-start', fontSize: '0.75rem', textAlign: 'left', 
                      gap: '0.4rem', padding: '0.45rem 0.6rem',
                      background: 'var(--bg-secondary)'
                    }}
                    onClick={() => handleItemClick(item)}
                  >
                    {category === 'food'
                      ? <UtensilsCrossed size={11} style={{ opacity: 0.4, flexShrink: 0 }} />
                      : category === 'bar_hot'
                        ? <Flame size={11} style={{ color: '#ef4444', opacity: 0.8, flexShrink: 0 }} />
                        : <Snowflake size={11} style={{ color: '#06b6d4', opacity: 0.8, flexShrink: 0 }} />
                    }
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    {qtyAdded > 0 && (
                      <span style={{
                        background: 'var(--green)', color: 'white',
                        borderRadius: '99px', padding: '0.1rem 0.35rem',
                        fontSize: '0.65rem', fontWeight: 800,
                        marginLeft: 'auto'
                      }}>
                        {qtyAdded}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Order summary */}
          {activeOrder.items.length > 0 && (
            <>
              <div className="divider" />
              <span className="section-label">Orden ({activeOrder.items.length} artículo{activeOrder.items.length !== 1 ? 's' : ''})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.35rem 0.6rem',
                    background: 'var(--bg-card)',
                    borderRadius: '7px',
                    border: `1px solid ${stationColor(item.station)}44`,
                    borderLeft: `3px solid ${stationColor(item.station)}`,
                  }}>
                    <span style={{ fontWeight: 800, color: stationColor(item.station), minWidth: '1.2rem', fontSize: '0.78rem' }}>
                      ×{item.quantity}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.name}</div>
                      {item.modifiers.length > 0 && (
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
                          {item.modifiers.join(' · ')}
                        </div>
                      )}
                    </div>
                    <span style={{ display: 'flex', gap: '0.2rem', color: stationColor(item.station), opacity: 0.7, marginRight: '0.2rem' }}>
                      {stationIcon(item.station)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                      <button 
                        className="btn btn--secondary btn--sm btn--icon" 
                        style={{ padding: '0.15rem', width: '20px', height: '20px' }}
                        onClick={() => updateQuantity(activeTable, idx, -1)}
                      >
                        <Minus size={11} />
                      </button>
                      <button 
                        className="btn btn--secondary btn--sm btn--icon" 
                        style={{ padding: '0.15rem', width: '20px', height: '20px' }}
                        onClick={() => updateQuantity(activeTable, idx, 1)}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <button
                      className="btn btn--danger btn--sm btn--icon"
                      style={{ padding: '0.15rem 0.25rem', flexShrink: 0, marginLeft: '0.2rem' }}
                      onClick={() => removeItem(activeTable!, idx)}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Success */}
          {lastOrder && lastOrder.table === activeTable && (
            <div style={{
              padding: '0.45rem 0.75rem',
              background: 'var(--green-bg)', borderRadius: '8px', border: '1px solid var(--green-border)',
              fontSize: '0.75rem', color: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}>
              <Check size={12} strokeWidth={3} /> Comanda {lastOrder.num} enviada
            </div>
          )}

          {/* Submit */}
          <button
            className="btn btn--primary btn--full"
            onClick={submit}
            disabled={loading || activeOrder.items.length === 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Send size={13} />
            {loading
              ? 'Enviando...'
              : `Confirmar — ${activeTable}${activeOrder.items.length > 0 ? ` (${activeOrder.items.length})` : ''}`
            }
          </button>

          {/* Cobrar button */}
          {activeTable && tableBills[activeTable] > 0 && (
            <button
              className="btn btn--secondary btn--full"
              onClick={() => setShowBillModalFor(activeTable)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              <DollarSign size={13} />
              Cobrar — ${tableBills[activeTable].toFixed(2)}
            </button>
          )}
        </>
      )}

      {/* ── COBRAR MODAL ────────────────────────────────────────────── */}
      {showBillModalFor && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)', width: '100%', maxWidth: '380px', 
            borderRadius: '16px', border: '1px solid var(--border-bright)', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Cuenta: {showBillModalFor}</h3>
              <button 
                className="btn btn--ghost btn--icon btn--sm" 
                onClick={() => setShowBillModalFor(null)}
                style={{ position: 'absolute', right: '1rem', top: '1.15rem' }}
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Itemized list */}
            <div style={{ padding: '1.25rem', maxHeight: '50vh', overflowY: 'auto' }}>
              {tableSentItems[showBillModalFor]?.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay productos en la cuenta.</div>
              )}
              {(tableSentItems[showBillModalFor] as OrderItem[])?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {item.modifiers.join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 600 }}>${((item.price||0) * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* Total and Actions */}
            <div style={{ padding: '0', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {/* Split controls */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: splitMode === 'total' ? 0 : '1rem' }}>
                  <button className={`btn btn--sm ${splitMode === 'total' ? 'btn--primary' : 'btn--ghost'}`} style={{flex:1}} onClick={() => setSplitMode('total')}>Total</button>
                  <button className={`btn btn--sm ${splitMode === 'parts' ? 'btn--primary' : 'btn--ghost'}`} style={{flex:1}} onClick={() => setSplitMode('parts')}>Dividir</button>
                  <button className={`btn btn--sm ${splitMode === 'items' ? 'btn--primary' : 'btn--ghost'}`} style={{flex:1}} onClick={() => setSplitMode('items')}>Consumo</button>
                </div>

                {splitMode === 'parts' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                     <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Número de personas:</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <button className="btn btn--secondary btn--sm btn--icon" onClick={() => setSplitParts(Math.max(2, splitParts - 1))}><Minus size={14}/></button>
                       <span style={{ fontWeight: 800, minWidth: '2rem', textAlign: 'center' }}>{splitParts}</span>
                       <button className="btn btn--secondary btn--sm btn--icon" onClick={() => setSplitParts(splitParts + 1)}><Plus size={14}/></button>
                     </div>
                  </div>
                )}

                {splitMode === 'items' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '40vh', overflowY: 'auto' }}>
                     {(tableSentItems[showBillModalFor!] as OrderItem[])?.map((item, idx) => {
                        const sel = selectedItemsCount[idx] || 0;
                        const max = item.quantity;
                        if (max <= 0) return null;
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                             <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                               <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>${(item.price||0).toFixed(2)} c/u</div>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '99px', padding: '0.15rem', border: '1px solid var(--border)' }}>
                               <button 
                                 className="btn btn--ghost btn--sm btn--icon" 
                                 style={{ padding: '0.15rem', width: '24px', height: '24px', borderRadius: '50%' }}
                                 onClick={() => setSelectedItemsCount(p => ({ ...p, [idx]: Math.max(0, sel - 1) }))}
                               >
                                 <Minus size={12}/>
                               </button>
                               <span style={{ fontWeight: 800, minWidth: '1.2rem', textAlign: 'center', fontSize: '0.8rem' }}>{sel}</span>
                               <button 
                                 className="btn btn--ghost btn--sm btn--icon" 
                                 style={{ padding: '0.15rem', width: '24px', height: '24px', borderRadius: '50%' }}
                                 disabled={sel >= max}
                                 onClick={() => setSelectedItemsCount(p => ({ ...p, [idx]: Math.min(max, sel + 1) }))}
                               >
                                 <Plus size={12}/>
                               </button>
                             </div>
                          </div>
                        );
                     })}
                  </div>
                )}
              </div>

              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.5rem' }}>
                  <span>{splitMode === 'total' ? 'Total' : 'Pago Parcial'}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--green, #22c55e)' }}>${Math.min(totalBill, Math.max(0, paymentAmount)).toFixed(2)}</div>
                    {splitMode !== 'total' && paymentAmount < totalBill && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Restante: ${(totalBill - paymentAmount).toFixed(2)}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className="btn btn--ghost" 
                    style={{ flex: 1, fontWeight: 600 }} 
                    onClick={() => {
                      setShowBillModalFor(null);
                      setSplitMode('total');
                      setSelectedItemsCount({});
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn btn--success" 
                    style={{ flex: 1, fontWeight: 600 }} 
                    disabled={paymentAmount <= 0.01 || paymentAmount > totalBill}
                    onClick={async () => {
                       if (!showBillModalFor) return;
                       try {
                         await api.post(`/api/accounts/${showBillModalFor}/pay`, { 
                           amount: paymentAmount,
                           paidItemsIndices: splitMode === 'items' ? selectedItemsCount : undefined
                         });
                         if (paymentAmount >= totalBill - 0.01) {
                           setShowBillModalFor(null);
                           if (activeTable === showBillModalFor) setActiveTable(null);
                         } else {
                           setSplitMode('total');
                           setSelectedItemsCount({});
                         }
                       } catch (err) {
                         console.error(err);
                         alert('Error al cobrar la cuenta');
                       }
                    }}
                  >
                    Cobrar ${(Math.min(totalBill, Math.max(0, paymentAmount))).toFixed(2)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
