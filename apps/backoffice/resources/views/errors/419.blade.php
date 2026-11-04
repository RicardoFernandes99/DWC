@extends('layouts.app')

@section('title', 'Form expired | DWC Backoffice')

@section('content')
<main class="message-page" role="main">
    <p class="eyebrow">Backoffice</p>
    <h1>This form has expired</h1>
    <p>Refresh the page and try again.</p>
    <a class="text-link" href="{{ route('login') }}">Return to sign in</a>
</main>
@endsection
