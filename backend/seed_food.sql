CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  modifiers TEXT
);

UPDATE menu_items SET modifiers = '["Revuelto con Jamón","Salchicha","Tocino","Chorizo"]' WHERE name = 'Huevos al Gusto';

INSERT INTO menu_items (name, category, modifiers) VALUES
('Chilaquiles Tradicionales', 'food', '["Verdes","Rojos"]'),
('Chilaquiles con Proteína', 'food', '["Pechuga","Bistec","1 Huevo"]'),
('Enchiladas Tradicionales', 'food', '["Verdes","Rojas"]'),
('Enchiladas Rellenas', 'food', '["Pollo","Quesillo","Jamón"]'),
('Enchiladas Suizas', 'food', '["Verdes"]'),
('Enmoladas', 'food', '[]'),
('Enfrijoladas', 'food', '[]'),
('Club Sandwich Tradicional', 'food', '["Jamón"]'),
('Club Sandwich de Atún', 'food', '[]'),
('Club Sandwich de Pollo', 'food', '[]'),
('Sandwich de Jamón', 'food', '[]'),
('Sandwich de Atún', 'food', '[]'),
('Sandwich de Pollo', 'food', '[]'),
('Torta de Jamón', 'food', '[]'),
('Torta Especial', 'food', '["Milanesa de cerdo","Milanesa de pollo","Salchicha","Chorizo"]'),
('Hot Dog', 'food', '[]'),
('Hot Dog con Tocino', 'food', '[]'),
('Orden de Papas a la Francesa', 'food', '[]'),
('Huevos Divorciados', 'food', '[]'),
('Omelet Fit', 'food', '["Espinacas","Champiñones"]'),
('Waffles', 'food', '[]'),
('Nuggets de Pollo', 'food', '[]'),
('Salchichas Mini', 'food', '[]'),
('Leche con Cereal', 'food', '[]'),
('Coctel de Frutas', 'food', '[]'),
('Molletes Sencillos', 'food', '[]'),
('Molletes Especiales', 'food', '["Jamón","Chorizo","Champiñón"]'),
('Quesadillas Naturales', 'food', '[]'),
('Quesadillas Especiales', 'food', '["Chicharrón prensado","Champiñón"]'),
('Tostadas', 'food', '[]'),
('Sincronizadas', 'food', '[]');
