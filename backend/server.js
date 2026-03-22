const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Security modules
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

// Protect all HTTP Headers and hide express footprint
app.use(helmet());

// Basic Rate limitation: Protect against brute-force and DDoS
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 200,          // 200 requests per IP per minute
  message: { error: 'Se han procesado demasiadas peticiones, espera un momento' }
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: 30,           // 30 login attempts strictly
  message: { error: 'Demasiados intentos de acceso fallidos. Espera 1 minuto' }
});

app.use(globalLimiter);

app.use(cors());
app.use(express.json());

// ─── Helper functions ──────────────────────────────────────────────────────────

function getTickets(station = 'all') {
  let ticketRows;
  if (station === 'all') {
    ticketRows = db.prepare(`
      SELECT * FROM tickets
      WHERE status NOT IN ('completed')
      ORDER BY priority DESC, manual_order ASC, created_at ASC
    `).all();
  } else {
    ticketRows = db.prepare(`
      SELECT DISTINCT t.* FROM tickets t
      INNER JOIN ticket_items ti ON ti.ticket_id = t.id
      WHERE t.status NOT IN ('completed')
        AND (ti.station = ? OR ti.station = 'all')
      ORDER BY t.priority DESC, t.manual_order ASC, t.created_at ASC
    `).all(station);
  }

  return ticketRows.map(ticket => {
    const items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticket.id);
    return {
      ...ticket,
      items: items.map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
    };
  });
}

function getCompletedTickets(limit = 20) {
  const ticketRows = db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT ?
  `).all(limit);

  return ticketRows.map(ticket => {
    const items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticket.id);
    return {
      ...ticket,
      items: items.map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
    };
  });
}

function recordPrepTime(ticketId, station, prepTimeSeconds) {
  const now = Date.now();
  const date = new Date(now);
  const items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticketId);
  for (const item of items) {
    db.prepare(`
      INSERT INTO analytics_prep_times (ticket_id, item_name, station, prep_time_seconds, completed_at, day_of_week, hour_of_day)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ticketId, item.name, station || item.station, prepTimeSeconds, now, date.getDay(), date.getHours());
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET all active tickets (optionally filtered by station)
app.get('/api/tickets', (req, res) => {
  const { station } = req.query;
  res.json(getTickets(station || 'all'));
});

// GET completed/history tickets
app.get('/api/tickets/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(getCompletedTickets(limit));
});

// GET single ticket
app.get('/api/tickets/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticket.id);
  res.json({ ...ticket, items: items.map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') })) });
});

// GET all active table accounts
app.get('/api/accounts', (req, res) => {
  const accounts = db.prepare('SELECT * FROM table_accounts').all()
    .map(a => ({ ...a, items: JSON.parse(a.items || '[]') }));
  res.json(accounts);
});

// DELETE a table account (Payment / Close)
app.delete('/api/accounts/:tableId', (req, res) => {
  db.prepare('DELETE FROM table_accounts WHERE table_id = ?').run(req.params.tableId);
  const allAccounts = db.prepare('SELECT * FROM table_accounts').all()
    .map(a => ({ ...a, items: JSON.parse(a.items || '[]') }));
  io.emit('accounts:updated', allAccounts);
  res.status(204).send();
});

// POST pay partial or full amount
app.post('/api/accounts/:tableId/pay', (req, res) => {
  const { amount, paidItemsIndices } = req.body;
  const tableId = req.params.tableId;
  const existing = db.prepare('SELECT * FROM table_accounts WHERE table_id = ?').get(tableId);
  if (!existing) return res.status(404).json({ error: 'Account not found' });
  
  let updatedItemsStr = existing.items;
  if (paidItemsIndices && typeof paidItemsIndices === 'object') {
     let itemsList = [];
     try { itemsList = JSON.parse(existing.items || '[]'); } catch(e){}
     Object.keys(paidItemsIndices).forEach(idxStr => {
        const idx = parseInt(idxStr);
        const qtyToSubtract = paidItemsIndices[idxStr];
        if (itemsList[idx] && itemsList[idx].quantity >= qtyToSubtract) {
           itemsList[idx].quantity -= qtyToSubtract;
        }
     });
     itemsList = itemsList.filter(i => i.quantity > 0);
     updatedItemsStr = JSON.stringify(itemsList);
  }

  const newTotal = existing.total - amount;
  if (newTotal <= 0.01 || (paidItemsIndices && Object.keys(paidItemsIndices).length > 0 && JSON.parse(updatedItemsStr).length === 0)) {
    db.prepare('DELETE FROM table_accounts WHERE table_id = ?').run(tableId);
  } else {
    db.prepare('UPDATE table_accounts SET total = ?, items = ? WHERE table_id = ?').run(newTotal, updatedItemsStr, tableId);
  }
  
  const allAccounts = db.prepare('SELECT * FROM table_accounts').all()
    .map(a => ({ ...a, items: JSON.parse(a.items || '[]') }));
  io.emit('accounts:updated', allAccounts);
  res.json({ success: true, remaining: newTotal > 0 ? newTotal : 0 });
});

// POST create a new ticket (from POS)
app.post('/api/tickets', (req, res) => {
  const { order_number, table_number, order_type, station, priority, notes, items } = req.body;
  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO tickets (id, order_number, table_number, order_type, station, status, priority, created_at, notes)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, order_number || `#${Math.floor(1000 + Math.random() * 9000)}`, table_number || null,
    order_type || 'dine-in', station || 'all', priority || 0, now, notes || null);

  if (items && Array.isArray(items)) {
    for (const item of items) {
      db.prepare(`
        INSERT INTO ticket_items (id, ticket_id, name, quantity, station, status, modifiers, notes, price)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(uuidv4(), id, item.name, item.quantity || 1, item.station || 'all',
        JSON.stringify(item.modifiers || []), item.notes || null, Number(item.price) || 0.0);
    }
  }

  // UPDATE Table Account state (For cross-device billing)
  if (table_number) {
    const orderItems = items.map(i => ({ ...i, price: Number(i.price || 0) }));
    const orderTotal = orderItems.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
    const existing = db.prepare('SELECT * FROM table_accounts WHERE table_id = ?').get(table_number);
    
    let updatedItems = [];
    if (existing) {
      const prevItems = JSON.parse(existing.items || '[]');
      updatedItems = [...prevItems, ...orderItems];
      db.prepare('UPDATE table_accounts SET total = total + ?, items = ? WHERE table_id = ?')
        .run(orderTotal, JSON.stringify(updatedItems), table_number);
    } else {
      updatedItems = orderItems;
      db.prepare('INSERT INTO table_accounts (table_id, total, items) VALUES (?, ?, ?)')
        .run(table_number, orderTotal, JSON.stringify(updatedItems));
    }
    
    // Broadcast updated account status to all clients
    const allAccounts = db.prepare('SELECT * FROM table_accounts').all()
      .map(a => ({ ...a, items: JSON.parse(a.items || '[]') }));
    io.emit('accounts:updated', allAccounts);
  }

  const fullTicket = {
    ...db.prepare('SELECT * FROM tickets WHERE id = ?').get(id),
    items: db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(id)
      .map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
  };

  io.emit('ticket:new', fullTicket);
  res.status(201).json(fullTicket);
});

// POST reorder tickets manually (Drag & Drop)
app.post('/api/tickets/reorder', (req, res) => {
  const { ticketIds } = req.body;
  if (!Array.isArray(ticketIds)) return res.status(400).json({ error: 'ticketIds array required' });

  try {
    const stmt = db.prepare('UPDATE tickets SET manual_order = ? WHERE id = ?');
    const updateOrder = db.transaction((ids) => {
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    updateOrder(ticketIds);
    
    // Broadcast completely initialized list to ALL stations so they sync the manual sort
    io.emit('tickets:init', getTickets('all'));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST reset all ticket/analytics data (ROOT ONLY)
app.post('/api/admin/reset-data', (req, res) => {
  // We'll perform authorization in the frontend, but we'll add a check here too if needed.
  // For now, simplicity is key since it's a local KDS.
  try {
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM analytics_prep_times').run();
    db.prepare('DELETE FROM table_accounts').run();
    
    // Notify clients that everything is empty
    io.emit('tickets:reset');
    io.emit('accounts:updated', []);
    res.json({ success: true, message: 'All tickets, analytics and accounts have been cleared.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Failed to reset data.' });
  }
});

// PATCH update ticket status
app.patch('/api/tickets/:id/status', (req, res) => {
  const { status } = req.body;
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });

  const now = Date.now();
  let update = {};

  if (status === 'in-progress' && !ticket.started_at) {
    update.started_at = now;
    db.prepare('UPDATE ticket_items SET started_at = ? WHERE ticket_id = ? AND started_at IS NULL')
      .run(now, ticket.id);
  }
  
  if (status === 'ready' || status === 'completed') {
    db.prepare('UPDATE ticket_items SET status = ?, completed_at = COALESCE(completed_at, ?) WHERE ticket_id = ? AND status = ?')
      .run('ready', now, ticket.id, 'pending');
  }

  if (status === 'completed') {
    update.completed_at = now;
    // Record analytics
    if (ticket.started_at) {
      const prepTime = Math.floor((now - ticket.started_at) / 1000);
      recordPrepTime(ticket.id, ticket.station, prepTime);
    }
  }

  db.prepare('UPDATE tickets SET status = ?, started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at) WHERE id = ?')
    .run(status, update.started_at || null, update.completed_at || null, ticket.id);

  const updated = {
    ...db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id),
    items: db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticket.id)
      .map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
  };

  io.emit('ticket:updated', updated);
  res.json(updated);
});

// PATCH update single item status
app.patch('/api/tickets/:ticketId/items/:itemId/status', (req, res) => {
  const { status } = req.body;
  const now = Date.now();

  const item = db.prepare('SELECT * FROM ticket_items WHERE id = ? AND ticket_id = ?')
    .get(req.params.itemId, req.params.ticketId);
  if (!item) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE ticket_items SET status = ?, completed_at = ? WHERE id = ?')
    .run(status, status === 'ready' ? now : null, item.id);

  // Check if all items in ticket are ready → auto-set ticket to ready
  const pending = db.prepare("SELECT COUNT(*) as c FROM ticket_items WHERE ticket_id = ? AND status = 'pending'")
    .get(req.params.ticketId);
  if (pending.c === 0) {
    db.prepare("UPDATE tickets SET status = 'ready' WHERE id = ? AND status = 'in-progress'")
      .run(req.params.ticketId);
  }

  const ticket = {
    ...db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId),
    items: db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(req.params.ticketId)
      .map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
  };

  io.emit('ticket:updated', ticket);
  res.json(ticket);
});

// PATCH prioritize ticket
app.patch('/api/tickets/:id/priority', (req, res) => {
  const { priority } = req.body;
  db.prepare('UPDATE tickets SET priority = ? WHERE id = ?').run(priority, req.params.id);
  const ticket = {
    ...db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id),
    items: db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(req.params.id)
      .map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
  };
  io.emit('ticket:updated', ticket);
  res.json(ticket);
});

// PATCH restore (undo) a completed ticket
app.patch('/api/tickets/:id/restore', (req, res) => {
  db.prepare("UPDATE tickets SET status = 'in-progress', completed_at = NULL WHERE id = ? AND status = 'completed'")
    .run(req.params.id);
  db.prepare("UPDATE ticket_items SET status = 'pending', completed_at = NULL WHERE ticket_id = ?")
    .run(req.params.id);

  const ticket = {
    ...db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id),
    items: db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(req.params.id)
      .map(i => ({ ...i, modifiers: JSON.parse(i.modifiers || '[]') }))
  };
  io.emit('ticket:updated', ticket);
  res.json(ticket);
});

// DELETE ticket
app.delete('/api/tickets/:id', (req, res) => {
  db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  io.emit('ticket:deleted', { id: req.params.id });
  res.json({ success: true });
});

// ─── Analytics endpoints ──────────────────────────────────────────────────────

app.get('/api/analytics/prep-times', (req, res) => {
  const rows = db.prepare(`
    SELECT item_name, station,
           ROUND(AVG(prep_time_seconds)) as avg_seconds,
           MIN(prep_time_seconds) as min_seconds,
           MAX(prep_time_seconds) as max_seconds,
           COUNT(*) as count
    FROM analytics_prep_times
    GROUP BY item_name, station
    ORDER BY avg_seconds DESC
  `).all();
  res.json(rows);
});

app.get('/api/analytics/peak-hours', (req, res) => {
  const rows = db.prepare(`
    SELECT hour_of_day, COUNT(*) as order_count,
           ROUND(AVG(prep_time_seconds)) as avg_prep_seconds
    FROM analytics_prep_times
    GROUP BY hour_of_day
    ORDER BY hour_of_day ASC
  `).all();
  res.json(rows);
});

app.get('/api/analytics/station-performance', (req, res) => {
  const rows = db.prepare(`
    SELECT station,
           COUNT(*) as total_items,
           ROUND(AVG(prep_time_seconds)) as avg_seconds,
           COUNT(CASE WHEN prep_time_seconds > 600 THEN 1 END) as delayed_count
    FROM analytics_prep_times
    GROUP BY station
    ORDER BY avg_seconds DESC
  `).all();
  res.json(rows);
});

app.get('/api/analytics/summary', (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const totalToday = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE created_at >= ?').get(todayMs);
  const completedToday = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE created_at >= ? AND status = 'completed'").get(todayMs);
  const avgPrepTime = db.prepare('SELECT ROUND(AVG(prep_time_seconds)) as avg FROM analytics_prep_times WHERE completed_at >= ?').get(todayMs);
  const delayed = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('completed') AND created_at < ?").get(Date.now() - 600000);
  
  const salesToday = db.prepare(`
    SELECT ROUND(SUM(ti.price * ti.quantity), 2) as sum
    FROM ticket_items ti
    JOIN tickets t ON ti.ticket_id = t.id
    WHERE t.created_at >= ? AND t.status = 'completed'
  `).get(todayMs);

  res.json({
    total_today: totalToday.c,
    completed_today: completedToday.c,
    avg_prep_time_seconds: avgPrepTime.avg || 0,
    delayed_count: delayed.c,
    sales_today: salesToday.sum || 0
  });
});

// ─── Menu ────────────────────────────────────────────────────────────────────

app.get('/api/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
  items.forEach(i => i.modifiers = JSON.parse(i.modifiers || '[]'));
  res.json(items);
});

app.post('/api/menu', (req, res) => {
  const { name, category, modifiers, price } = req.body;
  const insert = db.prepare('INSERT INTO menu_items (name, category, modifiers, price) VALUES (?, ?, ?, ?)');
  const info = insert.run(name, category, JSON.stringify(modifiers || []), Number(price) || 0.0);
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid);
  item.modifiers = JSON.parse(item.modifiers || '[]');
  res.status(201).json(item);
});

app.put('/api/menu/:id', (req, res) => {
  const { name, category, modifiers, price } = req.body;
  db.prepare('UPDATE menu_items SET name = ?, category = ?, modifiers = ?, price = ? WHERE id = ?')
    .run(name, category, JSON.stringify(modifiers || []), Number(price) || 0.0, req.params.id);
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.modifiers = JSON.parse(item.modifiers || '[]');
  res.json(item);
});

app.delete('/api/menu/:id', (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ─── Stations ─────────────────────────────────────────────────────────────────


app.get('/api/stations', (req, res) => {
  res.json(db.prepare('SELECT * FROM stations').all());
});

app.post('/api/stations', (req, res) => {
  const { id, name, label, color, time_alert_yellow, time_alert_red } = req.body;
  
  // Use provided id (e.g. "bar", "food") or fallback to a uuid
  const stationId = id || uuidv4();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO stations (id, name, label, color, time_alert_yellow, time_alert_red)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(stationId, name, label || name, color || '#6366f1', Number(time_alert_yellow) || 300, Number(time_alert_red) || 600);
    
    io.emit('stations:updated', db.prepare('SELECT * FROM stations').all());
    res.status(201).json({ success: true, id: stationId });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
       return res.status(400).json({ error: 'Station ID already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stations/:id', (req, res) => {
  const { name, label, color, time_alert_yellow, time_alert_red } = req.body;
  const stationId = req.params.id;
  
  try {
    const stmt = db.prepare(`
      UPDATE stations 
      SET name = ?, label = ?, color = ?, time_alert_yellow = ?, time_alert_red = ?
      WHERE id = ?
    `);
    stmt.run(name, label || name, color || '#6366f1', Number(time_alert_yellow) || 300, Number(time_alert_red) || 600, stationId);
    
    io.emit('stations:updated', db.prepare('SELECT * FROM stations').all());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stations/:id', (req, res) => {
  const stationId = req.params.id;
  if (stationId === 'all') return res.status(400).json({ error: 'Cannot delete the "all" station.' });
  
  try {
    db.prepare('DELETE FROM stations WHERE id = ?').run(stationId);
    io.emit('stations:updated', db.prepare('SELECT * FROM stations').all());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.patch('/api/settings', (req, res) => {
  const updates = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, String(value));
  }
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  io.emit('settings:updated', settings);
  res.json(settings);
});

app.get('/api/logo', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app_logo'").get();
    if (!row || !row.value) {
      return res.status(404).send('No logo set');
    }
    
    let dataUrl = row.value;
    
    // Ensure it's a valid data URL and get the content type and base64 data
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    }
    
    // Fallback if it was saved without prefix (unlikely but possible)
    if (dataUrl.length > 100) { 
      const buffer = Buffer.from(dataUrl, 'base64');
      res.setHeader('Content-Type', 'image/png'); // assume png
      return res.send(buffer);
    }

    res.status(400).send('Invalid logo format');
  } catch (error) {
    console.error('[/api/logo] Fatal error:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// ─── Item consolidation endpoint ─────────────────────────────────────────────

app.get('/api/consolidation', (req, res) => {
  const { station } = req.query;
  let query = `
    SELECT ti.name, SUM(ti.quantity) as total_quantity, ti.station
    FROM ticket_items ti
    INNER JOIN tickets t ON t.id = ti.ticket_id
    WHERE t.status NOT IN ('completed') AND ti.status = 'pending'
  `;
  const params = [];
  if (station && station !== 'all') {
    query += ' AND (ti.station = ? OR ti.station = "all")';
    params.push(station);
  }
  query += ' GROUP BY ti.name, ti.station ORDER BY total_quantity DESC';
  res.json(db.prepare(query).all(...params));
});

// ─── Users & Auth ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  const user = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?').get(username);
  
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  // 1. Check if the hash matches using bcrypt
  let isMatch = false;
  try {
    isMatch = bcrypt.compareSync(password, user.password);
  } catch (e) {
    // If bcrypt throws (meaning it's a plain string that can't be parsed as hash), it's not a valid bcrypt hash
  }

  // 2. Fallback for unhashed (plaintext) passwords in DEV migrations
  if (!isMatch && password === user.password) {
     isMatch = true;
     // Hash it dynamically so next time it's secure
     const newHash = bcrypt.hashSync(password, 10);
     db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);
  }

  if (!isMatch) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  delete user.password;
  res.json({ success: true, user });
});

app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT id, username, role FROM users').all());
});

app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Faltan campos' });
  
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  
  try {
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run(id, username, hash, role);
    res.json({ id, username, role });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists or missing fields' });
  }
});

// Note: Using .patch because the frontend uses it, but PUT is also fine logically
app.match = app.match || app.all; // helper if needed, but I'll just use .patch and .put
const handleUserUpdate = (req, res) => {
  const { username, password, role } = req.body;
  try {
    if (password && password.trim().length > 0) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?').run(username, hash, role, req.params.id);
    } else {
      db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, req.params.id);
    }
    res.json({ id: req.params.id, username, role });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'La actualización falló: usuario duplicado o datos inválidos' });
  }
};

app.patch('/api/users/:id', handleUserUpdate);
app.put('/api/users/:id', handleUserUpdate);


app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (user && (user.role === 'root' || user.role === 'admin')) {
    const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = "root" OR role = "admin"').get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
    }
  }
  
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).send();
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send current state on connect
  socket.emit('tickets:init', getTickets('all'));
  
  const accounts = db.prepare('SELECT * FROM table_accounts').all()
    .map(a => ({ ...a, items: JSON.parse(a.items || '[]') }));
  socket.emit('accounts:init', accounts);

  socket.on('subscribe:station', (station) => {
    socket.join(`station:${station}`);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 KDS Backend running on http://localhost:${PORT}`);
  console.log(`   WebSocket ready for real-time connections\n`);
});
