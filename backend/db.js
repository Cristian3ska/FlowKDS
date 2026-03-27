const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'kds.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const init = () => {
  // --- MIGRATIONS FIRST ---
  try { db.exec("ALTER TABLE stations ADD COLUMN type TEXT DEFAULT 'food'"); } catch (e) {}
  try { db.exec("ALTER TABLE menu_items ADD COLUMN price REAL DEFAULT 0.0"); } catch (e) {}
  try { db.exec("ALTER TABLE ticket_items ADD COLUMN price REAL DEFAULT 0.0"); } catch (e) {}
  try { db.exec("ALTER TABLE tickets ADD COLUMN manual_order INTEGER DEFAULT 0"); } catch (e) {}

  const DRINK_EXTRAS = '["Extra Shot +$15", "Leche Almendra/Coco +$15", "Jarabe Extra +$10", "Tapioca +$10"]';

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
      type TEXT DEFAULT 'food',
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

    DELETE FROM stations;
    INSERT INTO stations (id, name, label, type, color, time_alert_yellow, time_alert_red) VALUES
      ('all',      'Todas',      'Todas',     'food',  '#6366f1', 300, 600),
      ('ch-en',    'Chilaquiles', 'C & E',     'food',  '#ef4444', 300, 600),
      ('h-o',      'Huevos',     'H & O',     'food',  '#f59e0b', 300, 600),
      ('antojos',  'Antojos',    'Antojos',   'food',  '#8b5cf6', 300, 600),
      ('lonche',   'Lonchería',  'Lonche',    'food',  '#06b6d4', 300, 600),
      ('kids',     'Kids',       'Peques',    'food',  '#ec4899', 300, 600),
      ('paquetes', 'Paquetes',   'Paquetes',  'food',  '#10b981', 300, 600),
      ('b-hot',    'Calientes',  'Humeante',  'drink', '#ef4444', 180, 360),
      ('b-iced',   'Iced / Bar', 'Barra',     'drink', '#06b6d4', 180, 360),
      ('b-frappe', 'Frappés',    'Frappés',   'drink', '#a855f7', 180, 480),
      ('b-extra',  'Extras',     'Otros',     'drink', '#94a3b8', 120, 240);

    DELETE FROM menu_items;
    
    -- CHILAQUILES Y ENCHILADAS
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Chilaquiles Tradicionales', 'ch-en', '["COMBO_Salsa:Verdes", "COMBO_Salsa:Rojos"]', 65.0),
      ('Chilaquiles con Proteína', 'ch-en', '["COMBO_Salsa:Verdes", "COMBO_Salsa:Rojos", "COMBO_Proteína:Pechuga", "COMBO_Proteína:Bistec", "COMBO_Proteína:1 Huevo"]', 80.0),
      ('Enchiladas Tradicionales', 'ch-en', '["COMBO_Salsa:Verdes", "COMBO_Salsa:Rojas"]', 65.0),
      ('Enchiladas Rellenas', 'ch-en', '["COMBO_Relleno:Pollo", "COMBO_Relleno:Quesillo", "COMBO_Relleno:Jamón"]', 70.0),
      ('Enchiladas Suizas (Verdes)', 'ch-en', '[]', 85.0),
      ('Enmoladas', 'ch-en', '[]', 70.0),
      ('Enfrijoladas', 'ch-en', '[]', 65.0);

    -- HUEVOS Y OMELETS
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Huevos al Gusto', 'h-o', '["COMBO_Preparación:Revuelto Jamón", "COMBO_Preparación:Revuelto Salchicha", "COMBO_Preparación:Revuelto Tocino", "COMBO_Preparación:Revuelto Chorizo", "COMBO_Preparación:Solo"]', 60.0),
      ('Huevos Divorciados', 'h-o', '[]', 60.0),
      ('Omelet Fit', 'h-o', '["COMBO_Ingrediente:Espinacas", "COMBO_Ingrediente:Champiñones"]', 70.0);

    -- BEBIDAS CALIENTES
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Espresso', 'b-hot', '[]', 25.0),
      ('Americano', 'b-hot', '[]', 30.0),
      ('Mocha', 'b-hot', '[]', 45.0),
      ('Latte', 'b-hot', '[]', 45.0),
      ('Cappuccino', 'b-hot', '[]', 45.0),
      ('Cappuccino Francés', 'b-hot', '["COMBO_Sabor:Vainilla", "COMBO_Sabor:Chocolate Irlandés", "Extra Shot +$15"]', 50.0);

    -- ESPECIALIDADES BARRA
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Caramel Macchiato (Hot)', 'b-hot', '[]', 65.0),
      ('Taro Latte', 'b-hot', '[]', 60.0),
      ('Matcha Latte', 'b-hot', '[]', 60.0),
      ('Chai Latte', 'b-hot', '[]', 60.0),
      ('Chocolate Caliente', 'b-hot', '[]', 60.0);

    -- TISANAS
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Tisana Frutos Rojos', 'b-hot', '[]', 60.0),
      ('Tisana Mango-Maracuya', 'b-hot', '[]', 60.0);

    -- BARRA FRÍA (ICED)
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Iced Americano', 'b-iced', '[]', 40.0),
      ('Iced Latte', 'b-iced', '[]', 55.0),
      ('Iced Mocha', 'b-iced', '[]', 55.0),
      ('Iced Chocolate', 'b-iced', '[]', 55.0),
      ('Iced Taro/Matcha/Chai', 'b-iced', '["COMBO_Sabor:Taro", "COMBO_Sabor:Matcha", "COMBO_Sabor:Chai", "Tapioca +$10"]', 60.0),
      ('Caramel Macchiato (Iced)', 'b-iced', '[]', 70.0);

    -- FRAPPÉS
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Classic Frappe', 'b-frappe', '[]', 70.0),
      ('Mocha Frappe', 'b-frappe', '[]', 75.0),
      ('Caramel Frappe', 'b-frappe', '[]', 75.0),
      ('Mazapán Frappe', 'b-frappe', '[]', 75.0),
      ('Galleta Oreo Frappe', 'b-frappe', '[]', 75.0),
      ('Taro Frappe', 'b-frappe', '[]', 80.0),
      ('Matcha Frappe', 'b-frappe', '[]', 80.0),
      ('Chai Frappe', 'b-frappe', '[]', 80.0);

    -- BEBIDAS COMPLEMENTARIAS
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Sodas Italianas', 'b-extra', '["COMBO_Sabor:Mora Azul", "COMBO_Sabor:Manzana Verde", "COMBO_Sabor:Fresa"]', 45.0),
      ('Refresco', 'b-extra', '[]', 25.0),
      ('Agua Embotellada', 'b-extra', '[]', 20.0),
      ('Jugo Natural', 'b-extra', '["COMBO_Sabor:Naranja", "COMBO_Sabor:Zanahoria"]', 30.0);

    -- ANTOJOS Y LONCHE (Para mantener el resto)
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Molletes Sencillos (4 pza)', 'antojos', '[]', 60.0),
      ('Molletes Especiales (4 pza)', 'antojos', '["COMBO_Ingrediente:Jamón", "COMBO_Ingrediente:Chorizo", "COMBO_Ingrediente:Champiñón"]', 65.0),
      ('Quesadillas Naturales (3 pza)', 'antojos', '[]', 45.0),
      ('Quesadillas Especiales (3 pza)', 'antojos', '["COMBO_Guiso:Chicharrón prensado", "COMBO_Guiso:Champiñón"]', 50.0),
      ('Tostadas (3 pza)', 'antojos', '[]', 45.0),
      ('Sincronizadas (3 pza)', 'antojos', '[]', 50.0),
      ('Club Sandwich Tradicional', 'lonche', '["Jamón"]', 80.0),
      ('Club Sandwich de Atún', 'lonche', '[]', 80.0),
      ('Club Sandwich de Pollo', 'lonche', '[]', 80.0),
      ('Sandwich de Jamón', 'lonche', '[]', 50.0),
      ('Sandwich de Atún', 'lonche', '[]', 50.0),
      ('Sandwich de Pollo', 'lonche', '[]', 55.0),
      ('Torta de Jamón', 'lonche', '[]', 40.0),
      ('Torta Especial', 'lonche', '["COMBO_Relleno:Milanesa cerdo", "COMBO_Relleno:Milanesa pollo", "COMBO_Relleno:Salchicha", "COMBO_Relleno:Chorizo"]', 50.0),
      ('Hot Dog (1 pza)', 'lonche', '[]', 25.0),
      ('Hot Dog con Tocino (1 pza)', 'lonche', '[]', 35.0),
      ('Orden de Papas a la Francesa', 'lonche', '[]', 50.0);

    -- PEQUES Y PAQUETES
    INSERT INTO menu_items (name, category, modifiers, price) VALUES
      ('Waffles', 'kids', '[]', 50.0),
      ('Nuggets de Pollo', 'kids', '[]', 50.0),
      ('Salchichas Mini', 'kids', '[]', 40.0),
      ('Leche con Cereal', 'kids', '[]', 35.0),
      ('Coctel de Frutas', 'kids', '[]', 30.0),
      ('PAQUETE COMPLETO', 'paquetes', '["COMBO_1. Entrada:Fruta del día", "COMBO_1. Entrada:Pan Dulce", "COMBO_2. Platillo:Chilaquiles", "COMBO_2. Platillo:Enchiladas Sencillas", "COMBO_2. Platillo:Bistec Asado", "COMBO_2. Platillo:Pechuga Asada", "COMBO_2. Platillo:Huevos al gusto", "COMBO_2. Platillo:Sandwich Clásico", "COMBO_2. Platillo:Omelet", "Café de Olla Incluido", "Extra +$15"]', 95.0);

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('sound_enabled', 'true'),
      ('app_name', 'El Farolito KDS'),
      ('sound_new_order', 'bell'),
      ('sound_delayed', 'alarm');
  `);

  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('1', 'root', 'root', 'root')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('2', 'admin', 'admin', 'admin')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('3', 'cocina', '1234', 'kitchen')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('4', 'barista', '1234', 'barista')"); } catch (e) {}
  try { db.exec("INSERT OR IGNORE INTO users (id, username, password, role) VALUES ('5', 'mesero', '1234', 'waiter')"); } catch (e) {}
};

init();

module.exports = db;
