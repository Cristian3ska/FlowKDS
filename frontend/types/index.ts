export type TicketStatus = 'pending' | 'in-progress' | 'ready' | 'completed';
export type ItemStatus = 'pending' | 'ready';
export type OrderType = 'dine-in' | 'takeout' | 'delivery' | 'vip';
export type StationId = string;


export interface TicketItem {
  id: string;
  ticket_id: string;
  name: string;
  quantity: number;
  station: StationId;
  status: ItemStatus;
  modifiers: string[];
  notes?: string;
  started_at?: number;
  completed_at?: number;
}

export interface Ticket {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: OrderType;
  station: StationId;
  status: TicketStatus;
  priority: number;
  manual_order?: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  notes?: string;
  items: TicketItem[];
}

export interface Station {
  id: StationId;
  name: string;
  label: string;
  type: string;
  color: string;
  time_alert_yellow: number;
  time_alert_red: number;
}

export interface ConsolidationItem {
  name: string;
  total_quantity: number;
  station: StationId;
}

export interface AnalyticsPrepTime {
  item_name: string;
  station: string;
  avg_seconds: number;
  min_seconds: number;
  max_seconds: number;
  count: number;
}

export interface PeakHour {
  hour_of_day: number;
  order_count: number;
  avg_prep_seconds: number;
}

export interface StationPerformance {
  station: string;
  total_items: number;
  avg_seconds: number;
  delayed_count: number;
}

export interface AnalyticsSummary {
  total_today: number;
  completed_today: number;
  avg_prep_time_seconds: number;
  delayed_count: number;
  sales_today: number;
}

export interface Settings {
  sound_enabled: string;
  sound_new_order: string;
  sound_delayed: string;
  alert_yellow_default: string;
  alert_red_default: string;
  app_name?: string;
  app_logo?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'root' | 'admin' | 'waiter' | 'kitchen' | 'barista';
  password?: string;
}

export type AlertLevel = 'green' | 'yellow' | 'red';
