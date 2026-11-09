@if ($totalPages > 1)
    <x-pager
        :summary="'Page '.$page.' of '.$totalPages.' · '.number_format($total).' records'"
        :prev="$page > 1 ? request()->fullUrlWithQuery(['page' => $page - 1]) : null"
        :next="$page < min(500, $totalPages) ? request()->fullUrlWithQuery(['page' => $page + 1]) : null" />
    @if ($totalPages > 500)
        <p class="text-muted-foreground text-sm">The list reaches its 500-page limit. Apply filters to find older records.</p>
    @endif
@else
    <p class="text-muted-foreground text-sm">{{ number_format($total) }} {{ $total === 1 ? 'record' : 'records' }}</p>
@endif
