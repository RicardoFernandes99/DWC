@extends('layouts.app')

@section('title', 'Auction inspection | DWC Backoffice')

@section('content')
@php($link = 'underline underline-offset-4')
<x-page>
    <x-back-link :href="route('inspection.auctions')">← Auctions</x-back-link>
    <x-page-heading eyebrow="Administration / Inspection / Auctions" :title="$auction['product']['name']">
        Auction {{ $auction['id'] }}
        <x-slot:aside><x-status-pill :tone="$auction['status']">{{ ucfirst($auction['status']) }}</x-status-pill></x-slot:aside>
    </x-page-heading>

    <x-section title="Auction details">
        <x-facts>
            <x-fact label="Auction ID" mono>{{ $auction['id'] }}</x-fact>
            <x-fact label="Product ID" mono>{{ $auction['productId'] }}</x-fact>
            <x-fact label="Producer"><a class="{{ $link }}" href="{{ route('inspection.user', $auction['producer']['id']) }}">{{ $auction['producer']['name'] ?? $auction['producer']['id'] }}</a>{{ $auction['producer']['email'] ? ' · '.$auction['producer']['email'] : '' }}</x-fact>
            <x-fact label="Quantity">{{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</x-fact>
            <x-fact label="Starting price">€{{ number_format($auction['startingPriceCents'] / 100, 2) }}</x-fact>
            <x-fact label="Minimum increment">€{{ number_format($auction['minimumIncrementCents'] / 100, 2) }}</x-fact>
            <x-fact label="Current bid">{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</x-fact>
            <x-fact label="Current bidder">@if ($auction['currentBidderId'])<a class="{{ $link }}" href="{{ route('inspection.user', $auction['currentBidderId']) }}">{{ $auction['currentBidderName'] ?? $auction['currentBidderId'] }}</a>@else — @endif</x-fact>
            <x-fact label="Last bid">{{ $auction['lastBidAt'] ? \Carbon\Carbon::parse($auction['lastBidAt'])->format('j M Y, H:i') : '—' }}</x-fact>
            <x-fact label="Starts">{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</x-fact>
            <x-fact label="Ends">{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</x-fact>
            <x-fact label="Revision">{{ $auction['revision'] }}</x-fact>
        </x-facts>
        <x-copy title="Product snapshot">
            <p>{{ $auction['product']['description'] }}</p>
            <p>{{ ucfirst($auction['product']['category']) }} · {{ ucfirst($auction['product']['productionMethod']) }} · {{ collect($auction['product']['seasons'])->map(fn ($season) => ucwords(str_replace('_', ' ', $season)))->join(', ') }}</p>
        </x-copy>
    </x-section>

    @if ($auction['settlement']['order'] || $auction['settlement']['payment'])
        <x-section title="Settlement">
            @if ($auction['settlement']['order'])
                <h3 class="text-sm font-semibold">Settlement order</h3>
                <x-facts>
                    <x-fact label="Order"><a class="{{ $link }}" href="{{ route('inspection.order', $auction['settlement']['order']['id']) }}">{{ $auction['settlement']['order']['id'] }}</a></x-fact>
                    <x-fact label="Order status / stored total">{{ ucwords(str_replace('_', ' ', $auction['settlement']['order']['status'])) }} · €{{ number_format($auction['settlement']['order']['totalCents'] / 100, 2) }}</x-fact>
                    <x-fact label="Payment ID" mono>{{ $auction['settlement']['order']['paymentId'] }}</x-fact>
                    <x-fact label="Buyer"><a class="{{ $link }}" href="{{ route('inspection.user', $auction['settlement']['order']['buyerId']) }}">{{ $auction['settlement']['order']['buyerId'] }}</a></x-fact>
                    <x-fact label="Producer"><a class="{{ $link }}" href="{{ route('inspection.user', $auction['settlement']['order']['producerId']) }}">{{ $auction['settlement']['order']['producerId'] }}</a></x-fact>
                </x-facts>
            @endif
            @if ($auction['settlement']['payment'])
                <h3 class="text-sm font-semibold">Settlement payment</h3>
                <x-facts>
                    <x-fact label="Payment ID" mono>{{ $auction['settlement']['payment']['id'] }}</x-fact>
                    <x-fact label="Payment status">{{ ucfirst($auction['settlement']['payment']['status']) }}</x-fact>
                    <x-fact label="Amount / refunded">€{{ number_format($auction['settlement']['payment']['amountCents'] / 100, 2) }} / €{{ number_format($auction['settlement']['payment']['refundedCents'] / 100, 2) }}</x-fact>
                    <x-fact label="Buyer"><a class="{{ $link }}" href="{{ route('inspection.user', $auction['settlement']['payment']['buyerId']) }}">{{ $auction['settlement']['payment']['buyerId'] }}</a></x-fact>
                </x-facts>
            @endif
        </x-section>
    @endif

    <x-section title="Bid history">
        @if ($auction['bidHistory']['items'] === [])
            <p class="text-muted-foreground text-sm">No bids have been accepted.</p>
        @else
            <x-ui.table aria-label="Bid history">
                <x-ui.table-header>
                    <x-ui.table-row class="hover:bg-transparent">
                        <x-ui.table-head>Bidder</x-ui.table-head>
                        <x-ui.table-head>Amount</x-ui.table-head>
                        <x-ui.table-head>Accepted</x-ui.table-head>
                        <x-ui.table-head>Auction end after bid</x-ui.table-head>
                        <x-ui.table-head>Revision</x-ui.table-head>
                    </x-ui.table-row>
                </x-ui.table-header>
                <x-ui.table-body>
                    @foreach ($auction['bidHistory']['items'] as $bid)
                        <x-ui.table-row>
                            <x-ui.table-cell>
                                <a class="font-semibold {{ $link }}" href="{{ route('inspection.user', $bid['buyerId']) }}">{{ $bid['bidderName'] }}</a>
                                <div class="text-muted-foreground font-mono text-xs">{{ $bid['buyerId'] }}</div>
                            </x-ui.table-cell>
                            <x-ui.table-cell>€{{ number_format($bid['amountCents'] / 100, 2) }}</x-ui.table-cell>
                            <x-ui.table-cell><time datetime="{{ $bid['acceptedAt'] }}">{{ \Carbon\Carbon::parse($bid['acceptedAt'])->format('j M Y, H:i') }}</time></x-ui.table-cell>
                            <x-ui.table-cell><time datetime="{{ $bid['endsAt'] }}">{{ \Carbon\Carbon::parse($bid['endsAt'])->format('j M Y, H:i') }}</time></x-ui.table-cell>
                            <x-ui.table-cell>{{ $bid['revision'] }}</x-ui.table-cell>
                        </x-ui.table-row>
                    @endforeach
                </x-ui.table-body>
            </x-ui.table>
        @endif
        @include('inspection.pagination', ['page' => $auction['bidHistory']['page'], 'totalPages' => $auction['bidHistory']['totalPages'], 'total' => $auction['bidHistory']['total']])
    </x-section>
</x-page>
@endsection
