@extends('layouts.app')

@section('title', 'Moderation unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Administration / Content" :title="$notSent ? 'Hide decision not sent' : 'Hide outcome unknown'" :href="route($kind === 'product' ? 'moderation.product' : 'moderation.review', $id)" link="Refresh content state">
    @if ($notSent)
        <p>The administrator check could not reach the service. The hide request was not sent. Your reason draft is saved for this {{ $kind }}.</p>
    @else
        <p>The service did not return a confirmed result. The hide request may have reached the server. Refresh the content state before deciding whether to act again. Your reason draft is saved for this {{ $kind }}.</p>
    @endif
    @if ($reason !== '')<x-note title="Saved reason draft">{{ $reason }}</x-note>@endif
</x-message>
@endsection
