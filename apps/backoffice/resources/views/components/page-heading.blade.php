{{-- Page title block: eyebrow, h1, optional intro text (slot) and an optional aside (e.g. a status chip). --}}
@props(['eyebrow', 'title'])
<div class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex flex-col gap-1.5">
        <p class="text-primary text-xs font-bold tracking-widest uppercase">{{ $eyebrow }}</p>
        <h1 class="text-3xl font-normal tracking-tight text-balance">{{ $title }}</h1>
        @if (! $slot->isEmpty())<p class="text-muted-foreground max-w-prose text-sm">{{ $slot }}</p>@endif
    </div>
    @isset($aside)<div>{{ $aside }}</div>@endisset
</div>
