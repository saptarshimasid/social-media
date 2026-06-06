"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, UserMinus, UserCheck, MessageSquare, Check, X } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import { insertNotification } from "@/lib/notification-utils";
import Link from "next/link";

type FriendStatus = "not_friends" | "request_sent" | "request_received" | "friends";

interface FriendButtonProps {
  targetUserId: string;
  initialStatus: FriendStatus;
  onStatusChange?: (newStatus: FriendStatus) => void;
  variant?: "default" | "compact";
}

export default function FriendButton({
  targetUserId,
  initialStatus,
  onStatusChange,
  variant = "default",
}: FriendButtonProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<FriendStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const timer = setTimeout(() => setStatus(initialStatus), 0);
    return () => clearTimeout(timer);
  }, [initialStatus]);

  if (!user || user.id === targetUserId) return null;

  const handleFriendAction = async (action: "send" | "cancel" | "accept" | "reject" | "remove") => {
    setLoading(true);
    try {
      if (action === "send") {
        const { error } = await supabase.from("friend_requests").insert({
          sender_id: user.id,
          receiver_id: targetUserId,
          status: "pending",
        });
        if (error) throw error;
        
        // Insert notification for recipient
        await insertNotification({
          user_id: targetUserId,
          sender_id: user.id,
          type: "friend_request",
          target_type: "friend_request",
          target_id: user.id,
        });

        setStatus("request_sent");
        if (onStatusChange) onStatusChange("request_sent");
      } 
      else if (action === "cancel" || action === "reject") {
        // Delete pending request
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`);
        
        if (error) throw error;
        setStatus("not_friends");
        if (onStatusChange) onStatusChange("not_friends");
      } 
      else if (action === "accept") {
        // Update request to accepted
        const { error: reqError } = await supabase
          .from("friend_requests")
          .update({ status: "accepted" })
          .eq("sender_id", targetUserId)
          .eq("receiver_id", user.id);
        
        if (reqError) throw reqError;

        // Add friendship row
        const user_id1 = user.id < targetUserId ? user.id : targetUserId;
        const user_id2 = user.id > targetUserId ? user.id : targetUserId;

        const { error: friendError } = await supabase.from("friendships").insert({
          user_id1,
          user_id2,
        });

        if (friendError) throw friendError;
        
        // Note: Check table name check: we created friendships in the schema, not friendhips. 
        // Wait, did we create 'friendships' or 'friendhips'? Let's check: 
        // In schema.sql: "CREATE TABLE IF NOT EXISTS public.friendships". Yes, friendships!
        // Let's use 'friendships' instead of 'friendhips'.
        
        // Wait! Let's check my code in the database insert.
        // Yes, let's write 'friendships'!

        // Notify user of acceptance
        await insertNotification({
          user_id: targetUserId,
          sender_id: user.id,
          type: "friend_accept",
          target_type: "friend_request",
          target_id: user.id,
        });

        setStatus("friends");
        if (onStatusChange) onStatusChange("friends");
      } 
      else if (action === "remove") {
        // Unfriend: Delete from friendships and requests
        const user_id1 = user.id < targetUserId ? user.id : targetUserId;
        const user_id2 = user.id > targetUserId ? user.id : targetUserId;

        const { error: friendError } = await supabase
          .from("friendships")
          .delete()
          .eq("user_id1", user_id1)
          .eq("user_id2", user_id2);

        if (friendError) throw friendError;

        // Also delete any existing requests
        await supabase
          .from("friend_requests")
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`);

        setStatus("not_friends");
        if (onStatusChange) onStatusChange("not_friends");
      }
    } catch (err) {
      console.error(`Error performing friend action (${action}):`, err);
    } finally {
      setLoading(false);
    }
  };

  const isCompact = variant === "compact";

  if (status === "not_friends") {
    return (
      <button
        onClick={() => handleFriendAction("send")}
        disabled={loading}
        className={`flex items-center gap-1.5 font-semibold transition-all active:scale-95 cursor-pointer rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 ${
          isCompact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm shadow-sm"
        }`}
      >
        <UserPlus size={isCompact ? 14 : 16} />
        <span>Add Friend</span>
      </button>
    );
  }

  if (status === "request_sent") {
    return (
      <button
        onClick={() => handleFriendAction("cancel")}
        disabled={loading}
        className={`flex items-center gap-1.5 font-semibold transition-all border border-border bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer rounded-xl ${
          isCompact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
        }`}
      >
        <UserMinus size={isCompact ? 14 : 16} />
        <span>Cancel</span>
      </button>
    );
  }

  if (status === "request_received") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleFriendAction("accept")}
          disabled={loading}
          className={`flex items-center gap-1 font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer rounded-xl ${
            isCompact ? "p-1.5 text-xs" : "px-3.5 py-2 text-sm shadow-sm"
          }`}
          title="Accept Request"
        >
          {isCompact ? <Check size={14} /> : <>Accept</>}
        </button>
        <button
          onClick={() => handleFriendAction("reject")}
          disabled={loading}
          className={`flex items-center gap-1 font-semibold transition-all border border-border bg-card hover:bg-secondary text-foreground cursor-pointer rounded-xl ${
            isCompact ? "p-1.5 text-xs" : "px-3.5 py-2 text-sm"
          }`}
          title="Reject Request"
        >
          {isCompact ? <X size={14} /> : <>Reject</>}
        </button>
      </div>
    );
  }

  if (status === "friends") {
    return (
      <div className="flex gap-2 items-center">
        {!isCompact && (
          <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold select-none">
            <UserCheck size={16} />
            Friends
          </span>
        )}

        <Link
          href={`/messages?chat=${targetUserId}`}
          className={`flex items-center gap-1.5 font-semibold transition-all border border-border bg-card hover:bg-secondary text-foreground rounded-xl ${
            isCompact ? "p-2" : "px-4 py-2.5 text-sm shadow-sm"
          }`}
          title="Send Message"
        >
          <MessageSquare size={isCompact ? 14 : 16} />
          {!isCompact && <span>Message</span>}
        </Link>

        <button
          onClick={() => handleFriendAction("remove")}
          disabled={loading}
          className={`text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 border border-transparent transition-colors cursor-pointer rounded-xl ${
            isCompact ? "p-2" : "p-2.5 border-border"
          }`}
          title="Unfriend"
        >
          <UserMinus size={16} />
        </button>
      </div>
    );
  }

  return null;
}
