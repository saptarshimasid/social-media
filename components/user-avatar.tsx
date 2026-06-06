import React from "react";
import Image from "next/image";
import { User } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  onlineStatus?: string | null;
  className?: string;
  zoom?: number;
  x?: number;
  y?: number;
}

export default function UserAvatar({
  src,
  name,
  size = 40,
  showOnlineStatus = false,
  isOnline = false,
  onlineStatus,
  className,
  zoom,
  x,
  y,
}: UserAvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  const currentStatus = onlineStatus || (isOnline ? "online" : "offline");

  return (
    <div className={`relative inline-block ${className || ""}`} style={{ width: size, height: size }}>
      {src ? (
        <div className="w-full h-full rounded-full overflow-hidden border border-border/60 bg-secondary/30">
          <Image
            src={src}
            alt={name || "User avatar"}
            width={size}
            height={size}
            className="object-cover w-full h-full"
            style={{
              transform: `translate(${x || 0}px, ${y || 0}px) scale(${zoom || 1})`,
              transformOrigin: "center",
              transition: "transform 0.1s ease-out",
            }}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold text-center select-none w-full h-full"
          style={{ fontSize: size * 0.4 }}
        >
          {initials || <User size={size * 0.5} />}
        </div>
      )}

      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-card ${
            currentStatus === "online"
              ? "bg-emerald-500 animate-pulse"
              : currentStatus === "busy"
              ? "bg-rose-500"
              : "bg-gray-400 dark:bg-gray-500"
          }`}
        />
      )}
    </div>
  );
}
