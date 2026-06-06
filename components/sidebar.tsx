"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Film, MessageSquare, Users, Bell, Settings, User, UsersRound, Store } from "lucide-react";
import { useAuth } from "./auth-provider";
import UserAvatar from "./user-avatar";

export default function Sidebar() {
  const { profile } = useAuth();
  const pathname = usePathname();

  const navigation = [
    { name: "Home Feed", href: "/", icon: Home },
    { name: "Reels", href: "/reels", icon: Film },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "Find Friends", href: "/friends", icon: Users },
    { name: "Groups", href: "/groups", icon: UsersRound },
    { name: "Marketplace", href: "/marketplace", icon: Store },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border/40 p-4 gap-6 shrink-0 h-[calc(100vh-4rem)] sticky top-16 bg-background/50 overflow-y-auto">
      {/* Profile summary card */}
      {profile && (
        <Link
          href={`/profile/${profile.username}`}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40 hover:bg-secondary/70 transition-all group"
        >
          <UserAvatar
            src={profile.profile_picture_url}
            name={profile.full_name}
            size={44}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {profile.full_name}
            </span>
            <span className="text-xs text-muted truncate">
              @{profile.username}
            </span>
          </div>
        </Link>
      )}

      {/* Navigation links */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-foreground hover:bg-secondary border border-transparent hover:border-border/30"
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {profile && (
          <Link
            href={`/profile/${profile.username}`}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
              pathname === `/profile/${profile.username}`
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-foreground hover:bg-secondary border border-transparent hover:border-border/30"
            }`}
          >
            <User size={18} />
            <span>My Profile</span>
          </Link>
        )}
      </nav>

      {/* Version badge */}
      <div className="text-[10px] text-muted text-center py-2 border-t border-border/40 flex items-center justify-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-white border border-border/30 flex items-center justify-center shrink-0">
          <span className="text-[8px] font-black bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent leading-none select-none">S</span>
        </div>
        SocialConnect v1.0
      </div>
    </aside>
  );
}
