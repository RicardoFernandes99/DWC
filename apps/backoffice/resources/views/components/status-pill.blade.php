{{-- Status chip. tone is the raw status word (approved, pending, cancelled, ...). --}}
@props(['tone' => 'neutral'])
@php
    $color = match ($tone) {
        'approved', 'active', 'delivered', 'completed', 'succeeded', 'settled', 'visible' => 'success',
        'pending', 'scheduled' => 'warning',
        'confirmed', 'shipped' => 'info',
        'rejected', 'suspended', 'cancelled', 'declined', 'failed', 'hidden' => 'danger',
        default => 'neutral',
    };
@endphp
<x-ui.badge :tone="$color" {{ $attributes }}>{{ $slot }}</x-ui.badge>
