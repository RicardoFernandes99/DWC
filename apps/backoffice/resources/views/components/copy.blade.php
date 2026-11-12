{{-- Titled block of free text (descriptions, reasons). --}}
@props(['title'])
<div class="flex flex-col gap-1"><h3 class="text-sm font-semibold">{{ $title }}</h3><div class="text-muted-foreground text-sm">{{ $slot }}</div></div>
