import { useState } from 'react';
import { cn } from '@/lib/utils';

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/**
 * Round profile picture with an initials fallback, used wherever a person or
 * farm is shown. Falls back to initials if the signed image URL fails.
 */
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-semibold text-primary',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src!)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
