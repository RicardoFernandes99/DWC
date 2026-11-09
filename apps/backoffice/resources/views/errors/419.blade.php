@extends('layouts.app')

@section('title', 'Form expired | DWC Backoffice')

@section('content')
<x-message eyebrow="Backoffice" title="This form has expired" :href="route('login')" link="Return to sign in">
    <p>Refresh the page and try again.</p>
</x-message>
@endsection
