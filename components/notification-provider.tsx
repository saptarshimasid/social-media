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
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  // 1. Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  }, [user, supabase]);

  // 2. Fetch full list of notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, sender:profiles!notifications_sender_id_fkey(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      setNotifications((data as unknown as DBNotification[]) || []);
      
      // Sync unread count
      const unread = (data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to load notifications list:", err);
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

  // 4. Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  // Setup Real-Time Notifications subscription on mount/user change
  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        setNotifications([]);
        setUnreadCount(0);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Load initial count and list
    const fetchTimer = setTimeout(() => {
      fetchUnreadCount();
    }, 0);

    // Setup channel subscription
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

          // Increment count
          setUnreadCount((prev) => prev + 1);
          
          // Fetch sender info for the new notification row to append it cleanly
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("*")
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

          setNotifications((prev) => [newNotif, ...prev].slice(0, 40));
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

          // Sync read changes
          if (newRow.is_read) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === newRow.id ? { ...n, is_read: true } : n
              )
            );
          }
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(fetchTimer);
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
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
