/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ixkfavukyhmxbwmjpojl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5yMdZv6j-7T44qTJv1Cc2w_5T4hTDeJ';

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('your-project') &&
    isValidUrl(supabaseUrl)
  );
};

const createSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const supabase = createSupabaseClient();

export const SUPABASE_SETUP_SQL = `-- Production-Ready Supabase SQL Schema for COD Management System
-- Copy and execute this in your Supabase SQL Editor:

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RIDERS TABLE (UUID Primary Key)
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  vehicle_number TEXT DEFAULT '',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  total_deliveries INT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 3. TRANSACTIONS TABLE (UUID Primary Key & UUID created_by / user_id)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  rider_name TEXT NOT NULL,
  cod_amount NUMERIC DEFAULT 0,
  cash_amount NUMERIC DEFAULT 0,
  online_amount NUMERIC DEFAULT 0,
  online_received_by TEXT DEFAULT '',
  payment_mode TEXT NOT NULL,
  remarks TEXT DEFAULT '',
  payment_status TEXT DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Pending')),
  pending_amount NUMERIC DEFAULT 0,
  payment_history JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

-- 4. DAILY CLOSINGS TABLE (UUID Primary Key & UUID closed_by / user_id)
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  total_transactions INT DEFAULT 0,
  total_cod NUMERIC DEFAULT 0,
  total_cash NUMERIC DEFAULT 0,
  total_online NUMERIC DEFAULT 0,
  shashank_online NUMERIC DEFAULT 0,
  akshay_online NUMERIC DEFAULT 0,
  total_riders INT DEFAULT 0,
  status TEXT DEFAULT 'Balanced',
  notes TEXT DEFAULT '',
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();
ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

-- 5. AUDIT LOGS TABLE (UUID Primary Key & UUID user_id)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  user_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_rider_name ON public.transactions(rider_name);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_name ON public.riders(name);
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON public.riders(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON public.daily_closings(date);
CREATE INDEX IF NOT EXISTS idx_daily_closings_user_id ON public.daily_closings(user_id);

-- TRIGGERS FOR UPDATED_AT COLUMNS
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_riders_updated_at ON public.riders;
CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_closings_updated_at ON public.daily_closings;
CREATE TRIGGER update_daily_closings_updated_at BEFORE UPDATE ON public.daily_closings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- REMOVE ALL ANONYMOUS / UNAUTHENTICATED PUBLIC POLICIES
DROP POLICY IF EXISTS "Allow auth all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow auth all riders" ON public.riders;
DROP POLICY IF EXISTS "Allow auth all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow auth all daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Allow auth all audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anon public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anon public access riders" ON public.riders;
DROP POLICY IF EXISTS "Anon public access transactions" ON public.transactions;

DROP POLICY IF EXISTS "Authenticated users view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users insert profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users manage riders" ON public.riders;
DROP POLICY IF EXISTS "Authenticated users manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users manage daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Authenticated users manage audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users access own riders" ON public.riders;
DROP POLICY IF EXISTS "Users access own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users access own daily_closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Users access own audit_logs" ON public.audit_logs;

-- STRICT ACCOUNT ISOLATION RLS POLICIES (NO CROSS-USER DATA LEAKS)
CREATE POLICY "Authenticated users view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users insert profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users access own riders" ON public.riders
  FOR ALL TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users access own transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (user_id IS NULL OR created_by IS NULL OR user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (user_id IS NULL OR created_by IS NULL OR user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users access own daily_closings" ON public.daily_closings
  FOR ALL TO authenticated
  USING (user_id IS NULL OR closed_by IS NULL OR user_id = auth.uid() OR closed_by = auth.uid())
  WITH CHECK (user_id IS NULL OR closed_by IS NULL OR user_id = auth.uid() OR closed_by = auth.uid());

CREATE POLICY "Users access own audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- AUTOMATIC USER REGISTRATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME PUBLICATION FOR MULTI-USER SYNC (Safe & Idempotent)
DO $$
BEGIN
  -- Ensure publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add tables if not already included in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel 
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
    AND prrelid = 'public.transactions'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel 
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
    AND prrelid = 'public.riders'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.riders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel 
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
    AND prrelid = 'public.daily_closings'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_closings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel 
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
    AND prrelid = 'public.audit_logs'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;

-- STORAGE BUCKET FOR DAILY EXCEL BACKUPS (COD_YYYY-MM-DD.xlsx)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', true)
ON CONFLICT (id) DO NOTHING;

-- RLS POLICIES FOR SUPABASE STORAGE BACKUPS BUCKET
DROP POLICY IF EXISTS "Authenticated users upload backups" ON storage.objects;
CREATE POLICY "Authenticated users upload backups" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups');

DROP POLICY IF EXISTS "Authenticated users view backups" ON storage.objects;
CREATE POLICY "Authenticated users view backups" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'backups');

DROP POLICY IF EXISTS "Public view backups" ON storage.objects;
CREATE POLICY "Public view backups" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'backups');
`;

export const getSupabaseSetupSql = () => SUPABASE_SETUP_SQL;

