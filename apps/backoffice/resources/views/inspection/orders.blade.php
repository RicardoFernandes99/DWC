@extends('layouts.app')

@section('title', 'Orders | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Inspection" title="Orders" />
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <x-filters :action="route('inspection.orders')">
        <x-filter-select label="Status" name="status" :options="['' => 'All statuses'] + collect(['pending', 'confirmed', 'shipped', 'delivered', 'ready_for_collection', 'collected', 'cancelled'])->mapWithKeys(fn ($value) => [$value => ucwords(str_replace('_', ' ', $value))])->all()" />
        <x-filter-select label="Origin" name="origin" :options="['' => 'All origins', 'catalogue' => 'Catalogue', 'auction' => 'Auction']" />
        <x-filter-select label="Fulfilment" name="fulfilmentMethod" :options="['' => 'All methods', 'delivery' => 'Delivery', 'collection' => 'Collection']" />
        <x-filter-input label="Buyer ID" name="buyerId" inputmode="text" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID" />
        <x-filter-input label="Producer ID" name="producerId" inputmode="text" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID" />
        <x-filter-select label="Page size" name="limit" :options="['20' => '20', '50' => '50']" />
    </x-filters>

    @if ($items === [])
        <x-empty-state title="No orders match these filters" />
    @else
        <x-ui.table variant="card" aria-label="Orders">
            <x-ui.table-header>
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">Order</x-ui.table-head>
                    <x-ui.table-head>Status</x-ui.table-head>
                    <x-ui.table-head>Total / refunded</x-ui.table-head>
                    <x-ui.table-head>Buyer</x-ui.table-head>
                    <x-ui.table-head>Producer</x-ui.table-head>
                    <x-ui.table-head>Created</x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $order)
                    <x-ui.table-row>
                        <x-ui.table-cell class="px-4 py-3 whitespace-normal">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.order', $order['id']) }}">Order {{ substr($order['id'], -8) }}</a>
                            <div class="text-muted-foreground text-xs">{{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }}@if ($order['auctionId']) · <a class="underline-offset-4 hover:underline" href="{{ route('inspection.auction', $order['auctionId']) }}">Auction {{ substr($order['auctionId'], -8) }}</a>@endif</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell><x-status-pill :tone="$order['status']">{{ ucwords(str_replace('_', ' ', $order['status'])) }}</x-status-pill></x-ui.table-cell>
                        <x-ui.table-cell>€{{ number_format($order['totalCents'] / 100, 2) }} / €{{ number_format($order['refundedCents'] / 100, 2) }}</x-ui.table-cell>
                        <x-ui.table-cell><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $order['buyerId']) }}">{{ substr($order['buyerId'], -8) }}</a></x-ui.table-cell>
                        <x-ui.table-cell><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $order['producerId']) }}">{{ substr($order['producerId'], -8) }}</a></x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $order['createdAt'] }}">{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
