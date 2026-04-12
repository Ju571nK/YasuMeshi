-- YasuMeshi Reports Table Schema
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id text NOT NULL,
  place_name text NOT NULL,
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

-- RLS: enable
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (through API route)
CREATE POLICY "Allow anonymous inserts" ON reports
  FOR INSERT WITH CHECK (true);

-- Only approved reports are readable
CREATE POLICY "Read approved only" ON reports
  FOR SELECT USING (status = 'approved');

-- Index for querying by place
CREATE INDEX idx_reports_place_id ON reports(place_id);
CREATE INDEX idx_reports_status ON reports(status);
