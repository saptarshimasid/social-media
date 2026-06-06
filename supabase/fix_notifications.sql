-- Migration: Fix notification RLS policies and enable realtime
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/crmlhrxktfgusbaieurv/sql

-- Step 1: Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Insert own notifications" ON public.notifications;

-- Step 2: Create a more permissive INSERT policy:
--   Any authenticated user can insert notifications
--   (the sender_id must match their uid - they can only send AS themselves)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id         -- sender must be the current user
    AND user_id != sender_id       -- can't notify yourself
  );

-- Step 3: Also ensure the SELECT policy is correct
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
CREATE POLICY "View own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Step 4: Ensure UPDATE policy is correct
DROP POLICY IF EXISTS "Mark own notifications as read" ON public.notifications;
CREATE POLICY "Mark own notifications as read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Step 5: Enable Realtime on notifications table
-- (Required for the real-time badge count updates to work)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Step 6: Add notifications table to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Verify policies are in place
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;
