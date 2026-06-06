import { createServerSideClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSideClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Look up profile to determine if they need onboarding
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (!profile) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // On failure, redirect back to login with an error query param
  return NextResponse.redirect(
    new URL("/login?error=Authentication failed", request.url)
  );
}
