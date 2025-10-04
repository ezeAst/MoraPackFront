/*
  # MoraPack Logistics Management System - Database Schema

  ## New Tables Created
  
  1. **clients** - Customer information
     - id (uuid, primary key)
     - first_name (text) - Client's first name
     - last_name (text) - Client's last name
     - birth_date (date) - Client's date of birth
     - email (text, unique) - Client's email address
     - phone (text) - Client's phone number
     - created_at (timestamptz) - Record creation timestamp
  
  2. **warehouses** - Warehouse locations and capacity
     - id (uuid, primary key)
     - name (text) - Warehouse name (e.g., "Aeropuerto de Lima")
     - airport_code (text) - IATA airport code (e.g., "LIM")
     - city (text) - City name
     - country (text) - Country name
     - current_capacity (integer) - Current packages stored
     - max_capacity (integer) - Maximum capacity
     - packages_incoming (integer) - Packages expected to arrive
     - packages_assigned_percentage (numeric) - Percentage of packages assigned to flights
     - status (text) - Status: 'normal', 'warning', 'critical'
     - created_at (timestamptz)
  
  3. **orders** - Customer orders/shipments
     - id (uuid, primary key)
     - order_code (text, unique) - Order identifier (e.g., "MPE-001")
     - client_id (uuid, foreign key) - Reference to clients table
     - product_quantity (integer) - Number of MPE products
     - destination_city (text) - Destination city
     - delivery_date (date) - Expected delivery date
     - status (text) - Status: 'processing', 'in_transit', 'completed'
     - created_at (timestamptz)
  
  4. **flights** - Flight information
     - id (uuid, primary key)
     - flight_code (text, unique) - Flight identifier (e.g., "VUELO-001")
     - origin (text) - Origin location
     - origin_code (text) - Origin airport code
     - destination (text) - Destination location
     - destination_code (text) - Destination airport code
     - current_packages (integer) - Current package count
     - max_capacity (integer) - Maximum package capacity
     - departure_time (timestamptz) - Scheduled departure time
     - arrival_time (timestamptz) - Scheduled arrival time
     - status (text) - Status: 'ready', 'in_transit', 'delayed', 'in_progress'
     - progress_percentage (integer) - Flight progress (0-100)
     - created_at (timestamptz)
  
  5. **routes** - Optimal routes calculated
     - id (uuid, primary key)
     - order_id (uuid, foreign key) - Reference to orders table
     - route_path (text) - Route description (e.g., "Lima → Bruselas → Baku")
     - estimated_time_days (numeric) - Estimated time in days
     - estimated_cost (numeric) - Estimated cost in dollars
     - created_at (timestamptz)
  
  6. **simulations** - Simulation runs
     - id (uuid, primary key)
     - simulation_type (text) - Type: 'weekly', 'stress_test'
     - start_time (timestamptz) - Simulation start time
     - duration_seconds (integer) - Duration in seconds
     - status (text) - Status: 'running', 'completed', 'paused'
     - orders_processed (integer) - Number of orders processed
     - flights_completed (integer) - Number of flights completed
     - packages_delivered (integer) - Number of packages delivered
     - packages_pending (integer) - Number of packages still pending
     - success_rate (numeric) - Success rate percentage
     - max_warehouse_capacity_used (numeric) - Maximum warehouse capacity percentage used
     - flights_cancelled (integer) - Number of cancelled flights
     - created_at (timestamptz)
  
  ## Security
  
  - Enable RLS on all tables
  - Add policies for public access (for demo purposes)
  - In production, these should be restricted to authenticated users with appropriate roles
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,
  email text UNIQUE NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to clients"
  ON clients FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to clients"
  ON clients FOR INSERT
  TO public
  WITH CHECK (true);

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  airport_code text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  current_capacity integer DEFAULT 0,
  max_capacity integer NOT NULL,
  packages_incoming integer DEFAULT 0,
  packages_assigned_percentage numeric DEFAULT 0,
  status text DEFAULT 'normal',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to warehouses"
  ON warehouses FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public update to warehouses"
  ON warehouses FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id),
  product_quantity integer NOT NULL,
  destination_city text NOT NULL,
  delivery_date date NOT NULL,
  status text DEFAULT 'processing',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to orders"
  ON orders FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to orders"
  ON orders FOR INSERT
  TO public
  WITH CHECK (true);

-- Create flights table
CREATE TABLE IF NOT EXISTS flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_code text UNIQUE NOT NULL,
  origin text NOT NULL,
  origin_code text NOT NULL,
  destination text NOT NULL,
  destination_code text NOT NULL,
  current_packages integer DEFAULT 0,
  max_capacity integer NOT NULL,
  departure_time timestamptz NOT NULL,
  arrival_time timestamptz NOT NULL,
  status text DEFAULT 'ready',
  progress_percentage integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to flights"
  ON flights FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to flights"
  ON flights FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to flights"
  ON flights FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  route_path text NOT NULL,
  estimated_time_days numeric NOT NULL,
  estimated_cost numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to routes"
  ON routes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to routes"
  ON routes FOR INSERT
  TO public
  WITH CHECK (true);

-- Create simulations table
CREATE TABLE IF NOT EXISTS simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_type text NOT NULL,
  start_time timestamptz NOT NULL,
  duration_seconds integer DEFAULT 0,
  status text DEFAULT 'running',
  orders_processed integer DEFAULT 0,
  flights_completed integer DEFAULT 0,
  packages_delivered integer DEFAULT 0,
  packages_pending integer DEFAULT 0,
  success_rate numeric DEFAULT 0,
  max_warehouse_capacity_used numeric DEFAULT 0,
  flights_cancelled integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to simulations"
  ON simulations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to simulations"
  ON simulations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to simulations"
  ON simulations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);