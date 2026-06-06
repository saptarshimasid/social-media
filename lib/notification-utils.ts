import { createClient } from "@/lib/supabase";

type NotificationType = "friend_request" | "friend_accept" | "reaction" | "comment" | "message";

export interface NotificationPayload {
  user_id: string;       // recipient
  sender_id: string;     // who triggered it
  type: NotificationType;
  target_type: string;   // 'post', 'friend_request', 'message', 'tag'
  target_id: string;     // UUID of the target object
}

/**
 * Inserts a single notification via the server API route (bypasses RLS issues).
 * Falls back to direct Supabase insert if the API call fails.
 */
export async function insertNotification(payload: NotificationPayload): Promise<void> {
  if (payload.user_id === payload.sender_id) return;
  await insertNotifications([payload]);
}

/**
 * Inserts multiple notifications via the server API route.
 * Falls back to direct Supabase insert if the API call fails.
 */
export async function insertNotifications(payloads: NotificationPayload[]): Promise<void> {
  if (payloads.length === 0) return;

  const filtered = payloads.filter((p) => p.user_id !== p.sender_id);
  if (filtered.length === 0) return;

  // Get the current session token to send to the API
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Method 1: Call the server API route (uses JWT + service role fallback)
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers,
      body: JSON.stringify(filtered),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[Notification] Inserted ${data.inserted} notification(s) via API`);
      return;
    }

    const errBody = await res.text();
    console.warn("[Notification] API route failed:", res.status, errBody);
  } catch (fetchErr) {
    console.warn("[Notification] API fetch failed:", fetchErr);
  }

  // Method 2: Direct Supabase insert with the authenticated client
  console.log("[Notification] Falling back to direct Supabase insert...");
  try {
    const { error } = await supabase.from("notifications").insert(filtered);
    if (error) {
      console.error("[Notification] Direct insert also failed:", error.message, {
        hint: error.hint,
        code: error.code,
        details: error.details,
      });
    } else {
      console.log(`[Notification] Fallback insert succeeded for ${filtered.length} notification(s)`);
    }
  } catch (err) {
    console.error("[Notification] Unexpected error:", err);
  }
}
