import { api } from '@/lib/api';
import { ImgHTMLAttributes, useEffect, useState } from 'react';

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

function isProtectedUploadPath(src: string) {
  return src.startsWith('/uploads/');
}

export default function ProtectedImage({ src, ...props }: ProtectedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    if (!isProtectedUploadPath(src)) {
      setResolvedSrc(src);
      return;
    }

    let revokedUrl: string | null = null;
    let active = true;

    void api
      .get(src, { responseType: 'blob' })
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