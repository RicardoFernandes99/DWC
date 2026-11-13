import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImageUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ApiError, authenticatedRequest, type User } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';
import { UserAvatar } from './user-avatar';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Account avatar: click to upload, change or remove the profile picture.
 * The API validates the real image bytes; the size check here only saves a
 * pointless upload.
 */
export function AvatarPicker({ user }: { user: User }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const saved = (updated: User) => {
    client.setQueryData(sessionOptions.queryKey, updated);
    setError('');
    setOpen(false);
  };
  const failed = (cause: unknown) =>
    setError(
      cause instanceof ApiError && cause.status === 400
        ? cause.message
        : 'The picture could not be saved. Try again.',
    );
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return authenticatedRequest<User>('account/avatar', {
        method: 'PUT',
        body,
      });
    },
    onSuccess: saved,
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () =>
      authenticatedRequest<User>('account/avatar', { method: 'DELETE' }),
    onSuccess: saved,
    onError: failed,
  });
  const busy = upload.isPending || remove.isPending;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            user.avatarUrl ? 'Change profile picture' : 'Add a profile picture'
          }
          className="group relative shrink-0 rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <UserAvatar
            name={user.name}
            src={user.avatarUrl}
            className="size-14 text-lg"
          />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground transition-transform group-hover:scale-110"
          >
            <Camera className="size-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-1 p-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (file.size > MAX_BYTES) {
              setError('Choose an image up to 5 MB.');
              return;
            }
            upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {upload.isPending
            ? 'Uploading…'
            : user.avatarUrl
              ? 'Upload a new picture'
              : 'Upload a picture'}
        </Button>
        {user.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => remove.mutate()}
          >
            <Trash2 aria-hidden="true" />
            {remove.isPending ? 'Removing…' : 'Remove picture'}
          </Button>
        )}
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to 5 MB.
        </p>
        {error && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
