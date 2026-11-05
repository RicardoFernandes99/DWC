@extends('layouts.app')

@section('title', 'Moderation unavailable | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Administration / Content</p>
    <h1>Moderation unavailable</h1>
    <p>The moderation service did not return usable data. No moderation action was sent.</p>
    <a class="text-link" href="{{ route($routeName, $routeParameters ?? []) }}">Refresh moderation data</a>
</main>
@endsection
