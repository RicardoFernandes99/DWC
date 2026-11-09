@extends('layouts.app')

@section('title', 'Auction inspection | DWC Backoffice')

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Auctions</p>
    <x-back-link :href="route('inspection.auctions')">Back to auctions</x-back-link>
    <div class="inspection-heading"><div><h1>{{ $auction['product']['name'] }}</h1><p class="page-intro">Auction {{ $auction['id'] }}</p></div><x-status-pill :tone="$auction['status']">{{ ucfirst($auction['status']) }}</x-status-pill></div>
    @include('inspection.nav')
    <x-section title="Auction details">
        <dl class="inspection-facts">
            <x-fact label="Auction ID" mono>{{ $auction['id'] }}</x-fact>
            <x-fact label="Product ID" mono>{{ $auction['productId'] }}</x-fact>
            <x-fact label="Producer"><a href="{{ route('inspection.user', $auction['producer']['id']) }}">{{ $auction['producer']['name'] ?? $auction['producer']['id'] }}</a>{{ $auction['producer']['email'] ? ' · '.$auction['producer']['email'] : '' }}</x-fact>
            <x-fact label="Quantity">{{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</x-fact>
            <x-fact label="Starting price">€{{ number_format($auction['startingPriceCents'] / 100, 2) }}</x-fact>
            <x-fact label="Minimum increment">€{{ number_format($auction['minimumIncrementCents'] / 100, 2) }}</x-fact>
            <x-fact label="Current bid">{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</x-fact>
            <x-fact label="Current bidder">@if ($auction['currentBidderId'])<a href="{{ route('inspection.user', $auction['currentBidderId']) }}">{{ $auction['currentBidderName'] ?? $auction['currentBidderId'] }}</a>@else — @endif</x-fact>
            <x-fact label="Last bid">{{ $auction['lastBidAt'] ? \Carbon\Carbon::parse($auction['lastBidAt'])->format('j M Y, H:i') : '—' }}</x-fact>
            <x-fact label="Starts">{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</x-fact>
            <x-fact label="Ends">{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</x-fact>
            <x-fact label="Revision">{{ $auction['revision'] }}</x-fact>
        </dl>
        <div class="inspection-copy"><h3>Product snapshot</h3><p>{{ $auction['product']['description'] }}</p><p>{{ ucfirst($auction['product']['category']) }} · {{ ucfirst($auction['product']['productionMethod']) }} · {{ collect($auction['product']['seasons'])->map(fn ($season) => ucwords(str_replace('_', ' ', $season)))->join(', ') }}</p></div></x-section>
    @if ($auction['settlement']['order'] || $auction['settlement']['payment'])
        <x-section title="Settlement">
            @if ($auction['settlement']['order'])<h3 class="inspection-subheading">Settlement order</h3><dl class="inspection-facts"><x-fact label="Order"><a href="{{ route('inspection.order', $auction['settlement']['order']['id']) }}">{{ $auction['settlement']['order']['id'] }}</a></x-fact><x-fact label="Order status / stored total">{{ ucwords(str_replace('_', ' ', $auction['settlement']['order']['status'])) }} · €{{ number_format($auction['settlement']['order']['totalCents'] / 100, 2) }}</x-fact><x-fact label="Payment ID" mono>{{ $auction['settlement']['order']['paymentId'] }}</x-fact><x-fact label="Buyer"><a href="{{ route('inspection.user', $auction['settlement']['order']['buyerId']) }}">{{ $auction['settlement']['order']['buyerId'] }}</a></x-fact><x-fact label="Producer"><a href="{{ route('inspection.user', $auction['settlement']['order']['producerId']) }}">{{ $auction['settlement']['order']['producerId'] }}</a></x-fact></dl>@endif
            @if ($auction['settlement']['payment'])<h3 class="inspection-subheading">Settlement payment</h3><dl class="inspection-facts"><x-fact label="Payment ID" mono>{{ $auction['settlement']['payment']['id'] }}</x-fact><x-fact label="Payment status">{{ ucfirst($auction['settlement']['payment']['status']) }}</x-fact><x-fact label="Amount / refunded">€{{ number_format($auction['settlement']['payment']['amountCents'] / 100, 2) }} / €{{ number_format($auction['settlement']['payment']['refundedCents'] / 100, 2) }}</x-fact><x-fact label="Buyer"><a href="{{ route('inspection.user', $auction['settlement']['payment']['buyerId']) }}">{{ $auction['settlement']['payment']['buyerId'] }}</a></x-fact></dl>@endif</x-section>
    @endif
    <x-section title="Bid history">
        <ul class="inspection-list">@forelse ($auction['bidHistory']['items'] as $bid)<li class="inspection-row"><div class="inspection-primary"><a class="inspection-link" href="{{ route('inspection.user', $bid['buyerId']) }}">{{ $bid['bidderName'] }}</a><span>{{ $bid['buyerId'] }}</span></div><x-field label="Amount"><span>€{{ number_format($bid['amountCents'] / 100, 2) }}</span></x-field><x-field label="Accepted"><time datetime="{{ $bid['acceptedAt'] }}">{{ \Carbon\Carbon::parse($bid['acceptedAt'])->format('j M Y, H:i') }}</time></x-field><x-field label="Auction end after bid"><time datetime="{{ $bid['endsAt'] }}">{{ \Carbon\Carbon::parse($bid['endsAt'])->format('j M Y, H:i') }}</time></x-field><x-field label="Revision"><span>{{ $bid['revision'] }}</span></x-field></li>@empty<li class="inspection-empty">No bids have been accepted.</li>@endforelse</ul>
        @include('inspection.pagination', ['page' => $auction['bidHistory']['page'], 'totalPages' => $auction['bidHistory']['totalPages'], 'total' => $auction['bidHistory']['total']])</x-section>
</main>
@endsection
