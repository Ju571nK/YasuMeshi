-- YasuMeshi Database Schema
-- Run in Supabase Dashboard > SQL Editor
-- Version 2: places master table + reports

-- ========================================
-- Step 1: Drop old tables (if migrating)
-- ========================================
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS places;

-- ========================================
-- Step 2: Places master table
-- ========================================
CREATE TABLE places (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id text,              -- nullable: user-submitted places won't have this
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  source text NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'user_submitted')),
  created_at timestamptz DEFAULT now()
);

-- Unique constraint on google_place_id (when not null)
CREATE UNIQUE INDEX idx_places_google_id ON places(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX idx_places_source ON places(source);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- Anyone can read places
CREATE POLICY "Read all places" ON places
  FOR SELECT USING (true);

-- Anyone can insert (through API route)
CREATE POLICY "Allow anonymous inserts" ON places
  FOR INSERT WITH CHECK (true);

-- ========================================
-- Step 3: Reports table (references places)
-- ========================================
CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id),
  menu_name text NOT NULL,
  price integer NOT NULL CHECK (price > 0 AND price <= 100000),
  tags text[] DEFAULT '{}',
  reporter_lat double precision NOT NULL,
  reporter_lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_reason text,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (through API route)
CREATE POLICY "Allow anonymous inserts" ON reports
  FOR INSERT WITH CHECK (true);

-- Only approved reports are readable
CREATE POLICY "Read approved only" ON reports
  FOR SELECT USING (status = 'approved');

CREATE INDEX idx_reports_place_id ON reports(place_id);
CREATE INDEX idx_reports_status ON reports(status);
