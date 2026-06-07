-- =========================================================================
-- Migration: fix_relationship_approval
-- Description: Creates a secure handle_relationship_response function
--              running with SECURITY DEFINER to bypass table RLS, 
--              enabling users to approve or decline relationship requests.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_relationship_response(requestor_id UUID, approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rel_status TEXT;
  partner_username TEXT;
BEGIN
  -- 1. Check if a pending request from this requestor to auth.uid() actually exists
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = requestor_id 
      AND relationship_partner_id = auth.uid() 
      AND relationship_approved = FALSE
  ) THEN
    RAISE EXCEPTION 'No pending relationship request found for this user.';
  END IF;

  -- Get request details
  SELECT relationship_status INTO rel_status
  FROM public.profiles
  WHERE id = requestor_id;

  SELECT username INTO partner_username
  FROM public.profiles
  WHERE id = auth.uid();

  IF approve THEN
    -- 2. Approve requestor's profile
    UPDATE public.profiles
    SET relationship_approved = TRUE
    WHERE id = requestor_id;

    -- 3. Update responder's profile (auth.uid()) to match
    UPDATE public.profiles
    SET 
      relationship_status = rel_status,
      relationship_partner_id = requestor_id,
      relationship_approved = TRUE
    WHERE id = auth.uid();

    -- 4. Create a feed post about the event (on behalf of the requestor)
    INSERT INTO public.posts (user_id, content, type)
    VALUES (
      requestor_id,
      'is now ' || (CASE WHEN rel_status = 'married' THEN 'married' ELSE 'engaged' END) || ' to @' || partner_username || '! 💍❤️',
      'text'
    );

    -- 5. Notify the requestor
    INSERT INTO public.notifications (user_id, sender_id, type, target_type, target_id, is_read)
    VALUES (
      requestor_id,
      auth.uid(),
      'friend_accept',
      'relationship_accept',
      auth.uid(),
      FALSE
    );

  ELSE
    -- Decline request: reset requestor's relationship fields
    UPDATE public.profiles
    SET
      relationship_status = NULL,
      relationship_partner_id = NULL,
      relationship_approved = FALSE
    WHERE id = requestor_id;
  END IF;
END;
$$;
