@extends('layouts.app')

@section('title', 'Inspection unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Administration / Inspection" title="Inspection data unavailable" :href="route($routeName, $routeParameters ?? [])" link="Try again">
    <p>The inspection service did not return usable data. No changes were made.</p>
</x-message>
@endsection
