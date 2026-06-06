"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Settings,
  UserPlus,
  UserMinus,
  UserCheck,
  MessageSquare,
  Camera,
  Sparkles,
  Move,
  Check,
  X,
} from "lucide-react";
import { Profile } from "./auth-provider";
import UserAvatar from "./user-avatar";
import { useChat } from "./chat-provider";
import { createClient } from "@/lib/supabase";

interface ProfileHeaderProps {
  viewedProfile: Profile;
  isOwnProfile: boolean;
  friendStatus: "not_friends" | "request_sent" | "request_received" | "friends";
  friendCount?: number;
  onFriendAction?: (
    action:
      | "send_request"
      | "cancel_request"
      | "accept_request"
      | "reject_request"
      | "remove_friend",
  ) => Promise<void>;
  onUpdatePictures?: (type: "avatar" | "cover", file: File) => Promise<void>;
}

export default function ProfileHeader({
  viewedProfile: initialProfile,
  isOwnProfile,
  friendStatus,
  friendCount = 0,
  onFriendAction,
  onUpdatePictures,
}: ProfileHeaderProps) {
  const [viewedProfile, setViewedProfile] = useState<Profile>(initialProfile);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const { openChatWith } = useChat();

  const coverContainerRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);

  // Cover image repositioning state
  const [isRepositioningCover, setIsRepositioningCover] = useState(false);
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverX, setCoverX] = useState(0);
  const [coverY, setCoverY] = useState(0);

  // Avatar repositioning state
  const [isRepositioningAvatar, setIsRepositioningAvatar] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarX, setAvatarX] = useState(0);
  const [avatarY, setAvatarY] = useState(0);

  const supabase = createClient();

  // Keep state synced with props changes
  useEffect(() => {
    setViewedProfile(initialProfile);
  }, [initialProfile]);

  // Helper to constrain cover position
  const getConstrainedCover = (x: number, y: number, zoom: number) => {
    if (!coverContainerRef.current) return { x, y };
    const w = coverContainerRef.current.clientWidth;
    const h = coverContainerRef.current.clientHeight;
    const maxDragX = Math.max(0, (w * (zoom - 1)) / 2);
    const maxDragY = Math.max(0, (h * (zoom - 1)) / 2);
    return {
      x: Math.max(-maxDragX, Math.min(maxDragX, x)),
      y: Math.max(-maxDragY, Math.min(maxDragY, y)),
    };
  };

  // Helper to constrain avatar position
  const getConstrainedAvatar = (x: number, y: number, zoom: number) => {
    if (!avatarContainerRef.current) return { x, y };
    const w = avatarContainerRef.current.clientWidth;
    const h = avatarContainerRef.current.clientHeight;
    const maxDragX = Math.max(0, (w * (zoom - 1)) / 2);
    const maxDragY = Math.max(0, (h * (zoom - 1)) / 2);
    return {
      x: Math.max(-maxDragX, Math.min(maxDragX, x)),
      y: Math.max(-maxDragY, Math.min(maxDragY, y)),
    };
  };

  const handleCoverZoomChange = (val: number) => {
    setCoverZoom(val);
    const constrained = getConstrainedCover(coverX, coverY, val);
    setCoverX(constrained.x);
    setCoverY(constrained.y);
  };

  const handleAvatarZoomChange = (val: number) => {
    setAvatarZoom(val);
    const constrained = getConstrainedAvatar(avatarX, avatarY, val);
    setAvatarX(constrained.x);
    setAvatarY(constrained.y);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "cover",
  ) => {
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

  // Start cover photo repositioning
  const startCoverReposition = () => {
    const zoom = viewedProfile.cover_photo_zoom || 1;
    const rawX = viewedProfile.cover_photo_x || 0;
    const rawY = viewedProfile.cover_photo_y || 0;
    setCoverZoom(zoom);
    const constrained = getConstrainedCover(rawX, rawY, zoom);
    setCoverX(constrained.x);
    setCoverY(constrained.y);
    setIsRepositioningCover(true);
  };

  // Start avatar repositioning
  const startAvatarReposition = () => {
    const zoom = viewedProfile.profile_photo_zoom || 1;
    const rawX = viewedProfile.profile_photo_x || 0;
    const rawY = viewedProfile.profile_photo_y || 0;
    setAvatarZoom(zoom);
    const constrained = getConstrainedAvatar(rawX, rawY, zoom);
    setAvatarX(constrained.x);
    setAvatarY(constrained.y);
    setIsRepositioningAvatar(true);
  };

  // Save cover position in DB
  const saveCoverPosition = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          cover_photo_zoom: coverZoom,
          cover_photo_x: coverX,
          cover_photo_y: coverY,
        })
        .eq("id", viewedProfile.id);

      if (error) throw error;

      setViewedProfile((prev) => ({
        ...prev,
        cover_photo_zoom: coverZoom,
        cover_photo_x: coverX,
        cover_photo_y: coverY,
      }));
      setIsRepositioningCover(false);
    } catch (err) {
      console.error("Failed to save cover position:", err);
      alert("Failed to save cover position. Please try again.");
    }
  };

  // Save avatar position in DB
  const saveAvatarPosition = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_photo_zoom: avatarZoom,
          profile_photo_x: avatarX,
          profile_photo_y: avatarY,
        })
        .eq("id", viewedProfile.id);

      if (error) throw error;

      setViewedProfile((prev) => ({
        ...prev,
        profile_photo_zoom: avatarZoom,
        profile_photo_x: avatarX,
        profile_photo_y: avatarY,
      }));
      setIsRepositioningAvatar(false);
    } catch (err) {
      console.error("Failed to save avatar position:", err);
      alert("Failed to save avatar position. Please try again.");
    }
  };

  // Drag handlers for cover repositioning
  const handleCoverMouseDown = (e: React.MouseEvent) => {
    if (!isRepositioningCover) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = coverX;
    const initialY = coverY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const constrained = getConstrainedCover(initialX + dx, initialY + dy, coverZoom);
      setCoverX(constrained.x);
      setCoverY(constrained.y);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleCoverTouchStart = (e: React.TouchEvent) => {
    if (!isRepositioningCover) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const initialX = coverX;
    const initialY = coverY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touch = moveEvent.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const constrained = getConstrainedCover(initialX + dx, initialY + dy, coverZoom);
      setCoverX(constrained.x);
      setCoverY(constrained.y);
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  // Drag handlers for avatar repositioning
  const handleAvatarMouseDown = (e: React.MouseEvent) => {
    if (!isRepositioningAvatar) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = avatarX;
    const initialY = avatarY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const constrained = getConstrainedAvatar(initialX + dx, initialY + dy, avatarZoom);
      setAvatarX(constrained.x);
      setAvatarY(constrained.y);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Touch handlers for avatar repositioning
  const handleAvatarTouchStart = (e: React.TouchEvent) => {
    if (!isRepositioningAvatar) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const initialX = avatarX;
    const initialY = avatarY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touch = moveEvent.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const constrained = getConstrainedAvatar(initialX + dx, initialY + dy, avatarZoom);
      setAvatarX(constrained.x);
      setAvatarY(constrained.y);
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div className="bg-card border border-border/40 rounded-3xl overflow-hidden glass shadow-sm mb-6 animate-in fade-in duration-300">
      
      {/* Cover Image Container */}
      <div 
        className={`relative h-60 sm:h-72 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 overflow-hidden group select-none ${
          isRepositioningCover ? "cursor-move ring-2 ring-primary ring-inset" : ""
        }`}
        onMouseDown={handleCoverMouseDown}
        onTouchStart={handleCoverTouchStart}
      >
        {viewedProfile.cover_picture_url ? (
          <div 
            ref={coverContainerRef}
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translate3d(${isRepositioningCover ? coverX : (viewedProfile.cover_photo_x || 0)}px, ${isRepositioningCover ? coverY : (viewedProfile.cover_photo_y || 0)}px, 0px) scale(${isRepositioningCover ? coverZoom : (viewedProfile.cover_photo_zoom || 1)})`,
              transformOrigin: "center",
              transition: isRepositioningCover ? "none" : "transform 0.2s ease-out",
            }}
          >
            <Image
              src={viewedProfile.cover_picture_url}
              alt={`${viewedProfile.full_name}'s cover`}
              fill
              sizes="100vw"
              className="object-cover pointer-events-none"
              priority
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted/30">
            <Sparkles size={48} />
          </div>
        )}

        {/* Repositioning HUD for Cover */}
        {isRepositioningCover && (
          <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-md border border-border/40 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg z-20">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-muted flex items-center gap-1 shrink-0">
                <Move size={12} /> Panning & Zoom:
              </span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={coverZoom}
                onChange={(e) => handleCoverZoomChange(parseFloat(e.target.value))}
                className="w-full sm:w-40 accent-primary"
              />
              <span className="text-xs font-semibold text-foreground shrink-0">{coverZoom.toFixed(2)}x</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => setIsRepositioningCover(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground cursor-pointer"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={saveCoverPosition}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/95 text-xs font-semibold text-primary-foreground cursor-pointer"
              >
                <Check size={14} /> Save Position
              </button>
            </div>
          </div>
        )}

        {/* Regular Cover Options */}
        {isOwnProfile && !isRepositioningCover && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-10">
            <button
              onClick={startCoverReposition}
              className="p-2.5 bg-background/85 hover:bg-background rounded-full border border-border/30 backdrop-blur-md cursor-pointer transition-all shadow-md active:scale-95 text-foreground flex items-center gap-1.5 text-xs font-semibold"
              title="Reposition Cover Photo"
            >
              <Move size={14} />
              <span className="hidden sm:inline">Reposition</span>
            </button>
            {onUpdatePictures && (
              <label className="p-2.5 bg-background/85 hover:bg-background rounded-full border border-border/30 backdrop-blur-md cursor-pointer transition-all shadow-md active:scale-95 text-foreground flex items-center gap-1.5 text-xs font-semibold">
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
        )}
      </div>

      {/* Info Overlay */}
      <div className="relative px-6 pb-6 pt-16 sm:pt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        
        {/* Profile Avatar Overlap */}
        <div className="absolute top-[-48px] sm:top-[-64px] left-6">
          <div 
            ref={avatarContainerRef}
            className={`relative rounded-full border-4 border-card shadow-md bg-card group/avatar w-24 h-24 sm:w-32 sm:h-32 overflow-hidden ${
              isRepositioningAvatar ? "ring-2 ring-primary cursor-move" : ""
            }`}
            onMouseDown={handleAvatarMouseDown}
            onTouchStart={handleAvatarTouchStart}
          >
            <UserAvatar
              src={viewedProfile.profile_picture_url}
              name={viewedProfile.full_name}
              size={120}
              zoom={isRepositioningAvatar ? avatarZoom : (viewedProfile.profile_photo_zoom || 1)}
              x={isRepositioningAvatar ? avatarX : (viewedProfile.profile_photo_x || 0)}
              y={isRepositioningAvatar ? avatarY : (viewedProfile.profile_photo_y || 0)}
            />

            {/* Avatar reposition actions */}
            {isOwnProfile && !isRepositioningAvatar && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity gap-1 z-15">
                <button
                  onClick={startAvatarReposition}
                  className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer"
                  title="Reposition Picture"
                >
                  <Move size={14} />
                </button>
                {onUpdatePictures && (
                  <label className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer flex flex-col items-center">
                    <Camera size={14} />
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
            )}
          </div>

          {/* Repositioning Avatar Slider overlay */}
          {isRepositioningAvatar && (
            <div className="absolute left-0 top-28 sm:top-36 bg-background border border-border p-2 rounded-2xl shadow-xl z-50 flex items-center gap-2 w-48 sm:w-56 glass">
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={avatarZoom}
                onChange={(e) => handleAvatarZoomChange(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <button
                onClick={saveAvatarPosition}
                className="p-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 shrink-0"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setIsRepositioningAvatar(false)}
                className="p-1 rounded-xl bg-secondary hover:bg-border shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* User Details */}
        <div className="flex-1 sm:pl-36">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {viewedProfile.full_name}
          </h2>
          <p className="text-sm text-muted">@{viewedProfile.username}</p>

          <div className="flex items-center gap-4 mt-2.5 text-xs font-medium text-muted">
            <div>
              <span className="font-semibold text-foreground">
                {friendCount}
              </span>{" "}
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

                  <button
                    onClick={() => openChatWith(viewedProfile)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    <MessageSquare size={16} />
                    Message
                  </button>

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
