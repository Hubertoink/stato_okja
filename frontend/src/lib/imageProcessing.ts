export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 600;

export type ProcessImageResult = {
  file: File;
  originalBytes: number;
  processedBytes: number;
  width: number;
  height: number;
  mime: string;
};

function isSupportedRasterImage(mime: string | undefined) {
  const m = (mime || '').toLowerCase();
  // keep it conservative: these are the formats we can reliably re-encode via canvas
  return m === 'image/jpeg' || m === 'image/jpg' || m === 'image/png' || m === 'image/webp';
}

function readImageDimensions(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  return createImageBitmap(file).then((bitmap) => ({ bitmap, width: bitmap.width, height: bitmap.height }));
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not encode image'));
        else resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export async function processImageForUpload(input: File): Promise<ProcessImageResult> {
  if (!input) throw new Error('No file provided');

  const originalBytes = input.size;
  const mime = (input.type || '').toLowerCase();

  if (!isSupportedRasterImage(mime)) {
    throw new Error('Unsupported image type. Please use JPG, PNG, or WEBP.');
  }

  // Decode
  const { bitmap, width, height } = await readImageDimensions(input);

  // Resize (max width)
  const scale = width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / width : 1;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  // Re-encode. Prefer JPEG for predictable size reduction.
  // Note: PNG transparency will be flattened (acceptable for cover images).
  const outMime = 'image/jpeg';
  let quality = 0.85;

  let blob = await canvasToBlob(canvas, outMime, quality);
  // If still too large, try lowering quality a bit.
  while (blob.size > MAX_IMAGE_BYTES && quality > 0.6) {
    quality = Math.max(0.6, quality - 0.1);
    blob = await canvasToBlob(canvas, outMime, quality);
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is still too large after compression.');
  }

  const baseName = (input.name || 'image').replace(/\.[^.]+$/, '');
  const fileName = `${baseName}.jpg`;
  const file = new File([blob], fileName, { type: outMime, lastModified: Date.now() });

  return {
    file,
    originalBytes,
    processedBytes: file.size,
    width: outW,
    height: outH,
    mime: outMime,
  };
}
