@if ($totalPages > 1)
    <nav class="pagination" aria-label="Pagination">
        <span>Page {{ $page }} of {{ $totalPages }} · {{ number_format($total) }} records</span>
        <div class="pagination-actions">
            @if ($page > 1)
                <a class="pagination-link" href="{{ request()->fullUrlWithQuery(['page' => $page - 1]) }}">Previous</a>
            @endif
            @if ($page < min(500, $totalPages))
                <a class="pagination-link" href="{{ request()->fullUrlWithQuery(['page' => $page + 1]) }}">Next</a>
            @endif
        </div>
    </nav>
    @if ($totalPages > 500)
        <p class="pagination-limit">The list reaches its 500-page limit. Apply filters to find older records.</p>
    @endif
@else
    <p class="inspection-count">{{ number_format($total) }} {{ $total === 1 ? 'record' : 'records' }}</p>
@endif
