"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import LoadingSpinner from "@/components/loading-spinner";
import EmptyState from "@/components/empty-state";
import { ArrowLeft, User, FileText, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface EditProfilePageProps {
  params: Promise<{ username: string }>;
}

export default function EditProfilePage({ params }: EditProfilePageProps) {
  const { username } = use(params);
  const { user, profile, refreshProfile } = useAuth();
  
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!profile) {
      const timer = setTimeout(() => setChecking(false), 0);
      return () => clearTimeout(timer);
    }

    // Check if the username in route matches the logged in user
    if (profile.username === username) {
      const timer = setTimeout(() => {
        setIsAuthorized(true);
        setFullName(profile.full_name);
        setBio(profile.bio || "");
        setChecking(false);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsAuthorized(false);
        setChecking(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [profile, username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAuthorized) return;
    setLoading(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      setSuccess(true);
      
      // Auto-redirect to profile after 1.5s
      setTimeout(() => {
        router.push(`/profile/${username}`);
      }, 1500);
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to update profile. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={36} />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto py-12">
        <EmptyState
          icon={ShieldAlert}
          title="Unauthorized Access"
          description="You do not have permission to edit this profile."
          action={
            <Link
              href="/"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-sm transition-all hover:bg-primary/95"
            >
              Back to Feed
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Link */}
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${username}`}
          className="p-2 border border-border/50 rounded-xl hover:bg-secondary transition-colors text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Edit Profile Details
        </h1>
      </div>

      <div className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm glass">
        {/* Status Notices */}
        {success && (
          <div className="p-4 mb-6 rounded-2xl text-xs font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 flex gap-2 items-center">
            <CheckCircle2 size={16} />
            <span>Profile updated successfully! Redirecting...</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 mb-6 rounded-2xl text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
              <User size={14} />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-secondary border border-border text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
              <FileText size={14} />
              <span>Bio</span>
            </label>
            <textarea
              placeholder="Tell friends about yourself..."
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-4 rounded-2xl bg-secondary border border-border text-sm text-foreground focus:border-primary focus:outline-none resize-none transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href={`/profile/${username}`}
              className="flex-1 h-12 border border-border rounded-2xl hover:bg-secondary transition-colors text-sm font-semibold flex items-center justify-center text-foreground"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size={18} />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
