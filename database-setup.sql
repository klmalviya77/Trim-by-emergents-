-- TrimTime Database Schema Setup
-- Run this SQL in your Supabase SQL Editor

-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'barber')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create barber_shops table
CREATE TABLE IF NOT EXISTS barber_shops (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "shopName" TEXT NOT NULL,
  category TEXT NOT NULL,
  "areaName" TEXT NOT NULL,
  "locationLink" TEXT NOT NULL,
  services JSONB DEFAULT '[]'::jsonb,
  "ratingAvg" DECIMAL(3,2) DEFAULT 0,
  "totalReviews" INTEGER DEFAULT 0,
  "bookingsCount" INTEGER DEFAULT 0,
  verify BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "shopId" TEXT NOT NULL REFERENCES barber_shops(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'done', 'cancelled', 'no_show')) DEFAULT 'waiting',
  "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL REFERENCES barber_shops(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  "reviewText" TEXT DEFAULT '',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("shopId", "userId") -- One review per user per shop
);

-- Create queue table (for real-time position tracking)
CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL REFERENCES barber_shops(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'serving', 'done')) DEFAULT 'waiting',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("shopId", "userId") -- One queue position per user per shop
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;

DROP POLICY IF EXISTS "Anyone can read verified shops" ON barber_shops;
DROP POLICY IF EXISTS "Barbers can read their own shops" ON barber_shops;
DROP POLICY IF EXISTS "Allow barber shop creation" ON barber_shops;
DROP POLICY IF EXISTS "Barbers can update their own shops" ON barber_shops;

DROP POLICY IF EXISTS "Users can read their own bookings" ON bookings;
DROP POLICY IF EXISTS "Barbers can read bookings for their shops" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Barbers can update bookings for their shops" ON bookings;

DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;

DROP POLICY IF EXISTS "Users can read their own queue position" ON queue;
DROP POLICY IF EXISTS "Barbers can read queue for their shops" ON queue;
DROP POLICY IF EXISTS "Users can join queue" ON queue;
DROP POLICY IF EXISTS "Barbers can update queue for their shops" ON queue;

-- Create RLS Policies

-- Users table policies
CREATE POLICY "Users can read their own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow user registration" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Barber shops policies (FIXED)
CREATE POLICY "Anyone can read verified shops" ON barber_shops FOR SELECT USING (verify = true OR auth.uid() = "userId");
CREATE POLICY "Barbers can read their own shops" ON barber_shops FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY "Allow barber shop creation" ON barber_shops FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "Barbers can update their own shops" ON barber_shops FOR UPDATE USING (auth.uid() = "userId");

-- Bookings table policies
CREATE POLICY "Users can read their own bookings" ON bookings FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY "Barbers can read bookings for their shops" ON bookings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM barber_shops 
    WHERE id = bookings."shopId" AND "userId" = auth.uid()
  )
);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "Users can update their own bookings" ON bookings FOR UPDATE USING (auth.uid() = "userId");
CREATE POLICY "Barbers can update bookings for their shops" ON bookings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM barber_shops 
    WHERE id = bookings."shopId" AND "userId" = auth.uid()
  )
);

-- Reviews table policies
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "Users can update their own reviews" ON reviews FOR UPDATE USING (auth.uid() = "userId");

-- Queue table policies
CREATE POLICY "Users can read their own queue position" ON queue FOR SELECT USING (auth.uid() = "userId");
CREATE POLICY "Barbers can read queue for their shops" ON queue FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM barber_shops 
    WHERE id = queue."shopId" AND "userId" = auth.uid()
  )
);
CREATE POLICY "Users can join queue" ON queue FOR INSERT WITH CHECK (auth.uid() = "userId");
CREATE POLICY "Barbers can update queue for their shops" ON queue FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM barber_shops 
    WHERE id = queue."shopId" AND "userId" = auth.uid()
  )
);

-- Create indexes for performance (IF NOT EXISTS not supported, so use DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_users_role' AND n.nspname = 'public') THEN
    CREATE INDEX idx_users_role ON users(role);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_users_created' AND n.nspname = 'public') THEN
    CREATE INDEX idx_users_created ON users("createdAt" DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_shops_verify' AND n.nspname = 'public') THEN
    CREATE INDEX idx_shops_verify ON barber_shops(verify);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_shops_area' AND n.nspname = 'public') THEN
    CREATE INDEX idx_shops_area ON barber_shops("areaName");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_shops_category' AND n.nspname = 'public') THEN
    CREATE INDEX idx_shops_category ON barber_shops(category);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_shops_rating' AND n.nspname = 'public') THEN
    CREATE INDEX idx_shops_rating ON barber_shops("ratingAvg" DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_shops_created' AND n.nspname = 'public') THEN
    CREATE INDEX idx_shops_created ON barber_shops("createdAt" DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_bookings_user' AND n.nspname = 'public') THEN
    CREATE INDEX idx_bookings_user ON bookings("userId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_bookings_shop' AND n.nspname = 'public') THEN
    CREATE INDEX idx_bookings_shop ON bookings("shopId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_bookings_status' AND n.nspname = 'public') THEN
    CREATE INDEX idx_bookings_status ON bookings(status);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_bookings_joined' AND n.nspname = 'public') THEN
    CREATE INDEX idx_bookings_joined ON bookings("joinedAt" DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_reviews_shop' AND n.nspname = 'public') THEN
    CREATE INDEX idx_reviews_shop ON reviews("shopId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_reviews_user' AND n.nspname = 'public') THEN
    CREATE INDEX idx_reviews_user ON reviews("userId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_reviews_rating' AND n.nspname = 'public') THEN
    CREATE INDEX idx_reviews_rating ON reviews(rating);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_reviews_created' AND n.nspname = 'public') THEN
    CREATE INDEX idx_reviews_created ON reviews("createdAt" DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_queue_shop' AND n.nspname = 'public') THEN
    CREATE INDEX idx_queue_shop ON queue("shopId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_queue_user' AND n.nspname = 'public') THEN
    CREATE INDEX idx_queue_user ON queue("userId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_queue_position' AND n.nspname = 'public') THEN
    CREATE INDEX idx_queue_position ON queue("shopId", position);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_queue_status' AND n.nspname = 'public') THEN
    CREATE INDEX idx_queue_status ON queue(status);
  END IF;
END $$;

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps (with proper IF NOT EXISTS handling)
DO $$
BEGIN
  -- Users table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_timestamp') THEN
    CREATE TRIGGER update_users_timestamp
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- Barber shops table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shops_timestamp') THEN
    CREATE TRIGGER update_shops_timestamp
      BEFORE UPDATE ON barber_shops
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- Bookings table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_timestamp') THEN
    CREATE TRIGGER update_bookings_timestamp
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- Function to calculate queue position
CREATE OR REPLACE FUNCTION get_queue_position(shop_id TEXT, user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  position INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO position
  FROM bookings
  WHERE "shopId" = shop_id 
    AND status = 'waiting'
    AND "joinedAt" < (
      SELECT "joinedAt" FROM bookings 
      WHERE "shopId" = shop_id AND "userId" = user_id AND status = 'waiting'
    );
  
  RETURN COALESCE(position, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get estimated wait time
CREATE OR REPLACE FUNCTION get_estimated_wait_time(shop_id TEXT, user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  position INTEGER;
  avg_service_time INTEGER := 30; -- Default 30 minutes per customer
BEGIN
  SELECT get_queue_position(shop_id, user_id) INTO position;
  RETURN (position - 1) * avg_service_time;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (optional)
-- Uncomment below if you want sample data

/*
-- Sample verified barber shop
INSERT INTO users (id, email, name, role) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'barber@example.com', 'John Barber', 'barber')
ON CONFLICT (id) DO NOTHING;

INSERT INTO barber_shops (id, "userId", "shopName", category, "areaName", "locationLink", services, verify) VALUES 
  ('shop_sample_1', '550e8400-e29b-41d4-a716-446655440000', 'Modern Cuts', 'Modern Salon', 'Downtown', 'https://maps.google.com/sample', 
   '[{"name": "Haircut", "price": 25}, {"name": "Beard Trim", "price": 15}]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Sample customer
INSERT INTO users (id, email, name, role) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'customer@example.com', 'Jane Customer', 'customer')
ON CONFLICT (id) DO NOTHING;
*/