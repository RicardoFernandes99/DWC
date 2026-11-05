@extends('layouts.app')

@section('title', 'Order inspection | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Orders</p>
    <a class="back-link" href="{{ route('inspection.orders') }}">Back to orders</a>
    <div class="inspection-heading"><div><h1>Order {{ substr($order['id'], -8) }}</h1><p class="page-intro">{{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }} fulfilment</p></div><span class="status-pill status-{{ $order['status'] }}">{{ ucwords(str_replace('_', ' ', $order['status'])) }}</span></div>
    @include('inspection.nav')
    <section class="inspection-section"><h2>Order summary</h2>
        <dl class="inspection-facts">
            <div><dt>Order ID</dt><dd class="inspection-id">{{ $order['id'] }}</dd></div>
            <div><dt>Created</dt><dd>{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div>
            <div><dt>Subtotal</dt><dd>€{{ number_format($order['subtotalCents'] / 100, 2) }}</dd></div>
            <div><dt>Delivery fee</dt><dd>€{{ number_format($order['deliveryFeeCents'] / 100, 2) }}</dd></div>
            <div><dt>Stored total</dt><dd>€{{ number_format($order['totalCents'] / 100, 2) }}</dd></div>
            <div><dt>Refunded</dt><dd>€{{ number_format($order['refundedCents'] / 100, 2) }}</dd></div>
            <div><dt>Revision</dt><dd>{{ $order['revision'] }}</dd></div>
        </dl>
    </section>
    <section class="inspection-section"><h2>People and payment</h2>
        <dl class="inspection-facts">
            <div><dt>Buyer</dt><dd><a href="{{ route('inspection.user', $order['buyer']['id']) }}">{{ $order['buyer']['name'] ?? $order['buyer']['id'] }}</a>{{ $order['buyer']['email'] ? ' · '.$order['buyer']['email'] : '' }}</dd></div>
            <div><dt>Producer</dt><dd><a href="{{ route('inspection.user', $order['producer']['id']) }}">{{ $order['producer']['name'] ?? $order['producer']['id'] }}</a>{{ $order['producer']['email'] ? ' · '.$order['producer']['email'] : '' }}</dd></div>
            <div><dt>Payment ID</dt><dd class="inspection-id">{{ $order['paymentId'] }}</dd></div>
            @if ($order['payment'])<div><dt>Payment status / amount</dt><dd>{{ ucfirst($order['payment']['status']) }} · €{{ number_format($order['payment']['amountCents'] / 100, 2) }}</dd></div>@endif
            @if ($order['checkoutId'])<div><dt>Checkout ID</dt><dd class="inspection-id">{{ $order['checkoutId'] }}</dd></div>@endif
            @if ($order['auctionId'])<div><dt>Auction</dt><dd><a href="{{ route('inspection.auction', $order['auctionId']) }}">{{ $order['auctionId'] }}</a></dd></div>@endif
        </dl>
    </section>
    <section class="inspection-section"><h2>Items</h2>
        <ul class="inspection-list item-list">@forelse ($order['items'] as $item)<li class="inspection-row"><div class="inspection-primary"><span class="inspection-link">{{ $item['productName'] }}</span><span>{{ $item['quantity'] }} {{ str_replace('_', ' ', $item['productUnit']) }} × €{{ number_format($item['unitPriceCents'] / 100, 2) }}</span></div><div class="inspection-secondary"><span class="inspection-label">Stored line total</span><span>€{{ number_format($item['lineTotalCents'] / 100, 2) }}</span></div><div class="inspection-secondary"><span class="inspection-label">Product ID</span><span class="inspection-id">{{ $item['productId'] }}</span></div></li>@empty<li class="inspection-empty">No order items were returned.</li>@endforelse</ul>
    </section>
    @if ($order['refundRequest'] || $order['refundAllocation'])
        <section class="inspection-section"><h2>Refund history</h2>
            @if ($order['refundRequest'])<h3 class="inspection-subheading">Refund request</h3><dl class="inspection-facts"><div><dt>Request status</dt><dd>{{ ucfirst($order['refundRequest']['status']) }}</dd></div><div><dt>Requested by</dt><dd><a href="{{ route('inspection.user', $order['refundRequest']['requestedBy']) }}">{{ $order['refundRequest']['requestedBy'] }}</a></dd></div><div><dt>Requested</dt><dd>{{ $order['refundRequest']['requestedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['requestedAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div><div><dt>Refund amount</dt><dd>{{ $order['refundRequest']['refundedCents'] === null ? '—' : '€'.number_format($order['refundRequest']['refundedCents'] / 100, 2) }}</dd></div><div><dt>Decided by</dt><dd>@if ($order['refundRequest']['decidedBy'])<a href="{{ route('inspection.user', $order['refundRequest']['decidedBy']) }}">{{ $order['refundRequest']['decidedBy'] }}</a>@else — @endif</dd></div><div><dt>Decision time</dt><dd>{{ $order['refundRequest']['decidedAt'] ? \Carbon\Carbon::parse($order['refundRequest']['decidedAt'])->format('j M Y, H:i') : '—' }}</dd></div></dl>@if ($order['refundRequest']['reason'])<div class="inspection-copy"><h3>Reason</h3><p>{{ $order['refundRequest']['reason'] }}</p></div>@endif @endif
            @if ($order['refundAllocation'])<h3 class="inspection-subheading">Refund allocation</h3><dl class="inspection-facts"><div><dt>Allocation payment</dt><dd class="inspection-id">{{ $order['refundAllocation']['paymentId'] }}</dd></div><div><dt>Refund completed</dt><dd>{{ $order['refundAllocation']['refundedAt'] ? \Carbon\Carbon::parse($order['refundAllocation']['refundedAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div></dl>@endif
        </section>
    @endif
    <section class="inspection-section"><h2>Status history</h2>
        <ul class="inspection-history">@forelse ($order['statusHistory'] as $entry)<li><div><strong>{{ ucwords(str_replace('_', ' ', $entry['status'])) }}</strong><span>{{ ucfirst($entry['actorRole']) }} · <a href="{{ route('inspection.user', $entry['actorId']) }}">{{ $entry['actorId'] }}</a></span></div><time>{{ $entry['timestamp'] ? \Carbon\Carbon::parse($entry['timestamp'])->format('j M Y, H:i') : 'Unknown' }}</time>@if ($entry['note'])<p>{{ $entry['note'] }}</p>@endif</li>@empty<li class="inspection-empty">No status history was returned.</li>@endforelse</ul>
    </section>
</main>
@endsection
