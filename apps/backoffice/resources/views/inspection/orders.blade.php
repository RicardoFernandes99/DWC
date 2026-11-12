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
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">Order</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Status</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Total / refunded</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Buyer</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Producer</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Created</th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $order)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="px-4 py-3 align-middle">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.order', $order['id']) }}">Order {{ substr($order['id'], -8) }}</a>
                            <div class="text-muted-foreground text-xs">{{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }}@if ($order['auctionId']) · <a class="underline-offset-4 hover:underline" href="{{ route('inspection.auction', $order['auctionId']) }}">Auction {{ substr($order['auctionId'], -8) }}</a>@endif</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap"><x-status-pill :tone="$order['status']">{{ ucwords(str_replace('_', ' ', $order['status'])) }}</x-status-pill></td>
                        <td class="p-2 align-middle whitespace-nowrap">€{{ number_format($order['totalCents'] / 100, 2) }} / €{{ number_format($order['refundedCents'] / 100, 2) }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $order['buyerId']) }}">{{ substr($order['buyerId'], -8) }}</a></td>
                        <td class="p-2 align-middle whitespace-nowrap"><a class="underline-offset-4 hover:underline" href="{{ route('inspection.user', $order['producerId']) }}">{{ substr($order['producerId'], -8) }}</a></td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $order['createdAt'] }}">{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></td>
                    </tr>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
