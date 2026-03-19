const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'kds.db'));

const FOOD_ITEMS = [
  // CHILAQUILES Y ENCHILADAS
  { name: 'Chilaquiles Tradicionales', modifiers: ['Verdes', 'Rojos'] },
  { name: 'Chilaquiles con Proteína', modifiers: ['Pechuga', 'Bistec', '1 Huevo'] },
  { name: 'Enchiladas Tradicionales', modifiers: ['Verdes', 'Rojas'] },
  { name: 'Enchiladas Rellenas', modifiers: ['Pollo', 'Quesillo', 'Jamón'] },
  { name: 'Enchiladas Suizas', modifiers: ['Verdes'] },
  { name: 'Enmoladas', modifiers: [] },
  { name: 'Enfrijoladas', modifiers: [] },

  // SANDWICHES, TORTAS Y SNACKS
  { name: 'Club Sandwich Tradicional', modifiers: ['Jamón'] },
  { name: 'Club Sandwich de Atún', modifiers: [] },
  { name: 'Club Sandwich de Pollo', modifiers: [] },
  { name: 'Sandwich de Jamón', modifiers: [] },
  { name: 'Sandwich de Atún', modifiers: [] },
  { name: 'Sandwich de Pollo', modifiers: [] },
  { name: 'Torta de Jamón', modifiers: [] },
  { name: 'Torta Especial', modifiers: ['Milanesa de cerdo', 'Milanesa de pollo', 'Salchicha', 'Chorizo'] },
  { name: 'Hot Dog', modifiers: [] },
  { name: 'Hot Dog con Tocino', modifiers: [] },
  { name: 'Orden de Papas a la Francesa', modifiers: [] },

  // HUEVOS Y OMELETS
  { name: 'Huevos al Gusto', modifiers: ['Revuelto con Jamón', 'Salchicha', 'Tocino', 'Chorizo'] },
  { name: 'Huevos Divorciados', modifiers: [] },
  { name: 'Omelet Fit', modifiers: ['Espinacas', 'Champiñones'] },

  // PARA LOS PEQUES (KIDS)
  { name: 'Waffles', modifiers: [] },
  { name: 'Nuggets de Pollo', modifiers: [] },
  { name: 'Salchichas Mini', modifiers: [] },
  { name: 'Leche con Cereal', modifiers: [] },
  { name: 'Coctel de Frutas', modifiers: [] },

  // ANTOJOS Y ENTRADAS
  { name: 'Molletes Sencillos', modifiers: [] },
  { name: 'Molletes Especiales', modifiers: ['Jamón', 'Chorizo', 'Champiñón'] },
  { name: 'Quesadillas Naturales', modifiers: [] },
  { name: 'Quesadillas Especiales', modifiers: ['Chicharrón prensado', 'Champiñón'] },
  { name: 'Tostadas', modifiers: [] },
  { name: 'Sincronizadas', modifiers: [] }
];

// Comprabamos que la tabla exista por si acaso
db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    modifiers TEXT
  );
`);

const insert = db.prepare('INSERT INTO menu_items (name, category, modifiers) VALUES (?, ?, ?)');
const check = db.prepare('SELECT 1 FROM menu_items WHERE name = ?');

let added = 0;
for (const item of FOOD_ITEMS) {
  if (!check.get(item.name)) {
    insert.run(item.name, 'food', JSON.stringify(item.modifiers));
    added++;
  }
}
console.log(`Se insertaron con exito ${added} elementos nuevos al menu de comida.`);
db.close();
