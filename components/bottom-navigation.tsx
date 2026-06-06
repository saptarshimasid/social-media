"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Film, MessageSquare, UsersRound, Store, Bell } from "lucide-react";
import { useNotifications } from "./notification-provider";

export default function BottomNavigation() {
  const pathname = usePathname();
  const { unreadCount, unreadChatCount } = useNotifications();

  const navigation = [
    { name: "Home", href: "/", icon: Home },
    { name: "Reels", href: "/reels", icon: Film },
    { name: "Groups", href: "/groups", icon: UsersRound },
    { name: "Market", href: "/marketplace", icon: Store },
    { name: "Chat", href: "/messages", icon: MessageSquare },
    { name: "Alerts", href: "/notifications", icon: Bell },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border/40 backdrop-blur-md pb-safe">
      <div className="flex h-14 items-center justify-around px-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 text-[9px] font-medium transition-colors ${
                isActive
                  ? "text-primary scale-105"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={18} className={isActive ? "stroke-[2.5]" : "stroke-[2]"} />
                {item.name === "Alerts" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                {item.name === "Chat" && unreadChatCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                )}
              </div>
              <span className="mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
