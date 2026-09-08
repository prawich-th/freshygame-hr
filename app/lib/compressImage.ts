import { UserFacingError } from "./errors";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const INITIAL_JPEG_QUALITY = 0.72;
const MIN_JPEG_QUALITY = 0.48;
const TARGET_BYTES = 900 * 1024;
export const ID_CARD_WATERMARK = "ใช้สำหรับงาน TU Freshy Game 2026 ของคณะสีน้ำตาลเท่านั้น";
export type UploadImageKind = "profile" | "nationalId" | "studentId";

let watermarkFontPromise: Promise<void> | null = null;

async function readExifOrientation(file: File) {
  if (file.type !== "image/jpeg") return 1;
  const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2, false);
    if (length < 2 || offset + 2 + length > view.byteLength) return 1;
    if (marker === 0xe1) {
      const exif = offset + 4;
      if (exif + 14 > view.byteLength || view.getUint32(exif, false) !== 0x45786966) return 1;
      const tiff = exif + 6;
      const byteOrder = view.getUint16(tiff, false);
      const littleEndian = byteOrder === 0x4949;
      if (!littleEndian && byteOrder !== 0x4d4d) return 1;
      const ifd = tiff + view.getUint32(tiff + 4, littleEndian);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, littleEndian);
      for (let index = 0; index < entries; index += 1) {
        const entry = ifd + 2 + index * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, littleEndian) === 0x0112) {
          const orientation = view.getUint16(entry + 8, littleEndian);
          return orientation >= 1 && orientation <= 8 ? orientation : 1;
        }
      }
      return 1;
    }
    offset += 2 + length;
  }
  return 1;
}

function applyExifTransform(context: CanvasRenderingContext2D, orientation: number, width: number, height: number) {
  switch (orientation) {
    case 2: context.transform(-1, 0, 0, 1, width, 0); break;
    case 3: context.transform(-1, 0, 0, -1, width, height); break;
    case 4: context.transform(1, 0, 0, -1, 0, height); break;
    case 5: context.transform(0, 1, 1, 0, 0, 0); break;
    case 6: context.transform(0, 1, -1, 0, height, 0); break;
    case 7: context.transform(0, -1, -1, 0, height, width); break;
    case 8: context.transform(0, -1, 1, 0, 0, width); break;
  }
}

async function loadWatermarkFont() {
  if (!watermarkFontPromise) {
    watermarkFontPromise = new FontFace(
      "FreshyWatermark",
      "url(/fonts/THSarabunNew-Bold.ttf)",
    ).load().then((font) => {
      document.fonts.add(font);
    }).catch(() => undefined);
  }
  await watermarkFontPromise;
}

function drawWatermark(context: CanvasRenderingContext2D, width: number, height: number, text: string) {
  const lines = text === ID_CARD_WATERMARK
    ? ["ใช้สำหรับงาน TU Freshy Game 2026", "ของคณะสีน้ำตาลเท่านั้น"]
    : [text];
  let fontSize = Math.max(28, Math.min(72, Math.round(Math.min(width, height) * 0.075)));
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(-Math.PI / 18);
  context.font = `bold ${fontSize}px FreshyWatermark, sans-serif`;
  // Leave extra horizontal room for the rotated corners of the text block.
  const maximumTextWidth = width * 0.68;
  const widestLine = Math.max(...lines.map((line) => context.measureText(line).width));
  if (widestLine > maximumTextWidth) {
    fontSize = Math.max(16, Math.floor(fontSize * maximumTextWidth / widestLine));
    context.font = `bold ${fontSize}px FreshyWatermark, sans-serif`;
  }
  // Canvas center alignment can drift for mixed Thai/Latin text. Position each
  // line from its measured width so its visual midpoint is exactly at x = 0.
  context.textAlign = "left";
  context.textBaseline = "middle";
  // Blend the watermark directly into the image without an opaque outline so
  // card details remain visible through every glyph after JPEG encoding.
  context.fillStyle = "rgba(83, 45, 34, 0.18)";
  const lineHeight = fontSize * 1.18;
  const firstLineY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = firstLineY + index * lineHeight;
    const x = -context.measureText(line).width / 2;
    context.fillText(line, x, y);
  });
  context.restore();
}

export async function compressImage(file: File, kind: UploadImageKind) {
  if (!file.type.startsWith("image/")) {
    throw new UserFacingError("Please choose a JPG, PNG, or WebP image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new UserFacingError("Please choose an image smaller than 25 MB");
  }

  let bitmap: ImageBitmap;
  let orientation: number;
  try {
    [bitmap, orientation] = await Promise.all([
      createImageBitmap(file, { imageOrientation: "none" }),
      readExifOrientation(file),
    ]);
  } catch {
    throw new UserFacingError("This image could not be processed. Please use JPG, PNG, or WebP");
  }

  try {
    const swapsDimensions = orientation >= 5 && orientation <= 8;
    const orientedWidth = swapsDimensions ? bitmap.height : bitmap.width;
    const orientedHeight = swapsDimensions ? bitmap.width : bitmap.height;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(orientedWidth, orientedHeight));
    const width = Math.max(1, Math.round(orientedWidth * scale));
    const height = Math.max(1, Math.round(orientedHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new UserFacingError("Image compression is unavailable in this browser");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.save();
    context.scale(scale, scale);
    applyExifTransform(context, orientation, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    context.restore();
    if (kind !== "profile") {
      await loadWatermarkFont();
      drawWatermark(context, width, height, ID_CARD_WATERMARK);
    }

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
    bitmap.close();
  }
}
