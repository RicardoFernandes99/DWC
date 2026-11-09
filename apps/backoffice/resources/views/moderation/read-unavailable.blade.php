@extends('layouts.app')

@section('title', 'Moderation unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Administration / Content" title="Moderation unavailable" :href="route($routeName, $routeParameters ?? [])" link="Refresh moderation data">
    <p>The moderation service did not return usable data. No moderation action was sent.</p>
</x-message>
@endsection
