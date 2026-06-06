"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2, MoreHorizontal, Share2 } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "./user-avatar";
import CommentSection from "./comment-section";
import { Tag } from "lucide-react";

export interface PostMedia {
  id: string;
  post_id: string;
  media_url: string;
  media_type: "image" | "video";
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  type: "text" | "image" | "video" | "reel";
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
  post_media?: PostMedia[];
  group_id?: string | null;
}

interface PostCardProps {
  post: Post;
  onPostDeleted?: () => void;
  onPostShared?: () => void;
}

type ReactionEmoji = "Like" | "Love" | "Care" | "Haha" | "Wow" | "Sad" | "Angry";

const EMOJIS: Record<ReactionEmoji, string> = {
  Like: "👍",
  Love: "❤️",
  Care: "🤗",
  Haha: "😂",
  Wow: "😮",
  Sad: "😢",
  Angry: "😡",
};

export default function PostCard({ post, onPostDeleted, onPostShared }: PostCardProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<{ type: ReactionEmoji; count: number }[]>([]);
  const [userReaction, setUserReaction] = useState<ReactionEmoji | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<{full_name: string; username: string}[]>([]);

  const supabase = createClient();
  const isOwner = user?.id === post.user_id;

  // 1. Fetch Reactions and Comments summary
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch reactions
        const { data: reactionData, error: rxError } = await supabase
          .from("reactions")
          .select("type, user_id")
          .eq("target_type", "post")
          .eq("target_id", post.id);

        if (!rxError && reactionData) {
          // Group reactions
          const counts = {} as Record<ReactionEmoji, number>;
          let myRx: ReactionEmoji | null = null;

          reactionData.forEach((r) => {
            const emojiType = r.type as ReactionEmoji;
            counts[emojiType] = (counts[emojiType] || 0) + 1;
            if (user && r.user_id === user.id) {
              myRx = emojiType;
            }
          });

          const grouped = Object.entries(counts).map(([type, count]) => ({
            type: type as ReactionEmoji,
            count,
          }));

          setReactions(grouped);
          setUserReaction(myRx);
        }

        // Fetch comments count
        const { count, error: commentError } = await supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("target_type", "post")
          .eq("target_id", post.id);

        if (!commentError) {
          setCommentCount(count || 0);
        }

        // Fetch tags
        const { data: tagsData } = await supabase
          .from("post_tags")
          .select("user_id, profiles(full_name, username)")
          .eq("post_id", post.id);

        if (tagsData) {
          setTaggedUsers(
            tagsData.map((t: Record<string, unknown>) => {
              const p = t.profiles as Record<string, unknown>;
              return {
                full_name: (p?.full_name as string) || "User",
                username: (p?.username as string) || "",
              };
            })
          );
        }
      } catch (err) {
        console.error("Failed to load post stats:", err);
      }
    };

    fetchStats();
  }, [post.id, user, supabase]);

  const handleReact = async (emoji: ReactionEmoji) => {
    if (!user) return;
    setShowPicker(false);

    try {
      if (userReaction === emoji) {
        // Remove reaction
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", "post")
          .eq("target_id", post.id);

        if (error) throw error;

        setUserReaction(null);
        setReactions((prev) =>
          prev
            .map((r) => (r.type === emoji ? { ...r, count: r.count - 1 } : r))
            .filter((r) => r.count > 0)
        );
      } else {
        // Add/Change reaction (Upsert with conflict target)
        const { error } = await supabase.from("reactions").upsert(
          {
            user_id: user.id,
            target_type: "post",
            target_id: post.id,
            type: emoji,
          },
          { onConflict: "user_id,target_type,target_id" }
        );

        if (error) throw error;

        // Trigger notification if reacting to someone else's post
        if (post.user_id !== user.id) {
          await supabase.from("notifications").insert({
            user_id: post.user_id,
            sender_id: user.id,
            type: "reaction",
            target_type: "post",
            target_id: post.id,
          });
        }

        // Adjust client state
        setReactions((prev) => {
          const exists = prev.some((r) => r.type === emoji);
          let updated = prev;

          // Decrement previous if changed
          if (userReaction) {
            updated = updated
              .map((r) => (r.type === userReaction ? { ...r, count: r.count - 1 } : r))
              .filter((r) => r.count > 0);
          }

          if (exists) {
            return updated.map((r) => (r.type === emoji ? { ...r, count: r.count + 1 } : r));
          } else {
            return [...updated, { type: emoji, count: 1 }];
          }
        });
        setUserReaction(emoji);
      }
    } catch (err) {
      console.error("Error setting reaction:", err);
    }
  };

  const handleShare = async () => {
    if (!user || sharing) return;
    setSharing(true);
    try {
      // Create a new post representing the repost
      const repostText = post.content 
        ? `🔄 Reposted from @${post.profiles.username}: ${post.content}` 
        : `🔄 Reposted from @${post.profiles.username}`;

      const { data: newPost, error: postErr } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: repostText,
          type: post.type,
          group_id: post.group_id || null,
        })
        .select()
        .single();

      if (postErr) throw postErr;

      // Duplicate media if there is any
      if (post.post_media && post.post_media.length > 0) {
        const mediaToInsert = post.post_media.map((m) => ({
          post_id: newPost.id,
          media_url: m.media_url,
          media_type: m.media_type,
        }));

        const { error: mediaErr } = await supabase
          .from("post_media")
          .insert(mediaToInsert);

        if (mediaErr) throw mediaErr;
      }

      setShared(true);
      setTimeout(() => setShared(false), 2000);

      // Trigger refresh callback
      if (onPostShared) {
        onPostShared();
      } else if (onPostDeleted) {
        onPostDeleted();
      }
    } catch (err) {
      console.error("Failed to share/repost post:", err);
    } finally {
      setSharing(false);
    }
  };

  const handleDeletePost = async () => {
    if (!isOwner) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      if (onPostDeleted) onPostDeleted();
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const totalReactionsCount = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div
      id={`post-${post.id}`}
      className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm glass animate-in fade-in slide-in-from-bottom-2 duration-300 relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/profile/${post.profiles.username}`}
          className="flex items-center gap-3"
        >
          <UserAvatar
            src={post.profiles.profile_picture_url}
            name={post.profiles.full_name}
            size={40}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                {post.profiles.full_name}
              </span>
              {taggedUsers.length > 0 && (
                <span className="text-xs text-muted">
                  with{" "}
                  {taggedUsers.slice(0, 2).map((t, i) => (
                    <React.Fragment key={t.username}>
                      {i > 0 && ", "}
                      <Link href={`/profile/${t.username}`} className="font-semibold text-primary hover:underline">
                        {t.full_name}
                      </Link>
                    </React.Fragment>
                  ))}
                  {taggedUsers.length > 2 && (
                    <span> and {taggedUsers.length - 2} others</span>
                  )}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted flex items-center gap-1.5 leading-none mt-1">
              <span>@{post.profiles.username}</span>
              <span className="w-1 h-1 bg-muted rounded-full" />
              <span>{formatDistanceToNow(new Date(post.created_at))} ago</span>
            </span>
          </div>
        </Link>

        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-full hover:bg-secondary text-muted hover:text-foreground transition-all cursor-pointer"
            >
              <MoreHorizontal size={18} />
            </button>

            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 mt-1.5 w-40 origin-top-right rounded-2xl border border-border bg-card p-1.5 shadow-lg z-40 animate-in fade-in duration-150 glass">
                  <button
                    onClick={() => {
                      setShowActions(false);
                      handleDeletePost();
                    }}
                    disabled={deleting}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 size={14} />
                    {deleting ? "Deleting..." : "Delete Post"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content text */}
      {post.content && (
        <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-4 leading-relaxed">
          {post.content}
        </p>
      )}

      {/* Media Attachments Grid */}
      {post.post_media && post.post_media.length > 0 && (
        <div
          className={`grid gap-2 mb-4 overflow-hidden rounded-2xl border border-border/20 ${
            post.post_media.length === 1
              ? "grid-cols-1"
              : post.post_media.length === 2
              ? "grid-cols-2"
              : "grid-cols-2"
          }`}
        >
          {post.post_media.map((media) => {
            const isSingle = post.post_media!.length === 1;
            return (
              <div
                key={media.id}
                className={
                  isSingle
                    ? "w-full bg-secondary/30 flex justify-center items-center overflow-hidden"
                    : "relative bg-secondary overflow-hidden aspect-square"
                }
              >
                {media.media_type === "image" ? (
                  isSingle ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.media_url}
                      alt="Post attachment"
                      className="w-full h-auto max-h-[600px] object-contain block"
                    />
                  ) : (
                    <Image
                      src={media.media_url}
                      alt="Post attachment"
                      fill
                      className="object-cover"
                    />
                  )
                ) : (
                  <video
                    src={media.media_url}
                    controls
                    className={
                      isSingle
                        ? "w-full max-h-[600px] object-contain block"
                        : "w-full h-full object-cover"
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats summary banner */}
      {(totalReactionsCount > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between pb-3 border-b border-border/40 text-xs text-muted mb-3">
          {/* Reactions detail */}
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1.5">
              {reactions.slice(0, 3).map((r) => (
                <span
                  key={r.type}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary border border-card text-[11px] leading-none"
                  title={r.type}
                >
                  {EMOJIS[r.type]}
                </span>
              ))}
            </div>
            {totalReactionsCount > 0 && (
              <span className="font-semibold text-foreground/80 pl-1">
                {totalReactionsCount} {totalReactionsCount === 1 ? "reaction" : "reactions"}
              </span>
            )}
          </div>

          {/* Comments count */}
          {commentCount > 0 && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="hover:underline font-medium text-foreground/80"
            >
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 relative text-xs font-semibold text-muted">
        {/* Like/Reaction selector */}
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          <button
            onClick={() => handleReact("Like")}
            className={`w-full flex items-center justify-center gap-2 h-10 rounded-2xl transition-all border border-transparent hover:bg-secondary active:scale-95 cursor-pointer ${
              userReaction
                ? "text-primary bg-primary/5 hover:bg-primary/10 border-primary/20"
                : "text-foreground/85"
            }`}
          >
            <span className="text-sm">
              {userReaction ? EMOJIS[userReaction] : "👍"}
            </span>
            <span>{userReaction || "Like"}</span>
          </button>

          {/* Hover popup picker */}
          {showPicker && (
            <div className="absolute bottom-11 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full p-2.5 shadow-xl flex gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 z-50 glass">
              {Object.entries(EMOJIS).map(([name, symbol]) => (
                <button
                  key={name}
                  onClick={() => handleReact(name as ReactionEmoji)}
                  className="text-2xl hover:scale-130 transition-transform duration-150 active:scale-90 cursor-pointer"
                  title={name}
                >
                  {symbol}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl text-foreground/85 hover:bg-secondary active:scale-95 transition-all cursor-pointer"
        >
          <MessageSquare size={16} />
          <span>Comment</span>
        </button>

        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl text-foreground/85 hover:bg-secondary active:scale-95 transition-all cursor-pointer relative disabled:opacity-50"
        >
          <Share2 size={16} />
          <span>{sharing ? "Sharing..." : shared ? "Shared!" : "Share"}</span>
          {shared && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold shadow-md animate-bounce">
              Reposted!
            </span>
          )}
        </button>
      </div>

      {/* Embedded CommentSection component */}
      {showComments && (
        <div className="mt-4 border-t border-border/40 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <CommentSection
            targetId={post.id}
            targetType="post"
            ownerId={post.user_id}
          />
        </div>
      )}
    </div>
  );
}
