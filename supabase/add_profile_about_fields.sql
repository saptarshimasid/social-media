-- Migration to add fields for the About section, Zoom/Pan offsets, and Story Music
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Add fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS hobbies TEXT,
ADD COLUMN IF NOT EXISTS relationship_status TEXT,
ADD COLUMN IF NOT EXISTS relationship_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS relationship_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS travel JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cover_photo_zoom NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS cover_photo_x NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cover_photo_y NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_photo_zoom NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS profile_photo_x NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_photo_y NUMERIC DEFAULT 0;

-- 2. Add fields to stories table
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS music_title TEXT,
ADD COLUMN IF NOT EXISTS music_artist TEXT,
ADD COLUMN IF NOT EXISTS music_url TEXT;
