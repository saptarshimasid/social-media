"use client";

import React, { useState } from "react";
import { Settings, LogOut, Sun, Moon, Shield, Calendar, User, Info, Smartphone, Mail, AlertTriangle, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import UserAvatar from "@/components/user-avatar";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase";
import LoadingSpinner from "@/components/loading-spinner";

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile?.username || confirmUsername.toLowerCase() !== profile.username.toLowerCase()) {
      setDeleteError("Username confirmation does not match.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      // 1. Call the delete_user_account RPC
      const { error: rpcError } = await supabase.rpc("delete_user_account");
      if (rpcError) throw rpcError;

      // 2. Log out locally to clear cookies and states
      await signOut();

      // 3. Redirect back to login with a success parameter
      window.location.href = "/login?success=Account successfully deleted";
    } catch (err: any) {
      console.error("Failed to delete account:", err);
      setDeleteError(err.message || "An error occurred while deleting your account.");
      setDeleting(false);
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

        {/* Right Side: Theme & Control Cards */}
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

          {/* Danger Zone */}
          <div className="bg-card border border-rose-500/30 rounded-3xl p-6 shadow-sm glass space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 border-b border-rose-500/20 pb-3">
              <AlertTriangle size={14} className="text-rose-500" />
              Danger Zone
            </h3>
            <p className="text-[11px] text-muted leading-snug">
              Permanently delete your account. This will remove all your profile data, posts, comments, photos, relationships, and is completely irreversible.
            </p>
            <button
              onClick={() => {
                setDeleteError("");
                setConfirmUsername("");
                setIsDeleteModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 h-11 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold rounded-2xl border border-rose-500/30 transition-all cursor-pointer active:scale-95 text-xs animate-pulse hover:animate-none"
            >
              <Trash2 size={14} />
              <span>Delete Account Permanently</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-card border border-border/30 rounded-3xl p-6 shadow-2xl max-w-md w-full glass space-y-4 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-bold text-base text-rose-500 flex items-center gap-2">
                <AlertTriangle size={18} /> Delete Account
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleting}
                className="p-1 rounded-full text-muted hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[11px] text-rose-500 leading-relaxed font-semibold">
                WARNING: This action is permanent and cannot be undone. All your posts, photos, comments, messages, relationships, and account configurations will be completely deleted from our database.
              </div>

              {deleteError && (
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-[11px] text-rose-500 leading-relaxed font-bold">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-muted leading-relaxed">
                Please type your username <span className="font-bold text-foreground">@{profile?.username}</span> to confirm account deletion:
              </p>

              <input
                type="text"
                placeholder={profile?.username || "username"}
                value={confirmUsername}
                onChange={(e) => setConfirmUsername(e.target.value)}
                disabled={deleting}
                className="w-full bg-secondary/60 border border-border/25 rounded-2xl px-3.5 py-2.5 text-xs text-foreground placeholder-muted focus:outline-none focus:border-rose-500/40"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-2xl border border-border hover:bg-secondary font-semibold text-xs text-foreground cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || confirmUsername.toLowerCase() !== profile?.username?.toLowerCase()}
                className="flex-1 py-2.5 bg-rose-500 text-white hover:bg-rose-600 font-semibold text-xs rounded-2xl cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all"
              >
                {deleting ? <LoadingSpinner size={14} /> : <Trash2 size={14} />}
                <span>{deleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
