{{-- Status chip, same look as <x-ui.badge tone="...">. Plain markup on purpose: it renders once per list row,
     and a nested BlatUI component per row made list pages slow. tone is the raw status word. --}}
@props(['tone' => 'neutral'])
@php
    $color = match ($tone) {
        'approved', 'active', 'delivered', 'completed', 'succeeded', 'settled', 'visible' => 'border-transparent bg-success/10 text-success',
        'pending', 'scheduled' => 'border-transparent bg-warning/10 text-warning',
        'confirmed', 'shipped' => 'border-transparent bg-info/10 text-info',
        'rejected', 'suspended', 'cancelled', 'declined', 'failed', 'hidden' => 'border-transparent bg-destructive/10 text-destructive',
        default => 'border-transparent bg-muted text-muted-foreground',
    };
@endphp
<span class="inline-flex w-fit shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap {{ $color }}">{{ $slot }}</span>
