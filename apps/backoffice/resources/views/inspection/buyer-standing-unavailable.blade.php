@extends('layouts.app')

@section('title', 'Buyer decision unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Administration / Inspection / Users" title="Could not confirm the buyer decision" :href="route('inspection.user', $id)" link="Review buyer status">
    @if ($notSent ?? false)
        <p>The current administrator check could not complete, so the decision was not sent. Your reason is saved for this session.</p>
    @else
        <p>The request may have reached the API, but the backoffice did not receive a usable response. Review the buyer’s current status before submitting another decision.</p>
    @endif
    @if ($action === 'suspend' && $reason)<x-note title="Reason entered">{{ $reason }}</x-note>@endif
</x-message>
@endsection
