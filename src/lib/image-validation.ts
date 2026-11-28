import sharp from "sharp";

export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface ImageValidationResult {
  valid: boolean;
  mime?: AllowedImageMime;
  ext?: "jpg" | "png" | "webp";
  width?: number;
  height?: number;
  error?: string;
}

export interface SanitizedImageResult {
  valid: boolean;
  buffer?: Buffer;
  mime?: "image/webp";
  ext?: "webp";
  width?: number;
  height?: number;
  error?: string;
}

// Aligned under Vercel Hobby's 4.5MB Serverless Function request payload limit
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MiB
export const MAX_IMAGE_DIMENSION_PX = 6000;
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 MP
const MIN_DIMENSION_PX = 16;

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 " && buf.length >= 30) {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunk === "VP8L" && buf.length >= 25) {
    if (buf[20] !== 0x2f) return null;
    const b1 = buf[21];
    const b2 = buf[22];
    const b3 = buf[23];
    const b4 = buf[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return { width, height };
  }
  if (chunk === "VP8X" && buf.length >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  return null;
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd9)
    ) {
      offset += 2;
      continue;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buf.length) {
      return null;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && segmentLength >= 7 && offset + 9 <= buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

export function validateImageBuffer(buf: Buffer): ImageValidationResult {
  if (!buf || buf.length === 0) {
    return { valid: false, error: "الملف فارغ" };
  }
  if (buf.length > MAX_IMAGE_UPLOAD_BYTES) {
    return { valid: false, error: "حجم الصورة يتجاوز الحد المسموح (4 ميجابايت)" };
  }

  let mime: AllowedImageMime | null = null;
  let ext: "jpg" | "png" | "webp" | null = null;
  let dims: { width: number; height: number } | null = null;

  const headText = buf.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
  if (
    headText.startsWith("<svg") ||
    headText.startsWith("<?xml") ||
    headText.startsWith("<html") ||
    headText.startsWith("<!doctype")
  ) {
    return { valid: false, error: "يُمنع رفع ملفات SVG أو المستندات النصية" };
  }

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mime = "image/jpeg";
    ext = "jpg";
    dims = parseJpegDimensions(buf);
  } else if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    mime = "image/png";
    ext = "png";
    dims = parsePngDimensions(buf);
  } else if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    mime = "image/webp";
    ext = "webp";
    dims = parseWebpDimensions(buf);
  } else {
    return {
      valid: false,
      error: "صيغة الملف غير مدعومة؛ يُسمح بـ JPG وPNG وWebP فقط",
    };
  }

  if (!dims || !Number.isFinite(dims.width) || !Number.isFinite(dims.height)) {
    return { valid: false, error: "ملف الصورة تالف أو لا يمكن قراءة أبعاده" };
  }

  if (
    dims.width < MIN_DIMENSION_PX ||
    dims.height < MIN_DIMENSION_PX ||
    dims.width > MAX_IMAGE_DIMENSION_PX ||
    dims.height > MAX_IMAGE_DIMENSION_PX ||
    dims.width * dims.height > MAX_IMAGE_PIXELS
  ) {
    return {
      valid: false,
      error: `أبعاد الصورة (${dims.width}x${dims.height}) خارج النطاق المسموح`,
    };
  }

  return {
    valid: true,
    mime,
    ext,
    width: dims.width,
    height: dims.height,
  };
}

/**
 * Fully decodes the image on the server via sharp (rejecting truncated/corrupted payloads
 * even if the header is valid), validates dimensions/total pixels, strips EXIF/metadata,
 * and re-encodes cleanly to WebP for menu performance.
 */
export async function decodeAndSanitizeImage(
  buf: Buffer
): Promise<SanitizedImageResult> {
  const headerCheck = validateImageBuffer(buf);
  if (!headerCheck.valid) {
    return { valid: false, error: headerCheck.error };
  }

  try {
    const pipeline = sharp(buf, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
      animated: false,
    });

    const meta = await pipeline.metadata();
    if (
      meta.format !== "jpeg" &&
      meta.format !== "png" &&
      meta.format !== "webp"
    ) {
      return {
        valid: false,
        error: "صيغة الصورة الفعلية غير مدعومة؛ يُسمح بـ JPG وPNG وWebP فقط",
      };
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (
      width < MIN_DIMENSION_PX ||
      height < MIN_DIMENSION_PX ||
      width > MAX_IMAGE_DIMENSION_PX ||
      height > MAX_IMAGE_DIMENSION_PX ||
      width * height > MAX_IMAGE_PIXELS
    ) {
      return {
        valid: false,
        error: `أبعاد الصورة (${width}x${height}) تتجاوز الحد المسموح`,
      };
    }

    // Full pixel decode + strip all EXIF/XMP/IPTC metadata + clean WebP re-encode
    const { data, info } = await pipeline
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 86,
        alphaQuality: 90,
      })
      .toBuffer({ resolveWithObject: true });

    if (!data || data.length === 0) {
      return { valid: false, error: "فشل ترميز الصورة" };
    }
    if (data.length > MAX_IMAGE_UPLOAD_BYTES) {
      return {
        valid: false,
        error: "حجم الصورة بعد المعالجة يتجاوز 4 ميجابايت، يرجى اختيار صورة أصغر",
      };
    }

    return {
      valid: true,
      buffer: data,
      mime: "image/webp",
      ext: "webp",
      width: info.width,
      height: info.height,
    };
  } catch {
    return {
      valid: false,
      error: "ملف الصورة تالف أو مبتور ولا يمكن فك ترميزه بأمان",
    };
  }
}
