"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "./user-avatar";
import LoadingSpinner from "./loading-spinner";
import { Send, CornerDownRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentSectionProps {
  targetId: string;
  targetType: "post" | "reel";
  ownerId: string; // ID of the post/reel owner to notify
  onCommentAdded?: () => void;
}

interface DBComment {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

export default function CommentSection({
  targetId,
  targetType,
  ownerId,
  onCommentAdded,
}: CommentSectionProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<DBComment[]>([]);
  const [replies, setReplies] = useState<Record<string, DBComment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  // 1. Fetch Comments
  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("comments")
          .select("*, profiles(*)")
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Separate top-level comments and nested replies
        const topLevel: DBComment[] = [];
        const nested: Record<string, DBComment[]> = {};

        (data as unknown as DBComment[] || []).forEach((c) => {
          if (c.parent_id === null) {
            topLevel.push(c);
          } else {
            const pid = c.parent_id;
            if (!nested[pid]) {
              nested[pid] = [];
            }
            nested[pid].push(c);
          }
        });

        setComments(topLevel);
        setReplies(nested);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [targetId, targetType, supabase]);

  // 2. Submit Top-Level Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
          content: commentText.trim(),
          parent_id: null,
        })
        .select("*, profiles(*)")
        .single();

      if (error) throw error;

      // Add to list
      setComments((prev) => [...prev, data]);
      setCommentText("");
      if (onCommentAdded) onCommentAdded();

      // Trigger notification if commenting on someone else's content
      if (ownerId !== user.id) {
        await supabase.from("notifications").insert({
          user_id: ownerId,
          sender_id: user.id,
          type: "comment",
          target_type: targetType,
          target_id: targetId,
        });
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Submit Reply Comment
  const handleAddReply = async (parentId: string) => {
    const text = replyTexts[parentId] || "";
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
          content: text.trim(),
          parent_id: parentId,
        })
        .select("*, profiles(*)")
        .single();

      if (error) throw error;

      // Add to replies map
      setReplies((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), data],
      }));

      setReplyTexts((prev) => ({ ...prev, [parentId]: "" }));
      setActiveReplyId(null);
      if (onCommentAdded) onCommentAdded();

      // Trigger notification if replying on someone else's content
      if (ownerId !== user.id) {
        await supabase.from("notifications").insert({
          user_id: ownerId,
          sender_id: user.id,
          type: "comment",
          target_type: targetType,
          target_id: targetId,
        });
      }
    } catch (err) {
      console.error("Failed to reply:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* List Comments */}
      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size={20} />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2.5">
              {/* Main Comment Bubble */}
              <div className="flex gap-2.5 items-start">
                <UserAvatar
                  src={comment.profiles.profile_picture_url}
                  name={comment.profiles.full_name}
                  size={32}
                />
                <div className="flex-1">
                  <div className="bg-secondary p-3 rounded-2xl border border-border/20 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-foreground">
                        {comment.profiles.full_name}
                      </span>
                      <span className="text-[9px] text-muted">
                        {formatDistanceToNow(new Date(comment.created_at))} ago
                      </span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>

                  {/* Comment actions */}
                  {user && (
                    <div className="flex items-center gap-3 mt-1.5 ml-2 text-[10px] font-semibold text-muted">
                      <button
                        onClick={() => {
                          setActiveReplyId(
                            activeReplyId === comment.id ? null : comment.id
                          );
                        }}
                        className="hover:text-primary transition-colors cursor-pointer"
                      >
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Replies Thread */}
              {replies[comment.id] && replies[comment.id].map((reply) => (
                <div
                  key={reply.id}
                  className="flex gap-2.5 items-start pl-8"
                >
                  <CornerDownRight className="text-muted shrink-0 mt-1" size={12} />
                  <UserAvatar
                    src={reply.profiles.profile_picture_url}
                    name={reply.profiles.full_name}
                    size={26}
                  />
                  <div className="flex-1 bg-secondary/60 p-2.5 rounded-2xl border border-border/10 text-[11px]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-foreground">
                        {reply.profiles.full_name}
                      </span>
                      <span className="text-[9px] text-muted">
                        {formatDistanceToNow(new Date(reply.created_at))} ago
                      </span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap">
                      {reply.content}
                    </p>
                  </div>
                </div>
              ))}

              {/* Reply Input Box */}
              {activeReplyId === comment.id && (
                <div className="flex gap-2 items-center pl-8 animate-in slide-in-from-top-1.5 duration-150">
                  <input
                    type="text"
                    placeholder="Write a reply..."
                    value={replyTexts[comment.id] || ""}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({
                        ...prev,
                        [comment.id]: e.target.value,
                      }))
                    }
                    className="flex-1 h-9 rounded-xl bg-secondary px-3 text-xs focus:outline-none border border-transparent focus:border-primary/30"
                  />
                  <button
                    onClick={() => handleAddReply(comment.id)}
                    disabled={submitting || !(replyTexts[comment.id] || "").trim()}
                    className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted py-2 select-none">
          No comments yet. Be the first to share your thoughts!
        </p>
      )}

      {/* Input Box for new comment */}
      {user && (
        <form onSubmit={handleAddComment} className="flex gap-2 items-center">
          <UserAvatar
            src={profile?.profile_picture_url}
            name={profile?.full_name}
            size={32}
          />
          <input
            type="text"
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 h-10 rounded-xl bg-secondary px-4 text-xs focus:outline-none border border-transparent focus:border-primary/40 text-foreground"
          />
          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
}
