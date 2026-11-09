@extends('layouts.app')

@section('title', 'Auctions | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Inspection" title="Auctions" />
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <x-filters :action="route('inspection.auctions')">
        <x-filter-select label="Status" name="status" :options="['' => 'All statuses', 'scheduled' => 'Scheduled', 'active' => 'Active', 'finished' => 'Finished', 'cancelled' => 'Cancelled']" />
        <x-filter-input label="Producer ID" name="producerId" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID" />
        <x-filter-select label="Page size" name="limit" :options="['20' => '20', '50' => '50']" />
    </x-filters>

    @if ($items === [])
        <x-empty-state title="No auctions match these filters" />
    @else
        <x-ui.table variant="card" aria-label="Auctions">
            <x-ui.table-header>
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">Product</x-ui.table-head>
                    <x-ui.table-head>Status</x-ui.table-head>
                    <x-ui.table-head>Current bid</x-ui.table-head>
                    <x-ui.table-head>Producer</x-ui.table-head>
                    <x-ui.table-head>Starts</x-ui.table-head>
                    <x-ui.table-head>Ends</x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $auction)
                    <x-ui.table-row>
                        <x-ui.table-cell class="px-4 py-3 whitespace-normal">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.auction', $auction['id']) }}">{{ $auction['product']['name'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell><x-status-pill :tone="$auction['status']">{{ ucfirst($auction['status']) }}</x-status-pill></x-ui.table-cell>
                        <x-ui.table-cell>{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</x-ui.table-cell>
                        <x-ui.table-cell><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $auction['producerId']) }}">{{ substr($auction['producerId'], -8) }}</a></x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $auction['startsAt'] }}">{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</time></x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $auction['endsAt'] }}">{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</time></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
