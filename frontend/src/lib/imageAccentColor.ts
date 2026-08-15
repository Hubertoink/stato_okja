/**
 * Determines a pleasant, sufficiently saturated dominant colour from a local
 * image or an already resolved image URL. It is deliberately browser-native:
 * no uploaded image data leaves the application for colour extraction.
 */
export async function extractAccentColorFromImage(source: Blob | string): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  let objectUrl: string | null = null;
  try {
    const src = typeof source === 'string' ? source : (objectUrl = URL.createObjectURL(source));
    const image = await loadImage(src);
    const canvas = document.createElement('canvas');
    const longestSide = 72;
    const scale = Math.min(1, longestSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const buckets = new Map<string, { red: number; green: number; blue: number; weight: number }>();

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 180) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const high = Math.max(red, green, blue);
      const low = Math.min(red, green, blue);
      const saturation = high === 0 ? 0 : (high - low) / high;
      const brightness = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;

      // Very dark, white and neutral pixels make poor accents. The remaining
      // pixel count still gives large background areas more influence.
      if (saturation < 0.16 || brightness < 0.16 || brightness > 0.9) continue;
      const bucketKey = `${Math.round(red / 32)}-${Math.round(green / 32)}-${Math.round(blue / 32)}`;
      const weight = 0.6 + saturation;
      const bucket = buckets.get(bucketKey) || { red: 0, green: 0, blue: 0, weight: 0 };
      bucket.red += red * weight;
      bucket.green += green * weight;
      bucket.blue += blue * weight;
      bucket.weight += weight;
      buckets.set(bucketKey, bucket);
    }

    const dominant = Array.from(buckets.values()).sort((left, right) => right.weight - left.weight)[0];
    if (!dominant?.weight) return null;
    return toHex(dominant.red / dominant.weight, dominant.green / dominant.weight, dominant.blue / dominant.weight);
  } catch {
    // Canvas can reject an unreadable or cross-origin image. The caller keeps
    // the existing user-chosen colour in that case.
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    image.src = src;
  });
}

function toHex(red: number, green: number, blue: number) {
  const toChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toChannel(red)}${toChannel(green)}${toChannel(blue)}`;
}
