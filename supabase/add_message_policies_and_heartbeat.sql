-- Database migration to support Chat Heartbeats, Message Editing/Deletion, and Marking Unread
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Add last_seen column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 2. Add UPDATE policy for messages (only sender can edit)
CREATE POLICY "Update own message" ON public.messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- 3. Add DELETE policy for messages (either conversation participant can delete)
CREATE POLICY "Delete message if participant" ON public.messages
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

-- 4. Add INSERT policy for notifications (allows users to notify themselves when marking a chat as unread)
CREATE POLICY "Users can insert own unread chat notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND type = 'message'
    );
