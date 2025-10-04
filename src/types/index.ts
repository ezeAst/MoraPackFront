export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  airport_code: string;
  city: string;
  country: string;
  current_capacity: number;
  max_capacity: number;
  packages_incoming: number;
  packages_assigned_percentage: number;
  status: 'normal' | 'warning' | 'critical';
  created_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  client_id: string;
  product_quantity: number;
  destination_city: string;
  delivery_date: string;
  status: 'processing' | 'in_transit' | 'completed';
  created_at: string;
}

export interface Flight {
  id: string;
  flight_code: string;
  origin: string;
  origin_code: string;
  destination: string;
  destination_code: string;
  current_packages: number;
  max_capacity: number;
  departure_time: string;
  arrival_time: string;
  status: 'ready' | 'in_transit' | 'delayed' | 'in_progress';
  progress_percentage: number;
  created_at: string;
}

export interface Route {
  id: string;
  order_id: string;
  route_path: string;
  estimated_time_days: number;
  estimated_cost: number;
  created_at: string;
}

export interface Simulation {
  id: string;
  simulation_type: 'weekly' | 'stress_test';
  start_time: string;
  duration_seconds: number;
  status: 'running' | 'completed' | 'paused';
  orders_processed: number;
  flights_completed: number;
  packages_delivered: number;
  packages_pending: number;
  success_rate: number;
  max_warehouse_capacity_used: number;
  flights_cancelled: number;
  created_at: string;
}
