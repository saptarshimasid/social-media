"use client";

import React, { useEffect } from "react";
import { useNotifications, DBNotification } from "@/components/notification-provider";
import UserAvatar from "@/components/user-avatar";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Heart, MessageSquare, UserPlus, Users, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loading,
  } = useNotifications();

  const router = useRouter();

  // Load notifications list on page load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notif: DBNotification) => {
    // 1. Mark as read
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }

    // 2. Redirect to destination
    if (notif.type === "friend_request" || notif.type === "friend_accept") {
      router.push(`/profile/${notif.sender.username}`);
    } else if (notif.type === "reaction" || notif.type === "comment") {
      // Redirect to home feed or target post/profile
      router.push(`/profile/${notif.sender.username}`);
    } else if (notif.type === "message") {
      router.push(`/messages`);
    }
  };

  const getNotificationDetails = (notif: DBNotification) => {
    switch (notif.type) {
      case "friend_request":
        return {
          text: "sent you a friend request.",
          icon: <UserPlus className="text-blue-500" size={14} />,
        };
      case "friend_accept":
        return {
          text: "accepted your friend request.",
          icon: <Users className="text-emerald-500" size={14} />,
        };
      case "reaction":
        return {
          text: "reacted to your post.",
          icon: <Heart className="text-rose-500" size={14} />,
        };
      case "comment":
        return {
          text: "commented on your post.",
          icon: <MessageSquare className="text-indigo-500" size={14} />,
        };
      case "message":
        return {
          text: "sent you a new message.",
          icon: <MessageSquare className="text-sky-500" size={14} />,
        };
      default:
        return {
          text: "interacted with your profile.",
          icon: <Sparkles className="text-amber-500" size={14} />,
        };
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Panel */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="text-xs text-muted">
              You have {unreadCount} unread alerts.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground cursor-pointer transition-colors"
          >
            <Check size={14} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* List items */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={32} />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const details = getNotificationDetails(n);
            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-3xl border border-border/30 flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all duration-200 group relative ${
                  n.is_read
                    ? "bg-card hover:bg-secondary/40"
                    : "bg-primary/5 hover:bg-primary/10 border-primary/10"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Left: Avatar overlapping icon */}
                  <div className="relative shrink-0">
                    <UserAvatar
                      src={n.sender.profile_picture_url}
                      name={n.sender.full_name}
                      size={44}
                    />
                    <span className="absolute -bottom-1 -right-1 p-1 bg-card rounded-full shadow border border-border/40">
                      {details.icon}
                    </span>
                  </div>

                  {/* Center: Message text */}
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs text-foreground leading-normal">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {n.sender.full_name}
                      </span>{" "}
                      {details.text}
                    </p>
                    <span className="text-[10px] text-muted mt-1 leading-none">
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </span>
                  </div>
                </div>

                {/* Right: Unread Dot indicator */}
                {!n.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 ring-4 ring-primary/20" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="All Caught Up!"
          description="You have no notifications at the moment."
        />
      )}
    </div>
  );
}
