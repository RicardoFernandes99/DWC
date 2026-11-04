@extends('layouts.app')

@section('title', 'Service unavailable | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Backoffice</p>
    <h1>Sign-in unavailable</h1>
    <p>The administrator service could not be reached. Try again in a moment.</p>
    <a class="text-link" href="{{ route('login') }}">Return to sign in</a>
</main>
@endsection
