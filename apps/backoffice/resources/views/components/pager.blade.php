{{-- Previous / Next with a summary on the left. prev / next are URLs or null. --}}
@props(['summary', 'prev' => null, 'next' => null])
<nav class="text-muted-foreground flex items-center justify-between gap-4 text-sm" aria-label="Pagination">
    <span>{{ $summary }}</span>
    <div class="flex gap-2">
        @if ($prev)<x-ui.button variant="outline" size="sm" :href="$prev">Previous</x-ui.button>@endif
        @if ($next)<x-ui.button variant="outline" size="sm" :href="$next">Next</x-ui.button>@endif
    </div>
</nav>
