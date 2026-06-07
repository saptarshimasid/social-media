"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import PostCard, { Post } from "@/components/post-card";
import UserAvatar from "@/components/user-avatar";
import { createClient } from "@/lib/supabase";
import { convertToWebP } from "@/lib/image-utils";
import { History, Sparkles, X, Globe, Calendar, Image as ImageIcon, Check, Info } from "lucide-react";

interface MediaPreview {
  file: File;
  previewUrl: string;
}

export default function MemoriesPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form states
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<MediaPreview | null>(null);
  const [dateType, setDateType] = useState<"1" | "2" | "3" | "5" | "custom">("1");
  const [customDate, setCustomDate] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Fetch all posts belonging to the logged-in user to compute "On This Day" memories
  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: userPosts, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles (
            full_name,
            username,
            profile_picture_url
          ),
          post_media (
            id,
            post_id,
            media_url,
            media_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts((userPosts as unknown as Post[]) || []);
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user, fetchMemories]);

  // Handle image attachment
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaFile) {
      URL.revokeObjectURL(mediaFile.previewUrl);
    }

    setMediaFile({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  };

  const removeImage = () => {
    if (mediaFile) {
      URL.revokeObjectURL(mediaFile.previewUrl);
    }
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload image to posts storage bucket
  const uploadMediaFile = async (file: File) => {
    if (!user) return "";
    const ext = file.name.split(".").pop();
    const path = `${user.id}/memory-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

    const { error } = await supabase.storage.from("posts").upload(path, file);
    if (error) {
      console.warn("Storage upload error:", error.message);
      throw new Error("Failed to upload image attachment.");
    }

    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  };

  // Create backdated post
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!content.trim() && !mediaFile) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Determine the target past date
      const today = new Date();
      let targetDate = new Date();

      if (dateType === "custom") {
        if (!customDate) {
          throw new Error("Please select a custom past date.");
        }
        targetDate = new Date(customDate);
      } else {
        const yearsBack = parseInt(dateType, 10);
        targetDate.setFullYear(today.getFullYear() - yearsBack);
      }

      // Ensure the memory isn't in the future
      if (targetDate > today) {
        throw new Error("Memories cannot be set in the future.");
      }

      // Align timezone/hours so the post is created at the current hour of that past day
      targetDate.setHours(today.getHours(), today.getMinutes(), today.getSeconds(), today.getMilliseconds());
      const postCreatedAt = targetDate.toISOString();

      let postType: "text" | "image" = "text";
      if (mediaFile) {
        postType = "image";
      }

      // 1. Insert post
      const { data: postData, error: postErr } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          type: postType,
          created_at: postCreatedAt,
          updated_at: postCreatedAt,
        })
        .select()
        .single();

      if (postErr) throw postErr;

      // 2. Upload media if present
      if (mediaFile) {
        const processedFile = await convertToWebP(mediaFile.file);
        const mediaUrl = await uploadMediaFile(processedFile);
        
        const { error: mediaErr } = await supabase
          .from("post_media")
          .insert({
            post_id: postData.id,
            media_url: mediaUrl,
            media_type: "image",
            created_at: postCreatedAt,
          });

        if (mediaErr) throw mediaErr;
      }

      // Reset form
      setContent("");
      removeImage();
      setDateType("1");
      setCustomDate("");
      setSuccessMsg("Memory successfully created in the past!");
      
      // Reload memories list
      await fetchMemories();
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to create memory. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter posts that match today's month & day in past years
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentDay = today.getDate(); // 1-31

  const memoryPosts = posts.filter((post) => {
    const postDate = new Date(post.created_at);
    // Month and day match, but the year is in the past
    return (
      postDate.getMonth() === currentMonth &&
      postDate.getDate() === currentDay &&
      postDate.getFullYear() < today.getFullYear()
    );
  });

  if (!user || !profile) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 px-4 md:px-0">
      {/* Premium Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-border/40 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center justify-center md:justify-start gap-2">
            <History className="text-primary animate-pulse" size={28} />
            Memories
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            We hope you enjoy looking back on your memories, from today&apos;s date in past years. Create backdated memories to populate your feed!
          </p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <History size={32} className="text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: On This Day Feed */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar size={18} className="text-indigo-500" />
            On This Day
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size={32} />
            </div>
          ) : memoryPosts.length > 0 ? (
            <div className="space-y-6">
              {memoryPosts.map((post) => {
                const yearsAgo = today.getFullYear() - new Date(post.created_at).getFullYear();
                const yearsLabel = `${yearsAgo} Year${yearsAgo > 1 ? "s" : ""} Ago Today`;
                const dateLabel = new Date(post.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });

                return (
                  <div key={post.id} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        <History size={10} />
                        {yearsLabel}
                      </span>
                      <span className="text-[10px] text-muted font-semibold">({dateLabel})</span>
                    </div>
                    <PostCard
                      post={post}
                      onPostDeleted={fetchMemories}
                      onPostShared={fetchMemories}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No Memories Today"
              description="You don't have any posts from this exact calendar date in past years. Create a backdated memory on the right to see it here!"
            />
          )}
        </div>

        {/* Right column: Create Memory Form */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            Add to Memories
          </h2>

          <div className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm glass flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                src={profile.profile_picture_url}
                name={profile.full_name}
                size={36}
              />
              <div>
                <p className="text-xs font-bold text-foreground leading-none mb-1">
                  {profile.full_name}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-muted">
                  <Globe size={9} />
                  <span>Public Memory</span>
                </div>
              </div>
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="p-3 rounded-xl text-xs font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20">
                {errorMsg}
              </div>
            )}

            {/* Success notifications */}
            {successMsg && (
              <div className="p-3 rounded-xl text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                <Check size={14} />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleCreateMemory} className="flex flex-col gap-3.5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What was a special moment in your past? Write it here..."
                rows={4}
                className="w-full bg-secondary/50 border border-border/20 rounded-2xl p-3.5 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary/30 resize-none"
              />

              {/* Date Presets Picker */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                  Select Past Date
                </label>
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as any)}
                  className="w-full bg-secondary border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="1">1 Year Ago Today</option>
                  <option value="2">2 Years Ago Today</option>
                  <option value="3">3 Years Ago Today</option>
                  <option value="5">5 Years Ago Today</option>
                  <option value="custom">Custom past date...</option>
                </select>
              </div>

              {/* Custom Date Input (appears if custom chosen) */}
              {dateType === "custom" && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                    Choose Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full bg-secondary border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Attachment display */}
              {mediaFile && (
                <div className="relative rounded-2xl overflow-hidden border border-border/40 aspect-video">
                  <img
                    src={mediaFile.previewUrl}
                    alt="Memory upload preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* File selection and Submit panel */}
              <div className="flex items-center justify-between border-t border-border/40 pt-3 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/20 text-xs font-semibold text-muted hover:bg-secondary transition-colors cursor-pointer"
                >
                  <ImageIcon size={14} className="text-emerald-500" />
                  <span>Attach Image</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="submit"
                  disabled={submitting || (!content.trim() && !mediaFile)}
                  className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-xs hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size={12} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Memory</span>
                  )}
                </button>
              </div>
            </form>
            <div className="mt-2 border-t border-border/40 pt-3 flex items-start gap-1.5 text-[9px] text-muted leading-normal">
              <Info size={11} className="shrink-0 text-muted-foreground mt-0.5" />
              <p>
                Memory posts will be backdated and immediately shown on your timeline. They will also display on the left feed if their month and day match today&apos;s.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
