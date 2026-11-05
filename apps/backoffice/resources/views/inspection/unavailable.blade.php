@extends('layouts.app')

@section('title', 'Inspection unavailable | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Administration / Inspection</p>
    <h1>Inspection data unavailable</h1>
    <p>The inspection service did not return usable data. No changes were made.</p>
    <a class="text-link" href="{{ route($routeName, $routeParameters ?? []) }}">Try again</a>
</main>
@endsection
