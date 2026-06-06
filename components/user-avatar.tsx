import React from "react";
import Image from "next/image";
import { User } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  className?: string;
}

export default function UserAvatar({
  src,
  name,
  size = 40,
  showOnlineStatus = false,
  isOnline = false,
  className,
}: UserAvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className={`relative inline-block ${className || ""}`} style={{ width: size, height: size }}>
      {src ? (
        <Image
          src={src}
          alt={name || "User avatar"}
          width={size}
          height={size}
          className="rounded-full object-cover aspect-square border border-border/60"
        />
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
            isOnline ? "bg-emerald-500" : "bg-muted"
          }`}
        />
      )}
    </div>
  );
}
