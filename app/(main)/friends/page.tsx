"use client";

import React, { use, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "@/components/user-avatar";
import FriendButton from "@/components/friend-button";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import { Search, UserCheck, Users } from "lucide-react";
import Link from "next/link";

interface FriendsPageProps {
  searchParams: Promise<{ search?: string }>;
}

interface ProfileWithStatus {
  id: string;
  full_name: string;
  username: string;
  profile_picture_url: string | null;
  status: "not_friends" | "request_sent" | "request_received" | "friends";
}

export default function FriendsPage({ searchParams }: FriendsPageProps) {
  const { search: urlSearch } = use(searchParams);
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState(urlSearch || "");
  const [results, setResults] = useState<ProfileWithStatus[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ProfileWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  
  const PAGE_SIZE = 10;

  const supabase = createClient();

  // Reset pagination when search query changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setResults([]);
  }, [searchQuery]);

  // Load incoming requests (who sent request to us)
  useEffect(() => {
    if (!user) return;

    const fetchIncomingRequests = async () => {
      setLoadingRequests(true);
      try {
        const { data, error } = await supabase
          .from("friend_requests")
          .select("*, sender:profiles!friend_requests_sender_id_fkey(*)")
          .eq("receiver_id", user.id)
          .eq("status", "pending");

        if (error) throw error;

        interface DBReq {
          sender: {
            id: string;
            full_name: string;
            username: string;
            profile_picture_url: string | null;
          };
        }

        const mapped: ProfileWithStatus[] = (data as unknown as DBReq[] || []).map((req) => ({
          id: req.sender.id,
          full_name: req.sender.full_name,
          username: req.sender.username,
          profile_picture_url: req.sender.profile_picture_url,
          status: "request_received",
        }));

        setIncomingRequests(mapped);
      } catch (err) {
        console.error("Failed to load incoming friend requests:", err);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchIncomingRequests();
  }, [user, supabase]);

  // Load search results or suggestions with pagination
  useEffect(() => {
    if (!user) return;

    const fetchProfiles = async () => {
      if (page === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        // 1. Fetch relationships to build a map
        // Fetch friendships
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id1, user_id2")
          .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

        const friendIds = friendships
          ? friendships.map((f) => (f.user_id1 === user.id ? f.user_id2 : f.user_id1))
          : [];

        // Fetch requests
        const { data: requests } = await supabase
          .from("friend_requests")
          .select("*")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        // Build status mapping
        const statusMap: Record<string, "not_friends" | "request_sent" | "request_received" | "friends"> = {};
        
        friendIds.forEach((id) => {
          statusMap[id] = "friends";
        });

        requests?.forEach((r) => {
          const otherId = r.sender_id === user.id ? r.receiver_id : r.sender_id;
          if (r.status === "accepted") {
            statusMap[otherId] = "friends";
          } else if (r.sender_id === user.id) {
            statusMap[otherId] = "request_sent";
          } else {
            statusMap[otherId] = "request_received";
          }
        });

        // 2. Fetch profiles with range-based pagination
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let profilesData = [];
        if (searchQuery.trim()) {
          const query = searchQuery.trim();
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .neq("id", user.id)
            .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
            .range(from, to);

          if (error) throw error;
          profilesData = data || [];
        } else {
          // Suggested connections (exclude existing friends)
          const queryBuilder = supabase
            .from("profiles")
            .select("*")
            .neq("id", user.id);

          if (friendIds.length > 0) {
            // filter out friends
            queryBuilder.not("id", "in", `(${friendIds.join(",")})`);
          }

          const { data, error } = await queryBuilder.range(from, to);
          if (error) throw error;
          profilesData = data || [];
        }

        // 3. Map status to profiles
        const mapped: ProfileWithStatus[] = profilesData.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          username: p.username,
          profile_picture_url: p.profile_picture_url,
          status: statusMap[p.id] || "not_friends",
        }));

        setResults((prev) => (page === 0 ? mapped : [...prev, ...mapped]));
        setHasMore(profilesData.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to load profiles:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchProfiles();
  }, [searchQuery, page, user, supabase]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, loading, loadingMore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleStatusChange = (
    profileId: string, 
    newStatus: "not_friends" | "request_sent" | "request_received" | "friends"
  ) => {
    // If a request is accepted, remove it from incoming requests list
    if (newStatus === "friends") {
      setIncomingRequests((prev) => prev.filter((r) => r.id !== profileId));
    }
    // Update local results list status
    setResults((prev) =>
      prev.map((r) => (r.id === profileId ? { ...r, status: newStatus } : r))
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
          <Users size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Find Friends
          </h1>
          <p className="text-xs text-muted">
            Manage friend requests and connect with people you know.
          </p>
        </div>
      </div>

      {/* Grid Layout: Left results, Right incoming */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Panel: Search & Results */}
        <div className="md:col-span-2 space-y-5">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 rounded-2xl bg-card pl-12 pr-4 text-sm text-foreground placeholder-muted border border-border/40 focus:border-primary/40 focus:bg-background transition-all focus:outline-none glass shadow-sm"
            />
          </form>

          {/* Results section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2 px-1">
              <Users size={16} className="text-primary" />
              <span>{searchQuery.trim() ? "Search Results" : "People You May Know"}</span>
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size={28} />
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {results.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-3xl bg-card border border-border/40 flex items-center justify-between gap-3 glass shadow-sm group hover:border-border transition-all duration-200"
                    >
                      <Link
                        href={`/profile/${p.username}`}
                        className="flex items-center gap-3 min-w-0"
                      >
                        <UserAvatar
                          src={p.profile_picture_url}
                          name={p.full_name}
                          size={42}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate">
                            {p.full_name}
                          </span>
                          <span className="text-[10px] text-muted truncate">
                            @{p.username}
                          </span>
                        </div>
                      </Link>

                      <FriendButton
                        targetUserId={p.id}
                        initialStatus={p.status}
                        onStatusChange={(status) => handleStatusChange(p.id, status)}
                        variant="compact"
                      />
                    </div>
                  ))}
                </div>
                {/* Sentinel for infinite scroll */}
                <div ref={observerRef} className="h-10 flex items-center justify-center mt-2">
                  {loadingMore && <LoadingSpinner size={20} />}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Search}
                title="No People Found"
                description={`We couldn't find any profiles matching "${searchQuery}"`}
              />
            )}
          </div>
        </div>

        {/* Sidebar Panel: Incoming requests */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2 px-1">
            <UserCheck size={16} className="text-primary" />
            <span>Friend Requests</span>
          </h2>

          {loadingRequests ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner size={20} />
            </div>
          ) : incomingRequests.length > 0 ? (
            <div className="space-y-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-3xl bg-card border border-border/40 glass shadow-sm flex flex-col gap-3"
                >
                  <Link
                    href={`/profile/${req.username}`}
                    className="flex items-center gap-2.5 min-w-0"
                  >
                    <UserAvatar
                      src={req.profile_picture_url}
                      name={req.full_name}
                      size={36}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground hover:text-primary truncate">
                        {req.full_name}
                      </span>
                      <span className="text-[10px] text-muted truncate">
                        @{req.username}
                      </span>
                    </div>
                  </Link>
                  <div className="border-t border-border/40 pt-2.5">
                    <FriendButton
                      targetUserId={req.id}
                      initialStatus={req.status}
                      onStatusChange={(status) => handleStatusChange(req.id, status)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Pending Requests"
              description="You have no incoming friend requests right now."
            />
          )}
        </div>
      </div>
    </div>
  );
}
