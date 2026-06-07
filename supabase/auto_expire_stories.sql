-- Migration: auto_expire_stories
-- Description: Update RLS policies to allow deleting stories older than 24 hours
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/crmlhrxktfgusbaieurv/sql

DROP POLICY IF EXISTS "Delete own stories" ON public.stories;

CREATE POLICY "Delete own or expired stories" ON public.stories
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR created_at < NOW() - INTERVAL '24 hours');
