"use client";

import React, { useRef } from "react";
import { Image as ImageIcon, Video, X, AlertCircle } from "lucide-react";

interface MediaFile {
  file: File;
  previewUrl: string;
  type: "image" | "video";
}

interface MediaUploaderProps {
  files: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  maxFiles?: number;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEOS = ["video/mp4", "video/webm"];

export default function MediaUploader({
  files,
  onChange,
  maxFiles = 4,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const validFiles: MediaFile[] = [...files];

    for (const file of selectedFiles) {
      if (validFiles.length >= maxFiles) {
        alert(`You can only upload up to ${maxFiles} files.`);
        break;
      }

      // Check file types
      const isImg = ALLOWED_IMAGES.includes(file.type);
      const isVid = ALLOWED_VIDEOS.includes(file.type);

      if (!isImg && !isVid) {
        alert("Unsupported file format. Please upload JPG, PNG, WEBP images or MP4, WEBM videos.");
        continue;
      }

      // Check file sizes
      if (isImg && file.size > MAX_IMAGE_SIZE) {
        alert(`Image "${file.name}" exceeds 5MB size limit.`);
        continue;
      }

      if (isVid && file.size > MAX_VIDEO_SIZE) {
        alert(`Video "${file.name}" exceeds 50MB size limit.`);
        continue;
      }

      validFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
        type: isImg ? "image" : "video",
      });
    }

    onChange(validFiles);

    // Reset input so the same file can be uploaded again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    URL.revokeObjectURL(fileToRemove.previewUrl);
    
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Trigger Buttons */}
      {files.length < maxFiles && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={triggerInput}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-muted/10 border border-border/30 text-xs font-semibold transition-colors active:scale-95 cursor-pointer text-foreground"
          >
            <ImageIcon size={16} className="text-emerald-500" />
            <span>Add Photos/Videos</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept={[...ALLOWED_IMAGES, ...ALLOWED_VIDEOS].join(",")}
            className="hidden"
          />
        </div>
      )}

      {/* Previews Grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {files.map((media, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-border/50 group"
            >
              {media.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.previewUrl}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={media.previewUrl}
                  controls={false}
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Media type indicator */}
              {media.type === "video" && (
                <span className="absolute bottom-2.5 left-2.5 p-1 bg-black/60 rounded-lg text-white backdrop-blur-md">
                  <Video size={12} />
                </span>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-500 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Constraints Help Notice */}
      <div className="flex gap-2 items-start text-[10px] text-muted leading-tight">
        <AlertCircle size={12} className="shrink-0 mt-0.5" />
        <span>
          Max {maxFiles} files. Images up to 5MB (JPG/PNG/WEBP) and videos up to 50MB (MP4/WEBM).
        </span>
      </div>
    </div>
  );
}
