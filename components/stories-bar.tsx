"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, Music, Check } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase";
import { convertToWebP } from "@/lib/image-utils";
import UserAvatar from "./user-avatar";
import LoadingSpinner from "./loading-spinner";

interface StoryItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  music_title?: string | null;
  music_artist?: string | null;
  music_url?: string | null;
}

interface StoryGroup {
  user_id: string;
  full_name: string;
  username: string;
  profile_picture_url: string | null;
  stories: StoryItem[];
}

const CURATED_SONGS = [
  {
    title: "Chill Lo-Fi Beat",
    artist: "Lofi Dreamer",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    genre: "Lofi",
  },
  {
    title: "Acoustic Sunset",
    artist: "Guitar Nomad",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    genre: "Acoustic",
  },
  {
    title: "Epic Cinematic",
    artist: "Orchestral Vibes",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    genre: "Cinematic",
  },
  {
    title: "Synthwave Horizon",
    artist: "Neon Rider",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    genre: "Synthwave",
  },
  {
    title: "Summer Breeze",
    artist: "Beach Party",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    genre: "Dance",
  },
  {
    title: "Urban Funk",
    artist: "Groove Station",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    genre: "Funk",
  },
  {
    title: "Ambient Relaxation",
    artist: "Zen Mind",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    genre: "Ambient",
  },
  {
    title: "Happy Ukulele",
    artist: "Sunny Days",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    genre: "Happy",
  },
];

export default function StoriesBar() {
  const { user, profile } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Song selection modal state
  const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
  const [selectedMusicIdx, setSelectedMusicIdx] = useState<number | null>(null);

  // New Background music preview/selection states
  const [musicTab, setMusicTab] = useState<"library" | "custom">("library");
  const [musicSearch, setMusicSearch] = useState("");
  const [musicGenre, setMusicGenre] = useState<string>("All");

  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  const currentGroup = activeGroup !== null ? storyGroups[activeGroup] : null;
  const currentStory = currentGroup?.stories[activeStoryIdx] || null;

  const supabase = createClient();
  const STORY_DURATION = 5000; // 5 seconds per story

  const fetchStories = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch stories from last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (storiesError) {
        console.error("Failed to load stories:", storiesError?.message || storiesError);
        return;
      }

      // Fetch profiles for users who have stories
      const userIds = [...new Set((storiesData || []).map((s) => s.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, username, profile_picture_url")
        .in("id", userIds.length > 0 ? userIds : ["none"]);

      if (profilesError) {
        console.warn("Failed to load story user profiles:", profilesError?.message || profilesError);
      }

      const profileMap: Record<string, Record<string, unknown>> = {};
      (profilesData || []).forEach((p) => {
        profileMap[p.id] = p;
      });

      // Group stories by user
      const grouped: Record<string, StoryGroup> = {};
      (storiesData || []).forEach((s) => {
        const uid = s.user_id as string;
        const p = profileMap[uid];
        if (!grouped[uid]) {
          grouped[uid] = {
            user_id: uid,
            full_name: (p?.full_name as string) || "User",
            username: (p?.username as string) || "",
            profile_picture_url: (p?.profile_picture_url as string) || null,
            stories: [],
          };
        }
        grouped[uid].stories.push({
          id: s.id as string,
          user_id: uid,
          media_url: s.media_url as string,
          media_type: s.media_type as string,
          created_at: s.created_at as string,
          music_title: s.music_title as string | null,
          music_artist: s.music_artist as string | null,
          music_url: s.music_url as string | null,
        });
      });

      // Put current user first
      const arr = Object.values(grouped);
      const myIdx = arr.findIndex((g) => g.user_id === user.id);
      if (myIdx > 0) {
        const [mine] = arr.splice(myIdx, 1);
        arr.unshift(mine);
      }
      setStoryGroups(arr);
    } catch (err) {
      console.error("Failed to load stories:", err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchStories(), 0);
    return () => clearTimeout(timer);
  }, [fetchStories]);

  const handleUploadClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingStoryFile(file);
      setSelectedMusicIdx(null); // default to no music
    }
  };

  const togglePreview = (url: string) => {
    if (!previewAudioRef.current) return;
    
    if (previewingUrl === url) {
      previewAudioRef.current.pause();
      setPreviewingUrl(null);
    } else {
      setPreviewingUrl(url);
      previewAudioRef.current.src = url;
      previewAudioRef.current.load();
      previewAudioRef.current.play().catch((err) => {
        console.warn("Preview playback failed:", err);
      });
    }
  };

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = "";
    }
    setPreviewingUrl(null);
  }, []);

  const handleCancelStory = () => {
    stopPreview();
    setPendingStoryFile(null);
    setSelectedMusicIdx(null);
    setCustomTitle("");
    setCustomArtist("");
    setCustomUrl("");
    setCustomFile(null);
    setMusicTab("library");
    setMusicSearch("");
    setMusicGenre("All");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (customAudioInputRef.current) customAudioInputRef.current.value = "";
  };

  const uploadCustomAudio = async (file: File) => {
    if (!user) return "";
    const ext = file.name.split(".").pop();
    const path = `${user.id}/audio-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file);
    if (error) {
      console.warn("Storage audio upload error:", error.message);
      throw new Error("Failed to upload custom audio file.");
    }
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  };

  const submitStory = async () => {
    if (!pendingStoryFile || !user) return;
    setUploading(true);
    stopPreview();
    try {
      // 1. Upload story image/video
      let fileToUpload = pendingStoryFile;
      if (pendingStoryFile.type.startsWith("image/")) {
        fileToUpload = await convertToWebP(pendingStoryFile);
      }
      const ext = fileToUpload.name.split(".").pop();
      const path = `${user.id}/story-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("posts").upload(path, fileToUpload);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
      const mediaType = fileToUpload.type.startsWith("video") ? "video" : "image";

      // 2. Resolve music details
      let finalMusicUrl = "";
      let finalMusicTitle = "";
      let finalMusicArtist = "";

      if (musicTab === "custom") {
        if (!customTitle.trim()) {
          throw new Error("Custom song title is required.");
        }
        finalMusicTitle = customTitle.trim();
        finalMusicArtist = customArtist.trim() || "Unknown Artist";

        if (customFile) {
          finalMusicUrl = await uploadCustomAudio(customFile);
        } else if (customUrl.trim()) {
          finalMusicUrl = customUrl.trim();
        }
      } else if (selectedMusicIdx !== null) {
        const song = CURATED_SONGS[selectedMusicIdx];
        finalMusicTitle = song.title;
        finalMusicArtist = song.artist;
        finalMusicUrl = song.url;
      }

      // 3. Insert story record
      const { error: insertErr } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        music_title: finalMusicTitle || null,
        music_artist: finalMusicArtist || null,
        music_url: finalMusicUrl || null,
      });
      if (insertErr) throw insertErr;

      // Reset states
      setPendingStoryFile(null);
      setSelectedMusicIdx(null);
      setCustomTitle("");
      setCustomArtist("");
      setCustomUrl("");
      setCustomFile(null);
      setMusicTab("library");
      setMusicSearch("");
      setMusicGenre("All");
      await fetchStories();
    } catch (err: any) {
      console.error("Failed to upload story:", err);
      alert(err.message || "Failed to share story. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (customAudioInputRef.current) customAudioInputRef.current.value = "";
    }
  };

  // Story player timer
  useEffect(() => {
    if (activeGroup === null || paused || currentStory?.media_type === "video") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 50;
    let elapsed = 0;
    setProgress(0);

    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / STORY_DURATION) * 100);

      if (elapsed >= STORY_DURATION) {
        nextStory();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, activeStoryIdx, paused, currentStory?.media_type]);

  // Video play/pause synchronization
  useEffect(() => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [paused, activeStoryIdx]);

  // Background audio play/pause synchronization
  useEffect(() => {
    if (audioRef.current) {
      if (paused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [paused, activeStoryIdx]);

  const nextStory = () => {
    if (activeGroup === null) return;
    const group = storyGroups[activeGroup];
    setProgress(0);
    if (activeStoryIdx < group.stories.length - 1) {
      setActiveStoryIdx((prev) => prev + 1);
    } else if (activeGroup < storyGroups.length - 1) {
      setActiveGroup((prev) => (prev !== null ? prev + 1 : null));
      setActiveStoryIdx(0);
    } else {
      closePlayer();
    }
  };

  const prevStory = () => {
    if (activeGroup === null) return;
    setProgress(0);
    if (activeStoryIdx > 0) {
      setActiveStoryIdx((prev) => prev - 1);
    } else if (activeGroup > 0) {
      setActiveGroup((prev) => (prev !== null ? prev - 1 : null));
      setActiveStoryIdx(0);
    }
  };

  const closePlayer = () => {
    setActiveGroup(null);
    setActiveStoryIdx(0);
    setPaused(false);
    setProgress(0);
  };

  const hasMyStory = storyGroups.some((g) => g.user_id === user?.id);

  return (
    <>
      {/* Stories horizontal scroller */}
      <div className="bg-card border border-border/40 rounded-3xl p-4 shadow-sm glass">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {/* Add Story Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px]">
              {profile ? (
                <UserAvatar
                  src={profile.profile_picture_url}
                  name={profile.full_name}
                  size={64}
                  zoom={profile.profile_photo_zoom || 1}
                  x={profile.profile_photo_x || 0}
                  y={profile.profile_photo_y || 0}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-secondary" />
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-card shadow-sm group-hover:scale-110 transition-transform">
                {uploading ? (
                  <LoadingSpinner size={12} />
                ) : (
                  <Plus size={14} className="text-white" />
                )}
              </div>
            </div>
            <span className="text-[10px] font-semibold text-muted truncate max-w-16">
              {hasMyStory ? "Add more" : "Your Story"}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleUploadClick}
          />

          {/* Story circles */}
          {loading ? (
            <div className="flex items-center justify-center w-20">
              <LoadingSpinner size={20} />
            </div>
          ) : (
            storyGroups.map((group, idx) => (
              <button
                key={group.user_id}
                onClick={() => {
                  setActiveGroup(idx);
                  setActiveStoryIdx(0);
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full p-[3px] bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-shadow">
                  <div className="w-full h-full rounded-full border-2 border-card overflow-hidden">
                    <UserAvatar
                      src={group.profile_picture_url}
                      name={group.full_name}
                      size={60}
                      zoom={group.stories[0]?.user_id === user?.id ? (profile?.profile_photo_zoom || 1) : 1}
                      x={group.stories[0]?.user_id === user?.id ? (profile?.profile_photo_x || 0) : 0}
                      y={group.stories[0]?.user_id === user?.id ? (profile?.profile_photo_y || 0) : 0}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-muted truncate max-w-16">
                  {group.user_id === user?.id ? "You" : group.full_name.split(" ")[0]}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Choose Background Music Dialog Overlay */}
      {pendingStoryFile && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          {/* Local Audio Elements for Previews */}
          <audio ref={previewAudioRef} onEnded={() => setPreviewingUrl(null)} />
          
          <div className="bg-card border border-border/30 rounded-3xl p-6 shadow-2xl max-w-md w-full glass space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Music size={18} className="text-primary" /> Add Background Music
            </h3>
            <p className="text-xs text-muted leading-relaxed">Select a background soundtrack to play in the background of your story.</p>
            
            {/* Tabs */}
            <div className="flex border-b border-border/40 gap-4">
              <button
                type="button"
                onClick={() => {
                  setMusicTab("library");
                  stopPreview();
                }}
                className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition-all ${
                  musicTab === "library"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                Curated Library
              </button>
              <button
                type="button"
                onClick={() => {
                  setMusicTab("custom");
                  stopPreview();
                }}
                className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition-all ${
                  musicTab === "custom"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                Custom Soundtrack
              </button>
            </div>

            {/* Content area based on tab */}
            {musicTab === "library" ? (
              <div className="space-y-3.5">
                {/* Search Bar & Genre Filters */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search tracks or artists..."
                    value={musicSearch}
                    onChange={(e) => setMusicSearch(e.target.value)}
                    className="w-full bg-secondary/60 border border-border/25 rounded-2xl px-3.5 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary/30"
                  />
                  
                  {/* Genre Chips */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {["All", "Lofi", "Acoustic", "Cinematic", "Synthwave", "Dance", "Ambient", "Funk", "Happy"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setMusicGenre(g)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          musicGenre === g
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/30 bg-secondary/50 text-muted hover:bg-secondary"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Music List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  <button
                    onClick={() => {
                      setSelectedMusicIdx(null);
                      stopPreview();
                    }}
                    className={`w-full text-left p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border cursor-pointer transition-colors ${
                      selectedMusicIdx === null
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/40 hover:bg-secondary text-foreground"
                    }`}
                  >
                    <span>No Background Music</span>
                    {selectedMusicIdx === null && <Check size={14} />}
                  </button>

                  {CURATED_SONGS.filter((song) => {
                    const matchesSearch =
                      song.title.toLowerCase().includes(musicSearch.toLowerCase()) ||
                      song.artist.toLowerCase().includes(musicSearch.toLowerCase());
                    const matchesGenre = musicGenre === "All" || song.genre === musicGenre;
                    return matchesSearch && matchesGenre;
                  }).map((song) => {
                    const idx = CURATED_SONGS.findIndex((s) => s.url === song.url);
                    const isSelected = selectedMusicIdx === idx;
                    const isPreviewing = previewingUrl === song.url;
                    
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border/30 hover:border-border/60"
                        }`}
                      >
                        {/* Play/Pause Button */}
                        <button
                          type="button"
                          onClick={() => togglePreview(song.url)}
                          className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center text-foreground hover:bg-secondary hover:text-primary transition-colors shrink-0"
                        >
                          {isPreviewing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </button>

                        {/* Title & Artist */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMusicIdx(idx);
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {song.title}
                          </p>
                          <p className="text-[10px] text-muted truncate mt-0.5">{song.artist}</p>
                        </button>

                        {/* Visualizer / Genre Badge */}
                        <div className="flex items-center gap-2 pr-1 shrink-0">
                          {isPreviewing && (
                            <div className="flex items-end gap-[3px] h-3.5 px-1 shrink-0">
                              <span className="w-[2.5px] h-2 bg-primary rounded-full animate-pulse" />
                              <span className="w-[2.5px] h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                              <span className="w-[2.5px] h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                            </div>
                          )}
                          <span className="px-2 py-0.5 rounded bg-secondary text-muted text-[9px] font-bold">
                            {song.genre}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Custom Tab Fields */}
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">Song Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. My Favorite Melody"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary/25"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">Artist Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Instrumental"
                      value={customArtist}
                      onChange={(e) => setCustomArtist(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary/25"
                    />
                  </div>

                  {/* MP3 Source Selector */}
                  <div className="space-y-2 border-t border-border/40 pt-2.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">Audio Source</label>
                    
                    <div className="flex flex-col gap-2">
                      {/* File Upload Selector */}
                      <button
                        type="button"
                        onClick={() => {
                          customAudioInputRef.current?.click();
                        }}
                        className={`w-full text-left p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border cursor-pointer transition-colors ${
                          customFile
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/30 bg-secondary/30 text-foreground hover:bg-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Music size={14} className="text-emerald-500 shrink-0" />
                          <span className="truncate">
                            {customFile ? customFile.name : "Upload Audio File (MP3)"}
                          </span>
                        </div>
                        {customFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomFile(null);
                              if (customAudioInputRef.current) customAudioInputRef.current.value = "";
                            }}
                            className="p-1 rounded-full text-muted hover:text-rose-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </button>

                      <input
                        ref={customAudioInputRef}
                        type="file"
                        accept="audio/mp3,audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setCustomFile(file);
                            setCustomUrl("");
                          }
                        }}
                      />

                      <div className="text-center text-[10px] text-muted">OR</div>

                      {/* Direct URL Input */}
                      <input
                        type="text"
                        placeholder="Paste direct audio MP3 URL..."
                        value={customUrl}
                        onChange={(e) => {
                          setCustomUrl(e.target.value);
                          setCustomFile(null); // Clear file when entering URL
                          if (customAudioInputRef.current) customAudioInputRef.current.value = "";
                        }}
                        className="w-full bg-secondary/50 border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary/25"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={handleCancelStory}
                className="flex-1 py-2.5 rounded-2xl border border-border hover:bg-secondary font-semibold text-xs text-foreground cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitStory}
                disabled={uploading || (musicTab === "custom" && !customTitle.trim())}
                className="flex-1 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold text-xs rounded-2xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
              >
                {uploading ? <LoadingSpinner size={14} /> : null}
                <span>{uploading ? "Sharing..." : "Share Story"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Story Player Modal */}
      {activeGroup !== null && currentStory && currentGroup && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          {/* Close */}
          <button
            onClick={closePlayer}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>

          {/* Story content */}
          <div className="relative w-full max-w-md h-full max-h-[100dvh] flex flex-col">
            
            {/* Background Audio Player */}
            {currentStory.music_url && (
              <audio
                ref={audioRef}
                key={currentStory.id}
                src={currentStory.music_url}
                autoPlay
                loop
                muted={muted}
              />
            )}

            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-40 flex gap-1 px-3 pt-3">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-none"
                    style={{
                      width:
                        i < activeStoryIdx
                          ? "100%"
                          : i === activeStoryIdx
                          ? `${progress}%`
                          : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* User info */}
            <div className="absolute top-8 left-3 right-14 z-40 flex items-center gap-2">
              <UserAvatar
                src={currentGroup.profile_picture_url}
                name={currentGroup.full_name}
                size={36}
                zoom={currentGroup.user_id === user?.id ? (profile?.profile_photo_zoom || 1) : 1}
                x={currentGroup.user_id === user?.id ? (profile?.profile_photo_x || 0) : 0}
                y={currentGroup.user_id === user?.id ? (profile?.profile_photo_y || 0) : 0}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{currentGroup.full_name}</p>
                <p className="text-[10px] text-white/60">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => setPaused(!paused)}
                className="p-1.5 rounded-full bg-black/30 text-white cursor-pointer"
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button
                onClick={() => setMuted(!muted)}
                className="p-1.5 rounded-full bg-black/30 text-white cursor-pointer"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>

            {/* Music Badge Sticker Overlay */}
            {currentStory.music_title && (
              <div className="absolute top-20 left-3 bg-black/45 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2 z-40 max-w-[85%] shadow-md">
                <Music size={12} className="text-primary animate-pulse" />
                <span className="text-[10px] font-bold text-white truncate">
                  {currentStory.music_title} - {currentStory.music_artist}
                </span>
              </div>
            )}

            {/* Media */}
            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
              {currentStory.media_type === "video" ? (
                <video
                  ref={videoRef}
                  key={currentStory.id}
                  src={currentStory.media_url}
                  autoPlay
                  playsInline
                  muted={muted || !!currentStory.music_url} // Mute video if story has custom background music playing
                  className="w-full h-full object-contain"
                  onPause={() => setPaused(true)}
                  onPlay={() => setPaused(false)}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    if (video.duration) {
                      setProgress((video.currentTime / video.duration) * 100);
                    }
                  }}
                  onEnded={nextStory}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={currentStory.id}
                  src={currentStory.media_url}
                  alt="Story"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Tap zones */}
            <button
              onClick={prevStory}
              className="absolute left-0 top-20 bottom-0 w-1/3 z-30 cursor-pointer"
              aria-label="Previous story"
            />
            <button
              onClick={nextStory}
              className="absolute right-0 top-20 bottom-0 w-1/3 z-30 cursor-pointer"
              aria-label="Next story"
            />

            {/* Navigation chevrons for desktop */}
            {activeGroup > 0 && (
              <button
                onClick={prevStory}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 w-10 h-10 rounded-full bg-white/10 items-center justify-center text-white hover:bg-white/20 z-40 cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {activeGroup < storyGroups.length - 1 && (
              <button
                onClick={nextStory}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 w-10 h-10 rounded-full bg-white/10 items-center justify-center text-white hover:bg-white/20 z-40 cursor-pointer"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
