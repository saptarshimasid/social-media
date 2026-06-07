/**
 * Utility to convert any browser File representing an image into WebP format
 * with high quality (default 0.85) and reduced file size.
 */
export function convertToWebP(file: File, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    // If not an image, return as-is
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    // If it is already webp and less than 800KB, return as-is (already small enough)
    if (file.type === "image/webp" && file.size < 800000) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        
        // Capped dimensions (1920px max resolution)
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }
        
        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            
            // Only use the compressed file if it's actually smaller or if it was resized
            if (blob.size >= file.size && file.type === "image/webp" && img.width <= MAX_WIDTH && img.height <= MAX_HEIGHT) {
              return resolve(file);
            }

            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], newName, {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(webpFile);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
