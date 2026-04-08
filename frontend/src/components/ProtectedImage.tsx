import { api } from '@/lib/api';
import { ImgHTMLAttributes, useEffect, useState } from 'react';
import { isProtectedUploadPath, normalizeUploadPath } from '@/lib/uploadPaths';

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

export default function ProtectedImage({ src, ...props }: ProtectedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const normalizedSrc = normalizeUploadPath(src);
    if (!normalizedSrc) {
      setResolvedSrc(undefined);
      return;
    }

    if (!isProtectedUploadPath(normalizedSrc)) {
      setResolvedSrc(normalizedSrc);
      return;
    }

    let revokedUrl: string | null = null;
    let active = true;

    void api
      .get(normalizedSrc, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        revokedUrl = URL.createObjectURL(response.data as Blob);
        setResolvedSrc(revokedUrl);
      })
      .catch(() => {
        if (active) setResolvedSrc(undefined);
      });

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [src]);

  if (!resolvedSrc) return null;
  return <img {...props} src={resolvedSrc} />;
}