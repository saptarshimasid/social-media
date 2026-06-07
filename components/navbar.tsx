"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, MessageSquare, LogOut, User, Settings, Users, UsersRound, Store } from "lucide-react";
import { useAuth } from "./auth-provider";
import { useNotifications } from "./notification-provider";
import { useChat } from "./chat-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "./user-avatar";
import ThemeToggle from "./theme-toggle";

export default function Navbar() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { unreadCount, unreadChatCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const { isOpen, setIsOpen } = useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/friends?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-all duration-200">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto w-full">
        {/* Left: Brand / Logo */}
        <div className="flex-1 flex items-center justify-start gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-white border border-border/30 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow shrink-0">
              <span className="text-lg font-black bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent leading-none select-none" style={{fontFamily:'Inter,system-ui,sans-serif'}}>S</span>
            </div>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <div className="hidden md:flex items-center justify-center flex-initial w-full max-w-md mx-4">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search people, usernames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 rounded-full bg-secondary pl-10 pr-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-3">
          {/* Groups Link */}
          <Link
            href="/groups"
            className="hidden sm:flex p-2 rounded-xl text-foreground hover:bg-secondary border border-transparent hover:border-border/40 transition-all cursor-pointer"
            aria-label="Groups"
          >
            <UsersRound size={20} />
          </Link>

          {/* Marketplace Link */}
          <Link
            href="/marketplace"
            className="hidden sm:flex p-2 rounded-xl text-foreground hover:bg-secondary border border-transparent hover:border-border/40 transition-all cursor-pointer"
            aria-label="Marketplace"
          >
            <Store size={20} />
          </Link>

          {/* Search/Find Friends Icon (Mobile) */}
          <button
            onClick={() => {
              setShowMobileSearch(!showMobileSearch);
              setShowDropdown(false);
              setShowNotifDropdown(false);
            }}
            className={`p-2 rounded-xl border border-transparent hover:border-border/40 transition-all cursor-pointer md:hidden ${
              showMobileSearch ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-foreground hover:bg-secondary"
            }`}
            aria-label="Find Friends"
          >
            <Search size={20} />
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Messages */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 rounded-xl border border-transparent hover:border-border/40 transition-all cursor-pointer relative ${
              isOpen ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-foreground hover:bg-secondary"
            }`}
            aria-label="Messages"
          >
            <MessageSquare size={20} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md leading-none">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowDropdown(false);
              }}
              className="p-2 rounded-xl text-foreground hover:bg-secondary border border-transparent hover:border-border/40 transition-all cursor-pointer relative"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowNotifDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-2xl border border-border bg-card p-2 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 glass">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 mb-1">
                    <span className="text-xs font-bold">Recent Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 5).map((n) => {
                        let text = "interacted with you.";
                        if (n.target_type === "tag") {
                          text = "tagged you in a post.";
                        } else {
                          if (n.type === "friend_request") text = "sent you a friend request.";
                          if (n.type === "friend_accept") text = "accepted your request.";
                          if (n.type === "reaction") text = "reacted to your post.";
                          if (n.type === "comment") text = "commented on your post.";
                          if (n.type === "message") text = "messaged you.";
                        }

                        return (
                          <div
                            key={n.id}
                            onClick={async () => {
                              setShowNotifDropdown(false);
                              if (!n.is_read) await markAsRead(n.id);
                              if (n.type === "message") {
                                router.push("/messages");
                              } else {
                                router.push(`/profile/${n.sender.username}`);
                              }
                            }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                              n.is_read
                                ? "hover:bg-secondary/60"
                                : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary"
                            }`}
                          >
                            <UserAvatar
                              src={n.sender.profile_picture_url}
                              name={n.sender.full_name}
                              size={28}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-[11px] text-foreground leading-normal">
                                <span className="font-bold">{n.sender.full_name}</span>{" "}
                                {text}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-[10px] text-muted py-4">
                        No notifications yet.
                      </p>
                    )}
                  </div>

                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifDropdown(false)}
                    className="block text-center text-[10px] font-semibold text-primary hover:underline border-t border-border/40 pt-2 mt-1"
                  >
                    See all notifications
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Profile Dropdown */}
          {profile && (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 focus:outline-none cursor-pointer rounded-full"
              >
                <UserAvatar
                  src={profile.profile_picture_url}
                  name={profile.full_name}
                  size={36}
                  showOnlineStatus
                  onlineStatus={profile.online_status}
                />
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-card p-2 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 glass">
                    <div className="px-3 py-2 border-b border-border/40 mb-1">
                      <p className="text-sm font-semibold truncate">
                        {profile.full_name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        @{profile.username}
                      </p>
                      
                      {/* Status Selector */}
                      <div className="mt-2 flex items-center justify-between border-t border-border/10 pt-2">
                        <span className="text-[10px] text-muted font-bold">Status:</span>
                        <select
                          value={profile.online_status || "online"}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            const supabase = createClient();
                            const { error } = await supabase
                              .from("profiles")
                              .update({ online_status: newStatus })
                              .eq("id", profile.id);
                            if (!error) {
                              await refreshProfile();
                            }
                          }}
                          className="text-[10px] bg-secondary border border-border/45 rounded-lg px-1.5 py-0.5 focus:outline-none cursor-pointer"
                        >
                          <option value="online">🟢 Online</option>
                          <option value="busy">🔴 Busy</option>
                          <option value="offline">⚫ Offline</option>
                        </select>
                      </div>
                    </div>

                    <Link
                      href={`/profile/${profile.username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <User size={16} />
                      My Profile
                    </Link>

                    <Link
                      href={`/profile/${profile.username}/edit`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <Settings size={16} />
                      Edit Profile
                    </Link>

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Mobile Search Bar Expand */}
      {showMobileSearch && (
        <div className="md:hidden border-t border-border/40 bg-background/95 px-4 py-2.5 animate-in slide-in-from-top duration-200">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              autoFocus
              placeholder="Search people, usernames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 rounded-full bg-secondary pl-10 pr-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
            />
          </form>
        </div>
      )}
    </header>
  );
}
