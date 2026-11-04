@extends('layouts.app')

@section('title', 'Decision outcome unavailable | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Producer decision</p>
    <h1>Decision outcome unavailable</h1>
    @if ($notSent)
        <p>The administrator check could not reach the service. The {{ $action }} decision was not sent. Your reason draft is saved.</p>
    @else
        <p>The connection ended before the backoffice could confirm the {{ $action }} result. Check the producer’s current status before choosing another action.</p>
    @endif
    @if ($reason)
        <div class="draft-reason unavailable-draft">
            <strong>Your reason draft is saved here.</strong>
            <p>{{ $reason }}</p>
        </div>
    @endif
    <a class="text-link" href="{{ route('producer-applications.show', $id) }}">Refresh producer status</a>
</main>
@endsection
