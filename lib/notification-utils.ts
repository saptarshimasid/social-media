import { createClient } from "@/lib/supabase";

type NotificationType = "friend_request" | "friend_accept" | "reaction" | "comment" | "message";

interface NotificationPayload {
  user_id: string;       // recipient
  sender_id: string;     // who triggered it
  type: NotificationType;
  target_type: string;   // 'post', 'friend_request', 'message', 'tag'
  target_id: string;     // UUID of the target object
}

/**
 * Inserts a notification row safely, logging any errors without throwing.
 * This ensures notification failures never break the main user action.
 */
export async function insertNotification(payload: NotificationPayload): Promise<void> {
  // Don't send a notification to yourself
  if (payload.user_id === payload.sender_id) return;

  const supabase = createClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: payload.user_id,
    sender_id: payload.sender_id,
    type: payload.type,
    target_type: payload.target_type,
    target_id: payload.target_id,
  });

  if (error) {
    console.error("[Notification] Failed to insert notification:", error.message, {
      payload,
    });
  }
}

/**
 * Inserts multiple notifications in a single batch call.
 */
export async function insertNotifications(payloads: NotificationPayload[]): Promise<void> {
  if (payloads.length === 0) return;

  const supabase = createClient();

  // Filter out self-notifications
  const filtered = payloads.filter((p) => p.user_id !== p.sender_id);
  if (filtered.length === 0) return;

  const { error } = await supabase.from("notifications").insert(filtered);

  if (error) {
    console.error("[Notification] Failed to batch insert notifications:", error.message, {
      count: filtered.length,
    });
  }
}
