/**
 * Utility to convert any browser File representing an image into WebP format
 * with high quality (default 0.85) and reduced file size.
 */
export function convertToWebP(file: File, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    // If not an image (or already webp), return as-is
    if (!file.type.startsWith("image/") || file.type === "image/webp") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }
        
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Create a new File from the blob with .webp extension
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
