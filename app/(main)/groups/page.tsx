"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Users, Image as ImageIcon, Upload } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "@/components/user-avatar";
import LoadingSpinner from "@/components/loading-spinner";
import EmptyState from "@/components/empty-state";

interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_picture_url: string | null;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
}

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"my" | "discover">("my");

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const supabase = createClient();

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: allGroups, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch member counts and membership status
      const enriched = await Promise.all(
        (allGroups || []).map(async (g: Group) => {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", g.id);

          const { data: membership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", g.id)
            .eq("user_id", user.id)
            .maybeSingle();

          return {
            ...g,
            member_count: count || 0,
            is_member: !!membership,
          };
        })
      );

      setGroups(enriched);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchGroups(), 0);
    return () => clearTimeout(timer);
  }, [fetchGroups]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);

    try {
      let coverUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/group-cover-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("posts").upload(path, coverFile);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        coverUrl = data.publicUrl;
      }

      const { data: newGroup, error: createErr } = await supabase
        .from("groups")
        .insert({
          name: newName.trim(),
          description: newDesc.trim() || null,
          cover_picture_url: coverUrl,
          creator_id: user.id,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // Auto-join as admin
      await supabase.from("group_members").insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: "admin",
      });

      setNewName("");
      setNewDesc("");
      setCoverFile(null);
      setCoverPreview(null);
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (groupId: string) => {
    if (!user) return;
    try {
      await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        role: "member",
      });
      fetchGroups();
    } catch (err) {
      console.error("Failed to join group:", err);
    }
  };

  const handleLeave = async (groupId: string) => {
    if (!user) return;
    try {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);
      fetchGroups();
    } catch (err) {
      console.error("Failed to leave group:", err);
    }
  };

  const filtered = groups.filter((g) => {
    const matchSearch =
      !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (tab === "my") return matchSearch && g.is_member;
    return matchSearch && !g.is_member;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Groups</h1>
          <p className="text-xs text-muted mt-0.5">Connect with people who share your interests</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Create Group</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-secondary rounded-2xl p-1">
          <button
            onClick={() => setTab("my")}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              tab === "my"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            My Groups
          </button>
          <button
            onClick={() => setTab("discover")}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              tab === "discover"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Discover
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-2xl bg-secondary pl-10 pr-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
          />
        </div>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={32} />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {filtered.map((group) => (
            <div
              key={group.id}
              className="bg-card border border-border/40 rounded-3xl overflow-hidden shadow-sm glass hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              {/* Cover */}
              <div className="h-28 sm:h-32 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 relative overflow-hidden">
                {group.cover_picture_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.cover_picture_url}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <h3 className="text-sm font-bold text-white truncate">{group.name}</h3>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                {group.description && (
                  <p className="text-xs text-muted line-clamp-2 mb-2">{group.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted flex items-center gap-1">
                    <Users size={12} />
                    {group.member_count} {group.member_count === 1 ? "member" : "members"}
                  </span>
                  {group.is_member ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeave(group.id);
                      }}
                      className="px-3 py-1 text-[10px] font-semibold text-rose-500 bg-rose-500/10 rounded-full hover:bg-rose-500/20 transition-colors cursor-pointer"
                    >
                      Leave
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoin(group.id);
                      }}
                      className="px-3 py-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={tab === "my" ? "No Groups Yet" : "Nothing to Discover"}
          description={
            tab === "my"
              ? "Create a group or discover existing ones to join."
              : "All groups have been joined! Try creating a new one."
          }
        />
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !creating && setShowCreate(false)} />
          <div className="w-full max-w-md rounded-3xl bg-card border border-border/40 shadow-2xl p-6 relative z-10 glass animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <h2 className="text-lg font-bold text-foreground">Create New Group</h2>
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="p-1.5 rounded-full hover:bg-secondary text-muted transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Cover upload */}
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Cover Image (Optional)</label>
                <div
                  className="h-28 rounded-2xl border-2 border-dashed border-border/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/40 transition-colors relative"
                  onClick={() => document.getElementById("group-cover-input")?.click()}
                >
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted">
                      <Upload size={20} />
                      <span className="text-[10px] font-medium">Click to upload cover</span>
                    </div>
                  )}
                  <input
                    id="group-cover-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setCoverFile(f);
                        setCoverPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Group Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Photography Enthusiasts"
                  required
                  className="w-full h-10 rounded-2xl bg-secondary px-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this group about?"
                  rows={3}
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Group</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
