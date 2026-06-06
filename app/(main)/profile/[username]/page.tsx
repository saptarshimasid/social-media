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
  Cake,
  Heart,
  Smile,
  Compass,
  MapPin,
  Phone,
  Briefcase,
  Music,
  Plus,
  Trash2,
  Check,
  X,
  Edit2,
  GraduationCap,
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

  // Custom states for newly added About sections
  const [partnerProfile, setPartnerProfile] = useState<{ id: string; full_name: string; username: string } | null>(null);
  const [pendingRelRequests, setPendingRelRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Inline editing toggle states
  const [editBirthDate, setEditBirthDate] = useState(false);
  const [editGender, setEditGender] = useState(false);
  const [editRelationship, setEditRelationship] = useState(false);
  const [editHobbies, setEditHobbies] = useState(false);
  const [editWork, setEditWork] = useState(false);
  const [editEducation, setEditEducation] = useState(false);
  const [editInterests, setEditInterests] = useState(false);
  const [editContact, setEditContact] = useState(false);
  const [editAddress, setEditAddress] = useState(false);
  const [editTravel, setEditTravel] = useState(false);

  // Form states for inline editing
  const [formData, setFormData] = useState({
    birth_date: "" as string | null,
    gender: "" as string | null,
    hobbies: "" as string | null,
    relationship_status: "single" as string | null,
    relationship_partner_id: "" as string | null,
    work_history: [] as { organization: string; time_span: string }[],
    education: [] as { institution: string; passing_year: string }[],
    interests: {
      music: [] as string[],
      films: [] as string[],
      tv_shows: [] as string[],
      video_games: [] as string[],
      sports: [] as string[],
    },
    phone: "" as string | null,
    email: "" as string | null,
    address: "" as string | null,
    travel: [] as { destination: string; dates: string }[],
  });

  const supabase = createClient();
  const isOwnProfile = user?.id === viewedProfile?.id;

  // 1. Fetch Profile Info
  const fetchProfileData = useCallback(async () => {
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

      // Pre-fill form data for inline edits
      setFormData({
        birth_date: profileData.birth_date || "",
        gender: profileData.gender || "",
        hobbies: profileData.hobbies || "",
        relationship_status: profileData.relationship_status || "single",
        relationship_partner_id: profileData.relationship_partner_id || "",
        work_history: Array.isArray(profileData.work_history) ? profileData.work_history : [],
        education: Array.isArray(profileData.education) ? profileData.education : [],
        interests: profileData.interests && typeof profileData.interests === "object" ? {
          music: (profileData.interests as any).music || [],
          films: (profileData.interests as any).films || [],
          tv_shows: (profileData.interests as any).tv_shows || [],
          video_games: (profileData.interests as any).video_games || [],
          sports: (profileData.interests as any).sports || [],
        } : { music: [], films: [], tv_shows: [], video_games: [], sports: [] },
        phone: profileData.phone || "",
        email: profileData.email || "",
        address: profileData.address || "",
        travel: Array.isArray(profileData.travel) ? profileData.travel : [],
      });

      // Fetch partner profile name if relationship exists
      if (profileData.relationship_partner_id) {
        const { data: partnerData } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .eq("id", profileData.relationship_partner_id)
          .maybeSingle();
        setPartnerProfile(partnerData);
      } else {
        setPartnerProfile(null);
      }

      // Fetch pending relationship requests if own profile
      if (user && user.id === profileData.id) {
        const { data: relReqs } = await supabase
          .from("profiles")
          .select("id, full_name, username, relationship_status")
          .eq("relationship_partner_id", user.id)
          .eq("relationship_approved", false);
        setPendingRelRequests(relReqs || []);
      }

      // Fetch Friend count
      const { count, error: countError } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .or(`user_id1.eq.${profileData.id},user_id2.eq.${profileData.id}`);

      if (!countError) {
        setFriendCount(count || 0);
      }

      // Fetch friendship status if not own profile
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
  }, [username, user?.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

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
  }, [viewedProfile?.id]);

  // 3. Fetch Friends list (lazy – only when Friends tab is active)
  const fetchFriends = useCallback(async () => {
    if (!viewedProfile) return;
    setLoadingFriends(true);
    try {
      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("user_id1, user_id2")
        .or(`user_id1.eq.${viewedProfile.id},user_id2.eq.${viewedProfile.id}`);

      if (error) throw error;

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

  // Autocomplete search for partner profile
  const handlePartnerSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .ilike("full_name", `%${val}%`)
        .neq("id", user?.id || "")
        .limit(5);
      setSearchResults(data || []);
    } catch (err) {
      console.error("Failed to search partners:", err);
    }
  };

  // Save edits of About section fields
  const handleSaveAboutField = async (fields: Partial<typeof formData>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update(fields)
        .eq("id", user.id);

      if (error) throw error;
      await fetchProfileData();

      // Reset edit flags
      setEditBirthDate(false);
      setEditGender(false);
      setEditRelationship(false);
      setEditHobbies(false);
      setEditWork(false);
      setEditEducation(false);
      setEditInterests(false);
      setEditContact(false);
      setEditAddress(false);
      setEditTravel(false);
    } catch (err) {
      console.error("Failed to update profile field:", err);
      alert("Failed to update field. Please try again.");
    }
  };

  // Relationship status save (triggers partner approval notification)
  const handleSaveRelationship = async () => {
    if (!user) return;
    const relStatus = formData.relationship_status;
    const partnerId = formData.relationship_partner_id;

    const needsPartner = relStatus ? ["married", "engaged"].includes(relStatus) : false;
    const payload = {
      relationship_status: relStatus,
      relationship_partner_id: needsPartner ? partnerId : null,
      relationship_approved: !needsPartner, // single/separated/confused don't need approval
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (error) throw error;

      // Send approval notification if partner is selected
      if (needsPartner && partnerId) {
        await insertNotification({
          user_id: partnerId,
          sender_id: user.id,
          type: "friend_request",
          target_type: "relationship",
          target_id: user.id,
        });
      }

      await fetchProfileData();
      setEditRelationship(false);
    } catch (err) {
      console.error("Failed to save relationship details:", err);
      alert("Error saving relationship status.");
    }
  };

  // Relationship Approval Actions
  const handleRelationshipApproval = async (requestor: any, approve: boolean) => {
    if (!user) return;
    try {
      if (approve) {
        // 1. Approve initiator's profile
        const { error: err1 } = await supabase
          .from("profiles")
          .update({ relationship_approved: true })
          .eq("id", requestor.id);
        if (err1) throw err1;

        // 2. Set own profile to matched status
        const { error: err2 } = await supabase
          .from("profiles")
          .update({
            relationship_status: requestor.relationship_status,
            relationship_partner_id: requestor.id,
            relationship_approved: true,
          })
          .eq("id", user.id);
        if (err2) throw err2;

        // 3. Create a feed post about the event
        const relLabel = requestor.relationship_status === "married" ? "married" : "engaged";
        await supabase.from("posts").insert({
          user_id: requestor.id,
          content: `is now ${relLabel} to @${viewedProfile?.username}! 💍❤️`,
          type: "text",
        });

        // 4. Notify requestor
        await insertNotification({
          user_id: requestor.id,
          sender_id: user.id,
          type: "friend_accept",
          target_type: "relationship_accept",
          target_id: user.id,
        });
      } else {
        // Decline relationship request: reset requestor's status
        const { error } = await supabase
          .from("profiles")
          .update({
            relationship_status: null,
            relationship_partner_id: null,
            relationship_approved: false,
          })
          .eq("id", requestor.id);
        if (error) throw error;
      }

      // Re-fetch profile data to clear request banners
      await fetchProfileData();
    } catch (err) {
      console.error("Failed handling relationship request:", err);
    }
  };

  // Direct Wish Birthday handler (submits comment or creates a post)
  const wishBirthday = async () => {
    if (!user || !viewedProfile) return;
    try {
      // Find latest post of the user to comment on
      const { data: latestPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", viewedProfile.id)
        .limit(1);

      if (latestPosts && latestPosts.length > 0) {
        // Comment on their latest post
        const { error } = await supabase.from("comments").insert({
          user_id: user.id,
          target_type: "post",
          target_id: latestPosts[0].id,
          content: "Happy Birthday! 🎂🎉🥳 Wish you a wonderful year ahead!",
        });
        if (error) throw error;
        alert("Birthday wish posted as a comment on their post!");
      } else {
        // Create a new post tagging/wishing them on feed
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          content: `Happy Birthday to my friend @${viewedProfile.username}! 🎂🎉🥳 Have an amazing day!`,
          type: "text",
        });
        if (error) throw error;
        alert("Posted a birthday greeting on your feed!");
      }
    } catch (err) {
      console.error("Failed to wish birthday:", err);
    }
  };

  // Check if today is the user's birthday
  const isUserBirthdayToday = () => {
    if (!viewedProfile?.birth_date) return false;
    const today = new Date();
    const bday = new Date(viewedProfile.birth_date);
    return today.getDate() === bday.getDate() && today.getMonth() === bday.getMonth();
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

      {/* Birthday Celebration Banner */}
      {isUserBirthdayToday() && (
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-5 rounded-3xl text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-bounce duration-1000">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉🎂</span>
            <div>
              <h3 className="font-bold text-lg">It's {viewedProfile.full_name}'s birthday today!</h3>
              <p className="text-xs text-white/95 font-medium">Help them celebrate with a 'Happy Birthday' comment!</p>
            </div>
          </div>
          {!isOwnProfile && (
            <button
              onClick={wishBirthday}
              className="px-4 py-2 bg-white text-purple-700 hover:bg-white/90 font-bold rounded-2xl text-xs transition-all shadow active:scale-95 shrink-0"
            >
              Wish Happy Birthday 🥳
            </button>
          )}
        </div>
      )}

      {/* Relationship Approval Banner HUD for Owner */}
      {isOwnProfile && pendingRelRequests.length > 0 && (
        <div className="space-y-3">
          {pendingRelRequests.map((req) => (
            <div key={req.id} className="bg-card border border-rose-200 dark:border-rose-950 p-4 rounded-3xl flex items-center justify-between gap-3 shadow-sm glass">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-full">
                  <Heart size={18} className="fill-rose-500 animate-pulse" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  <span className="font-bold">@{req.username}</span> ({req.full_name}) wishes to specify they are in a{" "}
                  <span className="text-rose-500 capitalize">{req.relationship_status}</span> relationship with you.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleRelationshipApproval(req, false)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-[10px] font-bold text-foreground cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleRelationshipApproval(req, true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 text-[10px] font-bold cursor-pointer shadow"
                >
                  Approve 💍
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              
              {/* Profile Bio */}
              {viewedProfile.bio && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Bio</h3>
                  <p className="text-sm text-foreground/90 leading-relaxed bg-secondary/30 rounded-2xl p-4 border border-border/30">
                    {viewedProfile.bio}
                  </p>
                </div>
              )}

              {/* 1. Basic Info Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Basic Info</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 divide-y divide-border/20 overflow-hidden p-4 space-y-4">
                  
                  {/* Birth Date Field */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-500/10 text-pink-500 rounded-xl">
                        <Cake size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-medium">Birth Date</p>
                        {editBirthDate ? (
                          <input
                            type="date"
                            value={formData.birth_date || ""}
                            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                            className="mt-1 px-3 py-1 bg-background border border-border text-xs rounded-xl focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm text-foreground font-semibold">
                            {viewedProfile.birth_date
                              ? format(new Date(viewedProfile.birth_date), "MMMM d, yyyy")
                              : "Not specified"}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1">
                        {editBirthDate ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ birth_date: formData.birth_date || null })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditBirthDate(false)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditBirthDate(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Gender Field */}
                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Smile size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-medium">Gender</p>
                        {editGender ? (
                          <select
                            value={formData.gender || ""}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="mt-1 px-3 py-1 bg-background border border-border text-xs rounded-xl focus:outline-none capitalize"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">male</option>
                            <option value="female">female</option>
                            <option value="third gender">third gender</option>
                          </select>
                        ) : (
                          <p className="text-sm text-foreground font-semibold capitalize">
                            {viewedProfile.gender || "Not specified"}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1">
                        {editGender ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ gender: formData.gender || null })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditGender(false)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditGender(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Relationship Status Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Relationship</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
                        <Heart size={16} className={viewedProfile.relationship_status ? "fill-rose-500" : ""} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted font-medium">Status</p>
                        {editRelationship ? (
                          <div className="mt-2 space-y-2">
                            <select
                              value={formData.relationship_status || "single"}
                              onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })}
                              className="px-3 py-1.5 bg-background border border-border text-xs rounded-xl focus:outline-none capitalize w-full"
                            >
                              <option value="single">single</option>
                              <option value="married">married</option>
                              <option value="separated">separated</option>
                              <option value="engaged">engaged</option>
                              <option value="confused">confused</option>
                            </select>

                            {["married", "engaged"].includes(formData.relationship_status || "") && (
                              <div className="relative mt-2">
                                <p className="text-[9px] text-muted font-bold mb-1">Select Partner:</p>
                                <input
                                  type="text"
                                  placeholder="Type partner name to search..."
                                  value={searchQuery}
                                  onChange={(e) => handlePartnerSearch(e.target.value)}
                                  className="w-full h-8 px-3 text-xs bg-background border border-border rounded-xl focus:outline-none"
                                />

                                {searchResults.length > 0 && (
                                  <div className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-30 divide-y divide-border/40 overflow-hidden">
                                    {searchResults.map((partner) => (
                                      <button
                                        key={partner.id}
                                        onClick={() => {
                                          setFormData({ ...formData, relationship_partner_id: partner.id });
                                          setSearchQuery(partner.full_name);
                                          setSearchResults([]);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-secondary text-xs font-semibold block"
                                      >
                                        {partner.full_name} (@{partner.username})
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-foreground capitalize flex flex-wrap items-center gap-1">
                            <span>{viewedProfile.relationship_status || "Single"}</span>
                            {["married", "engaged"].includes(viewedProfile.relationship_status || "") && partnerProfile && (
                              <span className="text-xs text-muted normal-case font-normal">
                                {viewedProfile.relationship_status === "married" ? "married to" : "engaged to"}{" "}
                                <Link
                                  href={`/profile/${partnerProfile.username}`}
                                  className="font-bold text-primary hover:underline"
                                >
                                  {partnerProfile.full_name}
                                </Link>
                                {!viewedProfile.relationship_approved && (
                                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-bold border border-amber-500/20">
                                    Pending Approval
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editRelationship ? (
                          <>
                            <button
                              onClick={handleSaveRelationship}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditRelationship(false);
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditRelationship(true);
                              if (partnerProfile) setSearchQuery(partnerProfile.full_name);
                            }}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Hobbies Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Hobbies</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0 mt-0.5">
                        <Smile size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted font-medium">My Hobbies</p>
                        {editHobbies ? (
                          <textarea
                            value={formData.hobbies || ""}
                            onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                            placeholder="e.g. Photography, Cooking, Playing Guitar, Reading..."
                            rows={3}
                            className="w-full mt-2 p-3 text-xs bg-background border border-border rounded-xl focus:outline-none resize-none"
                          />
                        ) : (
                          <p className="text-sm text-foreground/90 font-medium leading-relaxed mt-1">
                            {viewedProfile.hobbies || "No hobbies listed yet."}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editHobbies ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ hobbies: formData.hobbies || null })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditHobbies(false)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditHobbies(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Work History Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Work History</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0 mt-0.5">
                        <Briefcase size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-[10px] text-muted font-medium">Professional Experience</p>
                        {editWork ? (
                          <div className="space-y-3 mt-2">
                            {formData.work_history.map((job, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-background p-2.5 rounded-2xl border border-border/40">
                                <input
                                  type="text"
                                  placeholder="Organization"
                                  value={job.organization}
                                  onChange={(e) => {
                                    const nextWork = [...formData.work_history];
                                    nextWork[idx].organization = e.target.value;
                                    setFormData({ ...formData, work_history: nextWork });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Time span (e.g. 2022-Present)"
                                  value={job.time_span}
                                  onChange={(e) => {
                                    const nextWork = [...formData.work_history];
                                    nextWork[idx].time_span = e.target.value;
                                    setFormData({ ...formData, work_history: nextWork });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextWork = formData.work_history.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, work_history: nextWork });
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  work_history: [...formData.work_history, { organization: "", time_span: "" }],
                                });
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-border/50 hover:bg-secondary rounded-xl text-xs font-semibold cursor-pointer text-foreground mt-2"
                            >
                              <Plus size={14} /> Add Job
                            </button>
                          </div>
                        ) : formData.work_history.length > 0 ? (
                          <div className="space-y-3.5 mt-1">
                            {formData.work_history.map((job, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">{job.organization}</span>
                                <span className="text-xs text-muted mt-0.5">{job.time_span}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/50 font-medium">No work experience listed yet.</p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editWork ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ work_history: formData.work_history })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditWork(false);
                                setFormData({
                                  ...formData,
                                  work_history: Array.isArray(viewedProfile.work_history) ? viewedProfile.work_history : [],
                                });
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditWork(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Education Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Education</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0 mt-0.5">
                        <GraduationCap size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-[10px] text-muted font-medium">Academic Background</p>
                        {editEducation ? (
                          <div className="space-y-3 mt-2">
                            {formData.education.map((edu, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-background p-2.5 rounded-2xl border border-border/40">
                                <input
                                  type="text"
                                  placeholder="School / College / University Name"
                                  value={edu.institution}
                                  onChange={(e) => {
                                    const nextEdu = [...formData.education];
                                    nextEdu[idx].institution = e.target.value;
                                    setFormData({ ...formData, education: nextEdu });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Passing year / Time span (e.g. 2018)"
                                  value={edu.passing_year}
                                  onChange={(e) => {
                                    const nextEdu = [...formData.education];
                                    nextEdu[idx].passing_year = e.target.value;
                                    setFormData({ ...formData, education: nextEdu });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextEdu = formData.education.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, education: nextEdu });
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  education: [...formData.education, { institution: "", passing_year: "" }],
                                });
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-border/50 hover:bg-secondary rounded-xl text-xs font-semibold cursor-pointer text-foreground mt-2"
                            >
                              <Plus size={14} /> Add Education
                            </button>
                          </div>
                        ) : formData.education.length > 0 ? (
                          <div className="space-y-3.5 mt-1">
                            {formData.education.map((edu, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">{edu.institution}</span>
                                <span className="text-xs text-muted mt-0.5">Class of {edu.passing_year}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/50 font-medium">No education history listed yet.</p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editEducation ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ education: formData.education })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditEducation(false);
                                setFormData({
                                  ...formData,
                                  education: Array.isArray(viewedProfile.education) ? viewedProfile.education : [],
                                });
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditEducation(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Interests Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Interests</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl shrink-0 mt-0.5">
                        <Music size={16} />
                      </div>
                      <div className="flex-1 space-y-4">
                        <p className="text-[10px] text-muted font-medium">Favorites & Hobbies</p>
                        {editInterests ? (
                          <div className="space-y-4 mt-2">
                            {(["music", "films", "tv_shows", "video_games", "sports"] as const).map((cat) => (
                              <div key={cat} className="space-y-1">
                                <label className="text-[9px] text-muted font-bold capitalize">{cat.replace("_", " ")}:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Rock, Pop (comma-separated)..."
                                  value={formData.interests[cat].join(", ")}
                                  onChange={(e) => {
                                    const val = e.target.value.split(",").map((s) => s.trim()).filter((s) => s !== "");
                                    const nextInterests = { ...formData.interests, [cat]: val };
                                    setFormData({ ...formData, interests: nextInterests });
                                  }}
                                  className="w-full h-8 px-3 text-xs bg-background border border-border rounded-xl focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-3.5 mt-1">
                            {(["music", "films", "tv_shows", "video_games", "sports"] as const).map((cat) => {
                              const list = formData.interests[cat];
                              return (
                                <div key={cat} className="flex flex-col">
                                  <span className="text-[10px] text-muted capitalize font-semibold">{cat.replace("_", " ")}</span>
                                  <span className="text-sm font-semibold text-foreground/90 mt-0.5">
                                    {list.length > 0 ? list.join(", ") : "Not listed"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editInterests ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ interests: formData.interests })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditInterests(false);
                                setFormData({
                                  ...formData,
                                  interests: viewedProfile.interests && typeof viewedProfile.interests === "object" ? {
                                    music: (viewedProfile.interests as any).music || [],
                                    films: (viewedProfile.interests as any).films || [],
                                    tv_shows: (viewedProfile.interests as any).tv_shows || [],
                                    video_games: (viewedProfile.interests as any).video_games || [],
                                    sports: (viewedProfile.interests as any).sports || [],
                                  } : { music: [], films: [], tv_shows: [], video_games: [], sports: [] },
                                });
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditInterests(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 6. Contact details Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Contact Info</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  
                  {/* Phone */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-teal-500/10 text-teal-500 rounded-xl shrink-0">
                        <Phone size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted font-medium">Phone Number</p>
                        {editContact ? (
                          <input
                            type="text"
                            value={formData.phone || ""}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full h-8 mt-1 px-3 text-xs bg-background border border-border rounded-xl focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm text-foreground font-semibold">
                            {viewedProfile.phone || "Not specified"}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editContact ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ phone: formData.phone || null })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditContact(false)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditContact(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted font-medium">Email Address</p>
                      <p className="text-sm text-foreground font-semibold">{viewedProfile.email || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. Address Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Postal Address</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0 mt-0.5">
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted font-medium">Address</p>
                        {editAddress ? (
                          <textarea
                            value={formData.address || ""}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="e.g. 123 Main St, New York, NY 10001"
                            rows={3}
                            className="w-full mt-2 p-3 text-xs bg-background border border-border rounded-xl focus:outline-none resize-none"
                          />
                        ) : (
                          <p className="text-sm text-foreground/90 font-medium leading-relaxed mt-1">
                            {viewedProfile.address || "No address listed yet."}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editAddress ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ address: formData.address || null })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditAddress(false)}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditAddress(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 8. Travel Destinations Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center justify-between">
                  <span>Travel History</span>
                </h3>
                <div className="bg-secondary/20 rounded-3xl border border-border/30 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0 mt-0.5">
                        <Compass size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-[10px] text-muted font-medium">Recent Destinations Visited</p>
                        {editTravel ? (
                          <div className="space-y-3 mt-2">
                            {formData.travel.map((trip, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-background p-2.5 rounded-2xl border border-border/40">
                                <input
                                  type="text"
                                  placeholder="Destination"
                                  value={trip.destination}
                                  onChange={(e) => {
                                    const nextTravel = [...formData.travel];
                                    nextTravel[idx].destination = e.target.value;
                                    setFormData({ ...formData, travel: nextTravel });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <input
                                  type="text"
                                  placeholder="Dates (e.g. May 2026)"
                                  value={trip.dates}
                                  onChange={(e) => {
                                    const nextTravel = [...formData.travel];
                                    nextTravel[idx].dates = e.target.value;
                                    setFormData({ ...formData, travel: nextTravel });
                                  }}
                                  className="w-1/2 px-2.5 py-1 text-xs bg-secondary border border-border/40 rounded-xl focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextTravel = formData.travel.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, travel: nextTravel });
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  travel: [...formData.travel, { destination: "", dates: "" }],
                                });
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-border/50 hover:bg-secondary rounded-xl text-xs font-semibold cursor-pointer text-foreground mt-2"
                            >
                              <Plus size={14} /> Add Destination
                            </button>
                          </div>
                        ) : formData.travel.length > 0 ? (
                          <div className="space-y-3.5 mt-1">
                            {formData.travel.map((trip, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">{trip.destination}</span>
                                <span className="text-xs text-muted mt-0.5">{trip.dates}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/50 font-medium">No travel destination listed yet.</p>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-1 shrink-0">
                        {editTravel ? (
                          <>
                            <button
                              onClick={() => handleSaveAboutField({ travel: formData.travel })}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditTravel(false);
                                setFormData({
                                  ...formData,
                                  travel: Array.isArray(viewedProfile.travel) ? viewedProfile.travel : [],
                                });
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditTravel(true)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
                      zoom={friend.profile_photo_zoom || 1}
                      x={friend.profile_photo_x || 0}
                      y={friend.profile_photo_y || 0}
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
