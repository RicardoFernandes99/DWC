@extends('layouts.app')

@section('title', 'Decision outcome unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Producer decision" title="Decision outcome unavailable" :href="route('producer-applications.show', $id)" link="Refresh producer status">
    @if ($notSent)
        <p>The administrator check could not reach the service. The {{ $action }} decision was not sent. Your reason draft is saved.</p>
    @else
        <p>The connection ended before the backoffice could confirm the {{ $action }} result. Check the producer’s current status before choosing another action.</p>
    @endif
    @if ($reason)
        <x-note title="Your reason draft is saved here.">{{ $reason }}</x-note>
    @endif
</x-message>
@endsection
