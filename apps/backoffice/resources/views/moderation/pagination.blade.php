<nav class="pagination" aria-label="Moderation pages">
    <span>Page {{ $page }} · {{ $total }} total</span>
    <div class="pagination-actions">
        @if ($page > 1)<a class="quiet-button pagination-link" href="{{ route($routeName, ['state' => $state->value, 'page' => $page - 1]) }}">Previous</a>@endif
        @if ($page < 1000 && $page * $limit < $total)<a class="quiet-button pagination-link" href="{{ route($routeName, ['state' => $state->value, 'page' => $page + 1]) }}">Next</a>@endif
    </div>
</nav>
