@extends('layouts.app')

@section('title', 'Buyer decision unavailable | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Administration / Inspection / Users</p>
    <h1>Could not confirm the buyer decision</h1>
    @if ($notSent ?? false)
        <p>The current administrator check could not complete, so the decision was not sent. Your reason is saved for this session.</p>
    @else
        <p>The request may have reached the API, but the backoffice did not receive a usable response. Review the buyer’s current status before submitting another decision.</p>
    @endif
    @if ($action === 'suspend' && $reason)<p><strong>Reason entered:</strong> {{ $reason }}</p>@endif
    <a class="text-link" href="{{ route('inspection.user', $id) }}">Review buyer status</a>
</main>
@endsection
