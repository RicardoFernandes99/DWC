@extends('layouts.app')

@section('title', 'Administrator sign in | DWC Backoffice')

@section('content')
<main class="auth-layout">
    <section class="auth-form-side" aria-labelledby="login-title">
        <div class="auth-form-content">
            <p class="eyebrow">Administrator access</p>
            <h1 id="login-title">Sign in to the backoffice</h1>
            <p class="auth-intro">Use your administrator account to continue.</p>

            @if (session('notice'))
                <x-alert>{{ session('notice') }}</x-alert>
            @endif
            @if ($errors->has('credentials'))
                <x-alert type="error">{{ $errors->first('credentials') }}</x-alert>
            @endif

            <form class="auth-form" method="post" action="{{ route('login.submit') }}">
                @csrf
                <div class="field">
                    <label for="email">Email address</label>
                    <input id="email" name="email" type="email" autocomplete="username" inputmode="email" maxlength="254" value="{{ old('email') }}" required autofocus aria-describedby="email-error">
                    @error('email')<span class="field-error" id="email-error">{{ $message }}</span>@enderror
                </div>
                <div class="field">
                    <label for="password">Password</label>
                    <input id="password" name="password" type="password" autocomplete="current-password" maxlength="72" required aria-describedby="password-error">
                    @error('password')<span class="field-error" id="password-error">{{ $message }}</span>@enderror
                </div>
                <button class="primary-button" type="submit">Sign in</button>
            </form>
        </div>
    </section>
    <figure class="auth-image">
        <img src="{{ asset('images/countryside.jpg') }}" alt="">
        <figcaption>From farm to table</figcaption>
    </figure>
</main>
@endsection
