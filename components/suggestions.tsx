"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth, Profile } from "./auth-provider";
import UserAvatar from "./user-avatar";

export default function Suggestions() {
  const { user } = useAuth();
  const [suggestedProfiles, setSuggestedProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const fetchSuggestions = async () => {
      try {
        // Query profiles that are not the current user
        // In a real app we'd exclude existing friends/sent requests, but we'll filter simply for MVP.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .neq("id", user.id)
          .limit(5);

        if (error) throw error;
        setSuggestedProfiles(data || []);
      } catch (err) {
        console.error("Failed to load suggested profiles:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user, supabase]);

  if (!user || suggestedProfiles.length === 0) return null;

  return (
    <aside className="hidden lg:flex flex-col w-80 border-l border-border/40 p-5 gap-4 shrink-0 h-[calc(100vh-4rem)] sticky top-16 bg-background/50 overflow-y-auto">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
        <UserPlus size={16} className="text-primary" />
        <span>People You May Know</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-secondary rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-secondary rounded-md w-3/4" />
                <div className="h-2.5 bg-secondary rounded-md w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {suggestedProfiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 group"
            >
              <Link
                href={`/profile/${p.username}`}
                className="flex items-center gap-3 min-w-0"
              >
                <UserAvatar src={p.profile_picture_url} name={p.full_name} size={38} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate">
                    {p.full_name}
                  </span>
                  <span className="text-[10px] text-muted truncate">
                    @{p.username}
                  </span>
                </div>
              </Link>

              <Link
                href={`/profile/${p.username}`}
                className="p-2.5 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground border border-border/30 transition-all active:scale-95 cursor-pointer"
                title="View profile"
              >
                <UserPlus size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Footer copyright */}
      <div className="text-[10px] text-muted mt-auto pt-4 border-t border-border/30">
        © 2026 SocialConnect. Made with ❤️.
      </div>
    </aside>
  );
}
