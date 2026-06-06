"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Film, Image as ImageIcon, Sparkles, X, Globe, Tag, Search } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import { convertToWebP } from "@/lib/image-utils";
import UserAvatar from "./user-avatar";
import MediaUploader from "./media-uploader";
import LoadingSpinner from "./loading-spinner";

interface CreatePostBoxProps {
  onPostCreated?: () => void;
  groupId?: string;
}

interface MediaFile {
  file: File;
  previewUrl: string;
  type: "image" | "video";
}

interface FriendProfile {
  id: string;
  full_name: string;
  username: string;
  profile_picture_url: string | null;
}

export default function CreatePostBox({ onPostCreated, groupId }: CreatePostBoxProps) {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isReel, setIsReel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Tagging
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<FriendProfile[]>([]);

  const supabase = createClient();

  if (!user || !profile) return null;

  const resetForm = () => {
    setContent("");
    mediaFiles.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    setMediaFiles([]);
    setIsReel(false);
    setErrorMsg("");
    setTaggedUsers([]);
    setShowTagPicker(false);
    setTagSearch("");
  };

  const uploadMediaFile = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${user.id}/post-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

    const { error } = await supabase.storage.from("posts").upload(path, file);
    if (error) {
      console.warn("Storage upload error:", error.message);
      throw new Error("Failed to upload attachment.");
    }

    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  };

  const loadFriends = async () => {
    try {
      // Get all friendships where current user is involved
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_id1, user_id2")
        .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

      if (!friendships || friendships.length === 0) return;

      const friendIds = friendships.map((f) =>
        f.user_id1 === user.id ? f.user_id2 : f.user_id1
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, profile_picture_url")
        .in("id", friendIds);

      setFriends((profiles as FriendProfile[]) || []);
    } catch (err) {
      console.error("Failed to load friends for tagging:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;
    setLoading(true);
    setErrorMsg("");

    try {
      if (isReel) {
        const videos = mediaFiles.filter((m) => m.type === "video");
        if (videos.length !== 1) {
          throw new Error("A reel requires exactly one video file.");
        }

        const videoUrl = await uploadMediaFile(videos[0].file);

        const { error } = await supabase.from("reels").insert({
          user_id: user.id,
          video_url: videoUrl,
          caption: content.trim() || null,
        });

        if (error) throw error;
      } else {
        let postType: "text" | "image" | "video" = "text";
        if (mediaFiles.length > 0) {
          const hasVideo = mediaFiles.some((m) => m.type === "video");
          postType = hasVideo ? "video" : "image";
        }

        const insertPayload: Record<string, unknown> = {
          user_id: user.id,
          content: content.trim() || null,
          type: postType,
        };
        if (groupId) insertPayload.group_id = groupId;

        const { data: postData, error: postErr } = await supabase
          .from("posts")
          .insert(insertPayload)
          .select()
          .single();

        if (postErr) throw postErr;

        // Upload and Link Media
        if (mediaFiles.length > 0) {
          const mediaInsertPromises = mediaFiles.map(async (media) => {
            let fileToUpload = media.file;
            if (media.type === "image") {
              fileToUpload = await convertToWebP(media.file);
            }
            const mediaUrl = await uploadMediaFile(fileToUpload);
            return {
              post_id: postData.id,
              media_url: mediaUrl,
              media_type: media.type,
            };
          });

          const mediaPayload = await Promise.all(mediaInsertPromises);
          const { error: mediaErr } = await supabase
            .from("post_media")
            .insert(mediaPayload);

          if (mediaErr) throw mediaErr;
        }

        // Save tags
        if (taggedUsers.length > 0) {
          const tagPayload = taggedUsers.map((u) => ({
            post_id: postData.id,
            user_id: u.id,
          }));
          await supabase.from("post_tags").insert(tagPayload);

          // Trigger notifications for tagged users
          const notifPayload = taggedUsers.map((u) => ({
            user_id: u.id,
            sender_id: user.id,
            type: "reaction", // using 'reaction' since 'tag' is not in the db enum
            target_type: "tag", // used to distinguish tags in the frontend
            target_id: postData.id,
          }));
          await supabase.from("notifications").insert(notifPayload);
        }
      }

      resetForm();
      setIsOpen(false);
      if (onPostCreated) onPostCreated();
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to create post. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      !taggedUsers.some((t) => t.id === f.id) &&
      (f.full_name.toLowerCase().includes(tagSearch.toLowerCase()) ||
        f.username.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  return (
    <div className="bg-card border border-border/40 rounded-3xl p-4 shadow-sm glass flex gap-3.5">
      <UserAvatar
        src={profile.profile_picture_url}
        name={profile.full_name}
        size={40}
      />
      <div className="flex-1 flex flex-col gap-3">
        <button
          onClick={() => {
            setIsOpen(true);
            loadFriends();
          }}
          className="w-full text-left h-10 px-4 rounded-2xl bg-secondary border border-transparent hover:border-border/30 hover:bg-secondary/80 text-muted text-sm transition-all focus:outline-none select-none cursor-pointer flex items-center"
        >
          What&apos;s on your mind, {profile.full_name.split(" ")[0]}?
        </button>

        <div className="flex items-center gap-1 border-t border-border/40 pt-2 text-xs font-semibold text-muted">
          <button
            onClick={() => {
              setIsReel(false);
              setIsOpen(true);
              loadFriends();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer text-foreground/80"
          >
            <ImageIcon size={14} className="text-emerald-500" />
            <span>Photo/Video</span>
          </button>
          <button
            onClick={() => {
              setIsReel(true);
              setIsOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer text-foreground/80"
          >
            <Film size={14} className="text-rose-500" />
            <span>Reel</span>
          </button>
          <button
            onClick={() => {
              setIsOpen(true);
              setShowTagPicker(true);
              loadFriends();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer text-foreground/80"
          >
            <Tag size={14} className="text-blue-500" />
            <span className="hidden sm:inline">Tag Friends</span>
          </button>
        </div>
      </div>

      {/* Create Post Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0 cursor-default"
            onClick={() => !loading && setIsOpen(false)}
          />
          <div className="w-full max-w-xl rounded-3xl bg-card border border-border/40 shadow-2xl p-5 sm:p-6 relative z-10 glass animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4 shrink-0">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                <Sparkles size={18} className="text-amber-500" />
                {isReel ? "Create Short Reel" : "Create Post"}
              </h2>
              <button
                disabled={loading}
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-full hover:bg-secondary text-muted transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl text-xs font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 shrink-0">
                {errorMsg}
              </div>
            )}

            {/* Author info & Type Select */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <UserAvatar
                src={profile.profile_picture_url}
                name={profile.full_name}
                size={40}
              />
              <div>
                <p className="text-sm font-semibold leading-none mb-1 text-foreground">
                  {profile.full_name}
                </p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted font-medium select-none">
                    <Globe size={10} />
                    Friends Only
                  </span>
                  
                  <select
                    value={isReel ? "reel" : "post"}
                    onChange={(e) => {
                      setIsReel(e.target.value === "reel");
                      mediaFiles.forEach((m) => URL.revokeObjectURL(m.previewUrl));
                      setMediaFiles([]);
                    }}
                    className="bg-secondary text-[10px] text-foreground font-semibold px-2 py-0.5 rounded-md border-none focus:outline-none"
                  >
                    <option value="post">Feed Post</option>
                    <option value="reel">Vertical Reel</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tagged users pills */}
            {taggedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
                <span className="text-[10px] text-muted font-semibold flex items-center gap-1">
                  <Tag size={10} /> Tagged:
                </span>
                {taggedUsers.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold border border-blue-500/20"
                  >
                    {t.full_name}
                    <button
                      onClick={() => setTaggedUsers((prev) => prev.filter((u) => u.id !== t.id))}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag Picker */}
            {showTagPicker && (
              <div className="mb-3 shrink-0 border border-border/40 rounded-2xl p-3 bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={14} className="text-muted" />
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search friends to tag..."
                    className="flex-1 bg-transparent text-xs text-foreground placeholder-muted focus:outline-none"
                  />
                  <button
                    onClick={() => setShowTagPicker(false)}
                    className="text-[10px] text-muted font-semibold hover:text-foreground cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filteredFriends.length > 0 ? (
                    filteredFriends.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setTaggedUsers((prev) => [...prev, f]);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary transition-colors text-left cursor-pointer"
                      >
                        <UserAvatar
                          src={f.profile_picture_url}
                          name={f.full_name}
                          size={24}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{f.full_name}</p>
                          <p className="text-[10px] text-muted truncate">@{f.username}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted text-center py-2">
                      {friends.length === 0 ? "Add friends first to tag them" : "No matching friends"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Post/Reel Editor Form */}
            <form onSubmit={handleCreatePost} className="flex-1 flex flex-col overflow-y-auto pr-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  isReel
                    ? "Add a caption for your reel..."
                    : `What's on your mind, ${profile.full_name.split(" ")[0]}?`
                }
                rows={3}
                className="w-full bg-transparent text-sm placeholder-muted text-foreground resize-none border-none focus:outline-none mb-4 shrink-0"
              />

              {/* Media Uploader Container */}
              <div className="mb-4 shrink-0">
                <MediaUploader
                  files={mediaFiles}
                  onChange={setMediaFiles}
                  maxFiles={isReel ? 1 : 4}
                />
              </div>

              {/* Tag button inside modal */}
              {!showTagPicker && !isReel && (
                <button
                  type="button"
                  onClick={() => setShowTagPicker(true)}
                  className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl border border-border/40 text-xs font-semibold text-muted hover:bg-secondary transition-colors cursor-pointer shrink-0"
                >
                  <Tag size={14} className="text-blue-500" />
                  Tag Friends
                </button>
              )}

              {/* Submit panel */}
              <button
                type="submit"
                disabled={loading || (!content.trim() && mediaFiles.length === 0)}
                className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer mt-auto shrink-0 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <span>Publish {isReel ? "Reel" : "Post"}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
