@php
    $filterNames = match (request()->route()->getName()) {
        'inspection.users' => ['role' => 'Role', 'producerStatus' => 'Producer status'],
        'inspection.orders' => ['status' => 'Status', 'origin' => 'Origin', 'fulfilmentMethod' => 'Fulfilment', 'buyerId' => 'Buyer ID', 'producerId' => 'Producer ID'],
        'inspection.auctions' => ['status' => 'Status', 'producerId' => 'Producer ID'],
        default => [],
    };
    $activeFilterScope = collect(request()->only(array_keys($filterNames)))
        ->filter(fn ($value) => is_string($value) && $value !== '')
        ->map(fn ($value, $key) => $filterNames[$key].': '.(str_ends_with($key, 'Id') ? '…'.substr($value, -8) : ucwords(str_replace('_', ' ', $value))))
        ->values();
@endphp
<p class="inspection-filter-scope" aria-live="polite">
    @if ($activeFilterScope->isEmpty()) Showing all records. @else Showing {{ $activeFilterScope->join(' · ') }}. @endif
</p>
