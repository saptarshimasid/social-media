"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  cover_picture_url: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  created_at: string;
  updated_at: string;
  birth_date: string | null;
  gender: string | null;
  hobbies: string | null;
  relationship_status: string | null;
  relationship_partner_id: string | null;
  relationship_approved: boolean;
  work_history: any[] | null;
  interests: Record<string, string[]> | null;
  address: string | null;
  travel: any[] | null;
  cover_photo_zoom: number | null;
  cover_photo_x: number | null;
  cover_photo_y: number | null;
  profile_photo_zoom: number | null;
  profile_photo_x: number | null;
  profile_photo_y: number | null;
  education: any[] | null;
  online_status: string | null;
}

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (error) {
        if (error.code === "PGRST116") {
          // Profile not found -> user needs onboarding
          setProfile(null);
        } else {
          console.error("Error fetching profile:", error.message);
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const signOut = async () => {
    setLoading(true);
    if (user) {
      await supabase.from("profiles").update({ online_status: "offline" }).eq("id", user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    // Check active session on load
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
