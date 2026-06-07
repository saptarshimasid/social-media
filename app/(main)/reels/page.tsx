"use client";

import React, { use, useEffect, useState, useRef, useCallback } from "react";
import { Plus, Video, Film, AlertCircle, X, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import LoadingSpinner from "@/components/loading-spinner";
import EmptyState from "@/components/empty-state";
import ReelCard, { Reel } from "@/components/reel-card";

interface ReelsPageProps {
  searchParams: Promise<{ reelId?: string }>;
}

export default function ReelsPage({ searchParams }: ReelsPageProps) {
  const { reelId: targetReelId } = use(searchParams);
  const { user } = useAuth();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // 1. Fetch reels list
  const fetchReels = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reels")
        .select("*, profiles(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const fetchedReels = (data as unknown as Reel[]) || [];

      // If targetReelId is provided in URL, reorder so that reel appears first
      if (targetReelId) {
        const targetReel = fetchedReels.find((r) => r.id === targetReelId);
        if (targetReel) {
          const remainingReels = fetchedReels.filter((r) => r.id !== targetReelId);
          setReels([targetReel, ...remainingReels]);
          setLoading(false);
          return;
        }
      }

      setReels(fetchedReels);
    } catch (err) {
      console.error("Failed to load reels:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, targetReelId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReels();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReels]);

  // 2. Track which reel is active in viewport during scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight === 0) return;
    
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIndex && index >= 0 && index < reels.length) {
      setActiveIndex(index);
    }
  };

  // 3. File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validations: MP4 or WEBM only, up to 50MB
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
      if (!allowedTypes.includes(file.type)) {
        setUploadError("Unsupported format. Please select an MP4 or WEBM video file.");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setUploadError("Video size exceeds the 50MB limit.");
        return;
      }

      setUploadError("");
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFile || uploading) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadError("");

    try {
      const fileExt = uploadFile.name.split(".").pop();
      const storagePath = `${user.id}/reel-${Date.now()}.${fileExt}`;
      
      setUploadProgress(30);

      // Attempt upload to 'reels' storage bucket
      let uploadErr = null;
      
      const uploadResponse = await supabase.storage
        .from("reels")
        .upload(storagePath, uploadFile, { cacheControl: "3600", upsert: true });

      uploadErr = uploadResponse.error;

      // Fallback if 'reels' bucket wasn't provisioned - upload to 'posts'
      let usedBucket = "reels";
      if (uploadErr) {
        console.warn("Retrying upload on 'posts' bucket fallback...");
        const retryResponse = await supabase.storage
          .from("posts")
          .upload(storagePath, uploadFile, { cacheControl: "3600", upsert: true });
        
        if (retryResponse.error) {
          throw new Error("Failed to upload video to both 'reels' and 'posts' storage buckets.");
        }
        usedBucket = "posts";
      }

      setUploadProgress(70);

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from(usedBucket).getPublicUrl(storagePath);
      const videoUrl = publicUrlData.publicUrl;

      // Save database entry
      const { data: dbData, error: dbError } = await supabase
        .from("reels")
        .insert({
          user_id: user.id,
          video_url: videoUrl,
          caption: caption.trim() || null,
        })
        .select("*, profiles(*)")
        .single();

      if (dbError) throw dbError;

      setUploadProgress(100);

      // Reset state and close modal
      const newReel = dbData as unknown as Reel;
      setReels((prev) => [newReel, ...prev]);
      setActiveIndex(0);
      
      // Cleanup
      setCaption("");
      setUploadFile(null);
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
        setUploadPreview(null);
      }
      setShowUploadModal(false);
    } catch (err) {
      const error = err as Error;
      setUploadError(error.message || "Failed to upload Reel.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReelDeleted = (deletedId: string) => {
    setReels((prev) => prev.filter((r) => r.id !== deletedId));
    // Reset active index if needed
    if (activeIndex >= reels.length - 1 && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const closeModal = () => {
    if (uploading) return;
    setCaption("");
    setUploadFile(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview(null);
    }
    setUploadError("");
    setShowUploadModal(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] relative overflow-hidden bg-background/5 p-4 md:p-6 animate-in fade-in duration-300">
      {/* 1. Header Toolbar */}
      <div className="absolute top-0 inset-x-0 h-14 shrink-0 flex items-center justify-between px-2 md:px-6 z-10">
        <h1 className="text-md font-extrabold tracking-tight text-foreground flex items-center gap-1.5 select-none">
          <Film size={18} className="text-primary" />
          <span>SocialConnect Reels</span>
        </h1>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          <span>Post Reel</span>
        </button>
      </div>

      {/* 2. Reels Vertical Scroll Snap Deck */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <LoadingSpinner size={28} />
          <span className="text-xs text-muted">Loading Snaps...</span>
        </div>
      ) : reels.length > 0 ? (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full max-w-[420px] h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] overflow-y-auto snap-y snap-mandatory no-scrollbar flex flex-col gap-0.5 scroll-smooth relative mt-10 rounded-3xl"
        >
          {reels.map((reel, index) => (
            <div
              key={reel.id}
              className="w-full h-full flex justify-center items-center shrink-0 snap-start snap-always"
            >
              <ReelCard
                reel={reel}
                isActive={index === activeIndex && !showUploadModal}
                onReelDeleted={handleReelDeleted}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-14 max-w-[360px]">
          <EmptyState
            icon={Film}
            title="No Reels Posted"
            description="Be the first to share a video. Show off your moments by sharing a quick Reel snap!"
          />
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 h-11 rounded-2xl bg-secondary hover:bg-muted/10 border border-border/30 text-xs font-bold transition-colors cursor-pointer text-foreground"
          >
            <Plus size={14} />
            <span>Create First Reel</span>
          </button>
        </div>
      )}

      {/* 3. Upload Reel Premium Modal Overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/40 rounded-3xl overflow-hidden glass shadow-2xl flex flex-col animate-in scale-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5 select-none">
                <Video size={16} className="text-primary animate-pulse" />
                Upload New Reel
              </span>
              <button
                onClick={closeModal}
                disabled={uploading}
                className="p-1.5 border border-border/50 rounded-xl hover:bg-secondary text-muted hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUploadReel} className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold rounded-xl flex gap-1.5 items-start">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Video selector area / preview */}
              <div className="relative w-full aspect-[9/12] rounded-2xl border-2 border-dashed border-border/50 bg-secondary flex flex-col items-center justify-center overflow-hidden group">
                {uploadPreview ? (
                  <div className="absolute inset-0 w-full h-full">
                    <video
                      src={uploadPreview}
                      controls
                      className="w-full h-full object-cover"
                    />
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          setUploadPreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-500 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-muted gap-2.5">
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                      <Video size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Select Reel Video</p>
                      <p className="text-[10px] mt-1">MP4 or WEBM up to 50MB (vertical aspect 9:16 recommended)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 bg-background border border-border rounded-xl text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      Browse Files
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Caption Text Box */}
              <div>
                <label className="block text-xs font-bold text-muted mb-2">Caption</label>
                <textarea
                  placeholder="Write a caption for your Reel (hashtags work)..."
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-3 bg-secondary text-foreground text-xs border border-border/50 focus:border-primary/50 focus:outline-none rounded-xl resize-none transition-colors"
                />
              </div>

              {/* Submit Buttons / Progress */}
              {uploading ? (
                <div className="space-y-2 py-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted">
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin text-primary" />
                      Uploading video...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!uploadFile}
                  className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Video size={14} />
                  <span>Share Reel Snap</span>
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
