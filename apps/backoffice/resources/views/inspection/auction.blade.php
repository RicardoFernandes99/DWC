@extends('layouts.app')

@section('title', 'Auction inspection | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Auctions</p>
    <a class="back-link" href="{{ route('inspection.auctions') }}">Back to auctions</a>
    <div class="inspection-heading"><div><h1>{{ $auction['product']['name'] }}</h1><p class="page-intro">Auction {{ $auction['id'] }}</p></div><span class="status-pill status-{{ $auction['status'] }}">{{ ucfirst($auction['status']) }}</span></div>
    @include('inspection.nav')
    <section class="inspection-section"><h2>Auction details</h2>
        <dl class="inspection-facts">
            <div><dt>Auction ID</dt><dd class="inspection-id">{{ $auction['id'] }}</dd></div>
            <div><dt>Product ID</dt><dd class="inspection-id">{{ $auction['productId'] }}</dd></div>
            <div><dt>Producer</dt><dd><a href="{{ route('inspection.user', $auction['producer']['id']) }}">{{ $auction['producer']['name'] ?? $auction['producer']['id'] }}</a>{{ $auction['producer']['email'] ? ' · '.$auction['producer']['email'] : '' }}</dd></div>
            <div><dt>Quantity</dt><dd>{{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</dd></div>
            <div><dt>Starting price</dt><dd>€{{ number_format($auction['startingPriceCents'] / 100, 2) }}</dd></div>
            <div><dt>Minimum increment</dt><dd>€{{ number_format($auction['minimumIncrementCents'] / 100, 2) }}</dd></div>
            <div><dt>Current bid</dt><dd>{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</dd></div>
            <div><dt>Current bidder</dt><dd>@if ($auction['currentBidderId'])<a href="{{ route('inspection.user', $auction['currentBidderId']) }}">{{ $auction['currentBidderName'] ?? $auction['currentBidderId'] }}</a>@else — @endif</dd></div>
            <div><dt>Last bid</dt><dd>{{ $auction['lastBidAt'] ? \Carbon\Carbon::parse($auction['lastBidAt'])->format('j M Y, H:i') : '—' }}</dd></div>
            <div><dt>Starts</dt><dd>{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</dd></div>
            <div><dt>Ends</dt><dd>{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</dd></div>
            <div><dt>Revision</dt><dd>{{ $auction['revision'] }}</dd></div>
        </dl>
        <div class="inspection-copy"><h3>Product snapshot</h3><p>{{ $auction['product']['description'] }}</p><p>{{ ucfirst($auction['product']['category']) }} · {{ ucfirst($auction['product']['productionMethod']) }} · {{ collect($auction['product']['seasons'])->map(fn ($season) => ucwords(str_replace('_', ' ', $season)))->join(', ') }}</p></div>
    </section>
    @if ($auction['settlement']['order'] || $auction['settlement']['payment'])
        <section class="inspection-section"><h2>Settlement</h2>
            @if ($auction['settlement']['order'])<h3 class="inspection-subheading">Settlement order</h3><dl class="inspection-facts"><div><dt>Order</dt><dd><a href="{{ route('inspection.order', $auction['settlement']['order']['id']) }}">{{ $auction['settlement']['order']['id'] }}</a></dd></div><div><dt>Order status / stored total</dt><dd>{{ ucwords(str_replace('_', ' ', $auction['settlement']['order']['status'])) }} · €{{ number_format($auction['settlement']['order']['totalCents'] / 100, 2) }}</dd></div><div><dt>Payment ID</dt><dd class="inspection-id">{{ $auction['settlement']['order']['paymentId'] }}</dd></div><div><dt>Buyer</dt><dd><a href="{{ route('inspection.user', $auction['settlement']['order']['buyerId']) }}">{{ $auction['settlement']['order']['buyerId'] }}</a></dd></div><div><dt>Producer</dt><dd><a href="{{ route('inspection.user', $auction['settlement']['order']['producerId']) }}">{{ $auction['settlement']['order']['producerId'] }}</a></dd></div></dl>@endif
            @if ($auction['settlement']['payment'])<h3 class="inspection-subheading">Settlement payment</h3><dl class="inspection-facts"><div><dt>Payment ID</dt><dd class="inspection-id">{{ $auction['settlement']['payment']['id'] }}</dd></div><div><dt>Payment status</dt><dd>{{ ucfirst($auction['settlement']['payment']['status']) }}</dd></div><div><dt>Amount / refunded</dt><dd>€{{ number_format($auction['settlement']['payment']['amountCents'] / 100, 2) }} / €{{ number_format($auction['settlement']['payment']['refundedCents'] / 100, 2) }}</dd></div><div><dt>Buyer</dt><dd><a href="{{ route('inspection.user', $auction['settlement']['payment']['buyerId']) }}">{{ $auction['settlement']['payment']['buyerId'] }}</a></dd></div></dl>@endif
        </section>
    @endif
    <section class="inspection-section"><h2>Bid history</h2>
        <ul class="inspection-list">@forelse ($auction['bidHistory']['items'] as $bid)<li class="inspection-row"><div class="inspection-primary"><a class="inspection-link" href="{{ route('inspection.user', $bid['buyerId']) }}">{{ $bid['bidderName'] }}</a><span>{{ $bid['buyerId'] }}</span></div><div class="inspection-secondary"><span class="inspection-label">Amount</span><span>€{{ number_format($bid['amountCents'] / 100, 2) }}</span></div><div class="inspection-secondary"><span class="inspection-label">Accepted</span><time datetime="{{ $bid['acceptedAt'] }}">{{ \Carbon\Carbon::parse($bid['acceptedAt'])->format('j M Y, H:i') }}</time></div><div class="inspection-secondary"><span class="inspection-label">Auction end after bid</span><time datetime="{{ $bid['endsAt'] }}">{{ \Carbon\Carbon::parse($bid['endsAt'])->format('j M Y, H:i') }}</time></div><div class="inspection-secondary"><span class="inspection-label">Revision</span><span>{{ $bid['revision'] }}</span></div></li>@empty<li class="inspection-empty">No bids have been accepted.</li>@endforelse</ul>
        @include('inspection.pagination', ['page' => $auction['bidHistory']['page'], 'totalPages' => $auction['bidHistory']['totalPages'], 'total' => $auction['bidHistory']['total']])
    </section>
</main>
@endsection
