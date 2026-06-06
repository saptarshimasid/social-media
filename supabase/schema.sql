-- ==========================================
-- 1. SETUP FUNCTIONS & SCHEMA DEFINITIONS
-- ==========================================

-- Trigger function to update updated_at columns automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Custom types definitions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
        CREATE TYPE post_type AS ENUM ('text', 'image', 'video', 'reel');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
        CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
        CREATE TYPE reaction_type AS ENUM ('Like', 'Love', 'Care', 'Haha', 'Wow', 'Sad', 'Angry');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('friend_request', 'friend_accept', 'reaction', 'comment', 'message');
    END IF;
END $$;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    bio TEXT,
    profile_picture_url TEXT,
    cover_picture_url TEXT,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    age INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    type post_type NOT NULL DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post Media Table
CREATE TABLE IF NOT EXISTS public.post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'image' or 'video'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reels Table
CREATE TABLE IF NOT EXISTS public.reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_friendship UNIQUE (user_id1, user_id2),
    CONSTRAINT check_user_order CHECK (user_id1 < user_id2)
);

-- Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_request UNIQUE (sender_id, receiver_id),
    CONSTRAINT check_sender_receiver CHECK (sender_id <> receiver_id)
);

-- Reactions Table
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'post', 'reel', 'comment'
    target_id UUID NOT NULL,
    type reaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_reaction UNIQUE (user_id, target_type, target_id)
);

-- Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'post', 'reel'
    target_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- recipient
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- initiator
    type notification_type NOT NULL,
    target_type TEXT NOT NULL, -- 'post', 'friend_request', 'message'
    target_id UUID NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation Participants Table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_participant UNIQUE (conversation_id, user_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type reaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_message_reaction UNIQUE (message_id, user_id)
);

-- ==========================================
-- 3. INDEXES FOR SPEED
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id1 ON public.friendships(user_id1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id2 ON public.friendships(user_id2);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON public.comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- ==========================================
-- 4. TRIGGERS FOR TIMESTAMPS
-- ==========================================
CREATE TRIGGER trigger_update_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_posts BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_reels BEFORE UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_comments BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_conversations BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 6. RLS POLICIES DEFINITIONS
-- ==========================================

-- PROFILES
CREATE POLICY "Public profiles are viewable by authenticated users" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- POSTS (Visible to all authenticated users)
CREATE POLICY "View posts from self and friends" ON public.posts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own posts" ON public.posts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.posts
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.posts
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- POST MEDIA
CREATE POLICY "View post media if post is accessible" ON public.post_media
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.posts WHERE posts.id = post_id
        )
    );

CREATE POLICY "Author can add media" ON public.post_media
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid()
        )
    );

-- REELS (Public read to authenticated users)
CREATE POLICY "Reels viewable by authenticated" ON public.reels
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can post reels" ON public.reels
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their reels" ON public.reels
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FRIENDSHIPS
CREATE POLICY "View own friendships" ON public.friendships
    FOR SELECT TO authenticated USING (user_id1 = auth.uid() OR user_id2 = auth.uid());

CREATE POLICY "Add friendship on accepted requests" ON public.friendships
    FOR INSERT TO authenticated WITH CHECK (user_id1 = auth.uid() OR user_id2 = auth.uid());

CREATE POLICY "Delete friendship" ON public.friendships
    FOR DELETE TO authenticated USING (user_id1 = auth.uid() OR user_id2 = auth.uid());

-- FRIEND REQUESTS
CREATE POLICY "View requests sent or received" ON public.friend_requests
    FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Create request as sender" ON public.friend_requests
    FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receiver can accept/reject requests" ON public.friend_requests
    FOR UPDATE TO authenticated USING (receiver_id = auth.uid());

CREATE POLICY "Delete requests" ON public.friend_requests
    FOR DELETE TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- REACTIONS
CREATE POLICY "Reactions are viewable" ON public.reactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert own reactions" ON public.reactions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own reactions" ON public.reactions
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Delete own reactions" ON public.reactions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- COMMENTS
CREATE POLICY "Comments are viewable" ON public.comments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create comment as self" ON public.comments
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Edit own comment" ON public.comments
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Delete own comment" ON public.comments
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "View own notifications" ON public.notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Mark own notifications as read" ON public.notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = sender_id     -- can only send as yourself
        AND user_id != sender_id   -- cannot notify yourself
    );

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- CONVERSATIONS
CREATE POLICY "View conversations involved in" ON public.conversations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Create conversation" ON public.conversations
    FOR INSERT TO authenticated WITH CHECK (true);

-- CONVERSATION PARTICIPANTS
CREATE POLICY "View conversation participants" ON public.conversation_participants
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Add participants" ON public.conversation_participants
    FOR INSERT TO authenticated WITH CHECK (true);

-- MESSAGES (Only accessible/creatable by participants)
CREATE POLICY "View messages if participant" ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Send message if friend and participant" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

-- MESSAGE REACTIONS
CREATE POLICY "View message reactions if participant" ON public.message_reactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
            WHERE m.id = message_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Add own reactions to messages" ON public.message_reactions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Remove own reactions from messages" ON public.message_reactions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- STORIES
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image', -- 'image', 'video'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View stories" ON public.stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add own stories" ON public.stories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own stories" ON public.stories FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST TAGS
CREATE TABLE IF NOT EXISTS public.post_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_tag UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View post tags" ON public.post_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add post tags if author" ON public.post_tags FOR INSERT TO authenticated 
    WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid()));
CREATE POLICY "Delete post tags if author" ON public.post_tags FOR DELETE TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.user_id = auth.uid()));

-- GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_picture_url TEXT,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View groups" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create group" ON public.groups FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Update own group" ON public.groups FOR UPDATE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Delete own group" ON public.groups FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'member', 'admin'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View group members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Join group" ON public.group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or remove member" ON public.group_members FOR DELETE TO authenticated 
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups WHERE groups.id = group_id AND groups.creator_id = auth.uid()));

-- ALTER POSTS TABLE FOR GROUPS SUPPORT
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- UPDATE POSTS INSERT POLICY TO SUPPORT GROUP MEMBERSHIP CHECK
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert posts" ON public.posts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND (
            group_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.group_members 
                WHERE group_id = posts.group_id AND user_id = auth.uid()
            )
        )
    );

-- MARKETPLACE PRODUCTS
CREATE TABLE IF NOT EXISTS public.marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT NOT NULL, -- 'cars', 'flats', 'clothing', 'electronics', 'others'
    image_url TEXT NOT NULL,
    owner_phone TEXT,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View marketplace products" ON public.marketplace_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create marketplace product" ON public.marketplace_products FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own product" ON public.marketplace_products FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Delete own product" ON public.marketplace_products FOR DELETE TO authenticated USING (owner_id = auth.uid());
