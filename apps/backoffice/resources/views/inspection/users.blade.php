@extends('layouts.app')

@section('title', 'Users | DWC Backoffice')

@section('content')
<main class="workspace inspection-workspace">
    <x-page-heading eyebrow="Administration / Inspection" title="Users" />
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
                <x-field label="Role"><span>{{ ucfirst($user['role']) }}</span></x-field>
                <x-field label="Producer status"><span>{{ $user['producerStatus'] ? ucfirst($user['producerStatus']) : 'Not applicable' }}</span></x-field>
                <x-field label="Buyer standing"><span>{{ $user['role'] === 'buyer' ? ucfirst($user['buyerStatus'] ?? 'active') : 'Not applicable' }}</span></x-field>
                <x-field label="Farm / city"><span>{{ collect([$user['farmName'], $user['city']])->filter()->join(' · ') ?: '—' }}</span></x-field>
                <x-field label="Created"><time datetime="{{ $user['createdAt'] }}">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></x-field>
            </li>
        @empty
            <li class="inspection-empty">No users match these filters.</li>
        @endforelse
    </ul>
    @include('inspection.pagination')
</main>
@endsection
