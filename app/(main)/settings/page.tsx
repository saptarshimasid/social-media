"use client";

import React from "react";
import { Settings, LogOut, Sun, Moon, Shield, Calendar, User, Info, Smartphone, Mail } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import UserAvatar from "@/components/user-avatar";
import { format } from "date-fns";

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const joinedDate = profile?.created_at
    ? format(new Date(profile.created_at), "MMMM d, yyyy")
    : "Recently Joined";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex items-center gap-3 select-none">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Settings & Preferences
          </h1>
          <p className="text-xs text-muted">
            Manage your account options, personal information, and app preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Account Info Card */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile overview card */}
          {profile && (
            <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass flex items-center gap-4">
              <UserAvatar
                src={profile.profile_picture_url}
                name={profile.full_name}
                size={64}
                className="border-2 border-primary/20 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-md font-bold text-foreground truncate">
                  {profile.full_name}
                </h2>
                <p className="text-xs text-muted truncate">
                  @{profile.username}
                </p>
                <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-muted">
                  <Calendar size={12} className="text-primary" />
                  <span>Joined {joinedDate}</span>
                </div>
              </div>
            </div>
          )}

          {/* Account Details Box */}
          <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/40 pb-3">
              <User size={14} className="text-primary" />
              Account Details
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-muted flex items-center gap-1.5">
                  <Smartphone size={14} />
                  Phone Number
                </span>
                <span className="font-bold text-foreground">
                  {profile?.phone || user?.phone || "Not linked"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-muted flex items-center gap-1.5">
                  <Mail size={14} />
                  Email Address
                </span>
                <span className="font-bold text-foreground">
                  {profile?.email || user?.email || "Not linked"}
                </span>
              </div>

              <div className="flex flex-col justify-start gap-1 text-xs">
                <span className="font-semibold text-muted">Bio Details</span>
                <span className="text-foreground leading-relaxed mt-1 block bg-secondary/30 p-3.5 border border-border/30 rounded-2xl italic">
                  {profile?.bio || "No biography provided yet."}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Access Policies Box */}
          <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/40 pb-3">
              <Shield size={14} className="text-primary" />
              Security & Privacy
            </h3>
            <p className="text-[11px] text-muted leading-relaxed">
              SocialConnect employs end-to-end security measures. All PostgreSQL tables are secured via Row Level Security (RLS). You only see posts from users with whom you share established friendships.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
              <Shield size={14} />
              <span>Row Level Security (RLS) Active & Verified</span>
            </div>
          </div>
        </div>

        {/* Right Side: Theme & Sign Out Control Cards */}
        <div className="space-y-6">
          {/* Theme Preferences */}
          <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/40 pb-3">
              <Info size={14} className="text-primary" />
              Appearance
            </h3>
            
            <p className="text-[11px] text-muted leading-tight">
              Select your color preference for SocialConnect. Light theme is optimized for daytime use, while Dark theme reduces eye strain in darker environments.
            </p>

            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <button
                onClick={() => {
                  if (theme === "dark") toggleTheme();
                }}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  theme === "light"
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:bg-secondary text-foreground"
                }`}
              >
                <Sun size={20} />
                <span className="text-[11px] font-bold">Light Mode</span>
              </button>

              <button
                onClick={() => {
                  if (theme === "light") toggleTheme();
                }}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:bg-secondary text-foreground"
                }`}
              >
                <Moon size={20} />
                <span className="text-[11px] font-bold">Dark Mode</span>
              </button>
            </div>
          </div>

          {/* System Control Options */}
          <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/40 pb-3">
              <LogOut size={14} className="text-primary" />
              System Actions
            </h3>
            <p className="text-[11px] text-muted leading-snug">
              Securely sign out of the active session. This will clear client cookies and cookies stored in your browser local storage.
            </p>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 h-11 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all cursor-pointer active:scale-95 shadow-md shadow-rose-500/10 text-xs"
            >
              <LogOut size={14} />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
