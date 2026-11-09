@extends('layouts.app')

@section('title', 'Order inspection | DWC Backoffice')

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Orders</p>
    <x-back-link :href="route('inspection.orders')">Back to orders</x-back-link>
    <div class="inspection-heading"><div><h1>Order {{ substr($order['id'], -8) }}</h1><p class="page-intro">{{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }} fulfilment</p></div><x-status-pill :tone="$order['status']">{{ ucwords(str_replace('_', ' ', $order['status'])) }}</x-status-pill></div>
    <p><a class="primary-button" href="{{ route('inspection.order.receipt', $order['id']) }}">Download purchase receipt</a></p>
    @include('inspection.nav')
    <x-section title="Order summary">
        <dl class="inspection-facts">
            <x-fact label="Order ID" mono>{{ $order['id'] }}</x-fact>
            <x-fact label="Created">{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Subtotal">€{{ number_format($order['subtotalCents'] / 100, 2) }}</x-fact>
            <x-fact label="Delivery fee">€{{ number_format($order['deliveryFeeCents'] / 100, 2) }}</x-fact>
            <x-fact label="Stored total">€{{ number_format($order['totalCents'] / 100, 2) }}</x-fact>
            <x-fact label="Refunded">€{{ number_format($order['refundedCents'] / 100, 2) }}</x-fact>
            <x-fact label="Revision">{{ $order['revision'] }}</x-fact>
        </dl></x-section>
    <x-section title="People and payment">
        <dl class="inspection-facts">
            <x-fact label="Buyer"><a href="{{ route('inspection.user', $order['buyer']['id']) }}">{{ $order['buyer']['name'] ?? $order['buyer']['id'] }}</a>{{ $order['buyer']['email'] ? ' · '.$order['buyer']['email'] : '' }}</x-fact>
            <x-fact label="Producer"><a href="{{ route('inspection.user', $order['producer']['id']) }}">{{ $order['producer']['name'] ?? $order['producer']['id'] }}</a>{{ $order['producer']['email'] ? ' · '.$order['producer']['email'] : '' }}</x-fact>
            <x-fact label="Payment ID" mono>{{ $order['paymentId'] }}</x-fact>
            @if ($order['payment'])<x-fact label="Payment status / amount">{{ ucfirst($order['payment']['status']) }} · €{{ number_format($order['payment']['amountCents'] / 100, 2) }}</x-fact>@endif
            @if ($order['checkoutId'])<x-fact label="Checkout ID" mono>{{ $order['checkoutId'] }}</x-fact>@endif
            @if ($order['auctionId'])<x-fact label="Auction"><a href="{{ route('inspection.auction', $order['auctionId']) }}">{{ $order['auctionId'] }}</a></x-fact>@endif
        </dl></x-section>
    <x-section title="Items">
        <ul class="inspection-list item-list">@forelse ($order['items'] as $item)<li class="inspection-row"><div class="inspection-primary"><span class="inspection-link">{{ $item['productName'] }}</span><span>{{ $item['quantity'] }} {{ str_replace('_', ' ', $item['productUnit']) }} × €{{ number_format($item['unitPriceCents'] / 100, 2) }}</span></div><x-field label="Stored line total"><span>€{{ number_format($item['lineTotalCents'] / 100, 2) }}</span></x-field><x-field label="Product ID"><span class="inspection-id">{{ $item['productId'] }}</span></x-field></li>@empty<li class="inspection-empty">No order items were returned.</li>@endforelse</ul></x-section>
    @if ($order['refundRequest'] || $order['refundAllocation'])
        <x-section title="Refund history">
            @if ($order['refundRequest'])<h3 class="inspection-subheading">Refund request</h3><dl class="inspection-facts"><x-fact label="Request status">{{ ucfirst($order['refundRequest']['status']) }}</x-fact><x-fact label="Requested by"><a href="{{ route('inspection.user', $order['refundRequest']['requestedBy']) }}">{{ $order['refundRequest']['requestedBy'] }}</a></x-fact><x-fact label="Requested">{{ $order['refundRequest']['requestedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['requestedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact><x-fact label="Refund amount">{{ $order['refundRequest']['refundedCents'] === null ? '—' : '€'.number_format($order['refundRequest']['refundedCents'] / 100, 2) }}</x-fact><x-fact label="Decided by">@if ($order['refundRequest']['decidedBy'])<a href="{{ route('inspection.user', $order['refundRequest']['decidedBy']) }}">{{ $order['refundRequest']['decidedBy'] }}</a>@else — @endif</x-fact><x-fact label="Decision time">{{ $order['refundRequest']['decidedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['decidedAt'])->format('j M Y, H:i') : '—' }}</x-fact></dl>@if ($order['refundRequest']['reason'])<div class="inspection-copy"><h3>Reason</h3><p>{{ $order['refundRequest']['reason'] }}</p></div>@endif @endif
            @if ($order['refundAllocation'])<h3 class="inspection-subheading">Refund allocation</h3><dl class="inspection-facts"><x-fact label="Allocation payment" mono>{{ $order['refundAllocation']['paymentId'] }}</x-fact><x-fact label="Refund completed">{{ $order['refundAllocation']['refundedAt'] ? \Carbon\Carbon::parse($order['refundAllocation']['refundedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact></dl>@endif</x-section>
    @endif
    <x-section title="Status history">
        <ul class="inspection-history">@forelse ($order['statusHistory'] as $entry)<li><div><strong>{{ ucwords(str_replace('_', ' ', $entry['status'])) }}</strong><span>{{ ucfirst($entry['actorRole']) }} · <a href="{{ route('inspection.user', $entry['actorId']) }}">{{ $entry['actorId'] }}</a></span></div><time>{{ $entry['timestamp'] ? \Carbon\Carbon::parse($entry['timestamp'])->format('j M Y, H:i') : 'Unknown' }}</time>@if ($entry['note'])<p>{{ $entry['note'] }}</p>@endif</li>@empty<li class="inspection-empty">No status history was returned.</li>@endforelse</ul></x-section>
</main>
@endsection
