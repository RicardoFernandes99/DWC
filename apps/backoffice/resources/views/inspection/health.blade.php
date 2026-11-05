@extends('layouts.app')

@section('title', 'Service health | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace health-workspace">
    <p class="eyebrow">Administration / Inspection</p>
    <div class="inspection-heading"><div><h1>Service health</h1><p class="page-intro">{{ $health['status'] === 'ok' ? 'All reported dependencies are responding.' : 'One or more dependencies need attention.' }}</p></div><a class="quiet-button health-refresh" href="{{ route('inspection.health') }}">Refresh checks</a></div>
    @include('inspection.nav')
    <p class="health-checked">Last check completed <time datetime="{{ $checkedAt }}">{{ \Carbon\Carbon::parse($checkedAt)->format('j M Y, H:i:s T') }}</time></p>
    <p class="health-overall status-pill {{ $health['status'] === 'ok' ? 'status-approved' : 'status-suspended' }}">{{ ucfirst($health['status']) }}</p>
    <ul class="health-list">
        @foreach (['api' => 'API', 'mongodb' => 'MongoDB', 'redis' => 'Redis', 'storage' => 'Object storage'] as $key => $label)
            <li><div><h2>{{ $label }}</h2><span class="status-pill {{ $health[$key] === 'up' ? 'status-approved' : 'status-suspended' }}">{{ ucfirst($health[$key]) }}</span></div>@if ($key !== 'api')<p>{{ number_format($health[$key.'LatencyMs']) }} ms</p>@endif</li>
        @endforeach
    </ul>
</main>
@endsection
