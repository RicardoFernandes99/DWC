@extends('layouts.app')

@section('title', 'Order inspection | DWC Backoffice')

@section('content')
@php($link = 'underline underline-offset-4')
<x-page>
    <x-back-link :href="route('inspection.orders')">← Orders</x-back-link>
    <x-page-heading eyebrow="Administration / Inspection / Orders" :title="'Order '.substr($order['id'], -8)">
        {{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }} fulfilment
        <x-slot:aside>
            <div class="flex items-center gap-3">
                <x-status-pill :tone="$order['status']">{{ ucwords(str_replace('_', ' ', $order['status'])) }}</x-status-pill>
                <x-ui.button :href="route('inspection.order.receipt', $order['id'])" size="sm">Download purchase receipt</x-ui.button>
            </div>
        </x-slot:aside>
    </x-page-heading>

    <x-section title="Order summary">
        <x-facts>
            <x-fact label="Order ID" mono>{{ $order['id'] }}</x-fact>
            <x-fact label="Created">{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Subtotal">€{{ number_format($order['subtotalCents'] / 100, 2) }}</x-fact>
            <x-fact label="Delivery fee">€{{ number_format($order['deliveryFeeCents'] / 100, 2) }}</x-fact>
            <x-fact label="Stored total">€{{ number_format($order['totalCents'] / 100, 2) }}</x-fact>
            <x-fact label="Refunded">€{{ number_format($order['refundedCents'] / 100, 2) }}</x-fact>
            <x-fact label="Revision">{{ $order['revision'] }}</x-fact>
        </x-facts>
    </x-section>

    <x-section title="People and payment">
        <x-facts>
            <x-fact label="Buyer"><a class="{{ $link }}" href="{{ route('inspection.user', $order['buyer']['id']) }}">{{ $order['buyer']['name'] ?? $order['buyer']['id'] }}</a>{{ $order['buyer']['email'] ? ' · '.$order['buyer']['email'] : '' }}</x-fact>
            <x-fact label="Producer"><a class="{{ $link }}" href="{{ route('inspection.user', $order['producer']['id']) }}">{{ $order['producer']['name'] ?? $order['producer']['id'] }}</a>{{ $order['producer']['email'] ? ' · '.$order['producer']['email'] : '' }}</x-fact>
            <x-fact label="Payment ID" mono>{{ $order['paymentId'] }}</x-fact>
            @if ($order['payment'])<x-fact label="Payment status / amount">{{ ucfirst($order['payment']['status']) }} · €{{ number_format($order['payment']['amountCents'] / 100, 2) }}</x-fact>@endif
            @if ($order['checkoutId'])<x-fact label="Checkout ID" mono>{{ $order['checkoutId'] }}</x-fact>@endif
            @if ($order['auctionId'])<x-fact label="Auction"><a class="{{ $link }}" href="{{ route('inspection.auction', $order['auctionId']) }}">{{ $order['auctionId'] }}</a></x-fact>@endif
        </x-facts>
    </x-section>

    <x-section title="Items">
        @if ($order['items'] === [])
            <p class="text-muted-foreground text-sm">No order items were returned.</p>
        @else
            <x-ui.table aria-label="Order items">
                <x-ui.table-header>
                    <tr class="border-b">
                        <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Product</th>
                        <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Stored line total</th>
                        <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Product ID</th>
                    </tr>
                </x-ui.table-header>
                <x-ui.table-body>
                    @foreach ($order['items'] as $item)
                        <tr class="hover:bg-muted/50 border-b transition-colors">
                            <td class="p-2 align-middle whitespace-nowrap">
                                <span class="font-semibold">{{ $item['productName'] }}</span>
                                <div class="text-muted-foreground text-xs">{{ $item['quantity'] }} {{ str_replace('_', ' ', $item['productUnit']) }} × €{{ number_format($item['unitPriceCents'] / 100, 2) }}</div>
                            </td>
                            <td class="p-2 align-middle whitespace-nowrap">€{{ number_format($item['lineTotalCents'] / 100, 2) }}</td>
                            <td class="p-2 align-middle whitespace-nowrap font-mono text-xs">{{ $item['productId'] }}</td>
                        </tr>
                    @endforeach
                </x-ui.table-body>
            </x-ui.table>
        @endif
    </x-section>

    @if ($order['refundRequest'] || $order['refundAllocation'])
        <x-section title="Refund history">
            @if ($order['refundRequest'])
                <h3 class="text-sm font-semibold">Refund request</h3>
                <x-facts>
                    <x-fact label="Request status">{{ ucfirst($order['refundRequest']['status']) }}</x-fact>
                    <x-fact label="Requested by"><a class="{{ $link }}" href="{{ route('inspection.user', $order['refundRequest']['requestedBy']) }}">{{ $order['refundRequest']['requestedBy'] }}</a></x-fact>
                    <x-fact label="Requested">{{ $order['refundRequest']['requestedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['requestedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
                    <x-fact label="Refund amount">{{ $order['refundRequest']['refundedCents'] === null ? '—' : '€'.number_format($order['refundRequest']['refundedCents'] / 100, 2) }}</x-fact>
                    <x-fact label="Decided by">@if ($order['refundRequest']['decidedBy'])<a class="{{ $link }}" href="{{ route('inspection.user', $order['refundRequest']['decidedBy']) }}">{{ $order['refundRequest']['decidedBy'] }}</a>@else — @endif</x-fact>
                    <x-fact label="Decision time">{{ $order['refundRequest']['decidedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['decidedAt'])->format('j M Y, H:i') : '—' }}</x-fact>
                </x-facts>
                @if ($order['refundRequest']['reason'])<x-copy title="Reason">{{ $order['refundRequest']['reason'] }}</x-copy>@endif
            @endif
            @if ($order['refundAllocation'])
                <h3 class="text-sm font-semibold">Refund allocation</h3>
                <x-facts>
                    <x-fact label="Allocation payment" mono>{{ $order['refundAllocation']['paymentId'] }}</x-fact>
                    <x-fact label="Refund completed">{{ $order['refundAllocation']['refundedAt'] ? \Carbon\Carbon::parse($order['refundAllocation']['refundedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
                </x-facts>
            @endif
        </x-section>
    @endif

    <x-section title="Status history">
        @if ($order['statusHistory'] === [])
            <p class="text-muted-foreground text-sm">No status history was returned.</p>
        @else
            <ol class="flex flex-col divide-y">
                @foreach ($order['statusHistory'] as $entry)
                    <li class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div class="flex flex-wrap justify-between gap-2">
                            <strong class="text-sm">{{ ucwords(str_replace('_', ' ', $entry['status'])) }}</strong>
                            <time class="text-muted-foreground text-xs">{{ $entry['timestamp'] ? \Carbon\Carbon::parse($entry['timestamp'])->format('j M Y, H:i') : 'Unknown' }}</time>
                        </div>
                        <span class="text-muted-foreground text-xs">{{ ucfirst($entry['actorRole']) }} · <a class="{{ $link }}" href="{{ route('inspection.user', $entry['actorId']) }}">{{ $entry['actorId'] }}</a></span>
                        @if ($entry['note'])<p class="text-sm">{{ $entry['note'] }}</p>@endif
                    </li>
                @endforeach
            </ol>
        @endif
    </x-section>
</x-page>
@endsection
