"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, UserPlus, UserMinus, Crown, Shield } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "@/components/user-avatar";
import LoadingSpinner from "@/components/loading-spinner";
import CreatePostBox from "@/components/create-post-box";
import PostCard, { Post } from "@/components/post-card";
import EmptyState from "@/components/empty-state";
import Link from "next/link";

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  cover_picture_url: string | null;
  creator_id: string;
  created_at: string;
}

interface MemberInfo {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const supabase = createClient();

  const fetchGroup = useCallback(async () => {
    if (!user || !groupId) return;
    setLoading(true);

    try {
      // Fetch group info
      const { data: groupData, error: groupErr } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (groupErr) throw groupErr;
      setGroup(groupData);
      setIsCreator(groupData.creator_id === user.id);

      // Fetch members
      const { data: membersData } = await supabase
        .from("group_members")
        .select("id, user_id, role, profiles(full_name, username, profile_picture_url)")
        .eq("group_id", groupId);

      setMembers((membersData as unknown as MemberInfo[]) || []);
      setIsMember(
        (membersData || []).some((m: Record<string, unknown>) => m.user_id === user.id)
      );

      // Fetch group posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, post_media(*), profiles(*)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      setPosts((postsData as unknown as Post[]) || []);
    } catch (err) {
      console.error("Failed to load group:", err);
    } finally {
      setLoading(false);
    }
  }, [user, groupId, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchGroup(), 0);
    return () => clearTimeout(timer);
  }, [fetchGroup]);

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    try {
      await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        role: "member",
      });
      fetchGroup();
    } catch (err) {
      console.error("Failed to join:", err);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setJoining(true);
    try {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);
      fetchGroup();
    } catch (err) {
      console.error("Failed to leave:", err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={36} />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-sm">Group not found.</p>
        <button
          onClick={() => router.push("/groups")}
          className="mt-4 text-primary font-semibold text-sm hover:underline cursor-pointer"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back button */}
      <button
        onClick={() => router.push("/groups")}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>All Groups</span>
      </button>

      {/* Cover & Title */}
      <div className="bg-card border border-border/40 rounded-3xl overflow-hidden shadow-sm glass">
        <div className="h-40 sm:h-52 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 relative">
          {group.cover_picture_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.cover_picture_url}
              alt={group.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <div className="p-4 sm:p-5 -mt-10 relative z-10">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 drop-shadow-md">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-sm text-foreground/80 mt-2">{group.description}</p>
          )}

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-4 text-xs text-muted">
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
              >
                <Users size={14} />
                <span className="font-semibold">{members.length} members</span>
              </button>
              <span>
                Created {new Date(group.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Join/Leave */}
            {isMember ? (
              <button
                onClick={handleLeave}
                disabled={joining || isCreator}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-2xl hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserMinus size={14} />
                {isCreator ? "Owner" : "Leave Group"}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-2xl hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {joining ? <LoadingSpinner size={14} /> : <UserPlus size={14} />}
                Join Group
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Members Panel (toggle) */}
      {showMembers && (
        <div className="bg-card border border-border/40 rounded-3xl p-4 shadow-sm glass animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-foreground mb-3">Members</h3>
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/profile/${m.profiles.username}`}
                className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-secondary transition-colors"
              >
                <UserAvatar
                  src={m.profiles.profile_picture_url}
                  name={m.profiles.full_name}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {m.profiles.full_name}
                  </p>
                  <p className="text-[10px] text-muted truncate">@{m.profiles.username}</p>
                </div>
                {m.role === "admin" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-semibold">
                    <Crown size={10} />
                    Admin
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Post in Group */}
      {isMember && (
        <CreatePostBox onPostCreated={fetchGroup} groupId={groupId} />
      )}

      {/* Group Posts */}
      {posts.length > 0 ? (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={fetchGroup} onPostShared={fetchGroup} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No Posts Yet"
          description={
            isMember
              ? "Be the first to post in this group!"
              : "Join this group to see and create posts."
          }
        />
      )}
    </div>
  );
}
