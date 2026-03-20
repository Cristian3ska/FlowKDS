const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'kds.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL,
      table_number TEXT,
      order_type TEXT DEFAULT 'dine-in',
      station TEXT DEFAULT 'all',
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS ticket_items (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      station TEXT DEFAULT 'all',
      status TEXT DEFAULT 'pending',
      modifiers TEXT,
      notes TEXT,
      started_at INTEGER,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      time_alert_yellow INTEGER DEFAULT 300,
      time_alert_red INTEGER DEFAULT 600
    );

    CREATE TABLE IF NOT EXISTS analytics_prep_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT,
      item_name TEXT,
      station TEXT,
      prep_time_seconds INTEGER,
      completed_at INTEGER,
      day_of_week INTEGER,
      hour_of_day INTEGER
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      modifiers TEXT,
      price REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO stations (id, name, label, color, time_alert_yellow, time_alert_red) VALUES
      ('all',      'All',        'Todas',     '#6366f1', 300, 600),
      ('food',     'Food',       'Comida',    '#f59e0b', 480, 900),
      ('bar',      'Bar',        'Barra',     '#8b5cf6', 240, 480),
      ('bar_hot',  'Hot Drinks', 'Calientes', '#ef4444', 180, 360),
      ('bar_cold', 'Cold Drinks','Frías',     '#06b6d4', 180, 360);

    -- Seed menu items if table is empty
    INSERT INTO menu_items (name, category, modifiers)
    SELECT 'Huevos al Gusto', 'food', '["Estrellados", "Revueltos", "Tibios"]'
    WHERE NOT EXISTS (SELECT 1 FROM menu_items);
    
    INSERT INTO menu_items (name, category, modifiers)
    SELECT 'Americano', 'bar_hot', '["Doble shot", "Shot simple", "Descafeinado"]'
    WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Americano');

    INSERT INTO menu_items (name, category, modifiers)
    SELECT 'Jugo de Naranja', 'bar_cold', '["Natural", "Sin hielo"]'
    WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Jugo de Naranja');

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS table_accounts (
      table_id TEXT PRIMARY KEY,
      total REAL DEFAULT 0,
      items TEXT DEFAULT '[]'
    );

    INSERT OR IGNORE INTO stations (id, name, label, color, time_alert_yellow, time_alert_red) VALUES
      ('sound_enabled', 'true'),
      ('app_name', 'Flow KDS'),
      ('sound_new_order', 'bell'),
      ('sound_delayed', 'alarm'),
      ('alert_yellow_default', '300'),
      ('alert_red_default', '600');
  `);

  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('1', 'root', 'root', 'root')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('2', 'admin', 'admin', 'admin')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('3', 'cocina', '1234', 'kitchen')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('4', 'barista', '1234', 'barista')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('5', 'mesero', '1234', 'waiter')"); } catch (e) {}

  try { db.exec("ALTER TABLE menu_items ADD COLUMN price REAL DEFAULT 0.0"); } catch (e) { /* ignore if exists */ }
  try { db.exec("ALTER TABLE ticket_items ADD COLUMN price REAL DEFAULT 0.0"); } catch (e) { /* ignore if exists */ }
};

init();

module.exports = db;
