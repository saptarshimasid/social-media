"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import LoadingSpinner from "@/components/loading-spinner";
import { CheckCircle2, AlertCircle } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. Check if there is a 'code' parameter in the query URL (PKCE flow)
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // 2. Wait a small moment to let Supabase client parse hash fragments (Implicit flow)
        // or retrieve the session if already set.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session?.user) {
          // Check if there are error parameters in the URL (e.g. from failed confirmation)
          const errorCode = searchParams.get("error_code");
          const errorDesc = searchParams.get("error_description");
          if (errorCode || errorDesc) {
            throw new Error(errorDesc || `Auth error: ${errorCode}`);
          }
          throw new Error("No active session found. Please sign in again.");
        }

        const user = session.user;

        // 3. Look up profile to determine if they need onboarding
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile check error:", profileError);
        }

        setStatus("success");
        
        // Redirect logic
        setTimeout(() => {
          if (!profile) {
            router.push("/onboarding");
          } else {
            router.push("/");
          }
          router.refresh();
        }, 1500);

      } catch (err: any) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Authentication failed. Please try signing in again.");
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(err.message || "Authentication failed")}`);
        }, 4000);
      }
    };

    handleCallback();
  }, [searchParams, router, supabase]);

  return (
    <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/40 shadow-xl glass text-center space-y-4">
      {status === "verifying" && (
        <div className="flex flex-col items-center space-y-3">
          <LoadingSpinner size={32} />
          <h2 className="text-lg font-bold text-foreground">Confirming your email...</h2>
          <p className="text-xs text-muted">Please wait while we establish your secure session.</p>
        </div>
      )}
      {status === "success" && (
        <div className="flex flex-col items-center space-y-3">
          <CheckCircle2 size={48} className="text-emerald-500 animate-bounce" />
          <h2 className="text-lg font-bold text-foreground">Email Confirmed!</h2>
          <p className="text-xs text-muted">Redirecting you to the app...</p>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center space-y-3">
          <AlertCircle size={48} className="text-rose-500 animate-pulse" />
          <h2 className="text-lg font-bold text-foreground">Authentication Error</h2>
          <p className="text-xs text-rose-500 font-semibold">{errorMsg}</p>
          <p className="text-[10px] text-muted font-medium">Returning you to the login page...</p>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/40 shadow-xl glass text-center space-y-4">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinner size={32} />
            <h2 className="text-lg font-bold text-foreground">Loading...</h2>
          </div>
        </div>
      }>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
