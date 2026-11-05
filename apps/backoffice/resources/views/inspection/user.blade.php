@extends('layouts.app')

@section('title', 'User inspection | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Users</p>
    <a class="back-link" href="{{ route('inspection.users') }}">Back to users</a>
    <div class="inspection-heading"><div><h1>{{ $user['name'] }}</h1><p class="page-intro">{{ $user['email'] }}</p></div><span class="status-pill status-{{ $user['producerStatus'] ?? 'neutral' }}">{{ ucfirst($user['role']) }}{{ $user['producerStatus'] ? ' · '.ucfirst($user['producerStatus']) : '' }}</span></div>
    @include('inspection.nav')
    <section class="inspection-section">
        <h2>Account</h2>
        <dl class="inspection-facts">
            <div><dt>User ID</dt><dd class="inspection-id">{{ $user['id'] }}</dd></div>
            <div><dt>Created</dt><dd>{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div>
            <div><dt>Updated</dt><dd>{{ $user['updatedAt'] ? \Carbon\Carbon::parse($user['updatedAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div>
            <div><dt>Farm</dt><dd>{{ $user['farmName'] ?? '—' }}</dd></div>
            <div><dt>City</dt><dd>{{ $user['city'] ?? '—' }}</dd></div>
        </dl>
    </section>
    @if ($user['producerApplication'])
        <section class="inspection-section">
            <h2>Producer application</h2>
            <dl class="inspection-facts">
                <div><dt>Farm name</dt><dd>{{ $user['producerApplication']['farmName'] }}</dd></div>
                <div><dt>City</dt><dd>{{ $user['producerApplication']['city'] }}</dd></div>
                <div><dt>Submitted</dt><dd>{{ $user['producerApplication']['submittedAt'] ? \Carbon\Carbon::parse($user['producerApplication']['submittedAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div>
            </dl>
            <div class="inspection-copy"><h3>Description</h3><p>{{ $user['producerApplication']['description'] }}</p></div>
        </section>
    @endif
    @if ($user['producerDecisionRevision'] > 0 || $user['producerDecisionBy'] || $user['producerDecisionAt'] || $user['producerRejectionReason'] || $user['producerSuspensionReason'])
        <section class="inspection-section"><h2>Latest producer decision</h2>
            <dl class="inspection-facts"><div><dt>Revision</dt><dd>{{ $user['producerDecisionRevision'] }}</dd></div><div><dt>Decision by</dt><dd>@if ($user['producerDecisionBy'])<a href="{{ route('inspection.user', $user['producerDecisionBy']) }}">{{ $user['producerDecisionBy'] }}</a>@else — @endif</dd></div><div><dt>Decision time</dt><dd>{{ $user['producerDecisionAt'] ? \Carbon\Carbon::parse($user['producerDecisionAt'])->format('j M Y, H:i') : 'Unknown' }}</dd></div></dl>
            @if ($user['producerRejectionReason'])<div class="inspection-copy"><h3>Rejection reason</h3><p>{{ $user['producerRejectionReason'] }}</p></div>@endif
            @if ($user['producerSuspensionReason'])<div class="inspection-copy"><h3>Suspension reason</h3><p>{{ $user['producerSuspensionReason'] }}</p></div>@endif
        </section>
    @endif
</main>
@endsection
