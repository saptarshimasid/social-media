"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, UserPlus, UserMinus, UserCheck, MessageSquare, Camera, Sparkles } from "lucide-react";
import { Profile } from "./auth-provider";
import UserAvatar from "./user-avatar";

interface ProfileHeaderProps {
  viewedProfile: Profile;
  isOwnProfile: boolean;
  friendStatus: "not_friends" | "request_sent" | "request_received" | "friends";
  friendCount?: number;
  onFriendAction?: (action: "send_request" | "cancel_request" | "accept_request" | "reject_request" | "remove_friend") => Promise<void>;
  onUpdatePictures?: (type: "avatar" | "cover", file: File) => Promise<void>;
}

export default function ProfileHeader({
  viewedProfile,
  isOwnProfile,
  friendStatus,
  friendCount = 0,
  onFriendAction,
  onUpdatePictures,
}: ProfileHeaderProps) {
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "cover") => {
    if (e.target.files && e.target.files[0] && onUpdatePictures) {
      setUploading(type);
      try {
        await onUpdatePictures(type, e.target.files[0]);
      } catch (err) {
        console.error(`Failed to upload ${type} image:`, err);
      } finally {
        setUploading(null);
      }
    }
  };

  return (
    <div className="bg-card border border-border/40 rounded-3xl overflow-hidden glass shadow-sm mb-6 animate-in fade-in duration-300">
      {/* Cover Image Container */}
      <div className="relative h-60 sm:h-72 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 overflow-hidden group">
        {viewedProfile.cover_picture_url ? (
          <Image
            src={viewedProfile.cover_picture_url}
            alt={`${viewedProfile.full_name}'s cover`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted/30">
            <Sparkles size={48} />
          </div>
        )}

        {isOwnProfile && onUpdatePictures && (
          <label className="absolute bottom-4 right-4 p-2.5 bg-background/80 hover:bg-background rounded-full border border-border/30 backdrop-blur-md cursor-pointer transition-all shadow-md active:scale-95 text-foreground z-10 flex items-center gap-1.5 text-xs font-semibold">
            <Camera size={14} />
            <span>{uploading === "cover" ? "Uploading..." : "Edit Cover"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "cover")}
              disabled={uploading !== null}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Info Overlay */}
      <div className="relative px-6 pb-6 pt-16 sm:pt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        {/* Profile Avatar Overlap */}
        <div className="absolute top-[-48px] sm:top-[-64px] left-6">
          <div className="relative rounded-full border-4 border-card shadow-md overflow-hidden bg-card group/avatar w-24 h-24 sm:w-32 sm:h-32">
            <UserAvatar
              src={viewedProfile.profile_picture_url}
              name={viewedProfile.full_name}
              size={120}
            />

            {isOwnProfile && onUpdatePictures && (
              <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity text-white text-[10px] font-semibold">
                <Camera size={18} className="mb-1" />
                <span>{uploading === "avatar" ? "Saving..." : "Change"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "avatar")}
                  disabled={uploading !== null}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="flex-1 sm:pl-36">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {viewedProfile.full_name}
          </h2>
          <p className="text-sm text-muted">@{viewedProfile.username}</p>

          <div className="flex items-center gap-4 mt-2.5 text-xs font-medium text-muted">
            <div>
              <span className="font-semibold text-foreground">{friendCount}</span>{" "}
              {friendCount === 1 ? "friend" : "friends"}
            </div>
          </div>

          {viewedProfile.bio && (
            <p className="text-sm text-foreground/80 mt-3 max-w-xl leading-relaxed">
              {viewedProfile.bio}
            </p>
          )}
        </div>

        {/* Actions Button Panel */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-end">
          {isOwnProfile ? (
            <Link
              href={`/profile/${viewedProfile.username}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all shadow-sm active:scale-95"
            >
              <Settings size={16} />
              Edit Profile
            </Link>
          ) : (
            <>
              {/* Contextual Action Button based on friendship status */}
              {friendStatus === "not_friends" && onFriendAction && (
                <button
                  onClick={() => onFriendAction("send_request")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <UserPlus size={16} />
                  Add Friend
                </button>
              )}

              {friendStatus === "request_sent" && onFriendAction && (
                <button
                  onClick={() => onFriendAction("cancel_request")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-all cursor-pointer"
                >
                  <UserMinus size={16} />
                  Cancel Request
                </button>
              )}

              {friendStatus === "request_received" && onFriendAction && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onFriendAction("accept_request")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    <UserCheck size={16} />
                    Accept
                  </button>
                  <button
                    onClick={() => onFriendAction("reject_request")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              )}

              {friendStatus === "friends" && (
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold">
                    <UserCheck size={16} />
                    Friends
                  </span>

                  <Link
                    href={`/messages?chat=${viewedProfile.id}`}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all shadow-sm"
                  >
                    <MessageSquare size={16} />
                    Message
                  </Link>

                  {onFriendAction && (
                    <button
                      onClick={() => onFriendAction("remove_friend")}
                      className="p-2.5 rounded-xl border border-border text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Unfriend"
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
