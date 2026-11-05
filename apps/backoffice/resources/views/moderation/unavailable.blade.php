@extends('layouts.app')

@section('title', 'Moderation unavailable | DWC Backoffice')

@section('content')
<main class="message-page">
    <p class="eyebrow">Administration / Content</p>
    <h1>{{ $notSent ? 'Hide decision not sent' : 'Hide outcome unknown' }}</h1>
    @if ($notSent)
        <p>The administrator check could not reach the service. The hide request was not sent. Your reason draft is saved for this {{ $kind }}.</p>
    @else
        <p>The service did not return a confirmed result. The hide request may have reached the server. Refresh the content state before deciding whether to act again. Your reason draft is saved for this {{ $kind }}.</p>
    @endif
    @if ($reason !== '')<div class="draft-reason"><strong>Saved reason draft</strong><p>{{ $reason }}</p></div>@endif
    <a class="text-link" href="{{ route($kind === 'product' ? 'moderation.product' : 'moderation.review', $id) }}">Refresh content state</a>
</main>
@endsection
