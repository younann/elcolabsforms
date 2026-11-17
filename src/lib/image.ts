const MAX_EDGE = 1600;
const QUALITY = 0.8;

export const UNSUPPORTED_IMAGE = 'פורמט התמונה אינו נתמך (HEIC). צלם מחדש או בחר JPEG';

type Decoded = { src: CanvasImageSource; w: number; h: number; close(): void };

const fromBitmap = (b: ImageBitmap): Decoded => ({ src: b, w: b.width, h: b.height, close: () => b.close() });

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }));
    } catch {
      // fall back to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    // e.g. HEIC outside Safari
    throw new Error(UNSUPPORTED_IMAGE);
  }
}

// high-quality downscale where the browser supports it
async function resized(img: Decoded, w: number, h: number): Promise<Decoded> {
  if (typeof createImageBitmap !== 'function' || (img.w === w && img.h === h)) return img;
  try {
    const b = await createImageBitmap(img.src as ImageBitmapSource, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    img.close();
    return fromBitmap(b);
  } catch {
    return img;
  }
}

/** JPEG, long edge at most 1600px, quality 0.8. */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const full = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(full.w, full.h));
  const w = Math.max(1, Math.round(full.w * scale));
  const h = Math.max(1, Math.round(full.h * scale));
  const img = await resized(full, w, h);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    // white under transparent PNGs
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.src, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('encode failed');
    return blob;
  } finally {
    img.close();
    // release canvas memory on iOS
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'),
  );
}
