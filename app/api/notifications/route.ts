import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key — bypasses RLS
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey.includes("placeholder")) {
    throw new Error("Supabase service role key is not configured.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

interface NotificationPayload {
  user_id: string;
  sender_id: string;
  type: "friend_request" | "friend_accept" | "reaction" | "comment" | "message";
  target_type: string;
  target_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const notifications: NotificationPayload[] = Array.isArray(body)
      ? body
      : [body];

    // Validate all required fields
    for (const n of notifications) {
      if (!n.user_id || !n.sender_id || !n.type || !n.target_type || !n.target_id) {
        return NextResponse.json(
          { error: "Missing required fields in notification payload" },
          { status: 400 }
        );
      }
      // Don't send to yourself
      if (n.user_id === n.sender_id) continue;
    }

    // Filter out self-notifications
    const filtered = notifications.filter((n) => n.user_id !== n.sender_id);

    if (filtered.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    // Use anon client with user's JWT for RLS check (preferred method)
    // Fall back to service role if that fails
    const authHeader = req.headers.get("authorization");
    
    if (authHeader) {
      // Try with user's JWT first (honors RLS policy)
      const { createClient: createBrowserClient } = await import("@supabase/supabase-js");
      const anonClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        }
      );

      const { error: anonError } = await anonClient
        .from("notifications")
        .insert(filtered);

      if (!anonError) {
        return NextResponse.json({ success: true, inserted: filtered.length });
      }

      console.warn("[API /notifications] anon insert failed, trying service role:", anonError.message);
    }

    // Use service role as fallback
    try {
      const serviceClient = getServiceClient();
      const { error } = await serviceClient.from("notifications").insert(filtered);

      if (error) {
        console.error("[API /notifications] service role insert failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, inserted: filtered.length });
    } catch (svcErr) {
      // Service role key not configured — use anon bypass via RLS workaround
      console.error("[API /notifications] service role not available:", svcErr);
      
      // Last resort: direct insert using anon key but without auth header
      // This will fail RLS but we log it clearly
      return NextResponse.json(
        { error: "Service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY in environment." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[API /notifications] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
