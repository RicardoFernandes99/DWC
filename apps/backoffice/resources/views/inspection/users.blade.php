@extends('layouts.app')

@section('title', 'Users | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection</p>
    <div class="inspection-heading"><h1>Users</h1><a class="back-link" href="{{ route('home') }}">Back to administration</a></div>
    @include('inspection.nav')
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <form class="inspection-filter-form" method="get" action="{{ route('inspection.users') }}">
        <details id="inspection-filter-disclosure" class="inspection-filter-disclosure" open>
            <summary>Filters</summary>
            <div class="inspection-filters">
        <label>Role<select name="role"><option value="">All roles</option>@foreach (['buyer', 'producer', 'admin'] as $value)<option value="{{ $value }}" @selected(request('role') === $value)>{{ ucfirst($value) }}</option>@endforeach</select></label>
        <label>Producer status<select name="producerStatus"><option value="">All statuses</option>@foreach (['pending', 'approved', 'rejected', 'suspended'] as $value)<option value="{{ $value }}" @selected(request('producerStatus') === $value)>{{ ucfirst($value) }}</option>@endforeach</select></label>
        <label>Page size<select name="limit"><option value="20" @selected((int) request('limit', 20) === 20)>20</option><option value="50" @selected((int) request('limit', 20) === 50)>50</option></select></label>
        <button class="quiet-button" type="submit">Apply filters</button>
        <a class="filter-reset" href="{{ route('inspection.users') }}">Clear</a>
            </div>
        </details>
    </form>
    @include('inspection.filter-disclosure-script')
    <ul class="inspection-list" aria-label="Users">
        @forelse ($items as $user)
            <li class="inspection-row">
                <div class="inspection-primary"><a class="inspection-link" href="{{ route('inspection.user', $user['id']) }}">{{ $user['name'] }}</a><span>{{ $user['email'] }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Role</span><span>{{ ucfirst($user['role']) }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Producer status</span><span>{{ $user['producerStatus'] ? ucfirst($user['producerStatus']) : 'Not applicable' }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Buyer standing</span><span>{{ $user['role'] === 'buyer' ? ucfirst($user['buyerStatus'] ?? 'active') : 'Not applicable' }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Farm / city</span><span>{{ collect([$user['farmName'], $user['city']])->filter()->join(' · ') ?: '—' }}</span></div>
                <div class="inspection-secondary"><span class="inspection-label">Created</span><time datetime="{{ $user['createdAt'] }}">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></div>
            </li>
        @empty
            <li class="inspection-empty">No users match these filters.</li>
        @endforelse
    </ul>
    @include('inspection.pagination')
</main>
@endsection
