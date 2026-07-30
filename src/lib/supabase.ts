/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('your-project')
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const SUPABASE_SETUP_SQL = `-- Supabase SQL Schema for COD Management System
-- Copy and execute this in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_number TEXT,
  status TEXT DEFAULT 'Active',
  total_deliveries INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  rider_name TEXT NOT NULL,
  cod_amount NUMERIC DEFAULT 0,
  cash_amount NUMERIC DEFAULT 0,
  online_amount NUMERIC DEFAULT 0,
  online_received_by TEXT DEFAULT '',
  payment_mode TEXT NOT NULL,
  remarks TEXT DEFAULT '',
  payment_status TEXT DEFAULT 'Paid',
  pending_amount NUMERIC DEFAULT 0,
  payment_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  total_transactions INT DEFAULT 0,
  total_cod NUMERIC DEFAULT 0,
  total_cash NUMERIC DEFAULT 0,
  total_online NUMERIC DEFAULT 0,
  shashank_online NUMERIC DEFAULT 0,
  akshay_online NUMERIC DEFAULT 0,
  total_riders INT DEFAULT 0,
  status TEXT DEFAULT 'Balanced',
  notes TEXT,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  user_email TEXT,
  user_role TEXT
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users read/write
CREATE POLICY "Allow auth all profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow auth all riders" ON public.riders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow auth all transactions" ON public.transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow auth all daily_closings" ON public.daily_closings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow auth all audit_logs" ON public.audit_logs FOR ALL USING (auth.role() = 'authenticated');

-- Handle new auth user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), COALESCE(new.raw_user_meta_data->>'role', 'Staff'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime Publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.transactions, public.riders, public.daily_closings, public.audit_logs;
COMMIT;
`;

export const getSupabaseSetupSql = () => SUPABASE_SETUP_SQL;

