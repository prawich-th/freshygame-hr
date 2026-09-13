import { UserFacingError } from "./errors";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const INITIAL_JPEG_QUALITY = 0.72;
const MIN_JPEG_QUALITY = 0.48;
const TARGET_BYTES = 900 * 1024;
export type UploadImageKind = "profile" | "nationalId" | "studentId";


// Use the same browser image decoder as the upload preview. It applies EXIF
// orientation once; applying a second canvas transform can rotate/mirror it again.
async function decodeImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = url;
    });
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function compressImage(file: File, kind: UploadImageKind) {
  if (!["profile", "nationalId", "studentId"].includes(kind)) throw new UserFacingError("Unknown document type");
  if (!file.type.startsWith("image/")) {
    throw new UserFacingError("Please choose a JPG, PNG, or WebP image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new UserFacingError("Please choose an image smaller than 25 MB");
  }

  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new UserFacingError("This image could not be processed. Please use JPG, PNG, or WebP");
  }

  try {
    const { image } = decoded;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new UserFacingError("Image compression is unavailable in this browser");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new UserFacingError("Image compression failed")), "image/jpeg", quality);
    });
    let quality = INITIAL_JPEG_QUALITY;
    let blob = await encode(quality);
    while (blob.size > TARGET_BYTES && quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, quality - 0.08);
      blob = await encode(quality);
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    decoded.release();
  }
}
