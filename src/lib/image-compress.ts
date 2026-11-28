"use client";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

async function hasValidImageMagicBytes(file: File): Promise<boolean> {
  try {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (header.length < 4) return false;

    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return file.type === "image/jpeg";
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      return file.type === "image/png";
    }

    // WebP: RIFF....WEBP
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return file.type === "image/webp";
    }

    return false;
  } catch {
    return false;
  }
}

export async function validateImageFile(
  file: File
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: "يُسمح برفع صور بصيغة JPG أو PNG أو WebP فقط (يُمنع SVG والملفات غير المدعومة).",
    };
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت.",
    };
  }

  const magicValid = await hasValidImageMagicBytes(file);
  if (!magicValid) {
    return {
      valid: false,
      error: "محتوى الملف لا يطابق صيغة صورة صالحة.",
    };
  }

  return { valid: true };
}

/**
 * Compresses an image file in the browser via Canvas before uploading to Supabase Storage.
 * Keeps storage lean on the Supabase Free Tier and speeds up mobile menu loading.
 */
export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = options;

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type) || file.size < 45 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = "image/webp";
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(
            new File([blob], `${baseName}.webp`, {
              type: outputType,
              lastModified: Date.now(),
            })
          );
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
