"use client";

import React, { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth, Profile } from "@/components/auth-provider";
import ProfileHeader from "@/components/profile-header";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import { Flame, ImageIcon, Film, FileText, UserMinus } from "lucide-react";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

type FriendStatus = "not_friends" | "request_sent" | "request_received" | "friends";

export default function ProfilePage({ params }: ProfilePageProps) {
  const { username } = use(params);
  const { user } = useAuth();
  
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("not_friends");
  const [friendCount, setFriendCount] = useState(0);
  const [posts, setPosts] = useState<unknown[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "photos" | "reels">("posts");

  const supabase = createClient();

  const isOwnProfile = user?.id === viewedProfile?.id;

  // 1. Fetch Profile Info
  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setViewedProfile(null);
          setLoading(false);
          return;
        }

        setViewedProfile(profileData);

        // Fetch Friend count
        const { count, error: countError } = await supabase
          .from("friendships")
          .select("*", { count: "exact", head: true })
          .or(`user_id1.eq.${profileData.id},user_id2.eq.${profileData.id}`);

        if (!countError) {
          setFriendCount(count || 0);
        }

        // Fetch relationship status if not own profile
        if (user && user.id !== profileData.id) {
          // Check friendships
          const user_id1 = user.id < profileData.id ? user.id : profileData.id;
          const user_id2 = user.id > profileData.id ? user.id : profileData.id;

          const { data: friendship } = await supabase
            .from("friendships")
            .select("*")
            .eq("user_id1", user_id1)
            .eq("user_id2", user_id2)
            .maybeSingle();

          if (friendship) {
            setFriendStatus("friends");
          } else {
            // Check sent requests
            const { data: req } = await supabase
              .from("friend_requests")
              .select("*")
              .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${user.id})`)
              .maybeSingle();

            if (req) {
              if (req.status === "accepted") {
                setFriendStatus("friends");
              } else if (req.sender_id === user.id) {
                setFriendStatus("request_sent");
              } else {
                setFriendStatus("request_received");
              }
            } else {
              setFriendStatus("not_friends");
            }
          }
        }
      } catch (err) {
        console.error("Error loading profile details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [username, user, supabase]);

  // 2. Fetch User Content (Posts)
  useEffect(() => {
    if (!viewedProfile) return;

    const fetchUserPosts = async () => {
      setLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*, post_media(*), profiles(*)")
          .eq("user_id", viewedProfile.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (err) {
        console.error("Error loading user posts:", err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchUserPosts();
  }, [viewedProfile, supabase]);

  // Handle updates to profile cover or avatar
  const handleUpdatePictures = async (type: "avatar" | "cover", file: File) => {
    if (!user || !viewedProfile) return;

    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${type}-${Date.now()}.${ext}`;

      // Upload file to profiles bucket
      const { error: uploadErr } = await supabase.storage
        .from("profiles")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      // Get public Url
      const { data: { publicUrl } } = supabase.storage
        .from("profiles")
        .getPublicUrl(path);

      // Update Database
      const updatePayload =
        type === "avatar"
          ? { profile_picture_url: publicUrl }
          : { cover_picture_url: publicUrl };

      const { error: dbErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (dbErr) throw dbErr;

      // Update local state
      setViewedProfile((prev) =>
        prev
          ? {
              ...prev,
              ...(type === "avatar"
                ? { profile_picture_url: publicUrl }
                : { cover_picture_url: publicUrl }),
            }
          : null
      );
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : "Error uploading file"}`);
    }
  };

  // Handle Friend Actions (Add, Cancel, Accept, Reject, Unfriend)
  const handleFriendAction = async (
    action: "send_request" | "cancel_request" | "accept_request" | "reject_request" | "remove_friend"
  ) => {
    if (!user || !viewedProfile) return;

    try {
      if (action === "send_request") {
        const { error } = await supabase.from("friend_requests").insert({
          sender_id: user.id,
          receiver_id: viewedProfile.id,
          status: "pending",
        });
        if (error) throw error;

        // Trigger notification
        await supabase.from("notifications").insert({
          user_id: viewedProfile.id,
          sender_id: user.id,
          type: "friend_request",
          target_type: "friend_request",
          target_id: user.id,
        });

        setFriendStatus("request_sent");
      } 
      else if (action === "cancel_request" || action === "reject_request") {
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${viewedProfile.id}),and(sender_id.eq.${viewedProfile.id},receiver_id.eq.${user.id})`);
        
        if (error) throw error;
        setFriendStatus("not_friends");
      } 
      else if (action === "accept_request") {
        // Accept request
        const { error: reqError } = await supabase
          .from("friend_requests")
          .update({ status: "accepted" })
          .eq("sender_id", viewedProfile.id)
          .eq("receiver_id", user.id);

        if (reqError) throw reqError;

        // Add friendship
        const u1 = user.id < viewedProfile.id ? user.id : viewedProfile.id;
        const u2 = user.id > viewedProfile.id ? user.id : viewedProfile.id;

        const { error: friendErr } = await supabase.from("friendships").insert({
          user_id1: u1,
          user_id2: u2,
        });

        if (friendErr) throw friendErr;

        setFriendStatus("friends");
        setFriendCount((prev) => prev + 1);

        // Notify user of acceptance
        await supabase.from("notifications").insert({
          user_id: viewedProfile.id,
          sender_id: user.id,
          type: "friend_accept",
          target_type: "friend_request",
          target_id: user.id,
        });
      } 
      else if (action === "remove_friend") {
        // Remove friendship
        const u1 = user.id < viewedProfile.id ? user.id : viewedProfile.id;
        const u2 = user.id > viewedProfile.id ? user.id : viewedProfile.id;

        const { error: deleteErr } = await supabase
          .from("friendships")
          .delete()
          .eq("user_id1", u1)
          .eq("user_id2", u2);

        if (deleteErr) throw deleteErr;

        // Delete any leftover request
        await supabase
          .from("friend_requests")
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${viewedProfile.id}),and(sender_id.eq.${viewedProfile.id},receiver_id.eq.${user.id})`);

        setFriendStatus("not_friends");
        setFriendCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to perform friend action:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={36} />
      </div>
    );
  }

  if (!viewedProfile) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={UserMinus}
          title="User Not Found"
          description="The profile you are looking for does not exist or may have been deactivated."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Panel */}
      <ProfileHeader
        viewedProfile={viewedProfile}
        isOwnProfile={isOwnProfile}
        friendStatus={friendStatus}
        friendCount={friendCount}
        onFriendAction={handleFriendAction}
        onUpdatePictures={handleUpdatePictures}
      />

      {/* Tabs Menu navigation */}
      <div className="flex border-b border-border/40 pb-px mb-2 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-2 px-4 py-3 transition-colors select-none cursor-pointer border-b-2 ${
            activeTab === "posts"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FileText size={16} />
          Posts
        </button>
        <button
          onClick={() => setActiveTab("photos")}
          className={`flex items-center gap-2 px-4 py-3 transition-colors select-none cursor-pointer border-b-2 ${
            activeTab === "photos"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <ImageIcon size={16} />
          Photos
        </button>
        <button
          onClick={() => setActiveTab("reels")}
          className={`flex items-center gap-2 px-4 py-3 transition-colors select-none cursor-pointer border-b-2 ${
            activeTab === "reels"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Film size={16} />
          Reels
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "posts" && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {loadingPosts ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size={24} />
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {/* Post cards will go here in Phase 4 */}
              <p className="text-center text-xs text-muted py-4">
                Found {posts.length} posts. Full posts viewer will be enabled in Phase 4.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={Flame}
              title="No Posts Yet"
              description={`${viewedProfile.full_name} has not shared any updates yet.`}
            />
          )}
        </div>
      )}

      {activeTab === "photos" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Extract media from posts in future, simple empty state for now */}
          <div className="col-span-full py-6">
            <EmptyState
              icon={ImageIcon}
              title="No Photos"
              description="Uploaded images will appear here."
            />
          </div>
        </div>
      )}

      {activeTab === "reels" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-full py-6">
            <EmptyState
              icon={Film}
              title="No Reels"
              description="Uploaded short videos will appear here."
            />
          </div>
        </div>
      )}
    </div>
  );
}
