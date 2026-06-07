"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, AtSign, User, FileText, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import ThemeToggle from "@/components/theme-toggle";
import LoadingSpinner from "@/components/loading-spinner";
import { convertToWebP } from "@/lib/image-utils";

export default function OnboardingPage() {
  const { user, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const supabase = createClient();
  const router = useRouter();

  // Populate default full name from user metadata if Google OAuth was used
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      const name = user.user_metadata.full_name;
      setTimeout(() => setFullName(name), 0);
    }
  }, [user]);

  // Debounce username check
  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setTimeout(() => setUsernameStatus("idle"), 0);
      return;
    }

    const checkUsername = async () => {
      setUsernameStatus("checking");
      try {
        const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", cleanUsername)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setUsernameStatus("taken");
        } else {
          setUsernameStatus("available");
        }
      } catch (err) {
        console.error("Error checking username:", err);
        setUsernameStatus("idle");
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, supabase]);

  const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileFile(file);
      setProfilePreview(URL.createObjectURL(file));
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    // Attempt to upload. Note that the bucket must be created in Supabase console.
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });

    if (error) {
      console.warn(`Storage upload error (please ensure '${bucket}' bucket exists in Supabase):`, error.message);
      throw new Error(`Failed to upload image. Please verify that the Supabase Storage bucket '${bucket}' exists.`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanUsername.length < 3) {
      setErrorMsg("Username must be at least 3 characters long.");
      setLoading(false);
      return;
    }

    if (usernameStatus === "taken") {
      setErrorMsg("Username is already taken.");
      setLoading(false);
      return;
    }

    try {
      let profileUrl = null;
      let coverUrl = null;

       // Upload profile image if selected
      if (profileFile) {
        const converted = await convertToWebP(profileFile);
        const ext = converted.name.split(".").pop();
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        profileUrl = await uploadFile(converted, "profiles", path);
      }

      // Upload cover image if selected
      if (coverFile) {
        const converted = await convertToWebP(coverFile);
        const ext = converted.name.split(".").pop();
        const path = `${user.id}/cover-${Date.now()}.${ext}`;
        coverUrl = await uploadFile(converted, "profiles", path);
      }

      // Save to database
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        username: cleanUsername,
        bio: bio.trim() || null,
        profile_picture_url: profileUrl,
        cover_picture_url: coverUrl,
        phone: user.phone || null,
        email: user.email || null,
        age: user.user_metadata?.age || null,
      });

      if (error) throw error;

      await refreshProfile();
      router.push("/");
      router.refresh();
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "Something went wrong while setting up your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-background to-background">
      <div className="absolute top-4 left-4">
        <button
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border/40 text-[10px] font-bold text-rose-500 transition-all shadow-sm cursor-pointer"
        >
          <LogOut size={12} />
          <span>Sign Out</span>
        </button>
      </div>
      
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl mx-auto rounded-3xl bg-card border border-border/40 shadow-xl glass overflow-hidden animate-in fade-in duration-300">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Setup Your Profile
            </h1>
            <p className="text-sm text-muted">
              Add some personality to your account to start connecting with friends.
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 mb-6 rounded-2xl text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 flex gap-2 items-start">
              <AlertTriangle className="shrink-0 mt-0.5" size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Images Section */}
            <div className="relative w-full h-44 rounded-2xl bg-secondary overflow-hidden border border-border/40 group">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt="Cover Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted text-xs gap-1">
                  <ImageIcon size={24} />
                  <span>Choose Cover Photo</span>
                </div>
              )}
              <label className="absolute bottom-3 right-3 p-2.5 bg-background/80 hover:bg-background rounded-full border border-border/30 backdrop-blur-md cursor-pointer transition-all shadow-md active:scale-95">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                  className="hidden"
                />
              </label>

              {/* Profile Pic Overlap */}
              <div className="absolute bottom-[-24px] left-6">
                <div className="relative w-24 h-24 rounded-full border-4 border-card bg-secondary overflow-hidden shadow-md group/avatar">
                  {profilePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePreview}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted">
                      <User size={32} />
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity text-white">
                    <Camera size={18} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="h-6" /> {/* spacing spacer */}

            {/* Inputs Block */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                  <User size={14} />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-secondary border border-border text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                  <AtSign size={14} />
                  <span>Username *</span>
                </label>
                <div className="relative flex rounded-2xl bg-secondary border border-border focus-within:border-primary overflow-hidden transition-colors">
                  <span className="flex items-center pl-4 pr-1 text-sm text-muted select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="john_doe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground px-1"
                  />
                  {usernameStatus !== "idle" && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                      {usernameStatus === "checking" && (
                        <LoadingSpinner size={16} />
                      )}
                      {usernameStatus === "available" && (
                        <CheckCircle2 className="text-emerald-500" size={18} />
                      )}
                      {usernameStatus === "taken" && (
                        <span className="text-[10px] font-semibold text-rose-500">Taken</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-1.5 pl-1">
                  Only lowercase letters, numbers, and underscores are allowed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                  <FileText size={14} />
                  <span>Bio</span>
                </label>
                <textarea
                  placeholder="Tell us a little bit about yourself (hobbies, profession, thoughts...)"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-secondary border border-border text-sm text-foreground focus:border-primary focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || usernameStatus === "taken" || usernameStatus === "checking"}
              className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size={18} />
                  <span>Finalizing Setup...</span>
                </>
              ) : (
                <span>Complete Onboarding</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
