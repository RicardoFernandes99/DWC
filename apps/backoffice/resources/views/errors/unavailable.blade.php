@extends('layouts.app')

@section('title', 'Service unavailable | DWC Backoffice')

@section('content')
<x-message eyebrow="Backoffice" title="Sign-in unavailable" :href="route('login')" link="Return to sign in">
    <p>The administrator service could not be reached. Try again in a moment.</p>
</x-message>
@endsection
