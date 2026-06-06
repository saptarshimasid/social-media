"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import CreatePostBox from "@/components/create-post-box";
import PostCard, { Post } from "@/components/post-card";
import { createClient } from "@/lib/supabase";
import { Flame } from "lucide-react";
import StoriesBar from "@/components/stories-bar";

export default function HomeFeed() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch all posts globally
      const { data: feedPosts, error: feedError } = await supabase
        .from("posts")
        .select("*, post_media(*), profiles(*)")
        .order("created_at", { ascending: false });

      if (feedError) throw feedError;
      
      setPosts((feedPosts as unknown as Post[]) || []);
    } catch (err) {
      console.error("Failed to load feed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFeed();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFeed]);

  if (!user || !profile) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Feed Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="text-xs text-muted">
          Here&apos;s what is happening in your network today.
        </p>
      </div>

      {/* Stories */}
      <StoriesBar />

      {/* Post Box */}
      <CreatePostBox onPostCreated={fetchFeed} />

      {/* Feed content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={32} />
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={fetchFeed}
              onPostShared={fetchFeed}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Flame}
          title="Your Feed is Quiet"
          description="Create your first post or add friends to see what's happening around you."
        />
      )}
    </div>
  );
}
