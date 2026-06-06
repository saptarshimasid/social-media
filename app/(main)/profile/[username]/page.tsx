"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth, Profile } from "@/components/auth-provider";
import ProfileHeader from "@/components/profile-header";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import PostCard, { Post } from "@/components/post-card";
import UserAvatar from "@/components/user-avatar";
import { useRouter } from "next/navigation";
import {
  Flame,
  ImageIcon,
  Film,
  FileText,
  UserMinus,
  Users,
  Info,
  Calendar,
  Mail,
  Hash,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { convertToWebP } from "@/lib/image-utils";
import { insertNotification } from "@/lib/notification-utils";
import Link from "next/link";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

type FriendStatus = "not_friends" | "request_sent" | "request_received" | "friends";
type ActiveTab = "all" | "about" | "friends" | "photos" | "reels";

export default function ProfilePage({ params }: ProfilePageProps) {
  const { username } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("not_friends");
  const [friendCount, setFriendCount] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendsList, setFriendsList] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

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
            const { data: req } = await supabase
              .from("friend_requests")
              .select("*")
              .or(
                `and(sender_id.eq.${user.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${user.id})`
              )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, user?.id]);

  // 2. Fetch Posts (for "All" tab)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedProfile?.id]);

  // 3. Fetch Friends list (lazy – only when Friends tab is active)
  const fetchFriends = useCallback(async () => {
    if (!viewedProfile) return;
    setLoadingFriends(true);
    try {
      // Get all friendship rows for this user
      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("user_id1, user_id2")
        .or(`user_id1.eq.${viewedProfile.id},user_id2.eq.${viewedProfile.id}`);

      if (error) throw error;

      // Collect the other user IDs
      const friendIds = (friendships || []).map((f) =>
        f.user_id1 === viewedProfile.id ? f.user_id2 : f.user_id1
      );

      if (friendIds.length === 0) {
        setFriendsList([]);
        return;
      }

      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);

      if (profilesErr) throw profilesErr;
      setFriendsList(profiles || []);
    } catch (err) {
      console.error("Error loading friends list:", err);
    } finally {
      setLoadingFriends(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedProfile?.id]);

  useEffect(() => {
    if (activeTab === "friends" && friendsList.length === 0) {
      fetchFriends();
    }
  }, [activeTab, fetchFriends, friendsList.length]);

  // Handle updates to profile cover or avatar
  const handleUpdatePictures = async (type: "avatar" | "cover", file: File) => {
    if (!user || !viewedProfile) return;

    try {
      const converted = await convertToWebP(file);
      const ext = converted.name.split(".").pop();
      const path = `${user.id}/${type}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("profiles")
        .upload(path, converted, { upsert: true });

      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(path);

      const updatePayload =
        type === "avatar"
          ? { profile_picture_url: publicUrl }
          : { cover_picture_url: publicUrl };

      const { error: dbErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (dbErr) throw dbErr;

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
      alert(
        `Upload failed: ${err instanceof Error ? err.message : "Error uploading file"}`
      );
    }
  };

  // Handle Friend Actions
  const handleFriendAction = async (
    action:
      | "send_request"
      | "cancel_request"
      | "accept_request"
      | "reject_request"
      | "remove_friend"
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

        // Notify recipient of request
        await insertNotification({
          user_id: viewedProfile.id,
          sender_id: user.id,
          type: "friend_request",
          target_type: "friend_request",
          target_id: user.id,
        });

        setFriendStatus("request_sent");
      } else if (action === "cancel_request" || action === "reject_request") {
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${viewedProfile.id}),and(sender_id.eq.${viewedProfile.id},receiver_id.eq.${user.id})`
          );

        if (error) throw error;
        setFriendStatus("not_friends");
      } else if (action === "accept_request") {
        const { error: reqError } = await supabase
          .from("friend_requests")
          .update({ status: "accepted" })
          .eq("sender_id", viewedProfile.id)
          .eq("receiver_id", user.id);

        if (reqError) throw reqError;

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
        await insertNotification({
          user_id: viewedProfile.id,
          sender_id: user.id,
          type: "friend_accept",
          target_type: "friend_request",
          target_id: user.id,
        });
      } else if (action === "remove_friend") {
        const u1 = user.id < viewedProfile.id ? user.id : viewedProfile.id;
        const u2 = user.id > viewedProfile.id ? user.id : viewedProfile.id;

        const { error: deleteErr } = await supabase
          .from("friendships")
          .delete()
          .eq("user_id1", u1)
          .eq("user_id2", u2);

        if (deleteErr) throw deleteErr;

        await supabase
          .from("friend_requests")
          .delete()
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${viewedProfile.id}),and(sender_id.eq.${viewedProfile.id},receiver_id.eq.${user.id})`
          );

        setFriendStatus("not_friends");
        setFriendCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to perform friend action:", err);
    }
  };

  const photoPosts = posts.filter(
    (p) => p.post_media && p.post_media.some((m: { media_type: string }) => m.media_type === "image")
  );
  const reelPosts = posts.filter(
    (p) => p.post_media && p.post_media.some((m: { media_type: string }) => m.media_type === "video")
  );

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

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <FileText size={15} /> },
    { id: "about", label: "About", icon: <Info size={15} /> },
    { id: "friends", label: "Friends", icon: <Users size={15} /> },
    { id: "photos", label: "Photos", icon: <ImageIcon size={15} /> },
    { id: "reels", label: "Reels", icon: <Film size={15} /> },
  ];

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

      {/* Tabs navigation */}
      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden glass shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-border/40">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all select-none cursor-pointer border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "friends" && friendCount > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "friends"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted"
                  }`}
                >
                  {friendCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== ALL TAB ===== */}
        {activeTab === "all" && (
          <div className="p-4 space-y-4">
            {loadingPosts ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size={24} />
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-4 max-w-2xl mx-auto">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="py-8">
                <EmptyState
                  icon={Flame}
                  title="No Posts Yet"
                  description={`${viewedProfile.full_name} hasn't shared any updates yet.`}
                />
              </div>
            )}
          </div>
        )}

        {/* ===== ABOUT TAB ===== */}
        {activeTab === "about" && (
          <div className="p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Bio */}
              {viewedProfile.bio && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Bio</h3>
                  <p className="text-sm text-foreground/90 leading-relaxed bg-secondary/30 rounded-2xl p-4 border border-border/30">
                    {viewedProfile.bio}
                  </p>
                </div>
              )}

              {/* Info Fields */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Details</h3>
                <div className="bg-secondary/20 rounded-2xl border border-border/30 divide-y divide-border/20 overflow-hidden">
                  {/* Username */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                      <Hash size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted font-medium">Username</p>
                      <p className="text-sm text-foreground font-semibold">@{viewedProfile.username}</p>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted font-medium">Full Name</p>
                      <p className="text-sm text-foreground font-semibold">{viewedProfile.full_name}</p>
                    </div>
                  </div>

                  {/* Email — only for own profile */}
                  {isOwnProfile && viewedProfile.email && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                        <Mail size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-medium">Email</p>
                        <p className="text-sm text-foreground font-semibold">
                          {viewedProfile.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Member since */}
                  {viewedProfile.created_at && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-medium">Member Since</p>
                        <p className="text-sm text-foreground font-semibold">
                          {format(new Date(viewedProfile.created_at), "MMMM yyyy")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-2xl border border-border/30 p-4 text-center">
                  <p className="text-xl font-bold text-foreground">{posts.length}</p>
                  <p className="text-[10px] text-muted font-medium mt-1">Posts</p>
                </div>
                <div className="bg-secondary/30 rounded-2xl border border-border/30 p-4 text-center">
                  <p className="text-xl font-bold text-foreground">{friendCount}</p>
                  <p className="text-[10px] text-muted font-medium mt-1">Friends</p>
                </div>
                <div className="bg-secondary/30 rounded-2xl border border-border/30 p-4 text-center">
                  <p className="text-xl font-bold text-foreground">{photoPosts.length}</p>
                  <p className="text-[10px] text-muted font-medium mt-1">Photos</p>
                </div>
              </div>

              {/* No Info fallback */}
              {!viewedProfile.bio && !viewedProfile.created_at && (
                <EmptyState
                  icon={Info}
                  title="No Info Available"
                  description="This user hasn't added any information to their profile yet."
                />
              )}
            </div>
          </div>
        )}

        {/* ===== FRIENDS TAB ===== */}
        {activeTab === "friends" && (
          <div className="p-4">
            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size={24} />
              </div>
            ) : friendsList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {friendsList.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${friend.username}`}
                    className="flex items-center gap-3 p-3.5 bg-secondary/30 hover:bg-secondary/60 border border-border/30 rounded-2xl transition-all group"
                  >
                    <UserAvatar
                      src={friend.profile_picture_url}
                      name={friend.full_name}
                      size={44}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {friend.full_name}
                      </p>
                      <p className="text-[11px] text-muted truncate">@{friend.username}</p>
                    </div>
                    {user && friend.id !== user.id && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/messages?chat=${friend.id}`);
                        }}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                        title="Message"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8">
                <EmptyState
                  icon={Users}
                  title="No Friends Yet"
                  description={`${viewedProfile.full_name} hasn't connected with anyone yet.`}
                />
              </div>
            )}
          </div>
        )}

        {/* ===== PHOTOS TAB ===== */}
        {activeTab === "photos" && (
          <div className="p-4">
            {photoPosts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photoPosts.flatMap((p) =>
                  (p.post_media || [])
                    .filter((m: { media_type: string }) => m.media_type === "image")
                    .map((m: { id: string; media_url: string }) => (
                      <div
                        key={m.id}
                        className="aspect-square rounded-2xl overflow-hidden bg-secondary border border-border/20 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.media_url}
                          alt="Photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className="py-8">
                <EmptyState
                  icon={ImageIcon}
                  title="No Photos"
                  description="Uploaded images will appear here."
                />
              </div>
            )}
          </div>
        )}

        {/* ===== REELS TAB ===== */}
        {activeTab === "reels" && (
          <div className="p-4">
            {reelPosts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {reelPosts.flatMap((p) =>
                  (p.post_media || [])
                    .filter((m: { media_type: string }) => m.media_type === "video")
                    .map((m: { id: string; media_url: string }) => (
                      <div
                        key={m.id}
                        className="aspect-[9/16] rounded-2xl overflow-hidden bg-secondary border border-border/20 relative group cursor-pointer"
                      >
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          src={m.media_url}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                          onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-2 bg-black/50 rounded-full">
                            <Film size={20} className="text-white" />
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className="py-8">
                <EmptyState
                  icon={Film}
                  title="No Reels"
                  description="Uploaded short videos will appear here."
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
