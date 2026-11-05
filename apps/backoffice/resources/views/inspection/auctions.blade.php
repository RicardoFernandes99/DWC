@extends('layouts.app')

@section('title', 'Auctions | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection</p>
    <div class="inspection-heading"><h1>Auctions</h1><a class="back-link" href="{{ route('home') }}">Back to administration</a></div>
    @include('inspection.nav')
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <form class="inspection-filter-form" method="get" action="{{ route('inspection.auctions') }}">
        <details id="inspection-filter-disclosure" class="inspection-filter-disclosure" open>
            <summary>Filters</summary>
            <div class="inspection-filters">
        <label>Status<select name="status"><option value="">All statuses</option>@foreach (['scheduled', 'active', 'finished', 'cancelled'] as $value)<option value="{{ $value }}" @selected(request('status') === $value)>{{ ucfirst($value) }}</option>@endforeach</select></label>
        <label>Producer ID<input name="producerId" value="{{ request('producerId') }}" maxlength="24" pattern="[a-fA-F0-9]{24}" placeholder="24-character ID"></label>
        <label>Page size<select name="limit"><option value="20" @selected((int) request('limit', 20) === 20)>20</option><option value="50" @selected((int) request('limit', 20) === 50)>50</option></select></label><button class="quiet-button" type="submit">Apply filters</button><a class="filter-reset" href="{{ route('inspection.auctions') }}">Clear</a>
            </div>
        </details>
    </form>
    @include('inspection.filter-disclosure-script')
    <ul class="inspection-list" aria-label="Auctions">
        @forelse ($items as $auction)
            <li class="inspection-row">
                <div class="inspection-primary"><a class="inspection-link" href="{{ route('inspection.auction', $auction['id']) }}">{{ $auction['product']['name'] }}</a><span>{{ ucfirst($auction['status']) }} · {{ $auction['quantity'] }} {{ str_replace('_', ' ', $auction['product']['unit']) }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Current bid</span><span>{{ $auction['currentBidCents'] === null ? 'No bids' : '€'.number_format($auction['currentBidCents'] / 100, 2) }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Producer</span><a href="{{ route('inspection.user', $auction['producerId']) }}">{{ substr($auction['producerId'], -8) }}</a></div>
                <div class="inspection-secondary"><span class="inspection-label">Starts</span><time datetime="{{ $auction['startsAt'] }}">{{ \Carbon\Carbon::parse($auction['startsAt'])->format('j M Y, H:i') }}</time></div>
                <div class="inspection-secondary"><span class="inspection-label">Ends</span><time datetime="{{ $auction['endsAt'] }}">{{ \Carbon\Carbon::parse($auction['endsAt'])->format('j M Y, H:i') }}</time></div>
            </li>
        @empty
            <li class="inspection-empty">No auctions match these filters.</li>
        @endforelse
    </ul>
    @include('inspection.pagination')
</main>
@endsection
