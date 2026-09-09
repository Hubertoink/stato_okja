import { api, getAuthSessionGeneration } from '@/lib/api';
import { ImgHTMLAttributes, useEffect, useState } from 'react';
import { useOrgScopeKey } from '@/lib/orgScope';
import { isProtectedUploadPath, normalizeUploadPath } from '@/lib/uploadPaths';

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

type CachedProtectedImage = {
  url?: string;
  request?: Promise<string | undefined>;
  consumers: number;
  evictionTimer?: ReturnType<typeof setTimeout>;
};

const protectedImageCache = new Map<string, CachedProtectedImage>();
const PROTECTED_IMAGE_CACHE_TTL_MS = 60_000;

function acquireProtectedImage(cacheKey: string, src: string): Promise<string | undefined> {
  let cached = protectedImageCache.get(cacheKey);
  if (!cached) {
    cached = { consumers: 0 };
    protectedImageCache.set(cacheKey, cached);
  }
  cached.consumers += 1;
  if (cached.evictionTimer) {
    clearTimeout(cached.evictionTimer);
    cached.evictionTimer = undefined;
  }
  if (cached.url) return Promise.resolve(cached.url);
  if (cached.request) return cached.request;

  cached.request = api
    .get(src, { responseType: 'blob' })
    .then((response) => {
      const url = URL.createObjectURL(response.data as Blob);
      const current = protectedImageCache.get(cacheKey);
      if (current) current.url = url;
      return url;
    })
    .catch(() => {
      protectedImageCache.delete(cacheKey);
      return undefined;
    })
    .finally(() => {
      const current = protectedImageCache.get(cacheKey);
      if (current) current.request = undefined;
    });
  return cached.request;
}

function releaseProtectedImage(cacheKey: string) {
  const cached = protectedImageCache.get(cacheKey);
  if (!cached) return;
  cached.consumers = Math.max(cached.consumers - 1, 0);
  if (cached.consumers > 0) return;
  cached.evictionTimer = setTimeout(() => {
    const current = protectedImageCache.get(cacheKey);
    if (!current || current.consumers > 0) return;
    if (current.url) URL.revokeObjectURL(current.url);
    protectedImageCache.delete(cacheKey);
  }, PROTECTED_IMAGE_CACHE_TTL_MS);
}

function blobUrlToDataUrl(url: string): Promise<string | undefined> {
  return fetch(url)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => undefined);
}
export function useResolvedImageSrc(src?: string | null) {
  const scopeKey = useOrgScopeKey();
  const normalizedSrc = normalizeUploadPath(src);
  const cacheKey = `${getAuthSessionGeneration()}\0${scopeKey}\0${normalizedSrc}`;
  const [resolved, setResolved] = useState<{ key: string; url?: string }>();

  useEffect(() => {
    if (!normalizedSrc) {
      return;
    }

    if (!isProtectedUploadPath(normalizedSrc)) {
      return;
    }

    let active = true;

    void acquireProtectedImage(cacheKey, normalizedSrc).then((url) => {
        if (!active) return;
        setResolved({ key: cacheKey, url });
      });

    return () => {
      active = false;
      releaseProtectedImage(cacheKey);
    };
  }, [cacheKey, normalizedSrc]);

  if (!normalizedSrc) return undefined;
  if (!isProtectedUploadPath(normalizedSrc)) return normalizedSrc;
  return resolved?.key === cacheKey ? resolved.url : undefined;
}

/**
 * Resolves upload images to a data URL when necessary for an SVG to be copied
 * into a canvas. Blob URLs work in the live chart but can be lost when an
 * export renderer serializes the surrounding SVG for PNG/PDF export.
 */
export function useEmbeddedImageSrc(src?: string | null) {
  const resolvedSrc = useResolvedImageSrc(src);
  const [embeddedSrc, setEmbeddedSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!resolvedSrc) {
      setEmbeddedSrc(undefined);
      return;
    }
    if (!resolvedSrc.startsWith('blob:')) {
      setEmbeddedSrc(resolvedSrc);
      return;
    }

    let active = true;
    void blobUrlToDataUrl(resolvedSrc).then((dataUrl) => {
      if (active) setEmbeddedSrc(dataUrl);
    });

    return () => {
      active = false;
    };
  }, [resolvedSrc]);

  return embeddedSrc;
}
export default function ProtectedImage({ src, loading = 'lazy', ...props }: ProtectedImageProps) {
  const resolvedSrc = useResolvedImageSrc(src);

  if (!resolvedSrc) return null;
  return <img {...props} src={resolvedSrc} loading={loading} />;
}
