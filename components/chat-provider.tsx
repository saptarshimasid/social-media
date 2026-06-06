"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";

interface ChatPartner {
  id: string;
  full_name: string;
  username: string;
  profile_picture_url: string | null;
  online_status: string | null;
  last_seen?: string | null;
}

type ChatContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activePartner: ChatPartner | null;
  setActivePartner: (partner: ChatPartner | null) => void;
  openChatWith: (partner: any) => void;
  friends: ChatPartner[];
  friendsStatuses: Record<string, string>;
  refreshFriends: () => Promise<void>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activePartner, setActivePartner] = useState<ChatPartner | null>(null);
  const [friends, setFriends] = useState<ChatPartner[]>([]);
  const [friendsStatuses, setFriendsStatuses] = useState<Record<string, string>>({});
  
  const supabase = createClient();
  const accessTokenRef = useRef<string | null>(null);

  // Sync session token for keepalive fetch
  useEffect(() => {
    if (!user) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        accessTokenRef.current = session.access_token;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        accessTokenRef.current = session.access_token;
      } else {
        accessTokenRef.current = null;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, supabase]);

  // Load friends and their online status
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch friendships
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_id1, user_id2")
        .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

      const friendIds = friendships
        ? friendships.map((f) => (f.user_id1 === user.id ? f.user_id2 : f.user_id1))
        : [];

      if (friendIds.length === 0) {
        setFriends([]);
        setFriendsStatuses({});
        return;
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, profile_picture_url, online_status, last_seen")
        .in("id", friendIds);

      if (!error && profiles) {
        const statuses: Record<string, string> = {};
        const list: ChatPartner[] = profiles.map((p) => {
          let status = p.online_status || "offline";
          if (status === "online" && p.last_seen) {
            const lastSeenDate = new Date(p.last_seen);
            const now = new Date();
            // If they haven't sent a heartbeat for more than 75 seconds, mark as offline
            if (now.getTime() - lastSeenDate.getTime() > 75000) {
              status = "offline";
            }
          }
          return {
            id: p.id,
            full_name: p.full_name,
            username: p.username,
            profile_picture_url: p.profile_picture_url,
            online_status: status,
            last_seen: p.last_seen,
          };
        });
        
        list.forEach((p) => {
          statuses[p.id] = p.online_status || "offline";
        });
        
        setFriends(list);
        setFriendsStatuses(statuses);
      }
    } catch (err) {
      console.error("Failed to load friends for chat:", err);
    }
  }, [user, supabase]);

  const openChatWith = (partner: any) => {
    setActivePartner({
      id: partner.id,
      full_name: partner.full_name,
      username: partner.username,
      profile_picture_url: partner.profile_picture_url,
      online_status: partner.online_status || "offline",
    });
    setIsOpen(true);
  };

  // Set initial online status on mount
  useEffect(() => {
    if (!user) return;

    const initializeOnlineStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("online_status")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          // Keep busy state, else set to online
          if (data.online_status !== "busy") {
            await supabase
              .from("profiles")
              .update({ online_status: "online", last_seen: new Date().toISOString() })
              .eq("id", user.id);
          } else {
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", user.id);
          }
        }
      } catch (err) {
        console.error("Failed to set online status:", err);
      }
    };

    initializeOnlineStatus();
    fetchFriends();

    // Heartbeat to update last_seen every 30 seconds
    const heartbeatInterval = setInterval(async () => {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }, 30000);

    // Subscribe to status updates of friends in realtime
    const channel = supabase
      .channel("profiles-realtime-statuses")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.id) {
            let status = updated.online_status || "offline";
            if (status === "online" && updated.last_seen) {
              const lastSeenDate = new Date(updated.last_seen);
              const now = new Date();
              if (now.getTime() - lastSeenDate.getTime() > 75000) {
                status = "offline";
              }
            }

            setFriendsStatuses((prev) => {
              if (prev[updated.id] !== undefined) {
                return { ...prev, [updated.id]: status };
              }
              return prev;
            });
            setFriends((prev) =>
              prev.map((f) =>
                f.id === updated.id
                  ? { ...f, online_status: status, last_seen: updated.last_seen }
                  : f
              )
            );
            // Also update active partner if they are the one updated
            setActivePartner((prevActive) => {
              if (prevActive && prevActive.id === updated.id) {
                return { ...prevActive, online_status: status };
              }
              return prevActive;
            });
          }
        }
      )
      .subscribe();

    // Set user to offline on tab close if desired
    const handleBeforeUnload = () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const token = accessTokenRef.current;
      if (supabaseUrl && supabaseKey && token) {
        const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`;
        fetch(url, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({ online_status: "offline" }),
          keepalive: true
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, supabase, fetchFriends]);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        setIsOpen,
        activePartner,
        setActivePartner,
        openChatWith,
        friends,
        friendsStatuses,
        refreshFriends: fetchFriends,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
