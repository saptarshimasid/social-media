-- Migration: delete_account_rpc
-- Description: Create a function to delete the authenticated user's account from auth.users.
--              Due to ON DELETE CASCADE constraints, this will automatically delete their 
--              profile, posts, comments, relationships, and all associated metadata.
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/crmlhrxktfgusbaieurv/sql

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Ensure the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete account.';
  END IF;

  -- 2. Delete the user from auth.users (cascades database-wide)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
