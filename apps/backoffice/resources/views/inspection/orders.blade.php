@extends('layouts.app')

@section('title', 'Orders | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection</p>
    <div class="inspection-heading"><h1>Orders</h1><a class="back-link" href="{{ route('home') }}">Back to administration</a></div>
    @include('inspection.nav')
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <form class="inspection-filter-form" method="get" action="{{ route('inspection.orders') }}">
        <details id="inspection-filter-disclosure" class="inspection-filter-disclosure" open>
            <summary>Filters</summary>
            <div class="inspection-filters">
        <label>Status<select name="status"><option value="">All statuses</option>@foreach (['pending', 'confirmed', 'shipped', 'delivered', 'ready_for_collection', 'collected', 'cancelled'] as $value)<option value="{{ $value }}" @selected(request('status') === $value)>{{ ucwords(str_replace('_', ' ', $value)) }}</option>@endforeach</select></label>
        <label>Origin<select name="origin"><option value="">All origins</option>@foreach (['catalogue', 'auction'] as $value)<option value="{{ $value }}" @selected(request('origin') === $value)>{{ ucfirst($value) }}</option>@endforeach</select></label>
        <label>Fulfilment<select name="fulfilmentMethod"><option value="">All methods</option>@foreach (['delivery', 'collection'] as $value)<option value="{{ $value }}" @selected(request('fulfilmentMethod') === $value)>{{ ucfirst($value) }}</option>@endforeach</select></label>
        <label>Buyer ID<input name="buyerId" value="{{ request('buyerId') }}" inputmode="text" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID"></label>
        <label>Producer ID<input name="producerId" value="{{ request('producerId') }}" inputmode="text" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID"></label>
        <label>Page size<select name="limit"><option value="20" @selected((int) request('limit', 20) === 20)>20</option><option value="50" @selected((int) request('limit', 20) === 50)>50</option></select></label><button class="quiet-button" type="submit">Apply filters</button><a class="filter-reset" href="{{ route('inspection.orders') }}">Clear</a>
            </div>
        </details>
    </form>
    @include('inspection.filter-disclosure-script')
    <ul class="inspection-list" aria-label="Orders">
        @forelse ($items as $order)
            <li class="inspection-row order-row">
                <div class="inspection-primary"><a class="inspection-link" href="{{ route('inspection.order', $order['id']) }}">Order {{ substr($order['id'], -8) }}</a><span>{{ ucfirst($order['origin']) }} · {{ ucfirst($order['fulfilmentMethod']) }} · {{ ucwords(str_replace('_', ' ', $order['status'])) }}@if ($order['auctionId']) · <a class="inspection-related-link" href="{{ route('inspection.auction', $order['auctionId']) }}">Auction {{ substr($order['auctionId'], -8) }}</a>@endif</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Total / refunded</span><span>€{{ number_format($order['totalCents'] / 100, 2) }} / €{{ number_format($order['refundedCents'] / 100, 2) }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Buyer</span><a href="{{ route('inspection.user', $order['buyerId']) }}">{{ substr($order['buyerId'], -8) }}</a></div>
                <div class="inspection-secondary"><span class="inspection-label">Producer</span><a href="{{ route('inspection.user', $order['producerId']) }}">{{ substr($order['producerId'], -8) }}</a></div>
                <div class="inspection-secondary"><span class="inspection-label">Created</span><time datetime="{{ $order['createdAt'] }}">{{ $order['createdAt'] ? \Carbon\Carbon::parse($order['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></div>
            </li>
        @empty
            <li class="inspection-empty">No orders match these filters.</li>
        @endforelse
    </ul>
    @include('inspection.pagination')
</main>
@endsection
