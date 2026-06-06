"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Share2, Trash2, Play, Pause, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "./user-avatar";
import CommentSection from "./comment-section";

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onReelDeleted?: (reelId: string) => void;
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

export default function ReelCard({ reel, isActive, onReelDeleted }: ReelCardProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<{ type: ReactionEmoji; count: number }[]>([]);
  const [userReaction, setUserReaction] = useState<ReactionEmoji | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayStateOverlay, setShowPlayStateOverlay] = useState(false);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const supabase = createClient();
  const isOwner = user?.id === reel.user_id;

  // Sync isMuted state with localStorage
  useEffect(() => {
    const storedMuted = localStorage.getItem("reels-muted") !== "false";
    const timer = setTimeout(() => {
      setIsMuted(storedMuted);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Control video play/pause based on isActive prop
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        const timer = setTimeout(() => {
          setIsPlaying(true);
        }, 0);
        videoRef.current.play().catch((err) => {
          console.warn("Video playback was interrupted:", err);
          setTimeout(() => {
            setIsPlaying(false);
          }, 0);
        });
        return () => clearTimeout(timer);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        const timer = setTimeout(() => {
          setIsPlaying(false);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isActive]);

  // Load stats (reactions, comment count)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch reactions
        const { data: reactionData, error: rxError } = await supabase
          .from("reactions")
          .select("type, user_id")
          .eq("target_type", "reel")
          .eq("target_id", reel.id);

        if (!rxError && reactionData) {
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
          .eq("target_type", "reel")
          .eq("target_id", reel.id);

        if (!commentError) {
          setCommentCount(count || 0);
        }
      } catch (err) {
        console.error("Failed to load reel stats:", err);
      }
    };

    fetchStats();
  }, [reel.id, user, supabase]);

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch((err) => console.log(err));
        setIsPlaying(true);
      }
      setShowPlayStateOverlay(true);
      const timer = setTimeout(() => setShowPlayStateOverlay(false), 600);
      return () => clearTimeout(timer);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem("reels-muted", String(nextMuted));
  };

  const handleReact = async (emoji: ReactionEmoji) => {
    if (!user) return;
    setShowPicker(false);

    try {
      if (userReaction === emoji) {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", "reel")
          .eq("target_id", reel.id);

        if (error) throw error;

        setUserReaction(null);
        setReactions((prev) =>
          prev
            .map((r) => (r.type === emoji ? { ...r, count: r.count - 1 } : r))
            .filter((r) => r.count > 0)
        );
      } else {
        const { error } = await supabase.from("reactions").upsert(
          {
            user_id: user.id,
            target_type: "reel",
            target_id: reel.id,
            type: emoji,
          },
          { onConflict: "user_id,target_type,target_id" }
        );

        if (error) throw error;

        if (reel.user_id !== user.id) {
          await supabase.from("notifications").insert({
            user_id: reel.user_id,
            sender_id: user.id,
            type: "reaction",
            target_type: "reel",
            target_id: reel.id,
          });
        }

        setReactions((prev) => {
          const exists = prev.some((r) => r.type === emoji);
          let updated = prev;

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
      console.error("Error setting reaction on reel:", err);
    }
  };

  const handleDeleteReel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner || deleting) return;
    if (!confirm("Are you sure you want to delete this Reel?")) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("reels").delete().eq("id", reel.id);
      if (error) throw error;
      if (onReelDeleted) onReelDeleted(reel.id);
    } catch (err) {
      console.error("Failed to delete reel:", err);
      setDeleting(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/reels?reelId=${reel.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  };

  const totalReactionsCount = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="relative w-full max-w-[420px] h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-end border border-border/10 snap-start select-none">
      {/* 1. Main Video Container */}
      <div className="absolute inset-0 w-full h-full cursor-pointer" onClick={handleTogglePlay}>
        <video
          ref={videoRef}
          src={reel.video_url}
          loop
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />

        {/* Dynamic Muted Banner */}
        {isMuted && (
          <div className="absolute top-4 left-4 z-10 bg-black/50 border border-white/10 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold text-white backdrop-blur-md">
            <VolumeX size={12} />
            <span>MUTED</span>
          </div>
        )}

        {/* Large Play/Pause State Animation Overlay */}
        {showPlayStateOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 animate-ping duration-300">
            <div className="p-4 bg-black/60 rounded-full text-white backdrop-blur-md">
              {isPlaying ? <Play size={32} /> : <Pause size={32} />}
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Right Actions (Mute toggle, Owner delete) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleToggleMute}
          className="p-2.5 bg-black/50 hover:bg-black/75 rounded-full text-white border border-white/10 backdrop-blur-md cursor-pointer transition-colors"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {isOwner && (
          <button
            onClick={handleDeleteReel}
            disabled={deleting}
            className="p-2.5 bg-black/50 hover:bg-rose-500 rounded-full text-white border border-white/10 backdrop-blur-md cursor-pointer transition-colors"
            title="Delete Reel"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 3. Bottom Gradient Shadow to help text readability */}
      <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-0" />

      {/* 4. Left Bottom Details Overlay */}
      <div className="absolute bottom-4 left-4 right-16 z-10 text-white pointer-events-auto">
        <Link
          href={`/profile/${reel.profiles.username}`}
          className="flex items-center gap-2 mb-2 w-fit"
          onClick={(e) => e.stopPropagation()}
        >
          <UserAvatar
            src={reel.profiles.profile_picture_url}
            name={reel.profiles.full_name}
            size={32}
            className="border-2 border-white/20"
          />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-normal truncate max-w-[150px]">
              {reel.profiles.full_name}
            </span>
            <span className="text-[9px] text-white/70 leading-none">
              @{reel.profiles.username}
            </span>
          </div>
        </Link>
        {reel.caption && (
          <p className="text-xs text-white/90 line-clamp-2 leading-relaxed text-left max-w-[280px]">
            {reel.caption}
          </p>
        )}
      </div>

      {/* 5. Right Bottom Vertical Actions Toolbar */}
      <div className="absolute right-3 bottom-6 z-10 flex flex-col items-center gap-4 text-white">
        {/* Likes / Reactions Action */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {/* Reaction bubble selector */}
          {showPicker && (
            <div className="absolute right-12 bottom-0 bg-black/80 border border-white/10 rounded-full p-2 shadow-2xl flex gap-1.5 backdrop-blur-md animate-in fade-in slide-in-from-right-3 duration-250 z-50">
              {Object.entries(EMOJIS).map(([name, symbol]) => (
                <button
                  key={name}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact(name as ReactionEmoji);
                  }}
                  className="text-xl hover:scale-130 transition-transform duration-150 cursor-pointer"
                  title={name}
                >
                  {symbol}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReact("Like");
            }}
            className={`p-2.5 rounded-full border border-white/10 backdrop-blur-md cursor-pointer transition-all ${
              userReaction
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "bg-black/50 hover:bg-black/75 hover:scale-105"
            }`}
          >
            <Heart size={18} fill={userReaction ? "white" : "none"} />
          </button>
          <span className="text-[10px] font-bold mt-1 text-white/90 drop-shadow-md">
            {totalReactionsCount}
          </span>
        </div>

        {/* Comment Action */}
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="p-2.5 bg-black/50 hover:bg-black/75 border border-white/10 rounded-full text-white backdrop-blur-md cursor-pointer hover:scale-105 transition-all"
          >
            <MessageSquare size={18} />
          </button>
          <span className="text-[10px] font-bold mt-1 text-white/90 drop-shadow-md">
            {commentCount}
          </span>
        </div>

        {/* Share Action */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleShare}
            className="p-2.5 bg-black/50 hover:bg-black/75 border border-white/10 rounded-full text-white backdrop-blur-md cursor-pointer hover:scale-105 transition-all relative"
          >
            <Share2 size={18} />
            {copied && (
              <span className="absolute -top-7 right-0 text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold whitespace-nowrap shadow-md">
                COPIED!
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 6. Comments Slide-up Tray Overlay */}
      {showComments && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-20"
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(false);
            }}
          />
          <div
            className="absolute bottom-0 inset-x-0 h-[75%] bg-card/95 backdrop-blur-xl border-t border-border/40 rounded-t-3xl shadow-2xl z-30 flex flex-col animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare size={14} className="text-primary" />
                Comments ({commentCount})
              </span>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 border border-border/50 rounded-lg hover:bg-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable comments box */}
            <div className="flex-1 overflow-y-auto p-4">
              <CommentSection
                targetId={reel.id}
                targetType="reel"
                ownerId={reel.user_id}
                onCommentAdded={() => setCommentCount((prev) => prev + 1)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
