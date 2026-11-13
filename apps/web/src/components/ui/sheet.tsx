// Adapted from shadcn/ui Sheet (MIT); see docs/licenses/shadcn-ui.txt.
// Trimmed to a full-screen variant used for mobile panels.

import * as React from 'react';
import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(
  props: React.ComponentProps<typeof SheetPrimitive.Trigger>,
) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { title: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          'fixed inset-0 z-50 flex flex-col bg-background outline-none',
          className,
        )}
        {...props}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <SheetPrimitive.Title className="font-sans text-base font-semibold">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </header>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
