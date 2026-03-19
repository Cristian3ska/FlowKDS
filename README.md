# Flow KDS

Sistema profesional de visualización de cocina en tiempo real para restaurantes. Solución de código abierto construida con Next.js 16, Node.js, Socket.IO y SQLite.

---

## Tabla de Contenido

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Requerimientos](#3-requerimientos)
4. [Instalación y Arranque](#4-instalación-y-arranque)
5. [Estructura del Proyecto](#5-estructura-del-proyecto)
6. [Módulos Frontend](#6-módulos-frontend)
7. [API REST — Referencia Completa](#7-api-rest--referencia-completa)
8. [WebSockets — Eventos en Tiempo Real](#8-websockets--eventos-en-tiempo-real)
9. [Base de Datos — Esquema](#9-base-de-datos--esquema)
10. [Configuración de Estaciones](#10-configuración-de-estaciones)
11. [Integración con POS Real](#11-integración-con-pos-real)
12. [Business Intelligence y Analítica](#12-business-intelligence-y-analítica)
13. [Requerimientos del Sistema](#13-requerimientos-del-sistema)
14. [Despliegue en Producción](#14-despliegue-en-producción)
15. [Solución de Problemas](#15-solución-de-problemas)

---

## 1. Descripción General

Flow KDS es un **Kitchen Display System** diseñado para reemplazar los tickets de papel en la cocina de un restaurante. Proporciona:

- Visualización instantánea de pedidos desde el punto de venta (POS) mediante WebSockets
- Control de tiempos con semáforo visual (verde / amarillo / rojo) por ticket
- Segmentación de pedidos por estación de trabajo (Parrilla, Frío, Postres, Bar)
- Consolidación de ítems para producción en lote
- Historial con recuperación de tickets completados
- Panel de analítica con indicadores de rendimiento (KPIs), horas pico y tiempos promedio de preparación
- Notificaciones sonoras configurables para nuevos pedidos y atrasos
- Funcionamiento offline en red local (sin dependencia de internet)

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                    NAVEGADOR (KDS)                   │
│  Next.js 16 · TypeScript · CSS Variables             │
│  Socket.IO Client · Recharts · Lucide React          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST + WebSocket (WS)
                       │ puerto 4000
┌──────────────────────▼──────────────────────────────┐
│                 SERVIDOR BACKEND                     │
│  Node.js · Express 4 · Socket.IO                    │
│  better-sqlite3 (SQLite WAL mode)                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                BASE DE DATOS                        │
│  SQLite — archivo local kds.db                      │
│  Tablas: tickets, ticket_items, stations,           │
│          analytics_prep_times, settings             │
└─────────────────────────────────────────────────────┘
```

### Flujo de datos

```
POS / Simulador
    │ POST /api/tickets
    ▼
Backend (Express)
    │ Persiste en SQLite
    │ io.emit('ticket:new', ticket)
    ▼
Socket.IO broadcast
    │
    ├──▶ Pantalla KDS Cocina (Todas)
    ├──▶ Pantalla KDS Parrilla
    ├──▶ Pantalla KDS Frío
    └──▶ Pantalla KDS Bar
```

---

## 3. Requerimientos

| Componente | Versión mínima |
|------------|----------------|
| Node.js    | 18.x o superior |
| npm        | 9.x o superior  |
| Sistema Operativo | Windows 10, macOS 12, Ubuntu 20.04 |
| Navegador  | Chrome 90+, Firefox 88+, Edge 90+ |

---

## 4. Instalación y Arranque

### Primera instalación

```bash
# Clonar o descargar el repositorio
cd /ruta/a/kds

# Instalar todas las dependencias (backend + frontend)
npm run install:all
```

### Arrancar en desarrollo

```bash
npm run dev
```

Esto inicia ambos servidores en paralelo:
- **Frontend (KDS):** http://localhost:3000
- **Backend API:** http://localhost:4000

### Arrancar por separado

```bash
# Solo el backend
npm run backend

# Solo el frontend (en otra terminal)
npm run frontend
```

### Variables de entorno

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Para producción, cambia la URL al hostname del servidor backend.

---

## 5. Estructura del Proyecto

```
kds/
├── package.json                  # Root scripts (dev, install:all)
├── README.md
│
├── backend/
│   ├── package.json
│   ├── server.js                 # Servidor principal: Express + Socket.IO + rutas REST
│   ├── db.js                     # Inicialización y conexión SQLite
│   └── kds.db                    # Base de datos SQLite (auto-generado al arrancar)
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── .env.local                # Variables de entorno frontend
    │
    ├── app/
    │   ├── layout.tsx            # Layout raíz con fuente Inter
    │   ├── page.tsx              # Página principal (dynamic import sin SSR)
    │   └── globals.css           # Sistema de diseño completo en CSS Variables
    │
    ├── types/
    │   └── index.ts              # Tipos TypeScript: Ticket, TicketItem, Station, etc.
    │
    ├── lib/
    │   └── utils.ts              # Cliente API, formateadores de tiempo, audio Web API
    │
    ├── hooks/
    │   └── useKDSSocket.ts       # Hook React para Socket.IO con manejo de sonidos
    │
    └── components/
        ├── KDSApp.tsx            # Componente principal: layout, filtros, sidebar
        ├── TicketCard.tsx        # Tarjeta de comanda: semáforo, ítems, acciones
        ├── HistoryPanel.tsx      # Panel de historial con restauración (undo)
        ├── ConsolidationPanel.tsx# Resumen de cantidades pendientes por ítem
        ├── PosSimulator.tsx      # Simulador POS para pruebas y demos
        └── AnalyticsPage.tsx     # Dashboard de analítica con gráficos Recharts
```

---

## 6. Módulos Frontend

### `KDSApp.tsx` — Aplicación Principal

Orquesta el estado global de la aplicación. Gestiona:
- Conexión WebSocket a través del hook `useKDSSocket`
- Selección de estación activa
- Filtros de estado (pendiente / en proceso / listo)
- Ordenamiento por prioridad o tiempo
- Apertura/cierre del sidebar

**Props:** ninguna (componente raíz)

### `TicketCard.tsx` — Tarjeta de Comanda

Representa un ticket de cocina individual. Actualiza su semáforo cada segundo.

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `ticket` | `Ticket` | Datos del ticket |
| `onUpdated` | `(t: Ticket) => void` | Callback cuando el ticket cambia de estado |
| `onCompleted` | `(t: Ticket) => void` | Callback cuando se despacha el ticket |
| `yellowThreshold` | `number` | Segundos para alerta amarilla (default: 300) |
| `redThreshold` | `number` | Segundos para alerta roja (default: 600) |

**Interacciones:**
- Clic en ítem → alterna estado pendiente/listo del ítem
- Botón estrella → alterna prioridad urgente
- Botón Iniciar → cambia estado a `in-progress`
- Botón Despachar → cambia estado a `completed` y elimina de la vista

### `HistoryPanel.tsx` — Historial

Lista los últimos 15 tickets completados. Permite restaurar un ticket por error de despacho.

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `onRestore` | `(t: Ticket) => void` | Callback al restaurar un ticket |

### `ConsolidationPanel.tsx` — Consolidación

Muestra la suma total de cada ítem pendiente en todas las comandas activas para facilitar la producción en lote. Se actualiza automáticamente cada 10 segundos.

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `station` | `string` | Filtra ítems por estación (o `'all'`) |

### `PosSimulator.tsx` — Simulador POS

Panel de pruebas para crear tickets sin necesidad de un sistema POS real. Útil para demostraciones y pruebas de carga.

### `AnalyticsPage.tsx` — Analítica

Dashboard completo con cuatro visualizaciones:
1. **KPIs del día** — Pedidos totales, completados, tiempo promedio, atrasados
2. **Horas pico** — Gráfico de barras (Recharts) por hora del día
3. **Rendimiento por estación** — Gráfico de pastel + tabla de tiempos y atrasos
4. **Tiempo por platillo** — Barras de progreso relativas con colores semáforo
5. **Tendencia horaria** — Gráfico de línea del tiempo promedio de preparación

### `useKDSSocket.ts` — Hook WebSocket

Gestiona la conexión Socket.IO y sincroniza el estado de tickets con el servidor.

```typescript
const { tickets, setTickets, connected } = useKDSSocket(soundEnabled);
```

- Escucha `tickets:init`, `ticket:new`, `ticket:updated`, `ticket:deleted`
- Reproduce sonidos mediante Web Audio API cuando `soundEnabled === true`
- Expone `connected` (boolean) para mostrar el indicador de estado de red

---

## 7. API REST — Referencia Completa

### Base URL

```
http://localhost:4000
```

---

### Tickets

#### `GET /api/tickets`

Lista todos los tickets activos (excluyendo los completados).

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `station` | `string` | Filtrar por estación (`grill`, `cold`, `dessert`, `bar`, `all`) |

**Respuesta exitosa `200`:**
```json
[
  {
    "id": "uuid",
    "order_number": "#1042",
    "table_number": "Mesa 5",
    "order_type": "dine-in",
    "station": "all",
    "status": "pending",
    "priority": 0,
    "created_at": 1710000000000,
    "started_at": null,
    "completed_at": null,
    "notes": null,
    "items": [
      {
        "id": "uuid",
        "ticket_id": "uuid",
        "name": "Hamburguesa Clásica",
        "quantity": 2,
        "station": "grill",
        "status": "pending",
        "modifiers": ["Sin cebolla", "Extra queso"],
        "notes": null,
        "started_at": null,
        "completed_at": null
      }
    ]
  }
]
```

---

#### `GET /api/tickets/history`

Lista los últimos tickets completados.

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `limit` | `number` | `20` | Máximo de registros a retornar |

---

#### `GET /api/tickets/:id`

Obtiene un ticket específico por ID.

---

#### `POST /api/tickets`

Crea un nuevo ticket. **Este es el endpoint principal para la integración con POS.**

**Body (JSON):**
```json
{
  "order_number": "#1042",
  "table_number": "Mesa 5",
  "order_type": "dine-in",
  "station": "all",
  "priority": 0,
  "notes": "Sin gluten",
  "items": [
    {
      "name": "Hamburguesa Clásica",
      "quantity": 2,
      "station": "grill",
      "modifiers": ["Sin cebolla", "Extra queso"],
      "notes": null
    },
    {
      "name": "Ensalada César",
      "quantity": 1,
      "station": "cold",
      "modifiers": [],
      "notes": "Sin crutones"
    }
  ]
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `order_number` | `string` | No | Auto-generado si no se provee |
| `table_number` | `string` | No | Número o nombre de mesa |
| `order_type` | `string` | No | `dine-in`, `takeout`, `delivery`, `vip` |
| `station` | `string` | No | Estación destino del ticket (`all` por default) |
| `priority` | `number` | No | `0` = normal, `1` = urgente |
| `notes` | `string` | No | Nota general del pedido |
| `items` | `array` | Sí | Lista de ítems del pedido |
| `items[].name` | `string` | Sí | Nombre del platillo |
| `items[].quantity` | `number` | No | Cantidad (default: 1) |
| `items[].station` | `string` | No | Estación del ítem (`all` por default) |
| `items[].modifiers` | `string[]` | No | Lista de modificadores |
| `items[].notes` | `string` | No | Nota específica del ítem |

**Respuesta exitosa `201`:** ticket completo con ítems.

> Emite evento WebSocket: `ticket:new`

---

#### `PATCH /api/tickets/:id/status`

Cambia el estado de un ticket.

**Body:**
```json
{ "status": "in-progress" }
```

| Valor | Descripción |
|-------|-------------|
| `pending` | Ticket recibido, sin iniciar |
| `in-progress` | Cocina iniciada — registra `started_at` |
| `ready` | Todo el ticket listo para despacho |
| `completed` | Despachado — se elimina de la vista activa |

> Al pasar a `completed`, todos los ítems se marcan como `ready` y se registra el tiempo de preparación en `analytics_prep_times`.

> Emite evento WebSocket: `ticket:updated`

---

#### `PATCH /api/tickets/:ticketId/items/:itemId/status`

Cambia el estado de un ítem individual dentro del ticket.

**Body:**
```json
{ "status": "ready" }
```

> Si todos los ítems quedan en `ready`, el ticket pasa automáticamente a `ready`.

> Emite evento WebSocket: `ticket:updated`

---

#### `PATCH /api/tickets/:id/priority`

Establece la prioridad de un ticket.

**Body:**
```json
{ "priority": 1 }
```

| Valor | Descripción |
|-------|-------------|
| `0` | Normal |
| `1` | Urgente — aparece primero en la lista |

> Emite evento WebSocket: `ticket:updated`

---

#### `PATCH /api/tickets/:id/restore`

Restaura un ticket completado por error de despacho. Lo regresa a estado `in-progress` y los ítems a `pending`.

> Emite evento WebSocket: `ticket:updated`

---

#### `DELETE /api/tickets/:id`

Elimina un ticket permanentemente.

> Emite evento WebSocket: `ticket:deleted`

---

### Consolidación

#### `GET /api/consolidation`

Retorna la suma de cantidades pendientes agrupadas por nombre de ítem.

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `station` | `string` | Filtrar por estación |

**Respuesta `200`:**
```json
[
  { "name": "Hamburguesa Clásica", "total_quantity": 5, "station": "grill" },
  { "name": "Papas Fritas",        "total_quantity": 3, "station": "cold"  }
]
```

---

### Analítica

#### `GET /api/analytics/summary`

KPIs del día actual.

**Respuesta `200`:**
```json
{
  "total_today": 24,
  "completed_today": 20,
  "avg_prep_time_seconds": 387,
  "delayed_count": 2
}
```

> `delayed_count` = tickets activos con más de 10 minutos transcurridos.

---

#### `GET /api/analytics/prep-times`

Tiempo promedio de preparación agrupado por platillo.

**Respuesta `200`:**
```json
[
  {
    "item_name": "Costillas BBQ",
    "station": "grill",
    "avg_seconds": 720,
    "min_seconds": 480,
    "max_seconds": 960,
    "count": 12
  }
]
```

---

#### `GET /api/analytics/peak-hours`

Volumen de pedidos y tiempo promedio por hora del día.

**Respuesta `200`:**
```json
[
  { "hour_of_day": 13, "order_count": 18, "avg_prep_seconds": 420 },
  { "hour_of_day": 14, "order_count": 22, "avg_prep_seconds": 510 }
]
```

---

#### `GET /api/analytics/station-performance`

Rendimiento por estación: volumen, tiempo promedio, cantidad de atrasos.

**Respuesta `200`:**
```json
[
  {
    "station": "grill",
    "total_items": 145,
    "avg_seconds": 540,
    "delayed_count": 8
  }
]
```

---

### Estaciones

#### `GET /api/stations`

Lista todas las estaciones configuradas.

**Respuesta `200`:**
```json
[
  {
    "id": "grill",
    "name": "Grill",
    "label": "Parrilla",
    "color": "#f59e0b",
    "time_alert_yellow": 240,
    "time_alert_red": 480
  }
]
```

---

### Configuración

#### `GET /api/settings`

Retorna la configuración del sistema.

**Respuesta `200`:**
```json
{
  "sound_enabled": "true",
  "sound_new_order": "bell",
  "sound_delayed": "alarm",
  "alert_yellow_default": "300",
  "alert_red_default": "600"
}
```

#### `PATCH /api/settings`

Actualiza una o más configuraciones.

**Body:**
```json
{ "sound_enabled": "false" }
```

> Emite evento WebSocket: `settings:updated`

---

## 8. WebSockets — Eventos en Tiempo Real

La conexión se establece en `http://localhost:4000` usando Socket.IO con transporte `websocket` + fallback `polling`.

### Eventos del servidor → cliente

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `tickets:init` | `Ticket[]` | Al conectar — estado actual completo |
| `ticket:new` | `Ticket` | Al crear un nuevo ticket |
| `ticket:updated` | `Ticket` | Al cambiar estado, prioridad, ítem |
| `ticket:deleted` | `{ id: string }` | Al eliminar un ticket |
| `settings:updated` | `Settings` | Al modificar la configuración |

### Eventos del cliente → servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `subscribe:station` | `string` | Suscribirse a sala de estación específica |

### Ejemplo de conexión desde JavaScript

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('connect', () => console.log('Conectado al KDS'));

socket.on('tickets:init', (tickets) => {
  // Estado inicial al conectar
  renderTickets(tickets);
});

socket.on('ticket:new', (ticket) => {
  // Nuevo pedido llegando de cocina
  addTicketToGrid(ticket);
  playBeepSound();
});

socket.on('ticket:updated', (ticket) => {
  // Ticket modificado (estado, ítem, prioridad)
  updateTicketInGrid(ticket);
});
```

---

## 9. Base de Datos — Esquema

SQLite con modo WAL (Write-Ahead Logging) para concurrencia.

### Tabla `tickets`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `TEXT PK` | UUID v4 |
| `order_number` | `TEXT` | Número visible del pedido (#1042) |
| `table_number` | `TEXT` | Mesa o identificador |
| `order_type` | `TEXT` | `dine-in`, `takeout`, `delivery`, `vip` |
| `station` | `TEXT` | Estación destino principal |
| `status` | `TEXT` | `pending`, `in-progress`, `ready`, `completed` |
| `priority` | `INTEGER` | `0` = normal, `1` = urgente |
| `created_at` | `INTEGER` | Timestamp Unix en ms |
| `started_at` | `INTEGER` | Timestamp de inicio de preparación |
| `completed_at` | `INTEGER` | Timestamp de despacho |
| `notes` | `TEXT` | Nota general del pedido |

### Tabla `ticket_items`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `TEXT PK` | UUID v4 |
| `ticket_id` | `TEXT FK` | Referencia a `tickets.id` |
| `name` | `TEXT` | Nombre del platillo |
| `quantity` | `INTEGER` | Cantidad |
| `station` | `TEXT` | Estación del ítem |
| `status` | `TEXT` | `pending`, `ready` |
| `modifiers` | `TEXT` | JSON Array de modificadores |
| `notes` | `TEXT` | Nota del ítem |
| `started_at` | `INTEGER` | Timestamp de inicio |
| `completed_at` | `INTEGER` | Timestamp de finalización |

### Tabla `stations`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `TEXT PK` | Identificador (`grill`, `cold`, etc.) |
| `name` | `TEXT` | Nombre en inglés |
| `label` | `TEXT` | Nombre en español (mostrado en UI) |
| `color` | `TEXT` | Color hexadecimal |
| `time_alert_yellow` | `INTEGER` | Segundos para alerta amarilla |
| `time_alert_red` | `INTEGER` | Segundos para alerta roja |

### Tabla `analytics_prep_times`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `INTEGER PK` | Auto-increment |
| `ticket_id` | `TEXT` | Ticket de origen |
| `item_name` | `TEXT` | Nombre del platillo |
| `station` | `TEXT` | Estación |
| `prep_time_seconds` | `INTEGER` | Tiempo de preparación en segundos |
| `completed_at` | `INTEGER` | Timestamp de finalización |
| `day_of_week` | `INTEGER` | Día de la semana (0=Dom, 6=Sáb) |
| `hour_of_day` | `INTEGER` | Hora del día (0–23) |

### Tabla `settings`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `key` | `TEXT PK` | Nombre del parámetro |
| `value` | `TEXT` | Valor en texto |

---

## 10. Configuración de Estaciones

Las estaciones se pre-cargan en la base de datos al iniciar el sistema:

| ID | Label | Color | Alerta Amarilla | Alerta Roja |
|----|-------|-------|----------------|-------------|
| `all` | Todas | `#6366f1` | 5 min | 10 min |
| `grill` | Parrilla | `#f59e0b` | 4 min | 8 min |
| `cold` | Frío | `#06b6d4` | 5 min | 10 min |
| `dessert` | Postres | `#ec4899` | 3 min | 6 min |
| `bar` | Bar | `#8b5cf6` | 3 min | 6 min |

Para personalizar los umbrales, editar directamente en la base de datos:

```sql
UPDATE stations SET time_alert_yellow = 180, time_alert_red = 360 WHERE id = 'grill';
```

---

## 11. Integración con POS Real

### Usando cURL

```bash
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "#1042",
    "table_number": "Mesa 5",
    "order_type": "dine-in",
    "priority": 0,
    "notes": "Alérgico al maní",
    "items": [
      {
        "name": "Hamburguesa Clásica",
        "quantity": 2,
        "station": "grill",
        "modifiers": ["Sin cebolla", "Extra queso"]
      },
      {
        "name": "Papas Fritas",
        "quantity": 2,
        "station": "cold"
      },
      {
        "name": "Mojito",
        "quantity": 1,
        "station": "bar"
      }
    ]
  }'
```

### Usando JavaScript / Node.js

```javascript
async function sendOrderToKDS(order) {
  const res = await fetch('http://localhost:4000/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const ticket = await res.json();
  console.log('Ticket creado:', ticket.order_number);
  return ticket;
}

// Ejemplo de uso
sendOrderToKDS({
  order_number: '#2045',
  table_number: 'Mesa 12',
  order_type: 'dine-in',
  items: [
    { name: 'Pizza Margherita', quantity: 1, station: 'grill' },
    { name: 'Tiramisú',         quantity: 2, station: 'dessert' },
  ],
});
```

### Usando Python

```python
import requests

def send_order_to_kds(order: dict) -> dict:
    res = requests.post(
        'http://localhost:4000/api/tickets',
        json=order,
        timeout=5
    )
    res.raise_for_status()
    return res.json()

ticket = send_order_to_kds({
    'order_number': '#3001',
    'order_type': 'delivery',
    'priority': 1,
    'items': [
        {'name': 'Costillas BBQ', 'quantity': 1, 'station': 'grill'},
    ]
})
print(f"Ticket enviado: {ticket['order_number']}")
```

---

## 12. Business Intelligence y Analítica

El sistema registra automáticamente el tiempo de preparación de cada ticket completado.

### Métricas disponibles

| Métrica | Endpoint | Descripción |
|---------|----------|-------------|
| KPIs del día | `GET /api/analytics/summary` | Pedidos, completados, tiempo promedio, atrasos |
| Horas pico | `GET /api/analytics/peak-hours` | Volumen por hora del día |
| Rendimiento por estación | `GET /api/analytics/station-performance` | Velocidad y atrasos por estación |
| Tiempos por platillo | `GET /api/analytics/prep-times` | Ranking de platillos por tiempo de preparación |

### Cómo se calculan los tiempos

- `started_at` se registra cuando el primer cocinero toca "Iniciar" en el ticket
- `completed_at` se registra al marcar el ticket como "Completado / Despachado"
- `prep_time_seconds = (completed_at - started_at) / 1000`

### Consultas SQL útiles

```sql
-- Top 5 platillos más lentos del día
SELECT item_name, ROUND(AVG(prep_time_seconds)/60, 1) AS avg_min
FROM analytics_prep_times
WHERE date(completed_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime')
GROUP BY item_name ORDER BY avg_min DESC LIMIT 5;

-- Horas con más de 15 pedidos (horas pico)
SELECT hour_of_day, COUNT(*) AS pedidos
FROM analytics_prep_times
GROUP BY hour_of_day HAVING pedidos > 15 ORDER BY pedidos DESC;

-- Eficiencia por estación esta semana
SELECT station,
       COUNT(*) AS total,
       ROUND(AVG(prep_time_seconds)/60, 1) AS avg_min,
       COUNT(CASE WHEN prep_time_seconds > 600 THEN 1 END) AS atrasos
FROM analytics_prep_times
WHERE completed_at > strftime('%s','now','-7 days') * 1000
GROUP BY station;
```

---

## 13. Requerimientos del Sistema

### Software

| Componente | Versión |
|------------|---------|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |
| Chrome / Chromium | ≥ 90 (para modo kiosco) |

### Hardware recomendado para cocina

| Componente | Especificación mínima | Recomendado |
|------------|-----------------------|-------------|
| Procesador | Intel Atom / ARM Cortex-A53 | Intel i3 8ª gen o superior |
| RAM | 2 GB | 4 GB |
| Almacenamiento | 16 GB eMMC | 64 GB SSD |
| Pantalla | 15" · 1280×800 · IP54 | 21.5" · 1920×1080 · IP65 |
| Red | Ethernet 100 Mbps | Gigabit Ethernet |
| Sistema Operativo | Ubuntu 20.04 / Windows 10 IoT | Ubuntu 22.04 LTS |

### Montaje

- Soporte VESA 75×75 o 100×100 mm
- Corriente: 12V DC (pantallas industriales) o 220V AC con adaptador
- Protección contra humedad y grasa: IP54 mínimo, IP65 recomendado

---

## 14. Despliegue en Producción

### Opción A: Servidor local en red LAN

```bash
# 1. En el servidor (PC/NUC dedicado):
cd /ruta/a/kds/backend
PORT=4000 node server.js

# 2. Construir el frontend
cd /ruta/a/kds/frontend
NEXT_PUBLIC_API_URL=http://192.168.1.100:4000 npm run build
npm start  # puertoo: 3000

# 3. En las pantallas KDS — abrir el navegador en modo kiosco:
# Linux:
chromium-browser --kiosk http://192.168.1.100:3000

# Windows:
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://192.168.1.100:3000
```

### Opción B: PM2 (proceso persistente)

```bash
npm install -g pm2

# Iniciar backend
pm2 start /ruta/kds/backend/server.js --name kds-backend

# Iniciar frontend (producción)
cd /ruta/kds/frontend && npm run build
pm2 start "npm start" --name kds-frontend

# Guardar y auto-iniciar al reiniciar el sistema
pm2 save
pm2 startup
```

### NGINX como proxy inverso (opcional)

```nginx
server {
    listen 80;
    server_name kds.local;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api/ {
        proxy_pass http://localhost:4000;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 15. Solución de Problemas

### El frontend no se conecta al backend

1. Verifica que el backend esté corriendo: `curl http://localhost:4000/api/stations`
2. Revisa el valor de `NEXT_PUBLIC_API_URL` en `frontend/.env.local`
3. Asegúrate de que el firewall no bloquee el puerto 4000

### Los tickets no aparecen en tiempo real

1. Abre las DevTools del navegador → pestaña Network → filtrar por WS
2. Verifica que exista una conexión WebSocket activa a `ws://localhost:4000/socket.io/`
3. Si usas NGINX, verifica la configuración de `proxy_set_header Upgrade`

### La base de datos SQLite está bloqueada

El modo WAL permite múltiples lectores simultáneos. Si aparece `SQLITE_BUSY`:
```bash
# Verificar que no haya múltiples instancias del backend
ps aux | grep "node server.js"
```

### Error `better-sqlite3` al instalar en ARM (Raspberry Pi)

```bash
cd backend
npm rebuild better-sqlite3 --build-from-source
```

### El sonido no funciona en el navegador

Los navegadores modernos bloquean el audio hasta que el usuario interactúe con la página. Haz clic en cualquier botón de la UI para desbloquear el contexto de audio.

---

## Licencia

MIT — Libre uso, modificación y distribución.
