"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";

export interface DBNotification {
  id: string;
  user_id: string;
  sender_id: string;
  type: "friend_request" | "friend_accept" | "reaction" | "comment" | "message";
  target_type: string;
  target_id: string;
  is_read: boolean;
  created_at: string;
  sender: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

type NotificationContextType = {
  notifications: DBNotification[];
  unreadCount: number;
  unreadChatCount: number;
  chatNotifications: DBNotification[];
  fetchNotifications: () => Promise<void>;
  fetchUnreadChatNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markChatAsRead: (senderId: string) => Promise<void>;
  markChatAsUnread: (senderId: string, conversationId?: string) => Promise<void>;
  loading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatNotifications, setChatNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  // 1. Fetch unread counts (normal and chat)
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count: normalCount, error: normalErr } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .neq("type", "message");

      if (!normalErr) {
        setUnreadCount(normalCount || 0);
      }

      const { count: chatCount, error: chatErr } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .eq("type", "message");

      if (!chatErr) {
        setUnreadChatCount(chatCount || 0);
      }
    } catch (err) {
      console.error("Failed to load unread counts:", err);
    }
  }, [user, supabase]);

  // 1b. Fetch unread chat notifications list
  const fetchUnreadChatNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, sender:profiles!notifications_sender_id_fkey(*)")
        .eq("user_id", user.id)
        .eq("type", "message")
        .eq("is_read", false);

      if (!error && data) {
        setChatNotifications(data as unknown as DBNotification[]);
        setUnreadChatCount(data.length);
      }
    } catch (err) {
      console.error("Failed to fetch unread chat notifications:", err);
    }
  }, [user, supabase]);

  // 2. Fetch full list of normal notifications (excluding chats)
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, sender:profiles!notifications_sender_id_fkey(*)")
        .eq("user_id", user.id)
        .neq("type", "message")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      setNotifications((data as unknown as DBNotification[]) || []);
      
      const unread = (data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to load normal notifications list:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // 3. Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // 3b. Mark chat notifications from a specific sender as read
  const markChatAsRead = useCallback(async (senderId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("sender_id", senderId)
        .eq("type", "message")
        .eq("is_read", false);

      if (error) throw error;

      setChatNotifications((prev) => prev.filter((n) => n.sender_id !== senderId));
      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark chat notifications as read:", err);
    }
  }, [user, supabase, fetchUnreadCount]);

  // 3c. Mark chat notifications from a specific sender as unread
  const markChatAsUnread = useCallback(async (senderId: string, conversationId?: string) => {
    if (!user) return;
    try {
      let activeConvId = conversationId;

      // If no conversation ID, try to query one
      if (!activeConvId) {
        const { data: userConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        const convIds = (userConvs || []).map((c) => c.conversation_id);

        if (convIds.length > 0) {
          const { data: partnerConv } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .neq("user_id", user.id)
            .eq("user_id", senderId)
            .in("conversation_id", convIds)
            .maybeSingle();

          if (partnerConv) {
            activeConvId = partnerConv.conversation_id;
          }
        }
      }

      const targetConvId = activeConvId || window.crypto.randomUUID();

      // Find the latest message notification from this sender to see if we can update it
      const { data: existing, error: findErr } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("sender_id", senderId)
        .eq("type", "message")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!findErr && existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from("notifications")
          .update({ is_read: false })
          .eq("id", existing[0].id);

        if (updateErr) throw updateErr;
      } else {
        // Otherwise, insert a new notification for ourselves
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            sender_id: senderId,
            type: "message",
            target_type: "message",
            target_id: targetConvId,
            is_read: false,
          });

        if (insertErr) throw insertErr;
      }

      fetchUnreadCount();
      fetchUnreadChatNotifications();
    } catch (err) {
      console.error("Failed to mark chat as unread:", err);
    }
  }, [user, supabase, fetchUnreadCount, fetchUnreadChatNotifications]);

  // 4. Mark all normal notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .neq("type", "message")
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  // Check if today is the birthday of any friend, and trigger notifications
  const checkBirthdays = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch friendships
      const { data: friendships, error: friendErr } = await supabase
        .from("friendships")
        .select("user_id1, user_id2")
        .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

      if (friendErr || !friendships) return;

      const friendIds = friendships.map((f) =>
        f.user_id1 === user.id ? f.user_id2 : f.user_id1
      );

      if (friendIds.length === 0) return;

      // 2. Fetch friends' profiles to check birth dates
      const { data: friendsProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, birth_date")
        .in("id", friendIds);

      if (!friendsProfiles) return;

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();

      const birthdayFriends = friendsProfiles.filter((p) => {
        if (!p.birth_date) return false;
        const bday = new Date(p.birth_date);
        return bday.getMonth() === currentMonth && bday.getDate() === currentDay;
      });

      if (birthdayFriends.length === 0) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 3. For each birthday friend, check if notification exists for today
      for (const friend of birthdayFriends) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("sender_id", friend.id)
          .eq("target_type", "birthday")
          .gte("created_at", todayStart.toISOString());

        if (!existing || existing.length === 0) {
          // Create a birthday notification
          await supabase.from("notifications").insert({
            user_id: user.id,
            sender_id: friend.id,
            type: "comment",
            target_type: "birthday",
            target_id: friend.id,
            is_read: false,
          });
        }
      }
    } catch (err) {
      console.error("Failed to run birthday check:", err);
    }
  }, [user, supabase]);

  // Setup Real-Time Notifications subscription on mount/user change
  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        setNotifications([]);
        setUnreadCount(0);
        setUnreadChatCount(0);
        setChatNotifications([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Load initial counts, lists, and check birthdays immediately
    fetchUnreadCount();
    fetchNotifications();
    fetchUnreadChatNotifications();
    checkBirthdays();

    // Polling fallback every 8 seconds for reliability
    const pollInterval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications();
      fetchUnreadChatNotifications();
    }, 8000);

    // Setup realtime channel subscription
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          const newRow = payload.new as {
            id: string;
            user_id: string;
            sender_id: string;
            type: "friend_request" | "friend_accept" | "reaction" | "comment" | "message";
            target_type: string;
            target_id: string;
            is_read: boolean;
            created_at: string;
          };

          // Fetch sender profile to enrich the notification
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name, username, profile_picture_url")
            .eq("id", newRow.sender_id)
            .single();

          const newNotif: DBNotification = {
            id: newRow.id,
            user_id: newRow.user_id,
            sender_id: newRow.sender_id,
            type: newRow.type,
            target_type: newRow.target_type,
            target_id: newRow.target_id,
            is_read: newRow.is_read,
            created_at: newRow.created_at,
            sender: senderProfile || {
              full_name: "Someone",
              username: "user",
              profile_picture_url: null,
            },
          };

          if (newRow.type === "message") {
            setUnreadChatCount((prev) => prev + 1);
            setChatNotifications((prev) => [newNotif, ...prev]);
          } else {
            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => [newNotif, ...prev].slice(0, 40));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newRow = payload.new as {
            id: string;
            is_read: boolean;
          };

          if (newRow.is_read) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === newRow.id ? { ...n, is_read: true } : n
              )
            );
            setChatNotifications((prev) => prev.filter((n) => n.id !== newRow.id));
          }
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Re-fetch on reconnect to catch any missed notifications
          fetchUnreadCount();
          fetchNotifications();
          fetchUnreadChatNotifications();
        }
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUnreadCount, fetchNotifications, fetchUnreadChatNotifications, checkBirthdays]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadChatCount,
        chatNotifications,
        fetchNotifications,
        fetchUnreadChatNotifications,
        markAsRead,
        markAllAsRead,
        markChatAsRead,
        markChatAsUnread,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
